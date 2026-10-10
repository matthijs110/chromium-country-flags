import { getIgnoredSites, storeSite, deleteSite } from '../utils/storageManager';
import { hostnameMatches, isValidUrlOrHostname } from '../utils/helpers';

const text = (key: string, value?: string): string => chrome.i18n.getMessage(key, value) || key;

// These controls belong to the packaged popup HTML, not to the visited website.
const hostname = document.getElementById('hostname')!;
const status = document.getElementById('status')!;
const toggle = document.getElementById('toggle') as HTMLButtonElement;
const options = document.getElementById('options') as HTMLButtonElement;
const help = document.getElementById('help')!;

// The current tab's hostname, or an empty string if unavailable or invalid.
let host = '';

// Block repeat clicks during writes and discard outdated asynchronous renders.
let busy = false;
let revision = 0;

// Localize static labels before loading the current tab and its exclusion state.
document.documentElement.lang = chrome.i18n.getUILanguage();
help.textContent = text('popupReload');
options.textContent = text('settings');
toggle.textContent = text('popupIgnore');

options.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage().catch(() => {
    status.textContent = text('storageError');
  });
});

async function render(): Promise<void> {
  const version = ++revision;
  toggle.disabled = true;

  try {
    const sites = await getIgnoredSites();

    // A newer storage update may have started another render while we waited.
    if (version !== revision) {
      return;
    }

    const parent = sites.find(
      (site) => site.hostname !== host && hostnameMatches(host, site.hostname),
    );
    const exact = sites.find((site) => site.hostname === host);

    // Never silently remove a parent exclusion that also covers other websites.
    status.textContent = parent
      ? text('popupParent', parent.hostname)
      : text(exact ? 'popupIgnored' : 'popupActive');

    // Use red text for parent or exact exclusions, green text for active sites.
    status.className = `mb-4 text-sm ${parent || exact ? 'text-red-700' : 'text-green-700'}`;
    toggle.textContent = text(exact ? 'popupEnable' : 'popupIgnore');
    toggle.disabled = busy || Boolean(parent);
  } catch {
    if (version === revision) {
      status.textContent = text('storageError');
      status.className = 'mb-4 text-sm text-red-700';
    }
  }
}

toggle.addEventListener('click', async () => {
  if (busy || !host) {
    return;
  }

  busy = true;
  toggle.disabled = true;

  try {
    // Re-read on click, since another options page may have changed the list.
    const sites = await getIgnoredSites();
    const parent = sites.some(
      (site) => site.hostname !== host && hostnameMatches(host, site.hostname),
    );

    // Toggle only this hostname's entry. Parent exclusions require the settings page.
    if (!parent) {
      const exact = sites.find((site) => site.hostname === host);

      if (exact) {
        await deleteSite(exact.id);
      } else {
        await storeSite(host);
      }
    }

    // Refresh from saved storage instead of assuming the write's resulting state.
    busy = false;
    await render();
  } catch {
    // Keep the popup usable for a retry and prevent stale reads hiding this error.
    busy = false;
    ++revision;
    toggle.disabled = false;
    status.textContent = text('storageError');
    status.className = 'mb-4 text-sm text-red-700';
  }
});

async function init(): Promise<void> {
  try {
    // Existing HTTP(S) host permissions provide the current tab URL; no tabs permission needed.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const parsed = tab?.url ? isValidUrlOrHostname(tab.url) : { valid: false as const };

    if (!parsed.valid) {
      // Browser-internal pages and unavailable URLs cannot be added as domains.
      status.textContent = text('popupUnavailable');
      help.hidden = true;

      return;
    }

    host = parsed.hostname;
    hostname.textContent = host;

    // Reflect changes from other extension pages while this popup remains open.
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync' && !busy) {
        void render();
      }
    });

    await render();
  } catch {
    status.textContent = text('popupUnavailable');
    help.hidden = true;
  }
}

void init();
