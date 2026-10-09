# Dynamic flag regression fixture

Open `dynamic-flags.html` in Chrome or Edge. It loads the repository's content
script directly and prints PASS/FAIL results. No installation or dependencies
are needed. The fixture checks computed styles and DOM behavior; visually check
that the flags render too.

For a headless run (adjust the browser executable and absolute file URL):

```text
chrome --headless --disable-gpu --allow-file-access-from-files --virtual-time-budget=5000 --dump-dom file:///absolute/path/to/tests/dynamic-flags.html
```

The resulting document title must be `PASS`, and every line in `#results` must
start with `PASS`.

The fixture also checks restoration after text changes, child removal and
replacement, multiple text nodes, host font/priority changes, and editable
subtrees (including `plaintext-only`, editor islands, moves and editability
changes). Restoring a declaration only changes `font-family`; other inline
styles remain intact.

The targeted inline fallback excludes entire editing subtrees and documents in
`designMode`. Existing global stylesheet overrides still apply there. If the
host changes the injected font value or priority, the fallback leaves that
declaration alone until the flags disappear. An identical rewrite is
indistinguishable from the extension's own declaration. `designMode` changes
alone are not observed; affected elements reconcile on their next content or
`contenteditable` mutation.

For extension integration, load `src` as an unpacked extension at
`chrome://extensions`, reload ChatGPT, and generate several replies with country
flags. Check both streaming and completed replies, alongside user messages.
The standalone fixture does not verify extension font-resource loading or live
ChatGPT behavior.
