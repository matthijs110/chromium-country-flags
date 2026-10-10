import { shouldIgnoreSite } from './utils/storageManager';

const updateNoticeVersion = '2.1.0';
const updateNoticeKey = 'cfUpdateNoticeVersion';
let openingUpdateNotice = false;

chrome.runtime.onInstalled.addListener(async (details) => {
  // This announcement is for upgrades to 2.1.0, not installs, reloads or later releases.
  const previous = details.previousVersion?.split('.').map(Number);
  const isOlder = previous && previous.every(Number.isFinite) && (
    previous[0] < 2 || (previous[0] === 2 && previous[1] < 1)
  );

  if (details.reason !== 'update' || !isOlder ||
      chrome.runtime.getManifest().version !== updateNoticeVersion || openingUpdateNotice) {
    return;
  }

  openingUpdateNotice = true;

  try {
    // Use device-local state: showing the notice on one device should not hide it on another.
    const saved = await chrome.storage.local.get(updateNoticeKey);

    if (saved[updateNoticeKey] !== updateNoticeVersion) {
      await chrome.tabs.create({ url: chrome.runtime.getURL('update/update.html') });
      await chrome.storage.local.set({ [updateNoticeKey]: updateNoticeVersion });
    }
  } catch (error) {
    console.warn('Could not show the 2.1.0 update notice.', error);
  } finally {
    openingUpdateNotice = false;
  }
});

// Listen to messages from content scripts and respond with whether the site should be ignored.
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  if ((message as { type?: string })?.type !== 'checkIgnoredSite') {
    return;
  }

  // Browser-provided URLs let us exclude both an iframe's own hostname and the
  // enclosing website without reading across the page's same-origin boundary.
  const urls = [sender.tab?.url, sender.url].filter((url): url is string => Boolean(url));

  Promise.all(urls.map(shouldIgnoreSite))
    .then((results) => reply({ ignored: results.some(Boolean) }))
    .catch(() => reply({ ignored: true }));

  // Keep the response channel open until the asynchronous storage read finishes.
  return true;
});
