// Source: https://github.com/talkjs/country-flag-emoji-polyfill
const fontName = "Twemoji Country Flags";
const fontUrl = chrome.runtime.getURL("assets/TwemojiCountryFlags.woff2");

/**
 * Register the custom font-face to load the emoji-font for certain unicodes.
 */
const style = document.createElement("style");
style.textContent = `
    @font-face {
        font-family: "${fontName}";
        src: url('${fontUrl}') format('woff2');
    }
`;

document.head.appendChild(style);

/**
 * Update all children of the given node.
 */
const updateChildNodes = (node) => 
{
    node.querySelectorAll('*').forEach((node) =>
    {
        // Match any emoji within the Unicode range
        const regex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
        if (node.innerHTML.match(regex)) 
        {
            // Get the original fonts to append later as fallback
            const originalFont = window.getComputedStyle(node, null).fontFamily;

            // Prevent any duplicated
            if (originalFont.toLowerCase().includes(fontName.toLowerCase())) 
                return;

            // Override the font
            node.style.fontFamily = `${fontName}, ${originalFont}`;
        }
    });
}

// Execute the initial replacement
updateChildNodes(document);

// Some elements can be ignored.
const ignoredElements = ['script', 'svg'];

/**
 *  Observe the document for updated elements (e.g. scroll loading).
 */
let observer = new MutationObserver(mutations => 
{ 
    for (let mutation of mutations) 
    {
        for (let node of mutation.addedNodes) 
        {
            if (node == null || node.tagName == null)
                continue;

            const tagName = node.tagName.toLowerCase();
            if (ignoredElements.includes(tagName))
                continue;

            if (node.style == null)
                continue;
            
            updateChildNodes(node);
        }
    }   
});

observer.observe(document, { childList: true, subtree: true });