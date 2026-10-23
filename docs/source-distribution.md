# Source distribution

The hosting Git repository keeps editable source, lockfiles, asset provenance and checksum manifests. Large reproducible model/media weights and upstream archive packets are omitted from Git pushes. The full laptop handoff contains them. For a fresh Git checkout or application source ZIP, run `npm run offline:download` and `node scripts/restore-source-packets.mjs` before building. The latter fetches unchanged Scratch and ESP32 sources from the exact official URLs in the included manifests, verifies full archives and split parts, and restores the smaller hardware packets from the matching published release. It refuses checksum mismatches.

The public `/source/` page provides DUETBlox's current source ZIP and changes, notices, build instructions, exact upstream URLs and full SHA-256 hashes. Unchanged upstream archives are downloaded directly from those official sources. `scripts/prepare-hosted-sources.mjs` removes only those locally mirrored packets from a hosting build after verifying them; every runtime asset, offline model, firmware bundle, and our own source remains. The local `dist/` and laptop handoff retain all source packets. The hosting input archive and its expanded contents must each remain below 256 MiB. Source packaging does not change the application/offline pack. `scripts/prepare-hosted-models.mjs` additionally omits the 23 ResNet50 weight shards from hosting only. The offline worker obtains their exact bytes from the pinned official HTTPS URLs, verifies size and SHA-256, then caches them at the original local URLs. The complete offline manifest still includes them, and a full offline preparation downloads them. All other runtime assets and every model architecture remain supported. The full laptop build retains all shards locally.

The source ZIP includes source-download metadata and scripts, but excludes archive packets to prevent recursive ZIPs. Source downloads require internet unless the full handoff is used. Archived verification notes below describe the full local packet; on the public site use the official full-archive links rather than local split-part URLs.

## 0.4.0 model/media packaging

The current application source ZIP excludes the unmodified bulk ML weights and Scratch media; their manifests, notices, SHA-256 locks and acquisition scripts are retained. The full laptop handoff includes the verified assets in `public/models/`, `public/scratch-media/` and `dist/`. When rebuilding from the source ZIP alone, after installing the pinned npm dependencies run `npm run offline:download` before `npm run build`. This explicit download uses the recorded upstream sources; normal builds verify local assets and do not silently download them. Fonts and their license texts are included. Keep the complete source packet in the laptop handoff and retain the source download page in each deployment. The browser offline cache excludes `/source/`; offline source access is through the downloaded folder.

DUETBlox 0.2.0 also includes `/source/hardware/`: exact Arduino AVR 1.8.8, Servo 1.3.0 and ESP32 3.3.7 source packets, firmware/generator/helper sources, SDK revision/build configuration records, licenses and checksums. The ESP32 archive is split below the hosting asset size limit. Its manifest identifies exact pinned inputs and explicitly records any unavailable upstream version information. All 19 hardware checksum entries and the split archive reassembly were verified on 17 October 2026. The unchanged Scratch source packet is described below.

The public source page is `/source/`. It links the root-generated `/source/duetblox-source.zip`, links to full pinned upstream source archives, checksums, reassembly script and build instructions. These downloads must accompany deployment of the matching application version. The app ZIP includes `public/source` metadata but excludes archive packets to avoid recursion; upstream archives are separate downloads.

The upstream packet contains 11 source archives (14 download files), approximately 118.43 MB total. The full editor tree is split into four parts of at most 24 MiB. All other archives are under 25 MiB. They preserve original sources, source assets, build scripts, tests, lockfiles and legal notices; they are not copies of the generated `node_modules` distribution directory.

| Source archive | Published version | Exact npm gitHead |
| --- | --- | --- |
| `paper-0.11.20221201200345-90d0fcf7e3e4.tar.gz` | 0.11.20221201200345 | `90d0fcf7e3e4a650eb4d308fb3cef94866113ed0` |
| `scratch-editor-15.2.0-970132883d63.tar.gz` | 15.2.0 | `970132883d63286762783448d4d487dcefedabf8` |
| `scratch-audio-2.0.268-f81ee34ac234.tar.gz` | 2.0.268 | `f81ee34ac23465bd63d88313c94e173af2a0cb99` |
| `scratch-audio-2.0.271-575bdae7ccc0.tar.gz` | 2.0.271 | `575bdae7ccc07aa1d6c48ea87b84f8eb33135c59` |
| `scratch-blocks-2.1.19-a599c0025170.tar.gz` | 2.1.19 | `a599c002517095322fd76538530fa67e0610dafb` |
| `scratch-l10n-6.1.118-91c3bc311fb9.tar.gz` | 6.1.118 | `91c3bc311fb95b562c273a9d24015d6287d101e9` |
| `scratch-parser-6.0.1-a9b466f23f39.tar.gz` | 6.0.1 | `a9b466f23f3955442357432f8832d4273586bc6f` |
| `scratch-render-fonts-1.0.252-c0d70b0a7fba.tar.gz` | 1.0.252 | `c0d70b0a7fbacb2175e2bc8beac1b94426d66064` |
| `scratch-sb1-converter-2.0.280-ff46e54ee373.tar.gz` | 2.0.280 | `ff46e54ee373f8a52e8f5da55bcabe734cb9e99e` |
| `scratch-translate-extension-languages-1.0.7-3c0b27e9b8f1.tar.gz` | 1.0.7 | `3c0b27e9b8f15eeb400ec4558e2eefca15e638fb` |
| `scratch-webpack-configuration-3.1.2-0eaa101c23bd.tar.gz` | 3.1.2 | `0eaa101c23bd76bf4134e5d0b769d580d735ff5e` |

The manifest at `public/source/upstream/manifest.json` lists exact package mappings, registry integrity values, full archive SHA-256 hashes and per-part checksums. The identical manifest is retained with the editor source at `apps/scratch-editor/docs/upstream-source-manifest.json`.

The archive acquisition records follow npm registry metadata for the installed pinned packages. All 2,621 compared source files from the GUI, VM, renderer, storage, SVG renderer and paint matched the respective published 15.2.0 package sources byte-for-byte. The release-input Git commit carries 15.1.2 manifest versions; upstream's release process applies `npm version 15.2.0 --no-git-tag-version` before building. The original build scripts and release workflow are preserved.

The `scratch-translate-extension-languages` GitHub repository returned 404. Its exact npm package is preserved as an explicit fallback: it includes the editable generator (`index.js`), tests, language data, package build script, README, BSD license and trademark notice. Its generated language list can be used without service credentials; regenerating the list may require the upstream translation service.

Verification completed: all 14 hosted files passed SHA-256 and byte-length checks; the four editor parts were reassembled outside the public directory, and the combined archive matched its original SHA-256. Every archive was checked for legal files and absence of `node_modules`. No full second build of the upstream monorepo was performed, so bit-for-bit source reproduction is not claimed. The tested shipping build uses exact published upstream distributions plus the documented DUETBlox patches. Other third-party dependencies and tools are specified by the pinned lockfiles and fetched by npm; this is not a full offline npm mirror.

## Downloaded files

- [​paper-0.11.20221201200345-90d0fcf7e3e4.tar.gz](../public/source/upstream/paper-0.11.20221201200345-90d0fcf7e3e4.tar.gz) — 1,108,975 bytes
- [​scratch-editor-15.2.0-970132883d63.tar.gz.part01](../public/source/upstream/scratch-editor-15.2.0-970132883d63.tar.gz.part01) — 25,165,824 bytes
- [​scratch-editor-15.2.0-970132883d63.tar.gz.part02](../public/source/upstream/scratch-editor-15.2.0-970132883d63.tar.gz.part02) — 25,165,824 bytes
- [​scratch-editor-15.2.0-970132883d63.tar.gz.part03](../public/source/upstream/scratch-editor-15.2.0-970132883d63.tar.gz.part03) — 25,165,824 bytes
- [​scratch-editor-15.2.0-970132883d63.tar.gz.part04](../public/source/upstream/scratch-editor-15.2.0-970132883d63.tar.gz.part04) — 6,958,618 bytes
- [​scratch-audio-2.0.268-f81ee34ac234.tar.gz](../public/source/upstream/scratch-audio-2.0.268-f81ee34ac234.tar.gz) — 481,569 bytes
- [​scratch-audio-2.0.271-575bdae7ccc0.tar.gz](../public/source/upstream/scratch-audio-2.0.271-575bdae7ccc0.tar.gz) — 484,276 bytes
- [​scratch-blocks-2.1.19-a599c0025170.tar.gz](../public/source/upstream/scratch-blocks-2.1.19-a599c0025170.tar.gz) — 555,150 bytes
- [​scratch-l10n-6.1.118-91c3bc311fb9.tar.gz](../public/source/upstream/scratch-l10n-6.1.118-91c3bc311fb9.tar.gz) — 10,945,016 bytes
- [​scratch-parser-6.0.1-a9b466f23f39.tar.gz](../public/source/upstream/scratch-parser-6.0.1-a9b466f23f39.tar.gz) — 20,613,752 bytes
- [​scratch-render-fonts-1.0.252-c0d70b0a7fba.tar.gz](../public/source/upstream/scratch-render-fonts-1.0.252-c0d70b0a7fba.tar.gz) — 697,053 bytes
- [​scratch-sb1-converter-2.0.280-ff46e54ee373.tar.gz](../public/source/upstream/scratch-sb1-converter-2.0.280-ff46e54ee373.tar.gz) — 896,042 bytes
- [​scratch-translate-extension-languages-1.0.7-3c0b27e9b8f1.tar.gz](../public/source/upstream/scratch-translate-extension-languages-1.0.7-3c0b27e9b8f1.tar.gz) — 60,679 bytes
- [​scratch-webpack-configuration-3.1.2-0eaa101c23bd.tar.gz](../public/source/upstream/scratch-webpack-configuration-3.1.2-0eaa101c23bd.tar.gz) — 128,130 bytes

## Reassembly and build instructions

The following text is also served as `public/source/upstream/BUILDING.txt`.

```text
DUETBlox 0.1.0 source distribution
================================

Files in this directory supplement /source/duetblox-source.zip. Together they
provide the DUETBlox application, its changes to the official bundles, and the
pinned Scratch Foundation source trees, original build scripts, source assets,
tests, lockfiles and license notices. manifest.json maps every included Scratch
npm package to its exact published version, registry integrity and gitHead.
SHA256SUMS covers each downloadable archive or part. reassemble.py verifies
those checksums, reconstructs the split editor archive and verifies its full
checksum. Run it with --verify-only to avoid creating a combined file.

NORMAL DUETBLOX BUILD (published upstream distributions)

Extract duetblox-source.zip, enter its project directory, install Node.js and npm
(the upstream source tree specifies Node 24.21.0), then run:

    npm ci
    npm --prefix apps/scratch-editor ci
    npm run build

The pinned npm distributions include the upstream compiled files. The build
applies the documented changes in apps/scratch-editor/scripts/build.mjs and
scripts/hardening.mjs, builds the DUETBlox wrapper and creates dist/. Its
package-lock.json verifies the installed dependency packages. If the optional
Windows bridge is needed, follow tools/windows-bridge/README.md separately.
Source archives remain separately hosted at /source/upstream/; the application
ZIP deliberately excludes that directory to avoid recursive/large archives.
For a new deployment, copy these source downloads into public/source/upstream
and this source page into public/source/index.html before the final root build.

UPSTREAM BUILD FROM EDITABLE SOURCE

Extract scratch-editor-15.2.0-970132883d63.tar.gz. The complete repository is
preserved, including .nvmrc, package-lock.json, .github build workflows, webpack
configurations and package scripts. Use Linux or a Unix-like environment with
Node 24.21.0, npm 10.9.9, Bash 4+ and jq. The upstream installation action lists
native Canvas prerequisites (pkg-config, Cairo, Pango, SSL, JPEG and GIF dev
libraries). Consult .github/actions/install-dependencies/action.yml for exact
upstream commands appropriate to your system.

In the extracted scratch-editor directory:

    NODE_ENV=development npm ci
    npm version 15.2.0 --no-git-tag-version
    npm run build

The registry gitHead is the release input commit; it contains version 15.1.2
manifests. Upstream release.config.mjs runs the npm version command above to
produce the 15.2.0 release manifests before building. Its scripts/npm-version.sh
updates all workspace versions and internal dependency pins. The 2,621 source
files compared in GUI, VM, renderer, storage, SVG renderer and paint were
byte-identical to the installed 15.2.0 packages; release version metadata is
expected to differ. The original upstream package-lock pins scratch-blocks
2.1.19, scratch-audio 2.0.268 and the other transitive versions in manifest.json.

After building, the GUI standalone bundle is in packages/scratch-gui/dist and
VM/renderer/storage/SVG bundles are in each package's dist/web. To integrate
these compiled source outputs, first install DUETBlox dependencies as above.
Replace the corresponding node_modules/@scratch/<package>/dist directories
inside apps/scratch-editor with the newly compiled dist directories (GUI, VM,
renderer, storage and SVG renderer), then run the DUETBlox build. Build guards
intentionally fail if the expected bundle fragments or minifier output drift;
review and adapt the documented patch functions in that case. Do not silently
remove those guards or claim an unapplied security patch succeeded.

The separate archives preserve editable source and build scripts for the exact
Blocks, Audio (both versions), Paper, localization, parser, fonts, SB1 converter,
and webpack-configuration dependencies. Their own README/package.json scripts
are authoritative for modifying/rebuilding them. For a modified dependency,
rebuild it, pack/install it in the upstream editor tree, then rebuild the editor.
An unmodified upstream build obtains the pinned versions via its lockfile.

SCOPE AND VERIFICATION

The standard DUETBlox build from the pinned published distributions and the
functional editor/runtime tests passed. Source archives were inspected for
licenses and source/build files, and every hosted archive checksum and the split
archive reassembly were verified. A second complete build of the upstream
monorepo from scratch was not performed; no bit-for-bit reproduction claim is
made. Upstream environment, dependency installation and minifier differences
can affect generated bytes. Dependencies and build tools outside these Scratch
repositories remain pinned in the respective lockfiles and are downloaded by
npm; this packet is not a full offline npm dependency mirror.

The scratch-translate-extension-languages repository returned HTTP 404 when
packaged. Its exact published npm source package is included instead. That
package contains index.js (the generator), tests, languages.json, package.json,
LICENSE, TRADEMARK and README. The language-data regeneration process may need
its upstream translation service credentials; the shipped language data itself
is included and is usable without regenerating that list.

LEGAL NOTICES

Preserve each archive's LICENSE/COPYING/NOTICE/TRADEMARK files and all bundled
third-party notices. Current core Scratch components are AGPL-3.0-only; Blocks
is Apache-2.0, Paper is MIT, and the translation-language package is BSD-3-Clause.
Fonts carry their own licenses. See exact files rather than applying one license
to every file. DUETBlox is independent and not endorsed by Scratch Foundation or
MIT. The source package is an engineering source-availability record, not a legal
certification. Keep source downloads accessible wherever the application is
provided, and update source/build instructions when deployed code changes.

```

## Python runtime in 0.7

The application distribution and full handoff include the unmodified selected Pyodide core runtime. The editable source ZIP retains its original licenses, exact upstream release/commit, per-file checksums and restoration script under `public/python/` and `scripts/`, without duplicating its compiled runtime files. `npm run offline:download` restores those exact runtime bytes before a build. `scripts/prepare-python-runtime.mjs` verifies those bytes before a build and can restore them from the pinned official core archive. `public/python/NOTICE.txt` links the Pyodide source commit/build instructions, CPython 3.14.2 and Emscripten 5.0.3 sources. Optional Python wheels are not bundled or automatically fetched. The separate DUETBlox worker/editor integration remains under the repository license.

Private classroom keys and saved gallery data default to `work/`, which is excluded from the source ZIP and deployment. Never copy a live room's key configuration into `public/` or `dist/`. The gallery is run by the local teacher service; static website hosting alone does not provide it.
