# Country Flag Fixer | Chromium Extension
Currently, Chromium users (using Chrome or Microsoft Edge) on Windows are not able to see the flag emoji's. A country code is shown instead. This extention will replace those abbreviations with its corresponding flag using a special font.

![](https://i.imgur.com/fzljj7K.png)

## Download
This extention is available in the [Chrome Web Store](https://chrome.google.com/webstore/detail/country-flag-fixer/jhcpefjbhmbkgjgipkhndplfbhdecijh?utm_source=github&utm_medium=referral&utm_campaign=spreadtheword) and the [Microsoft Edge Add-on store](https://microsoftedge.microsoft.com/addons/detail/country-flag-fixer/nfkjcekokjacfnambbbdidjpgogkppmm)!

This extention uses the [Twemoji Country Flags](https://github.com/talkjs/country-flag-emoji-polyfill) font, which is based on [Twemoji](https://twitter.github.io/twemoji/) (licensed under [CC BY-ND 2.0](https://github.com/mozilla/twemoji-colr/blob/master/LICENSE.md)).

<a href="https://www.flaticon.com/free-icons/world" title="world icons">World icons created by turkkub - Flaticon</a>

## Development

The project uses pnpm 12.10.1. pnpm installs a project-local Node 22 runtime;
your system-wide Node installation does not need to be replaced. If installing
pnpm through npm, use Node 22.13 or newer for that initial installation.

```sh
pnpm install --frozen-lockfile
pnpm run verify
pnpm audit
```

Load `dist` as an unpacked extension in `chrome://extensions` or `edge://extensions`.
The production build uses `src/manifest.json` and `src/_locales` as its sources;
font and icon assets come from `public`. Tailwind styles only the options page,
using its official PostCSS plugin and `scripts/build-css.cjs`.
After `pnpm run build`, click Reload on the unpacked extension and reload the test page. A ZIP is only needed for distribution.

`public` contains ready-to-copy binary assets: `fonts` and `icons`. Editable
application files belong in `src`: TypeScript, options HTML/CSS, the manifest and
translations. There is one translation source, `src/_locales`; the build copies
it into `dist/_locales`. Generated output belongs in `dist`, not in either source
directory.

Code comments explain decisions such as observer-loop prevention, font restoration and hostname matching; blank lines separate logical steps.

Open the extension's options page to manage ignored domains. An entry applies to
that hostname and its subdomains, including embedded content on its pages.
Reload existing pages after changing the list. Settings are saved in browser sync
storage using the existing `cfIgnoredSites` key.

Click the extension's toolbar icon to ignore the current hostname or remove its
exclusion. Reload the page afterwards. If a parent domain already excludes the
website, the popup explains this and links to Settings rather than removing a
broader exclusion. Popup text is translated into all 35 existing locales.

## Rendering limits

The extension handles flag sequences in DOM text, including dynamic updates and
open shadow roots found during initialization or subtree processing. It leaves
editable content alone, using HTML semantics rather than editor-specific class names. Canvas-rendered text, closed
shadow roots, CSS-generated flags, and browser-restricted pages are not covered.
A shadow root attached later to an unchanged host is discovered on its next
observed subtree change. `designMode` changes reconcile on the next relevant DOM
mutation. CSSOM-only stylesheet edits and viewport/media changes without a DOM
mutation are not observed. Flags split across separate text nodes are not joined.

## Pull request checks

GitHub Actions builds and tests each pull request and push on Windows in Chrome and Edge, and audits dependencies. See tests/README.md for the test layers.
