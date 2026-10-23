# DUETBlox 0.4.0

This browser release makes offline preparation explicit and gives students a guided route into the coding and ML workspaces. It bundles the local files needed for the standard media library and pretrained ML backbones, adds English/Hindi lessons, and shows what is ready to use without internet. The existing hosted site is not updated merely by saving this release on the laptop.

These additions address specific gaps found in the [comparison and REA investigation](comparison-2026-10.md). They do not establish that DUETBlox is better overall than Scratch, PictoBlox, mBlock or other educational tools. Those products already provide substantial offline, teaching, ML and hardware functionality; comparative learner outcomes and accuracy have not been measured here.

## Prepare once, then use the browser app offline

The production app now has an **Offline** page. **Make available offline** saves the final build's coding surfaces, JavaScript modules, fonts, standard Scratch media, image/sound/pose models, lessons and prepared Arduino/ESP32 live firmware. The complete pack is approximately 300 MB; the current build's exact file count and size are shown in the interface.

The app checks each file's byte length and SHA-256 digest against its build inventory before caching it. Preparation shows progress, can be cancelled, and reuses completed files on retry. A failed or incomplete preparation does not become an offline-ready pack. **Check / repair offline files** verifies existing cached bytes and restores missing or changed files while the matching source server/folder is available. The manifest ties a pack to a particular build; a new build can require preparation again.

**Use offline mode** serves prepared files and blocks other requests from the controlled app. This is an app request policy, not a switch that disables the computer's Wi-Fi. The local compiler service on localhost port 8765 remains permitted because it does not require internet to compile after its toolchains have been installed. The service worker does not force a replacement build over currently open project tabs; close old tabs and reopen when adopting an updated release.

For the downloaded laptop copy:

1. Run `npm start` with Node.js 22 or later when `dist/` is supplied, or use the handoff's browser launcher. This starts the built app without installing npm dependencies.
2. Open `http://127.0.0.1:5173`, choose **Offline → Make available offline**, and keep the page open until the pack is ready. The downloaded local folder supplies those files; a hosted copy needs an initial connection to its host.
3. Enable **Use offline mode**. Continue using the same browser profile, address and port. `localhost`, `127.0.0.1`, a hosted address and different ports have separate browser storage.
4. Download `.duet` backups using **Save project**. Browser cache and project storage are separate from those backup files. Clearing browser data, changing profiles or browser storage eviction can remove local app files, project saves or lesson progress.

Offline preparation is a production-build feature. `npm run dev` remains the Vite development server and does not create a prepared browser installation. Source archives are retained in the downloaded distribution and `/source/` when the server is available; the browser offline pack excludes those archives to avoid duplicating large source downloads.

The complete laptop folder can also serve its bundled files without internet while its local server runs. Preparing the browser pack additionally allows the controlled app to use cached files when that source server is unavailable; exact tested workflows are recorded in the validation report.

If a supported browser offers **Install app**, DUETBlox can run in its own browser-managed window. Installation is optional; a prepared browser tab also works. The installable browser app is not a Windows `.exe`, and installation alone does not download the full offline pack. Native Windows packaging remains a later stage.

## Local model and media dependencies

Image, sound and pose now load their pretrained backbones from the app's `/models/` directory. The pinned pack includes the image MobileNet V2 checkpoint, speech-commands model and labels, and supported MobileNetV1/ResNet50 PoseNet configurations. Text classification already needed no pretrained download. Saved image/sound model files and supported pose models can be loaded locally; a Teachable Machine model link still needs internet to fetch the external model. See [offline model details](offline-models.md) for exact configurations, unsupported combinations and source hashes.

The official Scratch library's content-addressed sprite, costume, backdrop and sound files are mirrored under `/scratch-media/`, with source URLs, hashes and upstream notices. Existing library selectors use the local asset paths. Model and media packaging keeps provenance; it does not imply new ownership or grant use of upstream trademarks as DUETBlox branding. Retain the supplied notices and applicable media credits when distributing the app.

Maintainer commands are:

```sh
npm run build:editor
npm run offline:download
npm run build
npm start
```

The explicit `offline:download` command acquires missing media/model assets from the recorded upstream sources. Normal builds verify already-present files and fail on missing or invalid assets. `scripts/build-offline.mjs` runs after the final Vite build and produces `offline-manifest.json` and the matching service worker. Serving only the HTML or host JavaScript is insufficient: retain the complete `dist/` tree.

## Five lessons that stay beside the work

**Learn step by step**, also linked from the home page, contains five short guided activities:

- Junior: run a story, edit speech, change movement and save it.
- Blocks: connect a green-flag event, movement and speech, then add a repeat.
- Image learning: train two shape classes, test a new picture and inspect separate evaluation results.
- Text learning: teach Hindi/English greetings, inspect word influences, try Unknown inputs and use predictions in Blocks.
- Arduino Uno: confirm the exact board, prepare live firmware, observe the onboard LED, then control it with blocks.

Students can switch explanations between English and Hindi. The instructions preserve the exact existing control names so students can find them in the editor. This does not translate every editor or extension control.

Opening an activity keeps a compact guide in its own row above the coding surface. It reserves document space so it cannot cover stage or hardware controls, and can be collapsed or paused without losing its place. Checkmarks are explicitly self-reported; changing pages or pressing Next does not claim that an exercise succeeded. Progress is stored under its own local browser key and stays separate from projects, models and `.duet` files. Resetting one lesson clears only its checkmarks and step position.

The Junior and text lessons include real downloadable starter files. Downloads do not replace current work; students choose when to open them. Lessons remind students to save before replacing existing datasets or stories, distinguish test examples from training examples, and separate live USB control from programs that run on a disconnected board. The Arduino lesson does not mark physical success until the learner reports observing it.

## Architecture and REA scope

The host remains React 18.3.1 with Vite 6.4.4. The official Scratch GUI, VM, render and storage packages remain pinned to 15.2.0. Junior compiles its picture programs into projects executed by that Scratch VM. Image/sound/pose use the existing pinned TensorFlow.js and official model libraries; text uses local Multinomial Naive Bayes. IndexedDB and ZIP-based `.duet` v3 projects retain the four models, datasets, programs and prediction settings.

`src/offline` adds the production service worker and preparation/status UI. `scripts/build-offline.mjs` inventories the actual final output. `src/learn` adds the lesson content, starter files, accessible controls and separate progress store. Hardware remains a Web Serial/browser-flashing layer plus an optional local Arduino CLI compiler service.

The REA skill was applied through the pinned `rea-agents@6.5.0` CLI to four selected paths from a frozen **0.3.0** DUETBlox build, and separately to PictoBlox's public HTML and two small referenced bootstrap bundles. Both semantic graphs were partial and reached their chosen node ceilings. These analyses identified static entrypoints and loading/dependency candidates. They did not execute either application, analyze PictoBlox's main GUI, decompile a desktop product or certify the new offline implementation. The exact invocations, evidence identities and limitations are recorded in the [comparison document](comparison-2026-10.md).

## Validation and remaining boundaries

Final build, automated-test and production-browser outcomes belong in the [release validation record](validation.md). Source inspection, a valid asset inventory and a cache-ready badge do not by themselves prove that a fresh offline model can train or that physical hardware works. The investigation preserves this distinction when reporting browser observations.

Online model links, external tutorial videos, translation/text-to-speech services and other cloud extensions still need internet. Board compilation needs the local helper, Arduino CLI, cores and required libraries installed beforehand. Camera, microphone and USB access still depend on browser support and permission. Bundling model files does not validate live capture hardware or improve a classifier's real-world accuracy by itself.

The five implemented Arduino/ESP32 software profiles retain their prior compile evidence and explicit physical-validation-pending status. ESP32-CAM camera/SD programming, planned robot adapters, object detection training, hand-specific pose training, numerical ML and classroom services remain outside this release. Windows `.exe` packaging, representative student usability studies and broad device/accessibility acceptance also remain outstanding.
