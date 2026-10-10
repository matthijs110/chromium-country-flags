/**
 * Purpose: Check generated extension assets for completeness and consistency.
 * Covers manifest/version consistency, popup resources, WOFF2 signature,
 * English/Dutch message coverage (sanity check) and absence of eval in production bundles.
 * Inspects dist without a browser. Run after building: pnpm run test:package.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Inspect generated output: source files alone cannot prove packaging is correct.
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const manifest = json('dist/manifest.json');
assert.equal(manifest.version, json('package.json').version);
assert.equal(manifest.version, '2.1.0');

// Every manifest entry point and resource must exist and contain data.
const files = [
  manifest.background.service_worker,
  manifest.options_ui.page,
  manifest.action.default_popup,
  'popup/popup.js',
  'update/update.html',
  'update/update.js',
  'css/dist.css',
  ...manifest.content_scripts.flatMap((script) => script.js),
  ...Object.values(manifest.icons),
  ...manifest.web_accessible_resources.flatMap((resource) => resource.resources),
];
for (const file of files) {
  assert.ok(fs.statSync(path.join('dist', file)).size > 0, file);
}

// Verify the WOFF2 signature rather than trusting the asset's filename.
assert.equal(
  fs.readFileSync('dist/fonts/TwemojiCountryFlags.woff2').subarray(0, 4).toString(),
  'wOF2',
);

// Dutch must cover all English fallback message keys.
// This is a sanity check for the translation coverage, not a check of the translation quality.
const en = json('dist/_locales/en/messages.json');
const nl = json('dist/_locales/nl/messages.json');
for (const key of Object.keys(en)) {
  assert.ok(nl[key]?.message, 'Dutch translation: ' + key);
}

// Catch bundler settings that introduce eval, which Manifest V3 disallows.
for (const script of ['content.js', 'contentHead.js', 'background.js', 'options/options.js', 'popup/popup.js', 'update/update.js']) {
  assert.ok(
    !/\beval\(/.test(fs.readFileSync(path.join('dist', script), 'utf8')),
    'No eval in ' + script,
  );
}

// Assertions throw before reaching this success message.
console.log(
  'PASS: packaged manifest, assets, translation coverage and extension CSP bundle checks',
);
