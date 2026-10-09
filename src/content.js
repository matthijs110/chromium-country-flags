// Source: https://github.com/talkjs/country-flag-emoji-polyfill
const replacementFontName = "Twemoji Country Flags";

// The id the element containing all overwritten font families.
const extentionStyleTagId = "country-flag-fixer-ext";

const extractFontFamilyRules = () => 
{
  const fontFamilyRules = [];

  for (const sheet of document.styleSheets) {

    // Ignore the styles set by this extention.
    if (sheet.ownerNode.id == extentionStyleTagId) 
      continue;

    // Ignore any non-screen stylesheets.
    const sheetMediaBlacklist = ['print', 'speech', 'aural', 'braille', 'handheld', 'projection', 'tty'];
    if (sheetMediaBlacklist.includes(sheet.media.mediaText))
      continue;

    try {
      
      // Loop through every CSS selector in the stylesheet
      for (const rule of sheet.cssRules) {

        if (!rule.style || !rule.style?.fontFamily) 
          continue;

        const selectorText = rule.selectorText;
        const fontFamily = rule.style.fontFamily;

        // The 'inherit' value cannot be combined with other fonts; ignore it.
        if (fontFamily == 'inherit')
          continue;

        // Already modified CSS selectors may be ignored.
        if (fontFamily.toLowerCase().includes(replacementFontName.toLowerCase())) 
          continue;

        fontFamilyRules.push({ selectorText, fontFamily });
      }
    }
    catch (e) {
      // Some stylesheets might not be accessible due to CORS restrictions; ignore them.
    }
  }

  return fontFamilyRules;
};

const createNewStyleTag = (fontFamilyRules) => 
{
  const style = document.createElement("style");
  style.setAttribute("type", "text/css");
  style.setAttribute("id", extentionStyleTagId);

  fontFamilyRules.forEach((rule) => {
    // Set the Country Flags font as main property; set the original font(s) as 'fallback'
    style.textContent += `${rule.selectorText} { font-family: '${replacementFontName}', ${rule.fontFamily} !important; }\n`;
  });

  return style;
};

const applyCustomFontStyles = () => 
{
  var existingSheet = document.getElementById(extentionStyleTagId);

  const fontFamilyRules = extractFontFamilyRules();
  const newStyleTag = createNewStyleTag(fontFamilyRules);

  // Completely rewrite the overriden styles, if applicable.
  if (existingSheet) {
    existingSheet.parentNode.removeChild(existingSheet);
  }

  if (document.head == null) 
    return;

  document.head.appendChild(newStyleTag);
};

const preserveCustomFonts = (element) => 
{
  if (element == undefined)
    return;

  // Ignore elements without style attribute or any font-family property.
  const inlineStyle = element.getAttribute('style');
  if (!inlineStyle || !inlineStyle.includes('font-family'))
    return;

  // Font family regex matching the font (group 1) and the !important modifier (group 2).
  const fontFamilyRegex = /font-family\s*:\s*([^;]+?)(\s*!important)?\s*(;|$)/;
  const match = fontFamilyRegex.exec(inlineStyle);
    
  // Cancel if there is no match for any reason.
  if (!match)
    return;

  const hasIsImportant = match[2] && match[2].includes('!important');
  if (hasIsImportant)
    return;

  const currentFontFamily = match[1].trim();
  element.style.setProperty('font-family', currentFontFamily, 'important');
}

// Match a flag pair, not an isolated regional indicator (e.g. while streaming).
const countryFlagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
const nonContentSelector = 'script, style, noscript, textarea, title';
const editableSelector = '[contenteditable=""], [contenteditable="true" i], [contenteditable="plaintext-only" i]';
const injectedFonts = new WeakMap();

const applyFlagFont = (element, preserveInline) => {
  if (!element.style)
    return;
  const excluded = element.closest(nonContentSelector) ||
    document.designMode === 'on' || element.closest(editableSelector);
  const hasFlags = !excluded && Array.from(element.childNodes).some(node =>
    node.nodeType === Node.TEXT_NODE && countryFlagRegex.test(node.data));
  const originalValue = element.style.getPropertyValue('font-family');
  const originalPriority = element.style.getPropertyPriority('font-family');
  const injected = injectedFonts.get(element);

  if (injected) {
    // Relinquish ownership if the host changes this property. Do not reapply it
    // until the current flag-bearing content has gone away.
    if (originalValue !== injected.value || originalPriority !== 'important') {
      if (!hasFlags)
        injectedFonts.delete(element);
      return;
    }
    if (!hasFlags) {
      if (injected.originalValue)
        element.style.setProperty('font-family', injected.originalValue, injected.originalPriority);
      else
        element.style.removeProperty('font-family');
      injectedFonts.delete(element);
    }
    return;
  }
  if (excluded)
    return;

  // Capture the original priority before the legacy inline-font preservation.
  if (hasFlags || preserveInline)
    preserveCustomFonts(element);
  if (!hasFlags)
    return;

  // Use the winning font stack: stylesheet extraction cannot cover every cascade.
  const fontFamily = getComputedStyle(element).fontFamily;
  // Keep quoted family names containing commas intact when removing duplicates.
  const families = fontFamily.match(/(?:[^,"']|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')+/g) || [];
  const isFlagFont = family => family.trim().replace(/^(["'])(.*)\1$/, '$2').toLowerCase() === replacementFontName.toLowerCase();
  if (families.length && isFlagFont(families[0]))
    return;

  const fallback = families.filter(family => !isFlagFont(family)).map(family => family.trim()).join(', ');
  element.style.setProperty('font-family', `"${replacementFontName}"${fallback ? ', ' + fallback : ''}`, 'important');
  injectedFonts.set(element, {
    originalValue, originalPriority, value: element.style.getPropertyValue('font-family')
  });
};

const scanContent = (root, elements, preserveInline) => {
  if (!root.isConnected)
    return;
  if (root.nodeType === Node.TEXT_NODE) {
    if (root.parentElement && !elements.has(root.parentElement))
      elements.set(root.parentElement, false);
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.matches(nonContentSelector))
      return;
    elements.set(root, elements.get(root) || preserveInline);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: node => node.matches(nonContentSelector)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  let node;
  while ((node = walker.nextNode()))
    elements.set(node, elements.get(node) || preserveInline);
};

// Observe the document for dynamically added styles
let lastStyleSheets = new Set(Array.from(document.styleSheets).map(sheet => sheet.href || sheet.ownerNode.textContent));
const observer = new MutationObserver((mutations) => 
{
  let stylesheetChanged = false;
  const changedRoots = new Map();
  const changedElements = new Map();

  mutations.forEach(mutation => 
  {
    if (mutation.type === 'characterData' || mutation.type === 'attributes') {
      if (!changedRoots.has(mutation.target))
        changedRoots.set(mutation.target, false);
      return;
    }
    // Removed/replaced text needs reconciliation even when no nodes were added.
    if (mutation.target.nodeType === Node.ELEMENT_NODE && mutation.target.isConnected)
      changedElements.set(mutation.target, false);
    // Only focus on <link> and <style> elements.
    mutation.addedNodes.forEach(node => 
    {
      changedRoots.set(node, true);
      if (node.id === extentionStyleTagId)
        return;

      const isStylesheet = node.nodeName === 'LINK' && node.rel === 'stylesheet';
      const isStyleNode = node.nodeName === 'STYLE'
      if (!isStylesheet && !isStyleNode)
        return;

      const newStylesheetIdentifier = isStylesheet ? node.href : node.textContent;
      if (lastStyleSheets.has(newStylesheetIdentifier))
        return;

      stylesheetChanged = true;
      lastStyleSheets.add(newStylesheetIdentifier);
    });
  });

  if (stylesheetChanged) {
    applyCustomFontStyles();
  }

  // Visit only changed subtrees, once per batch. Inline style writes are not observed.
  changedRoots.forEach((preserveInline, root) => {
    for (let parent = root.parentNode; parent; parent = parent.parentNode) {
      if (changedRoots.has(parent))
        return;
    }
    scanContent(root, changedElements, preserveInline);
  });
  changedElements.forEach((preserveInline, element) => applyFlagFont(element, preserveInline));
});

// Observe the children of the document DOM-element and every newly added element
// This may be a <link> element in the head, or any <style> sheet in the document.
observer.observe(document, {
  childList: true, characterData: true, subtree: true,
  attributes: true, attributeFilter: ['contenteditable']
});

if (document.head)
  applyCustomFontStyles();
const initialElements = new Map();
scanContent(document, initialElements, true);
initialElements.forEach((preserveInline, element) => applyFlagFont(element, preserveInline));
initialElements.clear();
