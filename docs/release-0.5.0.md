# DUETBlox 0.5.0

This browser release addresses specific coding gaps found by the REA, Ghidra and source comparison. It adds useful behavior to the existing application rather than changing its underlying Scratch engine. Competitor findings informed the design; their code and branding are not included. It is not a claim of universal superiority or complete PictoBlox parity.

## Junior can make decisions

Control now includes **If** and **If / otherwise**. Each branch is a real nested program with its own editing path, breadcrumbs, reordering and undo/redo. Decisions can check touching an edge, touching another character, a key press, an accepted prediction, or an accepted prediction with a specified label. Image, sound and pose decisions use the latest result; place Recognize before the decision to request a new prediction. A rejected prediction cannot trigger an accepted-label action even if its winning label happens to match.

Programs compile into actual Scratch `control_if` / `control_if_else` structures and supported sensing/ML reporters. Branches are validated and preserved in Junior save/open and `.duet` projects. Seven English/Hindi guided activities now include testing both branches and checking a board program before uploading. Progress remains manual and is not a learning assessment.

## My Blocks can organize board programs

The standalone Arduino/ESP32 generator supports non-recursive My Blocks with numeric/boolean inputs, nested calls and isolated parameter scope. Forward declarations allow definitions to appear after calls. Arguments are evaluated into ordered temporary variables before each C++ call; this avoids relying on C++'s unspecified function-argument evaluation order.

One supported start script is still required. Text inputs, lists, recursion, unsupported events, parallel scripts and browser-only stage/ML operations produce diagnostics and no downloadable sketch. Pins/modes must remain compile-time constants in this portable subset. My Blocks do not add general Python, embedded TensorFlow, or concurrency to the board runtime. Compilation uses the existing local Arduino toolchain; browser-only C++ compilation is not provided.

## Check a program while editing

**Board upload check** in the normal editor checks current blocks against the selected exact board, refreshes after edits, and discards stale results. It explains each issue and a possible next step. **Select sprite** opens Code, selects the owning sprite and briefly highlights its script; it does not automatically scroll to off-screen blocks. A valid result offers C++ preview, `.ino` download and the route to Boards & robots for compilation and upload. Code generation is clearly distinguished from compilation and physical testing.

**Coding board** updates new hardware pin choices from the same profile used by serial validation and compilation. Output menus exclude input-only and reserved pins; PWM choices follow the target; the ESP32-CAM profile hides the unsupported analog reporter from the palette. Existing blocks retain their values so switching boards cannot silently change a circuit. An incompatible existing pin is reported by validation. The selector is locked during active connections and board operations.

**Watch values** displays live variables and list previews from original sprites and the stage. Lists show their first ten items, long values are truncated, and at most 200 entries are shown. It observes running programs; it is not a pause/step debugger and does not enumerate clones. No debugger parity with MakeCode or Snap! is claimed.

## Offline Face Sensing repair

The copied official GUI/VM distributions previously requested `/chunks/mediapipe/face_detection`, but the files were hosted under `/scratch/chunks/mediapipe/face_detection`. The guarded build patch now uses the correct local path and removes the CDN retry. A failed local initialization clears the loading state and shows a repair/reload message. The exact patch fails the build if pinned upstream structure changes unexpectedly.

The packaging check verifies the GUI and VM bundles and all eleven official Face Sensing assets against the final offline inventory. Focused tests evaluate the actual initialization expression with a controlled detector API, verifying the local path and error handling. This is not physical-camera detection or accuracy validation. Rebuild and prepare the new offline pack; a previous 0.4.0 pack does not automatically contain these changes.

## Evidence and remaining work

The local handoff includes `validation-evidence/release-050/` for this release and `comparison-041/` for the prior competitor/native investigation. [Validation](validation.md) records test and compilation outcomes. The normal build regenerates the source archive and versioned offline inventory.

Ghidra's historical mBlock 4 artifact exposed a binary-framed device protocol; DUETBlox's inspected live firmware uses its own guarded text protocol. That evidence supports maintaining separate browser/live and standalone compilation paths. It does not measure learning outcomes, current competitor firmware behavior or relative security. The live firmware protocol is not changed just to create a new decompilation result.

Five software profiles remain implemented: Uno R3, Mega 2560, classic Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM. Physical uploads, reconnect behavior under real USB conditions and disconnected execution still need acceptance on actual boards. ESP32-CAM camera/SD programming, thirteen planned adapters, general Python, board simulation, full pause/step debugging, complete UI localization and representative student testing remain outstanding. Windows `.exe` packaging and the hosted site are unchanged.
