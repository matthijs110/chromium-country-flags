/**
 * Ask the service worker before modifying the page. It can check the top-level
 * URL even when this content script runs inside a cross-origin iframe.
 */
export const isPageIgnored = async (): Promise<boolean> => {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'checkIgnoredSite' });

    return result?.ignored !== false;
  } catch {
    // If settings cannot be checked, leave the page alone rather than bypassing
    // a user's exclusion after a storage failure or extension reload.
    return true;
  }
};
