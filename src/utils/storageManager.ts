import { generateRandomId, isValidUrlOrHostname } from "./helpers";
import { IgnoredSite } from "./ignoredSite";

/**
 * Storage management
 */
const STORAGE_KEY = 'cfIgnoredSites';

const getStorage = () => chrome.storage.sync.get();
export const setStorage = (data: {}) => chrome.storage.sync.set(data);

export const getIgnoredSites = async (): Promise<IgnoredSite[]> => 
{
  const storage = await getStorage();
  const sites = storage[STORAGE_KEY] ?? [];
  return sites.map((site: any) => new IgnoredSite(site.id, site.hostname));
};

export const shouldIgnoreSite = (href: string): boolean => 
{
  let shouldIgnore = false;

  try 
  {
    // Try to parse the input as a URL
    const url = new URL(href);

    getIgnoredSites()
      .then((ignoredSites: IgnoredSite[]) => 
      {
        const hostname = url.hostname.replace('www.', '');
        shouldIgnore = ignoredSites.some(site => hostname.includes(site.hostname));
      });
  } 
  catch (error) 
  {
    console.warn('Could not validate URL, because the given location was invalid.', href);
  }

  return shouldIgnore;
}

export const storeSite = (url: string): Promise<IgnoredSite> => 
{
  return new Promise((resolve, reject) => 
  {
    // Check valid URL
    const confirmedUrl = isValidUrlOrHostname(url);
    if (! confirmedUrl.valid) 
    {
      reject(`The provider URL is invalid. Please provide a valid hostname or URL.`);
      return;
    }

    // Attemp to store the site
    getIgnoredSites()
      .then((ignoredSites) => 
      {
        const id = generateRandomId();
        const newSite = new IgnoredSite(id, confirmedUrl.hostname);
        if (ignoredSites.some((site: IgnoredSite) => site.getUrl() === newSite.getUrl())) 
        {
          reject(`The website '${newSite.getUrl()}' is already being ignored. Please try another website.`);
          return;
        }
    
        // Append the site to the storage
        setStorage({ [STORAGE_KEY]: [...ignoredSites, newSite] }).then(() => resolve(newSite));
      })
      .catch(() => reject('Could not get the currenly ignored sites.'));
  });
}

export const deleteSite = (id: string): Promise<void> => 
{
  return new Promise((resolve, reject) => 
  {
    // Attemp to delete the site
    getIgnoredSites()
      .then((ignoredSites: IgnoredSite[]) => 
      {
        // Check if the requested site id exists
        if (! ignoredSites.some((site: IgnoredSite) => site.id === id)) 
        {
          reject(`No site with id '${id}' found.`);
          return;
        }
    
        // Remove the site from the list
        const ignoredSitesLeft = ignoredSites.filter((site: IgnoredSite) => site.id !== id);
    
        // Update the storage
        setStorage({ [STORAGE_KEY]: ignoredSitesLeft }).then(resolve);
      })
      .catch(() => reject('Could not get the currenly ignored sites.'));
  });
}

export const clearSites = (): Promise<void> =>
  {
    return new Promise((resolve, reject) => 
    {
      getIgnoredSites()
        .then(() => 
        {
          // Clear the valuee
          setStorage({ [STORAGE_KEY]: [] }).then(resolve);
        })
        .catch(reject);
    });
  }