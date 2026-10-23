# Deploy DUETBlox inside an existing website

Build a dedicated directory mount without changing the parent website:

```sh
DUETBLOX_BASE_PATH=/duetblox/ npm run build
npm test
DUETBLOX_BASE_PATH=/duetblox/ npm --prefix apps/scratch-editor test
node apps/scratch-editor/scripts/verify-face-offline.mjs
DUETBLOX_PORT=5198 npm start
```

The preview URL is `http://127.0.0.1:5198/duetblox/`. A root deployment remains available by omitting the build variable. Changing a build's mount requires rebuilding; copying a root build into a subdirectory is not sufficient.

## Publish

Copy **the contents** of `dist/` into a new `duetblox/` directory inside the existing HTTPS document root. Keep the index, hashed assets, `scratch`, `scratch-media`, `models`, `python`, `firmware`, `source`, `sw.js`, PWA and offline manifests together. No root rewrite, root service worker or main-site file replacement is required. A normal static directory index should serve `/duetblox/`, with `/duetblox` redirected to the trailing-slash address.

When a hosting file manager has per-file upload limits, create independent archives:

```sh
python3 tools/deployment/package_static.py dist /absolute/private/output --base /duetblox/ --max-mib 80
```

The packager checks every offline asset against its build checksum, rejects symlinks and hidden files, and creates archives whose paths all start with `duetblox/`. Upload and extract all parts inside a fresh **private staging directory**, then move only the completed new `duetblox` folder into the document root. Never replace an existing folder without reviewing it. Keep the deployment manifest locally so archive and file hashes can be checked after upload.

## Isolation and validation

- The worker is registered from `/duetblox/sw.js` with scope `/duetblox/`. Its cache and metadata names include the mount. Requests to same-origin paths outside that directory pass through, even when the app's offline mode is enabled.
- The PWA identity, start URL and scope use `/duetblox/`. Do not add a `Service-Worker-Allowed: /` header or put its worker at the website root.
- The worker client and pose asset preparation require DUETBlox's own worker; an unrelated main-site worker is not accepted as the app's worker.
- The optional classroom service uses the teacher's explicitly configured server address. Its `/api/classroom/` routes are independent of the static app mount.
- Source restoration accepts the complete HTTPS directory URL. Dependency/source ZIPs are provided for licensing and rebuilding; they are deliberately excluded from browser offline storage.
- Save checksums of the parent site's important pages before publication and verify them afterwards. Test the app home, Blocks, Junior, Python, ML asset loading, board downloads, source links and offline preparation at the actual HTTPS address.

The app uses browser storage. Moving from a different domain does not transfer saved projects automatically: export `.duet` files from the old address and open them at the new one. Private classroom sharing still needs its separate server. Physical hardware validation and native compiler setup are separate from static hosting validation.
