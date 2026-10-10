const message = (key: string): string => chrome.i18n.getMessage(key) || key;

document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = `Country Flag Fixer | ${message('updateTitle')}`;

document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
  element.textContent = message(element.dataset.i18n!);
});

// Open the existing options page rather than duplicating exclusion controls here.
document.getElementById('open-settings')!.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage().catch(() => {
    document.getElementById('error')!.textContent = message('storageError');
  });
});
