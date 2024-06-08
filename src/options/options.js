/**
 * UI
 */
const setPageTitle = () => {
  const optionsPageTitle = chrome.i18n.getMessage("optionsPageTitle");
  document.title = `Country Flag Fixer | ${optionsPageTitle}`;
};

document.addEventListener("DOMContentLoaded", setPageTitle);

/**
 * Options management
 */