import { generateRandomId, hostnameMatches, isValidUrlOrHostname } from './helpers';
import { IgnoredSite } from './ignoredSite';

// Retain the original key and entry IDs so existing exclusions survive upgrades.
export const STORAGE_KEY = 'cfIgnoredSites';

/** Writes a key-value pair to browser storage. */
export const setStorage = (data: Record<string, unknown>): Promise<void> =>
  chrome.storage.sync.set(data);

/** Reads the ignored sites from browser storage. */
export const getIgnoredSites = async (): Promise<IgnoredSite[]> => {
  const storage = await chrome.storage.sync.get(STORAGE_KEY);
  const sites: unknown = storage[STORAGE_KEY] ?? [];

  if (!Array.isArray(sites)) {
    throw new Error('storageError');
  }

  // Browser storage contains plain objects, not IgnoredSite instances. Normalize
  // legacy hostnames when reading without changing the saved entry's identity.
  return sites.flatMap((site: { id?: string; hostname?: string }) => {
    if (!site || typeof site.id !== 'string' || typeof site.hostname !== 'string') {
      return [];
    }

    const parsed = isValidUrlOrHostname(site.hostname);

    return parsed.valid ? [new IgnoredSite(site.id, parsed.hostname)] : [];
  });
};

/** Determines if a site should be ignored based on its URL. */
export const shouldIgnoreSite = async (href: string): Promise<boolean> => {
  let hostname: string;

  try {
    hostname = new URL(href).hostname;
  } catch {
    return false;
  }

  // Await storage: a synchronous return would always precede the exclusion check.
  const sites = await getIgnoredSites();

  return sites.some((site) => hostnameMatches(hostname, site.hostname));
};

/** Stores a new site in the ignored list. */
export const storeSite = async (input: string): Promise<IgnoredSite> => {
  const parsed = isValidUrlOrHostname(input);

  if (!parsed.valid) {
    throw new Error('invalidDomain');
  }

  const sites = await getIgnoredSites();

  if (sites.some((site) => site.hostname === parsed.hostname)) {
    throw new Error('duplicateDomain');
  }

  const site = new IgnoredSite(generateRandomId(), parsed.hostname);

  // Await writes too: quota/network failures must reach the options page.
  await setStorage({ [STORAGE_KEY]: [...sites, site] });

  return site;
};

/** Removes a site from the ignored list. */
export const deleteSite = async (id: string): Promise<void> => {
  const sites = await getIgnoredSites();

  await setStorage({ [STORAGE_KEY]: sites.filter((site) => site.id !== id) });
};

/** Clears all ignored sites. */
export const clearSites = (): Promise<void> => setStorage({ [STORAGE_KEY]: [] });
