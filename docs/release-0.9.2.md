# DUETBlox 0.9.2 — recovery and student workflow fixes

This update addresses the reproducible issues found in the November 24 Playwright review. It keeps the existing Scratch runtime, Junior language, hardware transports and simulation engines.

## Protecting student work

- Opening a different `.duet` or `.sb3` project first archives the complete current workspace in **My projects → Recovery copies**, including programs, circuits, datasets and models. Restoring a copy also protects the workspace being replaced. Invalid incoming projects leave current work intact.
- Recovery copies are validated before replacement. Incomplete inputs that would make a recovery file impossible to reopen block the replacement with an actionable message.
- **Save project** updates a stable project identity; **Save a copy** creates a separate one. The previous silent twelve-project limit is removed. Moving saved projects to Trash is reversible. The library shows archive storage usage and retains older records.
- A failed local save still downloads the current valid workspace. A failed recovery write prevents replacement. Failed startup reads keep editing/autosave paused and offer **Retry restoration**, preventing default state from overwriting stored work.
- All six ML dataset modes retain a previous-dataset copy in an atomic storage transaction before example/import replacement. **Undo dataset replacement** works after reload. Whole-workspace import clears dataset-specific Undo so it cannot restore data from a different project. Undo replaces the current dataset; export it first to keep both. Retraining updates the model.

## Interaction changes

- A shared accessible modal traps Tab/Shift+Tab, makes background content inert, handles Escape, returns focus to its opener and supports nested portals. Junior Paint/Sound/Help, global Help and ML import/clear-model dialogs use it. Workspace navigation closes remaining dialogs.
- Junior sound errors appear inside the sound library with retry guidance. On phones, Code/Stage views and persistent Play/Stop keep playback reachable. Help stays available, canvas controls have 44px targets, and explicit palette paging exposes additional blocks. On small phones the canvas tools occupy a reserved row, with numeric fields and every tool verified by hit testing; they do not overlap the scripts.
- ML image/pose sample thumbnails are buttons usable with the keyboard. JSON errors explain which exported file to choose. Trained models expose a prominent **Use in Blocks** action; model clearing requires confirmation where offered.
- Circuit edit history survives workspace navigation and remains separate per board. Importing a different whole workspace clears that history. Numeric component properties accept drafts and commit on blur/Enter; invalid drafts leave the circuit unchanged. Escape cancels pending wiring throughout the workbench.
- Boards & robots starts with board choice, Live control / Run after unplugging modes and the next preparation, connection or compilation action. Other boards stay collapsed until explicitly expanded; search reports matches in that group. Upload remains a separate action after firmware preparation/compilation.
- SPICE retries an interrupted worker download once, only before the worker has sent its first message. The original deadline remains in force; Stop, navigation and disposal cancel a scheduled retry. Actual solver errors never retry. Exhausted loading failures give connection/offline guidance rather than blaming the circuit.
- Workspace hash URLs support Back, Forward, direct links and refresh. A new visit without a hash remembers the last workspace on the same deployment path.

## Verification

The final full unit/regression run passed **394 tests**. The official Scratch integration suite passed **31 tests**. Shared-dialog tests passed **3 scenarios**, including nested portals under React StrictMode. Targeted browser checks exercised actual Junior VM movement, persistent dataset Undo, real text training/prediction, project recovery, storage failure injection, firmware preparation and circuit editing. Phone layouts were inspected at 375×667 and 390×844; hardware and ML layouts were also checked at desktop size.

The final local production browser suite passed **all 63 scenarios** in 1.8 minutes, with no failures or skips. This includes actual cold-offline execution and three additional SPICE startup/retry scenarios. An earlier run passed 59/60 because an existing Junior test returned before asynchronous workspace navigation finished; its helper now waits for the destination, and the full suite passes. Publication results are recorded separately in the deployment evidence; local validation alone does not establish publication. Failed exploratory runs remain diagnostics and are not counted as passing checks. A public follow-up trace identified `ERR_NETWORK_IO_SUSPENDED` during a 196-second Mac sleep; three unchanged reruns passed. The startup retry and final phone non-overlap checks address those follow-up findings. Long final verification uses a process-scoped idle-sleep inhibitor, without changing system power settings.

Reproduce with installed dependencies:

```sh
npm test
DUETBLOX_BASE_PATH=/duetblox/ npm --prefix apps/scratch-editor test
DUETBLOX_TEST_URL=http://127.0.0.1:5224/duetblox/ npm run test:components
DUETBLOX_TEST_PRODUCTION=1 DUETBLOX_TEST_URL=http://127.0.0.1:5225/duetblox/ npm run test:e2e
```

The component harness uses the development server. The production suite uses an already-built app and includes preparing the complete offline pack, disabling network access, opening a fresh tab, and executing SPICE, Python, numeric ML, Junior and Scratch.

## Deployment and limits

The target remains `https://duetpower.in/duetblox/`. A private copy of the prior release (offline pack `69f015f0d566c311084e`) is retained under `duetblox-backup-20261124-before-092`. Deployment is restricted to the DUETBlox directory; the parent website, DNS and hosting-wide configuration are outside this update.

No physical Arduino/ESP32, robot, microphone or camera acceptance is claimed. Browser tests use isolated profiles; a mocked serial chooser exercises cancellation/locks without contacting hardware. Emulated phone checks do not substitute for physical touch-device or screen-reader testing. This update does not establish universal platform superiority or a bug-free product. No new REA/Ghidra analysis was needed for these source-level fixes.

Development file watching excludes generated QA directories so trace HTML cannot reload the editor while tests run.

Evidence is retained locally under `work/fixes-20261124/` and `work/playwright-feedback-20261124/`.

## Recovering an older cached editor

On November 25 an existing browser still loaded the 0.8.0 Junior bundle even though the public files matched 0.9.2. The old offline worker served cached HTML, and the hosting server gave mutable HTML/worker files a ten-year cache lifetime. Reopening alone did not reliably install the new release.

The online `update.html` recovery page checks the current manifest before detaching only the worker registered at this app's exact scope and script path. It explicitly downloads the replacement with `updateViaCache: 'none'`, waits for activation, and checks the worker's reported pack version before opening a unique index URL. Both the old worker script and the old HTTP document cache are bypassed. It does not delete IndexedDB, localStorage, CacheStorage or another application's worker. Save/export each open project and close the other DUETBlox tabs before using it; prepare the new offline pack afterwards. Hosting-wide configuration is unchanged. Correct app-scoped cache headers and a normal update notification remain follow-up work; this page is an explicit recovery path.

Six separate Playwright recovery scenarios passed using an actual cache-first service worker and the observed ten-year HTTP cache headers. They verify loading the new app, subsequent reloads at its ordinary address, preservation of IndexedDB/localStorage/caches and unrelated workers, safe failure on an unavailable server, acknowledgement gating, refusal to detach a different worker at the same scope, rejection of the wrong reported pack, and rejection of an unacknowledged continuation link. Recovery uses a fresh document between removal and installation so its own old controller cannot hold the replacement in a waiting state. Run `npx playwright test --config tests/update-recovery/playwright.config.js`.
