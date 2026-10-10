/**
 * Purpose: Run production scripts and UI against deterministic browser fixtures.
 * Covers browser-checks.js, real font loading, exclusions, options validation,
 * storage failures and popup add/remove/parent-domain handling.
 * Chrome APIs are mocked; DOM and CSS run in a real headless Chrome/Edge browser.
 * Run after building dist: pnpm run test:browser.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const browserPath =
  process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Keep this test run separate from installed extensions and regular browsing.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-fixer-test-'));
let browser, server, socket;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock extension APIs to reproduce storage failures and external updates.
const mock = `
window.testSaved = {};
window.testIgnored = false;
window.testFail = false;
window.testListeners = [];

window.chrome = {
 tabs: { query: async () => [{url: 'https://blog.example.com/page'}] },
 runtime: { getURL: value => '/dist/' + value, sendMessage: async () => ({ignored: window.testIgnored}), openOptionsPage: async () => {} },
 i18n: { getUILanguage: () => 'nl', getMessage: (key, value) => {
   const entry = window.testMessages[key]; return entry ? entry.message.replace('$1', value || '') : '';
 } },
 storage: { sync: {
   get: async () => { if (window.testFail) throw Error('offline'); return structuredClone(window.testSaved); },
   set: async data => { if (window.testFail) throw Error('quota'); Object.assign(window.testSaved, data);
     window.testListeners.forEach(listener => listener({cfIgnoredSites: {}}, 'sync')); }
 }, onChanged: {addListener: listener => window.testListeners.push(listener)} }
};`;

(async () => {

  // Serve local fixtures and built resources; these tests do not contact live sites.
  server = http.createServer((request, response) => {
    const relative = decodeURIComponent(request.url.split('?')[0]);
    const file = path.resolve('.' + relative);
    if (!file.startsWith(process.cwd() + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const type = file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html';
      response.setHeader('Content-Type', type);
      response.end(fs.readFileSync(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );

  // Chromium publishes the random DevTools port after startup.
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) {
    await delay(100);
  }

  if (!fs.existsSync(portFile)) {
    throw Error('Browser debugging port did not start');
  }

  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => socket.once('open', resolve));

  // Route asynchronous DevTools replies by ID and time out missing responses.
  const waiting = new Map();
  let sequence = 0;
  socket.on('message', (message) => {
    const result = JSON.parse(message);
    if (waiting.has(result.id)) {
      const { resolve, reject, timeout } = waiting.get(result.id);
      waiting.delete(result.id);
      clearTimeout(timeout);
      result.error ? reject(Error(JSON.stringify(result.error))) : resolve(result.result);
    }
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => {
        waiting.delete(id);
        reject(Error(`Timeout: ${method}`));
      }, 30000);
      waiting.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw Error(JSON.stringify(result.exceptionDetails));
    }

    return result.result.value;
  };

  // Install localized API mocks before the real page scripts execute.
  const messages = JSON.parse(
    fs.readFileSync('src/_locales/nl/messages.json', 'utf8').replace(/^\uFEFF/, ''),
  );
  await call('Page.enable');
  const init = await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.testMessages = ${JSON.stringify(messages)}; ${mock}`,
  });
  await call('Page.navigate', { url: base + '/tests/fixture.html' });
  await delay(300);

  // Run the production bundle against real DOM, fonts and MutationObserver behavior.
  const script = fs.readFileSync('dist/content.js', 'utf8');
  await evaluate(script);
  await evaluate(fs.readFileSync('tests/browser-checks.js', 'utf8'));
  const results = await evaluate('runBrowserChecks()');
  // Font file loading is separate from computed font-family assertions.
  const fontLoaded = await evaluate(
    `document.fonts.load('16px "Twemoji Country Flags"', '🇳🇱').then(fonts => fonts.length > 0)`,
  );
  results.push({ passed: fontLoaded, label: 'packaged font resource loads' });
  await call('Page.navigate', { url: base + '/tests/fixture.html' });
  await delay(150);
  await evaluate('window.testIgnored = true');
  await evaluate(script);
  await evaluate(fs.readFileSync('dist/contentHead.js', 'utf8'));
  await delay(100);
  results.push({
    passed: await evaluate(
      `!document.querySelector('#country-flag-fixer-ext-head') && !document.getElementById('initial').style.fontFamily`,
    ),
    label: 'ignored page untouched by both scripts',
  });
  await call('Page.navigate', { url: base + '/dist/options/options.html' });
  await delay(300);
  results.push({
    passed: await evaluate(
      `document.getElementById('options-title').textContent === 'Instellingen'`,
    ),
    label: 'Dutch options page translations',
  });
  results.push({
    passed: await evaluate(
      `document.getElementById('list-status').textContent === 'Er worden geen websites genegeerd.'`,
    ),
    label: 'empty options list',
  });
  await evaluate(
    `document.getElementById('domain-input').value = 'HTTPS://EXAMPLE.COM/path'; document.getElementById('add-domain-form').requestSubmit()`,
  );
  await delay(100);
  results.push({
    passed: await evaluate(
      `testSaved.cfIgnoredSites[0].hostname === 'example.com' && document.querySelectorAll('#sites-list li').length === 1`,
    ),
    label: 'add normalized domain through options UI',
  });
  await evaluate(
    `document.getElementById('domain-input').value = 'example.com'; document.getElementById('add-domain-form').requestSubmit()`,
  );
  await delay(100);
  results.push({
    passed: await evaluate(
      `document.getElementById('domain-input').getAttribute('aria-invalid') === 'true' && testSaved.cfIgnoredSites.length === 1`,
    ),
    label: 'duplicate domain validation',
  });
  await evaluate(`document.querySelector('#sites-list button').click()`);
  await delay(100);
  results.push({
    passed: await evaluate(
      `testSaved.cfIgnoredSites.length === 0 && document.querySelectorAll('#sites-list li').length === 0`,
    ),
    label: 'remove domain through options UI',
  });
  await evaluate(
    `testFail = true; document.getElementById('domain-input').value = 'other.example'; document.getElementById('add-domain-form').requestSubmit()`,
  );
  await delay(100);
  results.push({
    passed: await evaluate(
      `document.getElementById('form-message').textContent.includes('niet worden') && !document.getElementById('domain-input').disabled`,
    ),
    label: 'storage failure shown and form re-enabled',
  });
  await evaluate(
    `testFail = false; testSaved = {cfIgnoredSites:[{id:'external',hostname:'external.example'}]}; testListeners.forEach(listener => listener({cfIgnoredSites:{}}, 'sync'))`,
  );
  await delay(100);
  results.push({
    passed: await evaluate(
      `document.querySelector('#sites-list').textContent.includes('external.example')`,
    ),
    label: 'external storage changes refresh list',
  });
  results.push({
    passed: await evaluate(
      `getComputedStyle(document.querySelector('main')).maxWidth !== 'none' && getComputedStyle(document.querySelector('button')).backgroundColor !== 'rgba(0, 0, 0, 0)'`,
    ),
    label: 'compiled Tailwind CSS applied',
  });

  // Save visual evidence and report each check independently.
  const shot = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(profile, 'options.png'), Buffer.from(shot.data, 'base64'));
  console.log(`Options screenshot: ${path.join(profile, 'options.png')}`);

  // The toolbar popup shares the options storage but acts on the active tab's hostname.
  await call('Page.navigate', { url: base + '/dist/popup/popup.html' });
  await delay(200);
  results.push({
    passed: await evaluate(`document.getElementById('hostname').textContent === 'blog.example.com' && !document.getElementById('toggle').disabled`),
    label: 'popup reads active website',
  });
  await evaluate(`document.getElementById('toggle').click()`);
  await delay(100);
  results.push({
    passed: await evaluate(`testSaved.cfIgnoredSites[0].hostname === 'blog.example.com'`),
    label: 'popup adds current hostname to exclusions',
  });
  await evaluate(`document.getElementById('toggle').click()`);
  await delay(100);
  results.push({
    passed: await evaluate(`testSaved.cfIgnoredSites.length === 0`),
    label: 'popup removes current hostname exclusion',
  });
  await evaluate(`chrome.storage.sync.set({cfIgnoredSites:[{id:'parent',hostname:'example.com'}]})`);
  await delay(100);
  results.push({
    passed: await evaluate(`document.getElementById('toggle').disabled && document.getElementById('status').textContent.includes('example.com') && testSaved.cfIgnoredSites.length === 1`),
    label: 'popup preserves parent-domain exclusion and explains settings',
  });

  for (const result of results) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'}: ${result.label}`);
  }

  console.log(
    `${results.filter((result) => result.passed).length}/${results.length} passed in ${path.basename(browserPath)}`,
  );
  if (results.some((result) => !result.passed)) process.exitCode = 1;
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: init.identifier });
  await call('Browser.close');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })

  // Clean up sockets and processes after both successful and failed runs.
  .finally(() => {
    if (socket) socket.close();
    if (browser) browser.kill();
    if (server) server.close();
    // The temporary profile is intentionally retained for inspection.
  });
