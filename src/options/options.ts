import { IgnoredSite } from "../utils/ignoredSite";
import { deleteSite, getIgnoredSites, storeSite } from "../utils/storageManager";

document.addEventListener("DOMContentLoaded", () => {
  setPageTitle();
  renderTable();

  const addDomainForm = document.getElementById('add-domain-form');
  addDomainForm.addEventListener('submit', handleFormSubmit);
});

const setPageTitle = () => {
  const optionsPageTitle = chrome.i18n.getMessage("optionsPageTitle");
  document.title = `Country Flag Fixer | ${optionsPageTitle}`;
  document.getElementById('options-title').innerText = optionsPageTitle;
};

const handleFormSubmit = (event: any) => {
  event.preventDefault();

  clearValidationMessage();

  const data = new FormData(event.target);
  storeSite(data.get('url').toString())
    .then(appendRow)
    .catch(setValidationMessage);
};

const validationMessageElement = document.getElementById('validation-message');
const setValidationMessage = (message: string) => {
  validationMessageElement.innerText = message;
  validationMessageElement.style.display = 'block';
};

const clearValidationMessage = () => {
  validationMessageElement.innerText = '';
  validationMessageElement.style.display = 'none';
};

/**
 * UI
 */
const generateTableRow = (site: IgnoredSite) => {
  const tr = document.createElement('tr');
  
  const tdSite = document.createElement('td');
  tdSite.textContent = site.getUrl();
  
  const tdButton = document.createElement('td');
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-domain-button';
  deleteBtn.type = 'button';
  deleteBtn.title = 'Delete domain';
  deleteBtn.textContent = 'Delete';
  deleteBtn.dataset.id = site.id;
  deleteBtn.onclick = () => 
  {
    if (confirm(`Are you sure you want to delete \n"${site.getUrl()}"?`)) 
    {
      deleteSite(site.id)
        .then(() => renderTable())
        .catch((message) => console.warn('Something went wrong while deleting the requested site', message, site.getUrl()));
    }
  };
  
  tdButton.appendChild(deleteBtn);
  tr.appendChild(tdSite);
  tr.appendChild(tdButton);

  return tr;
};

const renderTable = () => {
  const listView = document.getElementById('list-view');
  const siteTable = document.getElementById('sites-table');
  const noSitesAlert = document.getElementById('no-domains-alert');

  getIgnoredSites()
    .then(ignoredSites => {

      const hasIgnoredSites = ignoredSites && ignoredSites.length > 0;

      listView.style.display = hasIgnoredSites ? 'block' : 'none';
      noSitesAlert.style.display = hasIgnoredSites ? 'none' : 'block';
      
      siteTable.innerHTML = '';
      ignoredSites.forEach(appendRow);
    });
};

const appendRow = (site: IgnoredSite) => {
  const siteTable = document.getElementById('sites-table');
  const row = generateTableRow(site);
  siteTable.appendChild(row);
};

getIgnoredSites().then((sites) => console.table(sites));