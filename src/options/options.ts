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

const handleFormSubmit = (event: SubmitEvent) => {
  event.preventDefault();

  clearValidationMessage();

  const form = event.target as HTMLFormElement;
  const data = new FormData(form);
  storeSite(data.get('url').toString())
    .then((site: IgnoredSite) => renderTable())
    .catch((error: string) => setValidationMessage(error));
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
  deleteBtn.innerHTML = getDeleteButtonInnerHtml();
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
      noSitesAlert.style.display = hasIgnoredSites ? 'none' : 'flex';
      
      siteTable.innerHTML = '';
      ignoredSites.forEach(appendRow);
    });
};

const appendRow = (site: IgnoredSite) => {
  const siteTable = document.getElementById('sites-table');
  const row = generateTableRow(site);
  siteTable.appendChild(row);
};

// TODO: i18n
const getDeleteButtonInnerHtml = () => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 mr-1">
    <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
  </svg>
  <span>Delete</span>
`;

getIgnoredSites().then((sites) => console.table(sites));