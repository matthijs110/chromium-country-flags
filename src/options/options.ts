import { deleteSite, getIgnoredSites, STORAGE_KEY, storeSite } from '../utils/storageManager';
import { IgnoredSite } from '../utils/ignoredSite';

const text = (key: string, substitution?: string): string =>
  chrome.i18n.getMessage(key, substitution) || key;

// These controls are required by the options HTML. Fail clearly if a future
// markup change removes one, instead of failing later inside a storage callback.
const requiredElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing options control: ${id}`);
  }

  return element as T;
};

const form = requiredElement<HTMLFormElement>('add-domain-form');
const input = requiredElement<HTMLInputElement>('domain-input');
const message = requiredElement('form-message');
const list = requiredElement('sites-list');
const status = requiredElement('list-status');

let busy = false;
let renderVersion = 0;

document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = `Country Flag Fixer | ${text('settings')}`;

document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
  const key = element.dataset.i18n;

  if (key) {
    const translation = text(key);

    if (key === 'ignoredExample') {
      // Only these two formatting tags are supported; translation text is never
      // interpreted as arbitrary HTML or executable markup.
      const parts = translation.split(/(<strong>.*?<\/strong>|<code>.*?<\/code>)/g);

      element.replaceChildren(...parts.map((part) => {
        const match = part.match(/^<(strong|code)>(.*?)<\/(?:strong|code)>$/);

        if (!match) {
          return document.createTextNode(part);
        }

        const formatted = document.createElement(match[1]);
        formatted.textContent = match[2];
        return formatted;
      }));
    } else {
      element.textContent = translation;
    }
  }
});

input.placeholder = text(input.dataset.i18nPlaceholder || 'domainPlaceholder');

const showMessage = (key: string, error = false): void => {
  message.textContent = text(key);
  message.className = error ? 'mb-4 text-sm text-red-700' : 'mb-4 text-sm text-green-800';
  input.setAttribute(
    'aria-invalid',
    String(error && ['invalidDomain', 'duplicateDomain'].includes(key)),
  );
};

const setBusy = (value: boolean): void => {
  // Storage operations are asynchronous. Prevent double submissions while the
  // UI is waiting, and restore the controls even when an operation fails.
  busy = value;
  form.setAttribute('aria-busy', String(value));

  form
    .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')
    .forEach((control) => (control.disabled = value));
  list
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((control) => (control.disabled = value));
};

const errorKey = (error: unknown): string =>
  error instanceof Error && ['invalidDomain', 'duplicateDomain'].includes(error.message)
    ? error.message
    : 'storageError';

const row = (site: IgnoredSite): HTMLLIElement => {
  const li = document.createElement('li');
  li.className = 'flex items-center justify-between gap-4 py-3';

  const hostname = document.createElement('span');
  hostname.className = 'min-w-0 break-all';
  hostname.textContent = site.hostname;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className =
    'shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50';
  remove.textContent = text('deleteDomain');
  remove.setAttribute('aria-label', text('deleteDomainLabel', site.hostname));
  remove.disabled = busy;

  remove.addEventListener('click', async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await deleteSite(site.id);
      await render();
      showMessage('domainRemoved');
      input.focus();
    } catch (error) {
      showMessage(errorKey(error), true);
    } finally {
      setBusy(false);
    }
  });

  li.append(hostname, remove);

  return li;
};

const render = async (): Promise<void> => {
  // Storage changes can arrive while another read is pending. An older result
  // must not replace a newer list already requested by this page.
  const version = ++renderVersion;

  try {
    const sites = await getIgnoredSites();
    if (version !== renderVersion) {
      return;
    }

    sites.sort((a, b) => a.hostname.localeCompare(b.hostname));
    list.replaceChildren(...sites.map(row));
    status.textContent = sites.length ? '' : text('noDomains');
  } catch {
    if (version === renderVersion) {
      status.textContent = text('storageError');
    }
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (busy) {
    return;
  }

  setBusy(true);

  try {
    await storeSite(input.value);
    input.value = '';
    await render();
    showMessage('domainAdded');
  } catch (error) {
    showMessage(errorKey(error), true);
  } finally {
    setBusy(false);
    input.focus();
  }
});

// Keep multiple open options pages in sync with browser-sync storage updates.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    void render();
  }
});

status.textContent = text('loading');
void render();
