# DUETBlox student workflow comparison — 26 November 2026

This is an engineering and interface review, not a study with children. Competitor capabilities below are supported by their official documentation; DUETBlox statements come from its source and automated/manual browser checks. A larger feature list does not demonstrate better learning outcomes. There is no evidence to call DUETBlox the best overall.

| Comparison | DUETBlox strength | Where DUETBlox still needs work |
| --- | --- | --- |
| Scratch / ScratchJr | Official Scratch runtime plus a Junior interface, local ML tools and circuit work in one portable workspace. Junior has verified movement goals, optional celebrations and recovery copies. | Scratch has an established creative-learning library and in-editor tutorials. ScratchJr presents a smaller picture-block vocabulary. DUETBlox's interface and lessons still need direct observation with beginning readers, keyboard users and classroom devices. |
| PictoBlox | Browser-first, open-source project distribution and combined local programs, models and circuit files are useful product choices. | These are not proof of superiority. PictoBlox 10 documents guided entry across Junior, Blocks, Python and ML, plus a broader device ecosystem. DUETBlox has five implemented software board profiles; physical validation remains pending. |
| mBlock | DUETBlox adds text/numeric learning and project recovery alongside image, sound and pose workflows. | Browser-local ML is not unique: mBlock documents image, audio and pose training in the local browser, use-model blocks, and live/upload robot workflows. DUETBlox's device coverage and actual-board acceptance lag its software feature list. |
| Microsoft MakeCode | DUETBlox combines Scratch-style characters, Junior storytelling and ML with virtual circuit tools. It has constrained Learning steps, run-to-breakpoint and variable inspection. | MakeCode offers target-specific interactive simulation and documented debugging. DUETBlox Learning steps excludes waits, glides, sounds, clones, other events and extensions; it is not a general timing debugger or full board emulator. |
| Tinkercad Circuits | DUETBlox combines Scratch-driven circuit interaction, a separate SPICE workspace and a prepared offline pack. | Tinkercad provides prominent starters with both wiring and code, a component library and guided circuit lessons. DUETBlox now has four guided circuit lessons and protected matching block starters. Broader validated component coverage and full CPU/analog co-simulation remain gaps. |

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

## Changes made in 0.9.6

- Every one of the 13 built-in lessons has a protected direct starter: Junior story/decision, animation/game/quiz/Pen/Music, image/text examples, virtual board programs and Python. No file download/reopen round trip is needed. Existing complete work is recoverable before the relevant program/dataset changes. Old Scratch events are removed from a lesson copy to prevent unrelated programs from running together. ML models for replaced examples are cleared only after durable commit; other modalities remain intact.
- Learn has a workspace filter, larger instruction text and the starter action near the lesson heading. Lessons retain English, Hindi and Hinglish explanations; the entire application interface is not fully translated.
- Circuit Lab teaches LED/resistor, button/pull-up, potentiometer/ADC and sensor-controlled LED. Students may start with loose parts and build the wiring, inspect solved connections, compare current/voltage/readings, and open matching Blocks programs. Circuit replacement has its own persisted recovery. A traffic-light starter includes three wired LED/resistor branches.
- Learning steps can run to a chosen supported command, pause before it, inspect values, and step. Unreachable breakpoints stop at a bounded 100-step budget. This remains a core synchronous subset, not a general Scratch timing debugger.
- Private classrooms have teacher assignments, private submissions and review feedback. Students keep a room/server-scoped receipt to retrieve only their own submission. The updated teacher server must be run on the LAN; publishing static browser files alone does not install that backend. Aliases are self-reported, not individual authenticated identities.
- Board-specific observation sheets distinguish software checks from real connection, upload, outputs, input, Stop/watchdog and independent-power tests. Reports remain explicitly self-reported and do not change the software's physical-validation status.

## Remaining acceptance and scope limits

1. **Real hardware:** Uno, Nano, Mega, ESP32-WROOM and ESP32-CAM still need physical USB/upload/sensor/output testing. No board was connected during this work. Adding a checklist does not close this evidence gap. Other vendors' boards need documented adapters/protocols and the actual devices; unsupported boards must not be labelled working.
2. **Student usability:** observe beginning readers and experienced Scratch students doing the pilot above. Automated keyboard, viewport and workflow tests do not prove child preference or learning outcomes.
3. **Simulation/debugging depth:** asynchronous waits/glides/sounds, clones and extension stepping are unsupported in Learning steps. Circuit Lab and the separate SPICE engine are not a full MCU/analog co-simulator. The Uno CPU runner and five logic profiles do not establish emulation parity for every ESP32/robot peripheral.
4. **Teaching breadth:** 13 built-in lessons and four circuit guides are useful but not equivalent to Scratch's extensive curated learning ecosystem. Full application localization, additional sound/pose/object/numeric lessons and teacher-authenticated individual accounts remain future work.
5. **Update lifecycle:** the earlier in-app browser update timeout was followed by successful recovery after backing up both open projects and closing the older window. General multi-window migration still needs broader browser coverage. Prepare the new offline pack after updating.

These remaining items are not marked complete, and no universal “best”, “bug-free” or hardware-certification claim is made.
