import { shouldIgnoreSite } from './utils/storageManager';

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
