# Verification

Build first with the project-local Node 22 runtime and `pnpm run build`.

- `pnpm test`: normalization, legacy storage entries, asynchronous reads,
  read/write failures, domain boundaries and background exclusion decisions.
- `pnpm run test:browser`: built production scripts, font loading and options UI
  in headless Chrome. This suite mocks extension APIs so it can exercise storage
  failures and external storage changes deterministically.
- `pnpm run test:integration`: loads the actual unpacked extension in a temporary
  browser profile. Verifies service worker messaging, actual extension font
  resources, options persistence and cross-origin frame exclusions. Uses the
  browser's `Extensions.loadUnpacked` DevTools command and requires a modern
  Chrome/Edge version with extension debugging support.
- `pnpm run test:package`: checks the manifest's referenced assets, translation
  coverage, version consistency and absence of eval in the production bundles.
- `pnpm run verify`: builds and runs all the above checks in sequence, together
  with the TypeScript checks. It stops on the first failure.
- `pnpm audit`: checks the locked dependency tree, including development tooling,
  against the registry's known vulnerability database.

The browser executable defaults to Chrome on Windows. To run both browser suites
with Edge in PowerShell:

```powershell
$env:BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
pnpm run test:browser
pnpm run test:integration
```

Both suites use separate temporary profiles; they do not modify your regular
profile. The browser fixture suite saves an options-page screenshot in its
temporary profile. Profiles are retained for inspection.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests, pushes and manual dispatch.
A Windows runner installs the pinned pnpm and frozen dependency lockfile, runs
`pnpm run verify` with Chrome, repeats the two browser suites with Edge, and
runs `pnpm audit`. Failures fail the job; superseded runs are cancelled. No Store
ZIP is produced or uploaded. The workflow has read-only repository permissions
and also handles pull requests from forks without repository secrets.

Storage tests transpile the TypeScript and execute it with a mocked Chrome API,
including delayed reads and rejected writes. Browser tests serve local fixtures
and drive a separate headless browser over the Chrome DevTools Protocol; this
checks real DOM mutations, computed fonts and the options UI. Integration tests
load `dist` as a real extension, so messaging, storage and packaged resources
are checked without mocked extension APIs. Package tests inspect the generated
files. None of these tests contacts Jira, YouTube or other reported live sites.