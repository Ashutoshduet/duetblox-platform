# DUETBlox 0.9.1: Junior Blocks redesign

This update addresses the Junior editor's cramped layout and failed drops onto unused canvas space. The supplied PictoBlox Junior screenshot guided the layout hierarchy. The implementation uses DUETBlox's original artwork, editor model and compiler, and continues to execute programs through the official Scratch VM. It is not a claim of exact competitor parity or absence of all bugs.

## Interface and editing

- A focused purple toolbar replaces the surrounding app chrome while Junior is open. Workspace and Explore controls provide navigation, story Open/Save remains explicit, and complete-workspace Open/Save remains available. An active camera/microphone keeps its visible Stop control.
- A large dotted canvas sits beside the 4:3 stage, character rail and scene rail. The category dock and horizontal picture-block palette sit below the canvas. SVG puzzle-shaped pieces share their category colors across palette and program.
- Dropping an action into empty canvas space creates a positioned flag script, or reuses the selected empty script. Event pieces create scripts with their corresponding start events. Root blocks can detach or move between scripts; nested editing retains its explicit branch view.
- Script zoom is bounded to 60–140%. Drag/drop coordinates account for zoom and scrolling. Edge scrolling, Arrange, keyboard stack positioning and directly editable values remain available. Short desktop viewports use a compact canvas toolbar to keep Undo, Redo and zoom controls inside the visible canvas.
- Selecting a script, character or scene no longer consumes Undo history. Story and workspace downloads preserve programs and authored positions; older supported story/workspace versions remain readable.
- Character and backdrop painting are directly reachable. The twenty-costume limit is enforced at the media insertion boundary as well as in the shortcut controls, preventing a saved story from exceeding its import limit. The sound-library tile retains its visible picture-piece background.

At narrow widths, the editor stacks the stage beneath the coding area and permits page scrolling. Small-screen access uses tap-to-add and editable controls; this release does not introduce or certify native touch dragging.

## Local validation — 24 November 2026

| Check | Result |
|---|---|
| Root unit/regression suite | 376 passed |
| Official Scratch editor integration, correct `/duetblox/` base | 31 passed |
| Junior full-app scenarios, including twenty-costume round trip and sound-library visibility | All 6 passed in the final production suite |
| Zoom/scroll/drop/reorder canvas checks | 8 passed; zero captured page errors |
| Emulated touch-enabled Chrome at 390×844 and 820×1180 | Tap-to-add, numeric editing, category switching, reachable playback and no horizontal document overflow passed |
| Final combined production browser suite | All 22 passed in 1.0 minute, including actual cold-offline execution |
| Compact-toolbar regression at 1470×656, 1366×650, 1366×500 and 1440×900 | Controls remained inside the canvas; hit tests and actual Undo/Redo passed |

The final production suite's cold-offline scenario completed verified preparation, disabled network access, opened a fresh tab, and exercised SPICE, Python, numeric ML, Junior and Scratch. Short desktop canvases previously clipped the top of the vertical toolbar; the compact layout keeps its controls reachable and has explicit geometry and functional Undo/Redo checks. Publication checks are recorded separately after upload; a successful local build does not establish publication. The preceding [0.9.0 release](release-0.9.0.md) remains a separate dated validation record.

Full-app scenarios use the actual stage VM to verify motion and simultaneous scripts, nested repeat behavior, forever-loop stopping, resets, story/workspace archives and reload persistence. Canvas-specific checks verify transformed drop coordinates and long sequences. The sound test opens the library and checks its visibility; it does not request a physical microphone or assess audible quality.

Reproduce the main checks using the repository's installed dependencies:

```sh
npm test
DUETBLOX_BASE_PATH=/duetblox/ npm --prefix apps/scratch-editor test
DUETBLOX_TEST_URL=http://127.0.0.1:5222/duetblox/ npm run test:e2e -- tests/e2e/junior.spec.js
```

The last command requires the development server already running at that address. For the production suite, build for `/duetblox/`, serve the completed build at a consistent local origin, and set `DUETBLOX_TEST_PRODUCTION=1` with `DUETBLOX_TEST_URL` pointing to that origin. The production offline scenario must complete its verified preparation before testing a fresh tab with network access disabled. See [the production offline procedure](simulation.md#production-offline-check).

Evidence is retained locally under `work/junior-redesign-20261124/`. It includes baseline/final screenshots, unit and browser logs, `canvas-check.json`, `responsive-smoke.json`, media-boundary checks and the production test output. Earlier failed runs remain diagnostic evidence and are not counted as passing tests.

## Boundaries

This redesign preserves the existing Junior language and Scratch execution model; it does not add every PictoBlox block or proprietary extension. Movement squares remain twenty Scratch pixels. Scene transitions, ML input requirements, supported board protocols and standalone-upload limitations are unchanged. Normal Blocks remains the standalone Arduino program source.

No new Ghidra or REA analysis was performed for this UI revision. The prior bounded reference research remains documented in the 0.9.0 record. This update relies on the supplied screenshot, source inspection and direct DUETBlox behavior tests.

Physical touch devices, screen readers, real camera/microphone operation and physical board/robot acceptance still need their own validation. Browser offline preparation is distinct from Windows executable packaging. Neither this update nor passing the documented scenarios establishes universal platform superiority or a bug-free product.
