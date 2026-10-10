/**
 * Purpose: Exercise flag-processing regressions inside the browser fixture.
 * Covers initial/dynamic/streamed flags, fallback fonts, restoration, editors,
 * host font updates, shadow roots, icons and observer-loop prevention.
 * Includes a coarse performance guard, not a live-site benchmark.
 * Loaded and reported by tests/browser.cjs; not a standalone Node test.
 */

async function runBrowserChecks() {
  const results = [];
  const check = (value, label) => results.push({ passed: Boolean(value), label });

  // Allow observer callbacks and their resulting font writes to settle.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
  const font = (element) => element.style.fontFamily.startsWith('"Twemoji Country Flags"');
  const p = (text, style = '') => {
    const element = document.createElement('p');
    element.textContent = text;
    element.setAttribute('style', style);
    document.body.append(element);
    return element;
  };
  await settle();

  // Initial flags should change while ordinary text and icon fonts stay intact.
  const initial = document.getElementById('initial');
  check(font(initial), 'initial flag text');
  check(!document.getElementById('ordinary').style.fontFamily, 'ordinary text untouched');
  check(
    getComputedStyle(document.getElementById('icon')).fontFamily.includes('monospace'),
    'icon font preserved',
  );
  check(
    getComputedStyle(document.getElementById('icon'), '::before').fontFamily.includes('monospace'),
    'pseudo-element font preserved',
  );

  // Preserve fallback fonts and priorities, and recognize subdivision sequences.
  const normal = p('🇳🇱', 'font-family: Georgia, serif; color: red');
  const important = p('🇯🇵', 'font-family: "Courier New", monospace !important');
  const subdivision = p('\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}');
  const single = p('🇳');
  const stream = p('Streaming ');
  await settle();
  check(font(normal) && normal.style.fontFamily.includes('Georgia'), 'inline fallback preserved');
  check(
    font(important) && important.style.fontFamily.includes('Courier New'),
    'important fallback preserved',
  );
  check(font(subdivision), 'Scotland tag sequence');
  check(!font(single), 'single regional indicator excluded');

  // Read-only flags must not be excluded merely because of an editor class name.
  const namedEditor = p('Read-only flag 🇳🇱');
  namedEditor.className = 'monaco-editor cm-editor CodeMirror ace_editor';
  await settle();
  check(font(namedEditor), 'editor class names do not exclude read-only flags');

  // A streamed flag becomes valid only after both regional indicators arrive.
  stream.firstChild.data += '🇳';
  await settle();
  check(!font(stream), 'incomplete streamed flag excluded');
  stream.firstChild.data += '🇱';
  await settle();
  check(font(stream), 'streamed flag detected');

  // Streaming ordinary text must not cause repeated font writes or an observer loop.
  let writes = 0;
  const observer = new MutationObserver((records) => (writes += records.length));
  observer.observe(stream, { attributes: true, attributeFilter: ['style'] });
  for (let i = 0; i < 10; i++) {
    stream.firstChild.data += ' more';
    await settle();
  }
  observer.disconnect();
  check(writes === 0, 'streaming does not repeatedly rewrite styles');

  // Remove flags and verify the original values, priorities and unrelated styles.
  normal.firstChild.data = 'Ordinary';
  important.replaceChildren();
  await settle();
  check(
    normal.style.fontFamily === 'Georgia, serif' &&
      normal.style.getPropertyPriority('font-family') === '' &&
      normal.style.color === 'red',
    'original inline priority and other styles restored',
  );
  check(
    important.style.fontFamily.includes('Courier New') &&
      important.style.getPropertyPriority('font-family') === 'important',
    'important font restored after removal',
  );
  stream.textContent = 'Ordinary';
  await settle();
  check(!stream.style.fontFamily, 'absent original declaration restored');

  // HTML editing semantics determine exclusions, including moves into an editor.
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.innerHTML = '<span style="font-family: Georgia">🇳🇱</span>';
  document.body.append(editor);
  await settle();
  check(
    editor.firstChild.style.fontFamily === 'Georgia' &&
      editor.firstChild.style.getPropertyPriority('font-family') === '',
    'editor fonts untouched',
  );
  single.textContent = '🇳🇱';
  await settle();
  check(font(single), 'updated text gains font');
  editor.append(single);
  await settle();
  check(!single.style.fontFamily, 'moving into editor restores font');
  document.body.append(single);
  await settle();
  single.contentEditable = 'plaintext-only';
  await settle();
  check(!single.style.fontFamily, 'changing editability restores font');
  single.removeAttribute('contenteditable');
  await settle();
  check(font(single), 'changing back to read-only resumes handling');

  // Recompute class-based fallback fonts, but respect subsequent host font writes.
  const sheet = document.createElement('style');
  sheet.textContent =
    '.change-a { font-family: Georgia !important } .change-b { font-family: Verdana !important }';
  document.head.append(sheet);
  const changing = p('🇳🇱');
  changing.className = 'change-a';
  await settle();
  changing.className = 'change-b';
  await settle();
  check(
    changing.style.fontFamily.includes('Verdana') && !changing.style.fontFamily.includes('Georgia'),
    'class changes refresh computed fallback',
  );
  changing.style.setProperty('font-family', 'Tahoma', '');
  await settle();
  check(changing.style.fontFamily === 'Tahoma', 'host font rewrite respected');

  // Open shadow roots need their own registration and observation.
  const host = document.createElement('div');
  host.attachShadow({ mode: 'open' }).innerHTML = '<p>🇳🇱</p>';
  document.body.append(host);
  await settle();
  check(font(host.shadowRoot.querySelector('p')), 'open shadow root flags');
  check(
    host.shadowRoot.querySelectorAll('#country-flag-fixer-ext-head').length === 1,
    'shadow font registered once',
  );
  // designMode changes reconcile when the next relevant DOM mutation occurs.
  document.designMode = 'on';
  const design = p('🇳🇱');
  await settle();
  check(!font(design), 'designMode editor untouched');
  document.designMode = 'off';
  design.firstChild.data += ' more';
  await settle();
  check(font(design), 'designMode resumes on content update');

  check(initial.textContent === '🇳🇱', 'original text nodes preserved');
  check(
    document.querySelectorAll('#country-flag-fixer-ext-head').length === 1,
    'single document font registration',
  );

  // This is a coarse performance regression guard, not a live-site benchmark.
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 10000; i++) {
    const node = document.createElement('span');
    node.textContent = 'Ordinary';
    fragment.append(node);
  }
  document.body.append(fragment);
  await settle();
  const start = performance.now();
  for (let i = 0; i < 50; i++) {
    initial.firstChild.data += '.';
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  check(
    performance.now() - start < 5000,
    'large document streaming completes without full-page stalls',
  );

  // The Node runner reports all labels and fails on any recorded failure.
  return results;
}
