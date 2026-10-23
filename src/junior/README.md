# Junior blocks

Junior has 56 action blocks and five start events. It compiles projects to the official Scratch VM, including the new motion, sound, keyboard, wait-until, repeat-until and send-and-wait controls.

- Find a block with the search field. Search looks across every category, including descriptions. “All blocks” shows the whole palette; categories show their counts.
- Click a block to append it to the selected script or nested branch. Edit values on the block. Use its arrows to reorder, the copy icon to duplicate (including nested steps), or × to remove. Undo and Redo keep recent changes.
- Open “steps inside” on Repeat, Forever or Repeat until. Add steps, then use the breadcrumb or Back one level to return.
- Select a character and Start event. A keyboard script runs when the selected key is pressed after clicking the stage. Other scenes’ keyboard scripts are guarded by the active scene.
- Copy script creates and selects an independent copy. Save story preserves all scenes, scripts, media and new blocks in `.junior.json`.
- Wait until checks without blocking other scripts. Repeat until runs its children while its condition is false. Send and wait waits for the receiving scripts to finish.
- Start sound continues immediately; Play sound waits. Stop sounds stops current audio. Volume changes the selected character’s sound level. Play/reset restores starting rotation style and volume.
- Steps after Forever, End script, Go to scene or a stop that ends the current script receive an explanatory warning.

Predictions still require a model and a test input prepared in ML Studio. A condition reads the latest result; it does not start the camera, microphone or classification automatically. Device blocks still require a supported configured and physically connected board. Junior is a simpler language: arbitrary variable/operator reporters and custom procedures remain available in the normal Blocks editor.

Focused unit tests: `node --test src/junior/model.test.js src/junior/media.test.js`.
The local-only smoke harness is `/src/junior/smoke.html` on a Vite development server. The corresponding isolated-browser validation and screenshots are stored in `work/block-usability/`; they execute the actual Scratch stage, without physical hardware or microphone/camera testing.
