# DUETBlox student workflow comparison — 26 November 2026

This is an engineering and interface review, not a study with children. Competitor capabilities below are supported by their official documentation; DUETBlox statements come from its source and automated/manual browser checks. A larger feature list does not demonstrate better learning outcomes. There is no evidence to call DUETBlox the best overall.

| Comparison | DUETBlox strength | Where DUETBlox still needs work |
| --- | --- | --- |
| Scratch / ScratchJr | Official Scratch runtime plus a Junior interface, local ML tools and circuit work in one portable workspace. Junior has verified movement goals, optional celebrations and recovery copies. | Scratch has an established creative-learning library and in-editor tutorials. ScratchJr presents a smaller picture-block vocabulary. DUETBlox's interface and lessons still need direct observation with beginning readers, keyboard users and classroom devices. |
| PictoBlox | Browser-first, open-source project distribution and combined local programs, models and circuit files are useful product choices. | These are not proof of superiority. PictoBlox 10 documents guided entry across Junior, Blocks, Python and ML, plus a broader device ecosystem. DUETBlox has five implemented software board profiles; physical validation remains pending. |
| mBlock | DUETBlox adds text/numeric learning and project recovery alongside image, sound and pose workflows. | Browser-local ML is not unique: mBlock documents image, audio and pose training in the local browser, use-model blocks, and live/upload robot workflows. DUETBlox's device coverage and actual-board acceptance lag its software feature list. |
| Microsoft MakeCode | DUETBlox combines Scratch-style characters, Junior storytelling and ML with virtual circuit tools. It already has a constrained Learning steps mode and variable inspection. | MakeCode offers target-specific interactive simulation and documented debugging. DUETBlox Learning steps excludes waits, glides, sounds, clones, other events and extensions; it is not a general timing debugger or full board emulator. |
| Tinkercad Circuits | DUETBlox combines Scratch-driven circuit interaction, a separate SPICE workspace and a prepared offline pack. | Tinkercad provides prominent starters with both wiring and code, a component library and guided circuit lessons. DUETBlox's circuit and code workflows still need stronger integrated teaching, broader validated components and clearer explanations of simulation limits. |

## Official sources

- [Scratch Foundation Learning Library](https://www.scratchfoundation.org/learn/learning-library): activities, coding cards and tutorials that open in the editor.
- [ScratchJr block reference](https://www.scratchjr.org/learn/blocks) and [interface guide](https://www.scratchjr.org/learn/interface): picture-block interactions, triggering, motion, looks, sound and control.
- [PictoBlox 10 announcement](https://thestempedia.com/blog/pictoblox-10-0-0-software-update/): guided onboarding across four environments. [PictoBlox](https://pictoblox.ai/): coding, AI and robotics scope.
- [mBlock Machine Learning 2.0 FAQ](https://support.makeblock.com/hc/en-us/articles/24646380612887-FAQ-on-Machine-Learning-2-0): local-browser training and supported model types. [mBot live/upload workflow](https://support.makeblock.com/hc/en-us/articles/1500003954802-Program-mBot-with-mBlock-5).
- [MakeCode debugging activity](https://makecode.microbit.org/courses/csintro/iteration/activity): step execution with highlighting. [Editor acceptance checklist](https://makecode.microbit.org/release-tests/editor): tutorials, simulator controls and sensor interactions.
- [Tinkercad Circuits](https://www.tinkercad.com/circuits): virtual circuits, codeblocks, Arduino/micro:bit and guided starters.

## Changes made in 0.9.5

1. The home screen presents three concrete first activities with reading-sized text and controls: a first Junior story, guided lessons, and Circuit Lab without a physical board. Existing workspace cards explicitly continue current work.
2. Junior's lesson starter opens directly. The entire previous workspace is validated and stored as a recovery copy before replacement. Failed recovery or persistence leaves the current story intact. It does not erase Scratch code, circuit work or ML models. No activity runs automatically.
3. Learn and My projects move above advanced workspaces in the sidebar. Sidebar labels are larger; advanced choices have a separate heading.
4. The unconditional “Saved on this device” label is removed. Save feedback reflects actual completed IndexedDB transactions, including persistent failures and a downloadable backup action. Successful writes to unrelated records cannot dismiss an existing failed save. The label deliberately describes the last browser write, not a guarantee that every pending editor edit has been serialized.

## Student usability acceptance

Engineering checks cover: locate the first activity; open and run it; retain an in-editor guide; restore prior Junior/circuit work; recover from a simulated full storage condition; download a valid project despite a browser save failure; and reach primary controls by keyboard at 1366×768 and 390×844 without horizontal page overflow. These checks do not establish reading comprehension or child preference.

Next classroom pilot: observe a small group across beginning readers and experienced Scratch students, with teacher support. Ask each student to start a story, change one action, explain the result, save/reopen it, and try a virtual LED. Record anonymous task completion, time, where help was needed and whether saving/simulation were understood. Do not invent a numerical usability score before that pilot.

## Remaining priorities

- Guided in-editor starters across normal Blocks, ML and hardware; Junior now has the direct protected path, but other downloads remain.
- Consistent beginner/advanced disclosure and keyboard/picture help across all workspaces; the full UI is not fully localized even though lessons support three language choices.
- Real Uno, Nano, Mega, ESP32-WROOM and ESP32-CAM tests for USB connection, upload, outputs, watchdog and disconnected operation. Simulated tests do not replace this.
- More realistic timing/debug support and circuit lessons that explain current, voltage and invalid wiring.
- Classroom assignments, submission review and teacher guidance beyond the existing private-room infrastructure.
- Cache/update reliability in the existing in-app browser. The 0.9.4 direct runtime loaded correctly and Chromium cold-offline checks passed, but that browser's update helper still timed out. This student workflow release does not claim to repair that separate issue.
