# Changelog

## 2.1.0 — Fix flag rendering, reduce page interference and introduced site exclusions

- Apply AI-assisted troubleshooting.
- Show a one-time update page when existing users upgrade to 2.1.0, explaining the changes and linking to Settings.
- Add a toolbar popup to ignore or re-enable the current website. Exclusions inherited from a parent domain can be managed through the settings link.
- Migrate the extension to TypeScript.
- Introduce an ignored-websites options page with input validation, accessible controls, storage errors and synchronized lists.
- Replace global stylesheet font overrides and per-mutation whole-page scans with targeted, reversible handling of flag-bearing text containers.
- Support dynamically inserted and streamed text, subdivision flag sequences, relevant class/style changes and discovered open shadow roots.
- Restore original inline fonts when flags disappear and preserve host changes. Avoid touching editable content using standard HTML semantics.
- Add Chrome/Edge browser regressions and actual unpacked-extension integration checks. Targeted processing and restoration cases credit contributor PR #26.
- Update development dependencies and remove vulnerable obsolete tooling. Use pnpm 12.10.1 with a locked project-local Node 22 runtime.
- Keep translations only in `src/_locales`; reserve `public` for font/icon assets and move options CSS to its source directory.

These changes address mechanisms behind the reported compatibility problems. Live-site reports remain open until their reproduction steps have been verified.

## 2.0.2 — Ignore inherited fonts and non-screen stylesheets

[PR #6](https://github.com/matthijs110/chromium-country-flags/pull/6)

- Skip `font-family: inherit` declarations and stylesheets that do not apply to the screen.
- Fix incorrect fonts on sites such as [Archive of Our Own](https://archiveofourown.org/), where processing print-only stylesheets caused print fonts to appear on screen.

Original report screenshots: [expected rendering](https://github.com/matthijs110/chromium-country-flags/assets/4161158/fe5deeff-3420-4f3a-bf59-61e2ac44b485) and [incorrect rendering](https://github.com/matthijs110/chromium-country-flags/assets/4161158/fa1b4739-bf70-4d8c-a99a-c48950afecb4).

## 2.0.1 — Preserve fonts set by inline styles

[PR #5](https://github.com/matthijs110/chromium-country-flags/pull/5)

- Fix [issue #4](https://github.com/matthijs110/chromium-country-flags/issues/4), where extension-generated CSS overrode icon fonts set through inline styles.
- Check DOM elements for inline `font-family` declarations and add `!important` so those fonts take precedence over the extension's stylesheet overrides.

## 2.0.0 — Apply flag fonts through stylesheet selectors

- Replace per-element font changes with an additional stylesheet that prepends `Twemoji Country Flags` to font declarations using the site's existing selectors. Thanks to [@luuk777w](https://github.com/luuk777w) for this approach.
- Fix [issue #2](https://github.com/matthijs110/chromium-country-flags/issues/2), where the flag font could not be applied in some cases.
- Improve flag rendering on YouTube, where flags were sometimes missing.
