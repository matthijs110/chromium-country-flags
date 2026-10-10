/**
 * Purpose: Verify the production build as a real unpacked Chrome/Edge extension.
 * Covers service worker messaging, options persistence, packaged font loading,
 * and top-level/cross-origin iframe exclusions with local pages and a fresh profile.
 * No extension API mocks. Run after building dist: pnpm run test:integration.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const assert = require('node:assert/strict');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A disposable profile protects the developer's regular browser settings.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-fixer-integration-'));
let browser, server, socket;
(async () => {

  // Different hostnames on this server create a real cross-origin iframe.
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    const port = server.address().port;
    response.end(
      `<html><head><meta charset="utf-8"></head><body><p id="flag">🇳🇱</p>${request.url === '/top' ? `<iframe src="http://localhost:${port}/frame"></iframe>` : ''}</body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));

  // Enable extension debugging only in the disposable test browser.
  browser = spawn(
    process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-unsafe-extension-debugging',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );

  // Wait for Chromium to publish its randomly assigned debugging port.
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) {
    await delay(100);
  }

  assert.ok(fs.existsSync(portFile), 'Browser starts');
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.once('open', resolve));

  // Match asynchronous DevTools replies to their originating commands.
  let sequence = 0;
  const waiting = new Map();
  socket.on('message', (message) => {
    const result = JSON.parse(message);
    if (waiting.has(result.id)) {
      const entry = waiting.get(result.id);
      waiting.delete(result.id);
      clearTimeout(entry.timeout);
      result.error
        ? entry.reject(Error(JSON.stringify(result.error)))
        : entry.resolve(result.result);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => reject(Error('Timeout: ' + method)), 15000);
      waiting.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  // Load the production build as a real extension; no Chrome API mocks here.
  const extension = await call('Extensions.loadUnpacked', {
    path: path.resolve('dist'),
    enableInIncognito: false,
  });
  assert.ok(extension.id, 'Real unpacked extension loads');
  const target = await call('Target.createTarget', {
    url: `chrome-extension://${extension.id}/options/options.html`,
  });
  const attached = await call('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });

  // Evaluate checks inside the attached browser target rather than Node.
  const session = attached.sessionId;
  const evaluate = async (expression) => {
    const result = await call(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      session,
    );
    if (result.exceptionDetails) {
      throw Error(JSON.stringify(result.exceptionDetails));
    }

    return result.result.value;
  };
  await delay(300);
  assert.ok(
    await evaluate(`Boolean(document.getElementById('domain-input'))`),
    'Real options page loads',
  );
  await evaluate(`chrome.storage.sync.set({cfIgnoredSites: []})`);
  const url = `http://127.0.0.1:${server.address().port}/top`;
  await call('Page.navigate', { url }, session);
  await delay(500);
  assert.ok(
    await evaluate(
      `document.getElementById('flag').style.fontFamily.includes('Twemoji Country Flags')`,
    ),
    'Real service worker allows content script',
  );
  assert.ok(
    await evaluate(
      `document.fonts.load('16px "Twemoji Country Flags"', '🇳🇱').then(fonts => fonts.length > 0)`,
    ),
    'Real extension font resource loads',
  );

  // Site isolation can put the iframe in its own target; support either layout.
  const evaluateFrame = async (expression) => {
    const targets = await call('Target.getTargets');
    const frame = targets.targetInfos.find(
      (info) => info.type === 'iframe' && info.url.includes('/frame'),
    );
    if (frame) {
      const attachedFrame = await call('Target.attachToTarget', {
        targetId: frame.targetId,
        flatten: true,
      });
      return call('Runtime.evaluate', { expression, returnByValue: true }, attachedFrame.sessionId);
    }
    const tree = await call('Page.getFrameTree', {}, session);
    assert.ok(tree.frameTree.childFrames?.length, 'Cross-origin iframe loads');
    const world = await call(
      'Page.createIsolatedWorld',
      { frameId: tree.frameTree.childFrames[0].frame.id, worldName: 'test' },
      session,
    );
    return call(
      'Runtime.evaluate',
      { expression, contextId: world.executionContextId, returnByValue: true },
      session,
    );
  };

  // First prove the cross-origin frame works with no exclusions.
  const frameFont = await evaluateFrame(
    `document.getElementById('flag').style.fontFamily.includes('Twemoji Country Flags')`,
  );
  assert.equal(frameFont.result.value, true, 'Real cross-origin frame gets flags');

  // Add the parent exclusion through the real form, then revisit the same page.
  await call(
    'Page.navigate',
    { url: `chrome-extension://${extension.id}/options/options.html` },
    session,
  );
  await delay(200);
  await evaluate(
    `document.getElementById('domain-input').value='127.0.0.1'; document.getElementById('add-domain-form').requestSubmit()`,
  );
  await delay(200);
  assert.equal(
    await evaluate(
      `chrome.storage.sync.get('cfIgnoredSites').then(data => data.cfIgnoredSites[0].hostname)`,
    ),
    '127.0.0.1',
    'Real options UI persists exclusion',
  );
  await call('Page.navigate', { url }, session);
  await delay(400);
  assert.ok(
    await evaluate(
      `!document.getElementById('flag').style.fontFamily && !document.getElementById('country-flag-fixer-ext-head')`,
    ),
    'Real ignored top-level page untouched',
  );

  // The parent hostname must exclude the differently named frame as well.
  const ignoredFrame = await evaluateFrame(
    `!document.getElementById('flag').style.fontFamily && !document.getElementById('country-flag-fixer-ext-head')`,
  );
  assert.equal(ignoredFrame.result.value, true, 'Ignored parent excludes cross-origin iframe');

  console.log(
    'PASS: real unpacked extension, service worker, options persistence, font loading and top-level/cross-origin exclusion',
  );
  await call('Browser.close');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })

  // Release all test resources even when a check fails.
  .finally(() => {
    if (socket) socket.close();
    if (browser) browser.kill();
    if (server) server.close();
  });
