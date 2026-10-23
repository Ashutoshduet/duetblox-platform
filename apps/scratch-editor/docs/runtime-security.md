# Dependency assessment — 16 October 2026

The pinned official editor is a development release integration, not a blanket security certification. `audit-production.json` records `npm audit --omit=dev`: 34 affected package entries, including transitive dependents (10 critical, 10 high, 13 moderate, 1 low). This is the installed npm graph, not 34 separately confirmed browser exploits. Official GUI packages list several build and localization tools as production dependencies.

## Actual browser code inspected

We inspected original npm source maps for `scratch-gui-standalone.js` and `scratch-vm.js`, along with relevant source call sites. GUI contains hull.js, cookie, decode-uri-component and uuid. The inspected GUI/VM maps do not include request, form-data, minimist, tar, postcss, braces, diff, qs, serialize-javascript, tough-cookie or sprintf-js. Their critical/high audit entries are installed-tooling findings, rather than code in these browser entry bundles. This inspection is not a full transitive security audit of every optional extension and lazy-loaded asset.

- **hull.js, critical — mitigated in deployed output.** [GHSA-q849-wxrc-vqrp](https://github.com/advisories/GHSA-q849-wxrc-vqrp) affects versions 0.2.2 through 1.0.9 when an unsanitized third `format` parameter reaches its dynamic Function constructors. The upstream patched version is 1.0.10. Scratch's inspected `RenderWebGL.js` call is `hull(hullPoints, Infinity)` with no third argument. DUETBlox additionally removes both unused dynamic format converters from the actual GUI and renderer bundles, preserving the plain point-array path. `scripts/hardening.mjs` uses exact-match guards and the tests assert the vulnerable constructors are absent from both shipped bundles. npm's graph still reports the old package version; we have not falsely changed its version or claimed a library-wide upgrade.
- **decode-uri-component, moderate — remains inherited.** This is bundled through query-string in GUI URL parsing. The parent normally opens a fixed local `/scratch/index.html` URL, but arbitrary direct URLs are not comprehensively security tested. The upstream malformed-input decoding denial-of-service advisory remains a dependency remediation item before a broad public release.
- **uuid, moderate — affected API not identified at inspected VM call.** VM calls `uuid.v1()` for run IDs. The advisory concerns buffer bounds in v3/v5/v6 with supplied buffers. This is a call-site assessment, not a claim that every GUI dependency use has been audited.
- **cookie, low — affected API not identified at inspected GUI calls.** Theme/color persistence uses `cookie.parse(document.cookie)`; the reported invalid name/path/domain issue concerns serialization. No vulnerable serialization call was identified in those persistence modules.

Pinning npm overrides alone does not change dependency code embedded in the official precompiled GUI/VM. A future dependency upgrade should rebuild and validate upstream components or use an explicitly reviewed bundle transformation. This integration's targeted changes are listed in NOTICE.txt and reproducible from source.

## Browser isolation retained

The bridge checks source and origin, accepts a finite command catalog, and rejects arbitrary extension URLs. Scratch's SVG/Paper sandbox keeps its `allow-scripts`-only opaque origin. On loopback hosts the build selects upstream's existing inline script delivery branch, avoiding blocked requests from opaque origins to the local network; it does not add `allow-same-origin` or disable sandbox isolation.
