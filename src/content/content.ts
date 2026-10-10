import { flagFont, hasExtensionContext, registerFont } from './font';
import { isPageIgnored } from './settings';

// Targeted processing/restoration inspired by contributor PR #26:
// https://github.com/matthijs110/chromium-country-flags/pull/26

// A flag needs two regional indicators, or a black flag plus subdivision tags.
// A lone indicator can occur while a website is still streaming text.
const flagSequence = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}/u;

const excludedSelector =
  'script,style,noscript,textarea,input,select,title,[contenteditable=""],[contenteditable="true" i],[contenteditable="plaintext-only" i]';

type FontState = { original: string; priority: string; injected: string };

// WeakMap stores our original declarations. The small active set lets us restore
// disconnected elements and refresh fonts without searching the whole document.
const owned = new WeakMap<HTMLElement | SVGElement, FontState>();
const active = new Set<HTMLElement | SVGElement>();
const roots = new WeakSet<Document | ShadowRoot>();

const excluded = (element: Element): boolean => {
  if (document.designMode === 'on') {
    return true;
  }

  // closest() stops at a shadow boundary, so explicitly continue at each host.
  for (let current: Element | null = element; current;) {
    if (current.closest(excludedSelector)) {
      return true;
    }

    const root = current.getRootNode();
    current = root instanceof ShadowRoot ? root.host : null;
  }

  return false;
};

/** Apply or restore only this text container's font-family declaration. */
const reconcile = (element: HTMLElement | SVGElement, refresh = false): void => {
  if (!element.style) {
    return;
  }

  const state = owned.get(element);
  const value = element.style.getPropertyValue('font-family');
  const priority = element.style.getPropertyPriority('font-family');

  // Look at direct text children; a flag deep inside a subtree should not change
  // the font of the entire ancestor subtree. Original text nodes stay intact.
  const hasFlags =
    element.isConnected &&
    !excluded(element) &&
    Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && flagSequence.test((node as Text).data),
    );

  // Do not restore an old declaration over a newer font chosen by the host app.
  if (state && (value !== state.injected || priority !== 'important')) {
    owned.delete(element);
    active.delete(element);
    return;
  }

  // Restore before recomputing the winning font: otherwise our injected inline
  // value would hide a stylesheet/class change behind its !important priority.
  if (state && (!hasFlags || refresh)) {
    if (state.original) {
      element.style.setProperty('font-family', state.original, state.priority);
    } else {
      element.style.removeProperty('font-family');
    }

    owned.delete(element);
    active.delete(element);
  } else if (state) {
    return;
  }

  if (!hasFlags) {
    return;
  }

  const original = element.style.getPropertyValue('font-family');
  const originalPriority = element.style.getPropertyPriority('font-family');
  const computed = getComputedStyle(element).fontFamily;

  // Keep quoted family names containing commas intact and avoid duplicate flag
  // fonts. The computed stack already resolves inline CSS, media rules and CORS
  // stylesheets; we do not need to fetch or reconstruct the site's stylesheets.
  const families = computed.match(/(?:[^,"']|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')+/g) || [];
  const fallback = families
    .filter(
      (family) =>
        family
          .trim()
          .replace(/^(["'])(.*)\1$/, '$2')
          .toLowerCase() !== flagFont.toLowerCase(),
    )
    .join(',');

  element.style.setProperty(
    'font-family',
    `"${flagFont}"${fallback ? ', ' + fallback : ''}`,
    'important',
  );

  owned.set(element, { original, priority: originalPriority, injected: element.style.fontFamily });
  active.add(element);
};

const scan = (root: Node, elements: Set<HTMLElement | SVGElement>): void => {
  if (!root.isConnected) {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    if (root.parentElement) {
      elements.add(root.parentElement);
    }

    return;
  }

  const visit = (element: Element) => {
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      elements.add(element);
    }

    if (element.shadowRoot) {
      observeRoot(element.shadowRoot);
    }
  };

  if (root instanceof Element) {
    visit(root);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      (node as Element).matches('script,style,noscript,textarea,title')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    visit(node as Element);
  }
};

// Compare non-font declarations to distinguish our own writes from host updates.
const withoutFont = (css: string): string => {
  const scratch = document.createElement('span');

  scratch.setAttribute('style', css);
  scratch.style.removeProperty('font-family');

  return scratch.style.cssText;
};

const observer = new MutationObserver((records) => {
  // Extension reloads do not unload this page's old script. Stop observing before
  // using invalidated APIs or changing any further page fonts.
  if (!hasExtensionContext()) {
    observer.disconnect();
    active.clear();
    return;
  }

  const pending = new Set<Node>();
  const elements = new Set<HTMLElement | SVGElement>();
  let refresh = false;

  for (const record of records) {
    if (record.type === 'attributes') {
      const element = record.target as HTMLElement;
      const state = owned.get(element);

      // Ignore our own font-only writes; do not pin other host style changes.
      if (
        record.attributeName === 'style' &&
        state &&
        element.style.fontFamily === state.injected &&
        element.style.getPropertyPriority('font-family') === 'important' &&
        withoutFont(record.oldValue || '') === withoutFont(element.style.cssText)
      ) {
        continue;
      }

      pending.add(element);
      refresh = true;
    } else if (record.type === 'characterData') {
      pending.add(record.target);
      if (record.target.parentElement?.matches('style')) refresh = true;
    } else {
      if (record.target instanceof HTMLElement || record.target instanceof SVGElement)
        elements.add(record.target);
      record.addedNodes.forEach((node) => pending.add(node));
      if (record.target instanceof Element && record.target.matches('style')) refresh = true;
      if (
        Array.from(record.addedNodes).some(
          (node) => node instanceof Element && node.matches('style,link[rel="stylesheet"]'),
        )
      )
        refresh = true;
    }
  }

  // If both an ancestor and its child changed in this batch, visit that subtree
  // once. Streaming text updates normally need only their immediate container.
  pending.forEach((root) => {
    for (let parent = root.parentNode; parent; parent = parent.parentNode) {
      if (pending.has(parent)) {
        return;
      }
    }

    scan(root, elements);
  });

  for (const element of active) {
    if (!element.isConnected || refresh) {
      elements.add(element);
    }
  }

  elements.forEach((element) => reconcile(element, refresh));
  registerFont(document);
});

function observeRoot(root: Document | ShadowRoot): void {
  if (!hasExtensionContext() || roots.has(root)) {
    return;
  }

  roots.add(root);
  registerFont(root);

  // Observe relevant page changes only; font-only extension writes are filtered
  // in the callback to prevent a self-sustaining mutation loop.
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class', 'style', 'contenteditable'],
  });

  // One initial scan handles flags already on the page. Later scans are scoped
  // to affected subtrees instead of querying every element after every mutation.
  const elements = new Set<HTMLElement | SVGElement>();
  scan(root, elements);
  elements.forEach((element) => reconcile(element));
}

void isPageIgnored().then((ignored) => {
  if (!ignored) {
    observeRoot(document);
  }
});
