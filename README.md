# DUETBlox

Live app: **https://duetpower.in/duetblox/**

Public repository: **https://github.com/Ashutoshduet/duetblox-platform**

```sh
git clone https://github.com/Ashutoshduet/duetblox-platform.git
cd duetblox-platform
```

DUETBlox 0.7.1 is a browser-first educational coding application using official Scratch components, an original Junior editor, local machine learning, Python and Arduino/ESP32 programming. This update improves block discovery, runnable examples, narrow editor layouts, Stop/recovery during project loading, and Junior editing. Boards can be tried with simulated inputs/outputs in the browser. Windows packaging, additional robot protocols and physical board acceptance remain outstanding. See [0.7.1 changes and testing steps](docs/release-0.7.1.md).

## Run locally

If the supplied `dist/` build is already present, run `node scripts/serve-built.mjs` with Node.js 22 or later. This needs no npm install and serves only the built app on `http://127.0.0.1:5173`. Keep the terminal open. For development or rebuilding, use the steps below.

Use Node.js 22 or later and npm:

```sh
npm ci
npm --prefix apps/scratch-editor ci
npm run build:editor
npm run offline:download
node scripts/restore-source-packets.mjs
npm run build
npm run dev
```

`offline:download` needs internet to acquire missing checksum-pinned model/media/Python runtime files; `restore-source-packets.mjs` restores the exact dependency source archives and verifies their checksums. The app source and all DUETBlox changes are in this repository; a complete supplied pack is verified locally. Normal builds verify the bundled files and do not silently fetch missing ones. Keep the lock files, notices and local packs when copying the project.

Open the printed localhost URL. Desktop Chrome or Edge supports the intended Web Serial path. Production serves the complete `dist/` folder at an HTTPS origin or a dedicated directory. All bundled resources must remain available beneath that deployment directory. Each browser origin has its own local data; transfer projects with `.duet` files.

### Deploy under a directory

For the DUETPower deployment, build with `DUETBLOX_BASE_PATH=/duetblox/ npm run build`, then serve the complete contents of `dist/` inside the website's new `duetblox/` directory. The editor, models, Python, downloads, PWA and offline worker use that same prefix. `npm start` detects the built prefix and prints the correct local URL. The default build still uses `/` for a dedicated app origin. See [directory deployment](docs/subdirectory-deployment.md) for packaging, isolation and verification.

## Use offline

Offline preparation is available in the production build (`npm start`), not the Vite development server (`npm run dev`).

The complete local folder can serve bundled files without internet while its server runs. Preparing the browser pack additionally makes those files available from browser storage when the source server is unavailable.

1. Open the supplied local app at `http://127.0.0.1:5173`, or open the hosted production app while connected.
2. Choose **Offline → Make available offline**. Leave the page open until it says **Your offline pack is ready**. The full pack is approximately 300 MB; the page shows the exact size for your build. Files are checked against the build's byte counts and SHA-256 hashes before being saved. **Cancel preparation** retains completed files for a later retry.
3. Enable **Use offline mode** to serve the prepared app files and block external app network requests. The separately installed local Arduino compiler at localhost port 8765 and the private classroom API on literal local-network addresses remain permitted. Classroom sharing still needs its room server and a network connection to that server. Use the same browser profile, address and port when reopening. `localhost` and `127.0.0.1`, or different ports, are different storage locations.
4. Keep **Save project** `.duet` downloads outside the browser. Clearing browser data or automatic storage eviction can remove cached app files, local projects and lesson progress. **Check / repair offline files** can verify or restore the pack when the source folder/server is available again. A newer release may need preparation again.

The pack includes the coding surfaces, standard Scratch media, image/sound/pose backbones, text/numerical learning, the experimental object finder, the Python runtime, lessons and prepared live firmware. It does not include every external extension service or source archive in the browser cache. Link-based Teachable Machine imports, online translation/text-to-speech and external videos need internet; turn off **Use offline mode** to use them. Native board compilation needs the local helper, Arduino CLI, cores and libraries installed beforehand. Camera, microphone and USB require the relevant browser permissions even offline.

If Chrome or Edge offers **Install app**, DUETBlox can open in its own browser-managed window. Installation is optional and does not replace offline preparation. It is not a Windows `.exe` installer. See [local ML model details](docs/offline-models.md) for exact checkpoints and compatibility limits.

## Workspaces

| Workspace | Implemented behavior | Limits |
|---|---|---|
| Junior Blocks | Picture blocks; multiple scripts; flag/tap/bump/message events; scene transitions; movement, hop, size, visibility, speech, repeat/forever, if/otherwise decisions, pen, costumes; paint and image/audio imports; recording controls; AI/device blocks; undo/redo; story save/open | Original implementation running on the official Scratch VM. Proprietary PictoBlox AI/robot extensions are not replicated. Camera/microphone permission paths and physical outputs still require device QA. |
| Blocks | Official Scratch GUI/VM, standard categories, sprites, costumes, sounds, backdrops, `.sb3`, extension library; DUETBlox image/sound/pose/text/numbers, nested Data lists, private classroom and Arduino/ESP32 categories; prediction acceptance checks; upload checker/C++ preview, board-specific pin choices and live value inspection | External services and devices retain their own dependencies. Private classroom shared variables use the separate room service; no Scratch community login or public social network. |
| ML Studio | Image, sound, pose, text and numerical training; dataset/model import/export; Teachable Machine import for image/sound/pose; block integration. Image/sound/pose have separately uploaded evaluation sets, duplicate checks, confusion matrices, per-class precision/recall/F1 and JSON/CSV reports. Classifiers have configurable prediction acceptance limits. Text adds word contribution explanations and a separate training-time holdout check. Image/sound/pose checkpoints are bundled locally. | Offline use needs the bundled files from the running local server or a complete prepared browser pack. Sound requires a background-noise class. Pose uses official PoseNet features and accepts only supported checkpoint configurations. Text uses local word counts, not a language model or translation service. Image/sound/pose/text run in the browser; bounded numerical models can be included in standalone Arduino/ESP32 programs. Small fixture results are not real-world accuracy claims. |
| Boards | Uno R3, Mega 2560, classic Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM; GPIO, PWM, ADC where available, servo, tone; live serial control; standalone C++ generation; local CLI compilation; browser uploads with verification; compiled live firmware. Readiness checks, capability details, cancel/reconnect controls and local diagnostics export clarify the connection workflow. | All five profiles compiled with official toolchains. No physical board was attached for validation. CAM camera/SD functions are not implemented. Other adapters remain explicitly planned. STEMpedia boards are collapsed under Other boards. |
| Python | Actual CPython, standard library, queued input, output/errors, immediate Stop, .py files and project persistence | No Scratch-to-Python conversion, graphical canvas, optional packages or MicroPython deployment. |
| Object learning (experimental) | Student-labeled boxes, foreground/background crop training, still-image scans, holdout matches/misses/extra detections, project save/open and Scratch reporters | Fixed windows and learned crop classes, not learned localization. Limited scales/aspect ratios; false positives and missed objects remain. No live camera detector or MCU deployment. |
| Classroom | Teacher/student room keys, project gallery, shared numeric variables and Blocks integration; explicit LAN opt-in | Private service required. Keys stay in browser memory. Last-write-wins values; no atomic counters, public profiles or comments. |
| Projects | IndexedDB local saves; `.duet` v4 contains Junior, Scratch, Python, training datasets/models, prediction settings and separate image/sound/pose evaluation datasets; opens v1/v2/v3 projects | Reports must be rerun after loading or replacing a model. Keep downloaded backups. Browser data can be cleared; no cloud sync. |
| Learn step by step | Seven English/Hindi lessons for Junior stories, Scratch sequences, image testing, text classification and Arduino Uno; real Junior/text starter downloads; collapsible guide available while coding; local manual checkmarks | Progress is self-reported, stored in this browser and separate from `.duet` projects. These lessons do not automatically assess learning or certify hardware success. Editor controls retain their existing language. |
| Offline | Production service worker, verified pack preparation, progress/cancel/repair controls, explicit offline mode and optional browser installation | Browser storage can be evicted. Cloud services, model URL imports and external videos are not supplied locally. Native compiler/toolchain setup is separate. No Windows `.exe` package yet. |

## Try it

1. Start with **Learn step by step** or the home-page **Start a guided lesson** button. Choose English or हिन्दी, open an activity, and follow its compact guide above your work. Check a step only after trying it; progress is not automatically awarded. In **Junior Blocks**, add scripts and picture blocks, edit their values, then press Play story. Scenes, sprite media and sound are saved in the story.
2. In **Blocks**, make a green-flag script and run it. The official Costumes and Sounds editors remain available.
3. In **ML Studio**, select Image, Sound, Pose, Text or Numbers. Image/sound/pose need at least six examples per class. Text needs at least three distinct examples per class; five or more enable its separate holdout check. Train, then test new inputs. Sound includes an optional synthetic example dataset. Start camera/microphone only through the corresponding control. An active selected input remains available when moving to Blocks or Junior; the top-bar stop control releases it.
4. For Image, Sound or Pose, scroll to **Check with new examples**. Upload separately collected, labelled examples and choose **Evaluate new examples**. Review mistakes, missing classes and Unknown results before adjusting acceptance limits. Keep a final test set you do not tune against. In Text, review **Why this prediction?** and the holdout results.
5. Choose **Save project** for a portable `.duet` v4 backup, including evaluation examples. **Open** accepts `.duet` and `.sb3`.
6. In **Boards & robots**, choose the exact model and review its readiness and capability details. **Prepare live firmware** validates its compiled firmware, then **Select port & upload** requests the serial port. AVR upload replaces the existing program; the supplied ESP32 merged image replaces all 4 MB of flash, including saved settings and filesystem data. Afterwards, **Connect board** enables interactive blocks. Cancel/reconnect controls and **Export diagnostics** help with connection problems.
7. For programs that run disconnected, use **Generate Arduino code** or **Compile current blocks** with the [local compiler helper](tools/windows-bridge/README.md). Browser-only native compilation is not provided: Arduino CLI runs locally. Generated standalone programs use supported numeric/control/device blocks and non-recursive numeric/boolean My Blocks. Small numbers models can be embedded; unsupported stage and media-ML blocks produce diagnostics.

## Validation

```sh
npm test
```

See [release validation](docs/validation.md), [0.5.0 changes](docs/release-0.5.0.md), [0.4.0 changes and limitations](docs/release-0.4.0.md), [0.3.0 baseline](docs/release-0.3.0.md), [Junior checks](docs/junior-validation.md), [ML checks](docs/ml-multimodal.md), [local ML assets](docs/offline-models.md), [hardware readiness](docs/hardware-readiness.md), and [hardware documentation](docs/hardware.md). Tests distinguish protocol emulation, actual toolchain compilation, browser behavior and physical validation. A successful cache build alone does not establish successful offline training or real hardware operation. No physical upload success is claimed.

The editor harness is `npm --prefix apps/scratch-editor test`; it uses local Chrome. Current integrated checks use isolated development-test Chrome and the real Scratch VM; earlier in-app-browser checks remain dated historical evidence. For firmware regeneration, use `src/hardware/build-firmware-bundles.mjs` with the documented pinned CLI/core/library versions.

## Source and architecture

The host uses React 18.3.1 and Vite 6.4.4. Official Scratch GUI/VM/render/storage packages are pinned to 15.2.0. The media ML stack remains TensorFlow.js 1.3.1, Teachable Machine image 0.8.5 / pose 0.8.6, speech-commands 0.4.0 and PoseNet 2.2.1; text uses DUETBlox's local Multinomial Naive Bayes implementation. Numerical learning uses an original standardized softmax/ridge implementation with portable coefficients. Python uses Pyodide 314.0.7 / CPython 3.14.2 with pinned local assets.

`src/App.jsx` owns navigation/projects; `src/junior` compiles pictorial programs into Scratch projects; `apps/scratch-editor` embeds the pinned official editor and same-origin bridge; `src/ml` owns the training pipelines, prediction decisions and evaluation; `src/hardware` owns profiles, firmware, code generation and readiness; `src/programming` supplies browser flashing. `src/learn` contains the lessons and isolated local progress store. `src/offline` owns cache preparation/status and request handling; `scripts/build-offline.mjs` generates the final build inventory and worker. `public/models` and `public/scratch-media` hold bundled assets and provenance. `tools/classroom-server` supplies the authenticated private room gallery and shared numeric values. `src/python` supplies the isolated local Python workspace. `tools/windows-bridge` is the cross-platform local compiler helper; its historical folder name does not indicate a Windows desktop release.

The REA skill was applied to selected shipped DUETBlox JavaScript and the current PictoBlox public GUI. Bounded function excerpts establish Scratch-runtime, Arduino-generator and Teachable Machine import overlap; the full PictoBlox bundle exceeded its configured analysis memory. Ghidra analyzed DUETBlox's shipped Uno live firmware and the official historical mBlock 4 Uno firmware, with imported flash bytes verified against original Intel HEX. That historical artifact is not current mBlock 5. Evidence under the local handoff's `validation-evidence/comparison-041/` distinguishes native analysis, static JavaScript findings and runtime tests. These findings guided independent implementation; no PictoBlox code or artwork is incorporated. REA and Ghidra are analysis tools, not block-programming runtimes. The [0.5.0 release record](docs/release-0.5.0.md) describes the changes and current limits.

The source ZIP, upstream source archives and notices are available from Help & about. See [research](docs/research.md), [source distribution](docs/source-distribution.md), and [upstream runtime security assessment](apps/scratch-editor/docs/runtime-security.md). DUETBlox is AGPL-3.0-only with retained dependency licenses. No PictoBlox code, logo or mascot is included. The DUET STEM logo remains pending from the user.

## Studio 0.6

Normal Blocks now has an original DUETBlox toolbar, Project map search, bounded Learning steps, and an explicitly enabled Virtual Board Lab. Downloadable examples let students try each without overwriting their current work automatically. The official Scratch language/runtime remains underneath. See [release scope](docs/release-0.6.0.md) and [validation](docs/validation.md).

## Private classroom quick start

Run `npm run classroom:init -- --room classroom` once to generate separate teacher/student keys. Keep those keys private. Then run `npm run classroom` and open the printed loopback URL; the server serves the prebuilt app as well as its room API. LAN listening is an explicit operator choice, documented with exact origin configuration in [classroom setup](docs/classroom.md). The service is not started or exposed to the LAN automatically.

## Release 0.7 evidence

The new REA excerpts cover PictoBlox Python worker startup and separate numeric/object import paths; they do not reveal its training backend. Ghidra actually decompiled a new sensor-fed DUETBlox Uno classifier, with loaded flash matching its HEX bytes. These observations are recorded in `work/release-070/` and copied to handoff validation evidence. See [Python](docs/python.md), [numerical learning/deployment](docs/number-learning.md), [experimental object learning](docs/object-learning.md), [nested data lists](docs/data-lists.md) and [0.7 release scope](docs/release-0.7.0.md).
