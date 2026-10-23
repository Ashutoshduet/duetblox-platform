# Junior editor validation

Verified on 16 October 2026 in desktop Chrome against the Vite app at `http://127.0.0.1:5173`. Programs run in the official Scratch VM in a same-origin stage iframe. This is a substantial Junior implementation, not a claim of complete ScratchJr or PictoBlox parity.

## Implemented behavior

- Horizontal picture-and-text blocks, editable numeric/text/menu values, nested repeat/forever bodies, earlier/later controls, drag reordering, deletion, and undo/redo.
- Multiple independent scripts per character, with Play, character-tap, character-bump, and six colored-message start events. Bump scripts wait for separation before firing again.
- Directional movement, turn, hop, home, random position, speed, say, grow/shrink/reset size, show/hide, costume switching, sound, wait, repeat, forever, stop, script end, send message, and scene transition.
- Native Scratch Pen blocks for pen down/up, clear, color, size, and stamp.
- All scenes compile into one Scratch project. A scene change stops previous scripts, resets and hides previous characters, selects the destination backdrop, and starts destination Play scripts. The editor's selected scene remains the authored selection while the stage is running.
- Three original vector characters and three backgrounds. Import PNG/JPEG/WebP characters, costumes, and backgrounds; a raster paint editor provides brush, eraser, color, width, undo, and clear. Imported images are normalized to PNG.
- Upload sounds and record microphone audio on explicit request. Audio is normalized to mono PCM WAV, capped at 30 seconds, and embedded in the story. Closing the recorder stops its media stream, including a stream resolved after the dialog closed.
- Junior AI blocks invoke the shared image, sound, or pose service and say the predicted label. A trained/imported model and a studio test input or active camera/microphone are required; a block does not request permission automatically.
- Junior Devices blocks call the shared live-control service for pin on/off, PWM, servo angle, tone/stop tone, and analog/digital values spoken by the character. Board profile validation remains in that service. Standalone Arduino code generation currently uses the normal Blocks program.
- Play, Stop, Reset, runtime feedback, independent `.junior.json` Save/Open, and whole-workspace integration through the parent callback. Version 1 stories migrate to version 2 with their programs retained.

Imports validate supported block types, IDs, media checksums, PNG dimensions, WAV format/duration, and references. Bounds are 12 scenes, 12 characters per scene, 20 scripts per character, 1,000 blocks, eight nested loop levels, 100 media assets, and 30 MB of encoded media. Image imports are rasterized to 256 × 256 for costumes or 480 × 360 for backdrops.

## Observed browser checks

The latest checks used `src/junior/smoke.html`, which renders the actual JuniorEditor component and actual stage iframe. Its Read VM state action calls the documented bridge `getProject` command and displays actual VM targets in the page. All browser interaction used CUA; no external browser automation or injected application-state mutation was used.

| Check | Observed result |
| --- | --- |
| Directional motion, hop, size, turn | After Go right 2 squares, Hop 1, Grow 10, Shrink 5, and Turn left 30, the real Fox target was x=40, y=0, size=105, direction=60. |
| Independent tap program | Clicking the visible Fox ran its second script. A 25-pixel move at direction 60 changed its position to approximately x=61.65, y=12.5. |
| Messages and scene lifecycle | Fox sent blue, its blue-message script moved it 30 pixels, then the scene changed. The old Fox became hidden; destination Robot moved from x=-50 to x=20; destination Star's forever-turn script ran. |
| Bump event | Fox approached Robot and its bump script increased size from 100 to 120. A later state read while still overlapping remained 120, confirming the separation gate. |
| Native Pen | Clear/color/width/down/right/up/pen-up/stamp program ran. The stage visibly showed its maroon path and the target ended at x=60, y=40. Stamp was included in the executing program; its individual visual result was not isolated. |
| Paint | Drew an X with pointer strokes, saved the drawing, and observed it as the active costume on the actual stage. |
| Image upload | Uploaded the original synthetic `test-fixtures/orange.png` through the browser file chooser and selected the resulting costume. |
| Audio upload | Uploaded `test-fixtures/tone.wav`, selected it in a Play sound block, and ran the program to completion without captured console errors. Audible fidelity was not assessed. |
| Downloaded story round trip | Save story produced a 24,419-byte JSON file containing the painted costume, imported PNG, and WAV. Open story restored the nine-block program and selected custom costume/sound after another story had replaced it. The validated downloaded document is retained as `test-fixtures/media-roundtrip.junior.json`. |
| Script editing and history | Added a second script, chose blue-message start, added and edited Say, then used Undo and Redo. |
| Runtime status | A fresh load showed ready, Play showed running, and completion showed finished. |
| Console | No captured console errors after the final run. |

The prior integrated-app pass additionally covered Home → Junior, character/scene selection, complete `.duet` browser-library Save/Open, and browser reload persistence. That pass predates the v2 media/multiscript work; current whole-workspace acceptance is covered by the root integration checks.

Latest evidence: `src/junior/qa-junior-v2.png` and `src/junior/qa-junior-v2-ax.txt`. The latter is a browser accessibility tree showing controls and state, **not** an automated axe or screen-reader conformance report. Earlier evidence is retained as `qa-root-junior.*`.

## Automated checks

`node --test src/junior/model.test.js src/junior/media.test.js`: **16 passed, 0 failed**.

These checks cover v1 migration and v2 round trips, multi-script/scene lifecycle compilation, complete graph pointers and menu shadows, edge-gated bump programs, embedded original and imported asset checksums, immutable nested edits, malformed import rejection, numeric bounds, extension opcode/argument contracts, and WAV normalization. The MD5 implementation is independently compared with Node crypto across empty, padding-boundary, and multi-block byte vectors through 65,536 bytes; it is also used by the ESP upload path.

The combined Junior + workspace command passed **30 tests** at this check. Root's complete suite also includes hardware, firmware upload, model validation, and archive validation; consult the overall validation report for its latest count.

## Limits and remaining acceptance

- This is an original pictorial editor compiled to Scratch 3. It does not import `.sjr` files, reproduce every ScratchJr/PictoBlox editor behavior, or claim compatibility with proprietary vendor hand/face/robot engines.
- Movement squares are 20 Scratch pixels; angles are degrees. The paint editor is a simple raster brush editor, without vector shapes, text tools, or flood fill. Cross-character script drag/copy and native ScratchJr project sharing are not implemented.
- `Save story` includes Junior programs and embedded media. The outer `Save project` includes the whole `.duet` workspace; the story title can differ from the outer project name.
- Microphone recording is implemented but was not activated during this QA pass. Real microphone capture, audio output quality, keyboard-only navigation, screen readers, touch devices, and small-screen/cross-browser layout need dedicated acceptance testing.
- Live physical boards, robot mechanisms, and Junior image/sound/pose prediction end-to-end were not exercised by this Junior pass. Their native extension graph contracts are tested; physical devices and trained-model integration require the separate platform checks.

## Official feature references

- [ScratchJr block descriptions](https://www.scratchjr.org/explore/blocks): start events, colored messages, movement, looks, sound, speed, loops, and pages.
- [ScratchJr tips](https://www.scratchjr.org/learn/tips): multi-script editing, drawing, and interaction conventions.
- [STEMpedia: Getting Started with Junior Blocks](https://ai.thestempedia.com/docs/pictoblox/pictoblox-tutorials/getting-started-with-junior-blocks/): Junior categories, scenes/backgrounds, Pen, and vendor extensions.
- [STEMpedia: Hare and Penguin Race](https://ai.thestempedia.com/example/hare-and-penguin-race-in-pictoblox-junior-blocks-step-by-step-beginner-tutorial/): messages, speed, repeat, directional motion, and costume changes in a documented Junior workflow.

References guided the functional scope; the graphics, editor UI, project schema, and compiler are original code. Execution uses official Scratch components.
