DUETBlox Studio original examples

Save your current project before opening an example. Download an .sb3 file,
then use Open in DUETBlox. Opening replaces the current Scratch program.

learning-steps.sb3
  Green flag sets counter to 2 + 3, changes sprite x by 10, then adds 2 to counter.
  Final counter is 7. Learning steps can show each command separately.
  Sprite movement is relative, so each full run adds 10 to its x coordinate.

virtual-input-output.sb3
  Select Arduino Uno R3 and explicitly enable Virtual Board Lab before Run.
  Forever: read analog A0 into sensor; if sensor > 512, set digital pin 13 HIGH;
  otherwise set it LOW; wait 0.1 seconds before reading again.
  A0 512 -> LOW. A0 513 or 1023 -> HIGH. A0 0 -> LOW.
  The sensor variable is shown on the stage. Stop clears virtual outputs.
  This tests live block logic, not wiring, electrical behavior or compiled code.
  The example can also issue real live hardware commands when a physical board
  is connected and the lab is off. Use virtual mode for this starter exercise.

Both examples use original DUETBlox graphics and editable project JSON under
source/. Rebuild with: node scripts/build-studio-examples.mjs
Sources and build script are included in the DUETBlox source distribution.
