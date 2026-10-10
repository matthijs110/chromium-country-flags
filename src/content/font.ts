// Font source: https://github.com/talkjs/country-flag-emoji-polyfill
export const flagFont = 'Twemoji Country Flags';
export const fontStyleId = 'country-flag-fixer-ext-head';

/**
 * Register the packaged font once per document or discovered shadow root.
 * Registration makes the font available; it does not apply it to page text.
 */
export const registerFont = (root: Document | ShadowRoot): void => {
  if (root.getElementById(fontStyleId)) {
    return;
  }

  const parent = root instanceof Document ? root.head : root;

  if (!parent) {
    return;
  }

  const style = document.createElement('style');
  const url = chrome.runtime.getURL('fonts/TwemojiCountryFlags.woff2');

  style.id = fontStyleId;

  // Restrict the font to flag code points so ordinary letters and icon glyphs
  // continue to use the site's own fonts. Tag characters support subdivision flags.
  // An italic face prevents the browser from artificially slanting flag artwork.
  style.textContent = ['normal', 'italic']
    .map(
      (fontStyle) => `@font-face {
        font-family: "${flagFont}";
        font-style: ${fontStyle};
        font-weight: 100 900;
        src: url("${url}") format("woff2");
        unicode-range: U+1F1E6-1F1FF,U+1F3F4,U+E0062-E0063,U+E0065,U+E0067,U+E006C,U+E006E,U+E0073-E0074,U+E0077,U+E007F;
      }`,
    )
    .join('\n');

  parent.appendChild(style);
};
