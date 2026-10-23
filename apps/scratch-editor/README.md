# DUETBlox official Scratch editor integration

This package hosts the official Scratch 3 GUI, VM, renderer, paint editor, sound editor, storage and built-in extensions. It does not recreate the Scratch runtime. Exact official npm package versions and integrity hashes are recorded in `package-lock.json`.

The application uses AGPL-3.0-only; see `LICENSE` and `NOTICE.txt`. Default robot artwork and DUETBlox branding are original. Component copyright, license and trademark notices remain in `public/scratch/licenses` and the upstream bundle notice files.

## Build

Run `npm ci` then `npm run build` in this directory, or use the root application build. The script generates `../../public/scratch`. Serve that directory through the root application's HTTP server, mounted at `/scratch/`.

- `/scratch/index.html`: complete official block editor, costumes and sounds.
- `/scratch/index.html?mode=stage`: official VM and renderer with keyboard, pointer, sound and ask/answer input for Junior.

The normal editor includes the standard categories, sprite/backdrop and sound management, `.sb3` import/export, core extension library, plus DUETBlox image-learning and board blocks. These custom blocks delegate model and device operations to the parent shell. The standard asset libraries require network access. Text-to-speech/Translate retain upstream service dependencies; hardware extensions require their own compatible devices/transport support. These service/device paths were not all physically validated.

## Parent bridge

Use a same-origin iframe. Both sides must check exact `event.source` and `event.origin`.

```js
iframe.contentWindow.postMessage({
  channel: 'duetblox', requestId: 'unique-id', type: 'greenFlag', payload: {}
}, location.origin);
```

Wait for `{channel:'duetblox',type:'ready',payload:{mode,...}}`. Responses use the same requestId and `type:'result'` or `type:'error'` with `{message}`. Commands:

- `loadProject`: `{project: object|string, encoding?: 'json'|'base64', assets?: [{md5ext,dataFormat,data,encoding?:'base64'}]}`. Base64 is a complete `.sb3`. Text assets are UTF-8. Optional asset data are cached before the official loader runs.
- `resetProject`: restore the original Duet robot and blank stage; returns status.
- `getProject`: `{project: object}` containing Scratch project JSON, for code generation. Assets are obtained using `saveProject`.
- `saveProject`: `{base64,mimeType,filename}` containing complete `.sb3` with assets.
- `greenFlag`, `stopAll`, `status`, `ping`.
- `addExtension`: `{id}` from the curated built-in/custom catalog. Arbitrary extension URLs are rejected.
- `keyboard`: `{key,isDown}` for explicit parent keyboard forwarding.

The iframe emits `status` with `running`. `PROJECT_STOP_ALL` also emits `stopped:true`; the official green flag stops the previous execution before starting the new one. Do not treat that initial stop as the completion of the next run. `changed` reports project edits.

Custom blocks emit `{type:'extensionRequest',requestId,payload:{extension:'ml'|'hardware',method,args:[]}}`. Reply with `{type:'extensionResult',requestId,payload:{result}}` or `{error:string}`, preserving channel. Errors also emit `extensionError` for the shell to display. Calls time out after 30 seconds.

ML methods: `predict`, `label`, `confidence`, `confidenceFor(label)`, `isReady`. Confidence values are 0–100. Hardware methods: `setPinMode`, `digitalWrite`, `analogWrite`, `readAnalog`, `readDigital`. `duetHardware_whenBoardStarts` is an export entry point and does not fire during live Scratch execution; use the green flag for live programs.

## Verification

`npm test` uses a local Chrome installation (override executable with `CHROME_BIN`). The tests start their own HTTP server and use Playwright only for automated integration checks. Final verification: four tests passed on 16 October 2026.

- Real VM repeat execution and sound playback data in Normal and stage modes.
- Complete `.sb3` save/reload with SVG and WAV assets; restored state and resetProject.
- Standard Pen extension registration and rejection of arbitrary extension URLs.
- Normal editor's full categories, vector costume editor and sound waveform editor.
- Custom ML/hardware block execution through the checked parent bridge, persisted in `.sb3`.
- Actual shipped hull formatter hardening and rejection of executable format strings.

Screenshots from verification are stored in `work/test-results`; they are not web assets. No physical board flashing, microphone/camera permission flows, or exhaustive upstream compatibility suite was claimed by these tests. See `docs/runtime-security.md` for the dependency audit assessment.
