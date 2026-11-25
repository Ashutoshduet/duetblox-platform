# DUETBlox 0.9.4 — Consistent Junior engine updates

A browser retaining older Scratch files could show the new Junior interface and mascot preview while never acknowledging a completed story or goal. This was reproduced in an existing in-app browser session with a fresh three-block story: Go right 3, Hop 2, Say “I did it!”. The story finished, but no completion feedback appeared.

Scratch's entry HTML, bridge JavaScript and editor CSS now use content-derived filenames. Both Junior and normal Blocks load the entry generated for their build. The stable files remain as compatibility aliases. Changing only URL query parameters was insufficient because older offline workers normalize those parameters away.

Junior verifies that the stage announces completion support before enabling Play. An older bridge produces a visible update message while the story remains editable and downloadable. The offline worker also checks every uncached known asset against its release hash before returning it; a full browser cache does not block a verified online response or falsely claim offline readiness.

The initial shell installation no longer downloads the separately loaded 20 MiB SPICE worker. The worker stays in the full offline pack and is verified when used online. This reduces the shell from approximately 22.45 MiB to 3.19 MiB without removing simulation or full offline support. Existing update recovery preserves projects, datasets and downloaded caches.

Validation includes deterministic legacy-cache response scenarios, incompatible bridge readiness, real Scratch movement and automatic goal feedback, verified online cache misses, integrity failure, cache quota failure, and the full production browser suite. Test evidence and deployment checks are retained in `work/mascot-cache-fix-20261126/` in the laptop checkout. The original user's story was exported before the demonstration.

The new characters remain celebration companions; this update does not replace existing stage characters. Physical hardware validation, Windows packaging and child usability testing are separate outstanding work. Long-lived host cache headers are not changed by this release; already-open older app sessions may need the app-scoped update recovery page.
