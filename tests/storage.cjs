/**
 * Purpose: Verify domain validation, exclusion storage and background decisions.
 * Covers hostname boundaries, legacy IDs, duplicates, add/delete/clear operations,
 * asynchronous reads, failures and parent/frame exclusion matching.
 * Loads real TypeScript with a mocked Chrome API; no browser required.
 * Run: pnpm test.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

// Mock state lets scenarios simulate storage errors without a browser.
let saved = {},
  failRead = false,
  failWrite = false;
let listener;

// Delayed reads catch exclusions that return before storage has finished.
const chrome = {
  storage: {
    sync: {
      get: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (failRead) {
          throw Error('offline');
        }

        return saved;
      },
      set: async (value) => {
        if (failWrite) {
          throw Error('quota');
        }

        saved = { ...saved, ...value };
      },
    },
  },
  runtime: {
    onMessage: {
      addListener: (value) => {
        listener = value;
      },
    },
  },
};

// Execute real TypeScript modules in an isolated context with the Chrome mock.
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) {
    return cache.get(file);
  }

  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    chrome,
    URL,
    crypto: require('node:crypto').webcrypto,
    require: (name) => load(path.resolve(path.dirname(file), name + '.ts')),
  });
  return exports;
}
(async () => {

  // Validate normalization and hostname boundaries before testing persistence.
  const helper = load('src/utils/helpers.ts');
  const storage = load('src/utils/storageManager.ts');
  assert.equal(helper.isValidUrlOrHostname(' HTTPS://EXAMPLE.com/path ').hostname, 'example.com');
  assert.equal(helper.isValidUrlOrHostname('localhost:3000').hostname, 'localhost');
  for (const input of [
    '',
    'ftp://example.com',
    'https://user:secret@example.com',
    'bad host',
    '-bad.com',
    'javascript:alert(1)',
  ]) {
    assert.equal(helper.isValidUrlOrHostname(input).valid, false, input);
  }

  assert.equal(helper.hostnameMatches('sub.example.com', 'example.com'), true);
  assert.equal(helper.hostnameMatches('notexample.com', 'example.com'), false);
  assert.equal(helper.hostnameMatches('example.com.evil.test', 'example.com'), false);

  // Legacy entries retain their IDs during upgrades.
  saved = { cfIgnoredSites: [{ id: 'legacy', hostname: 'EXAMPLE.COM' }] };
  assert.equal((await storage.getIgnoredSites())[0].id, 'legacy');
  assert.equal(await storage.shouldIgnoreSite('https://sub.example.com'), true);
  assert.equal(await storage.shouldIgnoreSite('https://notexample.com'), false);
  await assert.rejects(storage.storeSite('example.com/path'), /duplicateDomain/);
  await storage.storeSite('other.example');
  assert.equal(saved.cfIgnoredSites.length, 2);

  // Write failures must reject so the options UI can show an error.
  failWrite = true;
  await assert.rejects(storage.storeSite('quota.example'), /quota/);
  await assert.rejects(storage.deleteSite('legacy'), /quota/);
  failWrite = false;

  // Failed reads propagate; the background listener must then exclude the page.
  failRead = true;
  await assert.rejects(storage.getIgnoredSites(), /offline/);
  failRead = false;

  // After storage recovers, deletion and clearing must work normally again.
  await storage.deleteSite('legacy');
  assert.equal(await storage.shouldIgnoreSite('https://example.com'), false);
  await storage.clearSites();
  assert.equal(saved.cfIgnoredSites.length, 0);
  await storage.storeSite('example.com');
  load('src/background.ts');

  // Exercise the real message listener with parent and cross-origin frame URLs.
  const checkFrame = (sender) =>
    new Promise((resolve) => {
      assert.equal(listener({ type: 'checkIgnoredSite' }, sender, resolve), true);
    });
  assert.equal(
    (
      await checkFrame({
        tab: { url: 'https://example.com' },
        url: 'https://third-party.test/frame',
      })
    ).ignored,
    true,
  );
  assert.equal(
    (await checkFrame({ tab: { url: 'https://unrelated.test' }, url: 'https://example.com/frame' }))
      .ignored,
    true,
  );
  assert.equal(
    (
      await checkFrame({
        tab: { url: 'https://unrelated.test' },
        url: 'https://third-party.test/frame',
      })
    ).ignored,
    false,
  );

  // Failed reads propagate; the background listener must then exclude the page.
  failRead = true;
  assert.equal((await checkFrame({ url: 'https://unrelated.test' })).ignored, true);

  console.log(
    'PASS: storage, normalization, failure propagation and cross-origin exclusion checks',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
