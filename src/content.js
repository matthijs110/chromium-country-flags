// Source: https://github.com/talkjs/country-flag-emoji-polyfill
const replacementFontName = "Twemoji Country Flags";

// Some elements can be ignored.
const ignoredElements = ["style", "script", "svg"];

// The id the element containing all overwritten font families.
const extentionStyleTagId = "country-flag-fixer-ext";

const extractFontFamilyRules = () => 
{
  const fontFamilyRules = [];

  for (const sheet of document.styleSheets) {

    if (sheet.ownerNode.id == extentionStyleTagId) 
      continue;

    try {
      
      // Loop through every CSS selector in the stylesheet
      for (const rule of sheet.cssRules) {

        if (!rule.style || !rule.style?.fontFamily) 
          continue;

        const selectorText = rule.selectorText;
        const fontFamily = rule.style.fontFamily;

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
  if (existingSheet != null) {
    existingSheet.parentNode.removeChild(existingSheet);
  }

  if (document.head == null) 
    return;

  document.head.appendChild(newStyleTag);
};

// Observe the document for dynamically added elements
let lastStyleSheets = new Set(Array.from(document.styleSheets).map(sheet => sheet.href || sheet.ownerNode.textContent));
const observer = new MutationObserver((mutations) => 
{
  let stylesheetChanged = false;

  mutations.forEach(mutation => 
  {  
    // Only focus on <link> and <style> elements.
    mutation.addedNodes.forEach(node => 
    {
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
});

// Observe the children of the document DOM-element and every newly added element
// This may be a <link> element in the head, or any <style> sheet in the document.
observer.observe(document, { childList: true, subtree: true });
