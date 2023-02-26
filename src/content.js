// Source: https://github.com/talkjs/country-flag-emoji-polyfill
const replacementFontName = "Twemoji Country Flags";

// Some elements can be ignored.
const ignoredElements = ["style", "script", "svg"];

/**
 * Update all children of the given node.
 */
const updateChildNodes = (startingPointNode) => 
{
    startingPointNode.querySelectorAll('*').forEach((childNode) =>
    {
        const tagName = childNode.tagName.toLowerCase();
        if (ignoredElements.includes(tagName))
            return;
            
        // Match any emoji within the Unicode range
        const regex = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]|[\uD83C]\uDDEC[\uD83C][\uDDA7\uDDAC\uDDA9\uDDAF\uDDA8\uDDB3\uDDB4]|\u200D?\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDCA7?\uFE0F?/g;
        const matches = childNode.innerHTML.match(regex);
        if (matches) 
        {
            // Get the original fonts to append later as fallback
            const originalFont = window.getComputedStyle(childNode, null).fontFamily;

            // Prevent any duplicated
            if (originalFont.toLowerCase().includes(replacementFontName.toLowerCase())) 
                return;

            // Override the font
            childNode.style.fontFamily = `${replacementFontName}, ${originalFont}`;
        }
    });
}

/**
 *  Observe the document for updated elements (e.g. scroll loading).
 */
let observer = new MutationObserver(mutations => 
{ 
    for (let mutation of mutations) 
    {
        for (let addedNode of mutation.addedNodes) 
        {
            if (addedNode != null && addedNode.tagName != null)
            {
                // Prevent searching within the ignored elements like SVG
                const tagName = addedNode.tagName.toLowerCase();
                if (ignoredElements.includes(tagName))
                    continue;

                updateChildNodes(addedNode);
            }
        }
    }   
});

// Observe the children of the document DOM-element and every newly added element (descendants)
observer.observe(document, { childList: true, subtree: true });