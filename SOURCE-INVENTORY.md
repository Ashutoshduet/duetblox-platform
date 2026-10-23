# Public source inventory

This repository contains all DUETBlox application, Junior editor, ML, Python,
offline, classroom service, hardware protocol/code-generator/firmware, and
Scratch-wrapper source code, tests, build scripts, lockfiles, examples,
license notices, dependency provenance, and asset/source checksum manifests.
DUETBlox is licensed AGPL-3.0-only. Third-party assets retain their own licenses.

Generated bundles, installed dependencies, large unchanged vendor model/media
files, compiled Python runtime, and upstream source archive packets are not
committed. Restore the exact pinned inputs with:

```sh
npm ci
npm --prefix apps/scratch-editor ci
npm run build:editor
npm run offline:download
node scripts/restore-source-packets.mjs
npm run build
npm test
npm --prefix apps/scratch-editor test
npm start
```

Use Node.js 22 or later. The source restoration script uses official upstream
archives plus the matching DUETBlox release for smaller hardware packets;
it verifies their byte counts and SHA-256 values. The root build verifies
local asset files instead of silently downloading replacements. See
`docs/source-distribution.md` for exact upstream revisions and rebuild details.
Editor browser tests require Chrome. Physical board tests need the actual
boards and local toolchain described in `docs/hardware.md`.

Raw reverse-engineering evidence, transient test screenshots/logs, downloaded
competitor artifacts, browser profiles, live classroom settings, user projects,
and personal data are deliberately excluded. They are not implementation
inputs. Research summaries remain under `docs/` with their limitations.

The private classroom service is separately started and does not become a
public community server merely by hosting the static browser app.
