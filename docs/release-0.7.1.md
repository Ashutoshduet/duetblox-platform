# DUETBlox 0.7.1 — Blocks usability and recovery

This update addresses block discovery, narrow editor layouts, stalled Stop commands and the first hardware test. It does not claim that every possible freeze or unsupported board is fixed.

- Find blocks & extensions searches the actual Scratch category catalog and opens the selected palette. ML, hardware, classroom and data categories are reachable without scrolling past all core blocks. Additional extensions show camera/network requirements.
- Add an example creates a separate sprite for a first animation, LED blink or analog-input/LED program. Existing programs/assets are preserved. All green-flag scripts run together, so conflicting examples should be stopped or removed.
- Boards & robots has a Try without a board entry. Virtual Board Lab provides real Scratch execution with simulated pin values; it does not compile firmware, emulate electrical circuits or verify USB hardware.
- Junior includes more motion/control/sound blocks, keyboard events, cross-category search, descriptions, duplication and improved selection/counting. Background preview updates no longer restart a playing story. Stop cancels stale Play requests, preview updates coalesce, and stage restart preserves the editable story.
- The normal editor supports category selection from media tabs and adapts its stage layout to narrow iframe widths. Priority Stop/status/ping are not held behind project load/export. A queued run issued before Stop cannot restart afterward. Editor recovery reloads the last saved snapshot; recent unsaved edits can be lost, as the UI explains.

The public browser app keeps projects in each visitor's browser. Camera, microphone and USB require browser permission and compatible devices. Public hosting does not expose the private classroom server or remove its room-key requirement. Compilation still needs the local Arduino helper/toolchains. Additional robot profiles remain planned.

## Manual browser checks

1. Blocks → Add an example → Animate a sprite → Run. Watch the sprite say hello and move. Stop ends the program.
2. Find blocks & extensions → search `ML`, `repeat`, `servo` or `variable` → choose a category. Its actual palette opens in Code.
3. Boards & robots → choose Arduino Uno R3 → Try without a board → Add LED test blocks → Run. Pin 13 alternates HIGH/LOW; Stop outputs clears it.
4. In a fresh test project, add Sensor test blocks. Run and move the analog slider across halfway. The output changes accordingly. ESP32-CAM has no analog input in its supported profile.
5. Junior → search `bounce`, `volume` or `wait` → add/edit steps → Play story. Stop stays available while the stage prepares; edits are saved for the next play.
6. Save project, open the downloaded `.duet`, and check retained programs/models. Prepare the Offline pack before disconnecting the browser network.

Actual automated and browser evidence is recorded in `work/release-071/` and `work/block-usability/`; see the current validation record for final outcomes and limits.

The public host has a 256 MiB expanded-artifact limit. Its large ResNet50 pose checkpoint uses verified official mirrors on first use or offline preparation. The local laptop bundle contains the same checkpoint. Preparing offline storage includes all 23 shards, so imported ResNet50 models can run with the network disconnected. Image, sound and default MobileNet pose training assets remain directly bundled.
