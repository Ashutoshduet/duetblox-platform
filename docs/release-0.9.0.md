# DUETBlox 0.9.0 browser release

This release extends the existing browser app with connected circuit simulation, actual Uno firmware execution and a separate analog/SPICE workspace. It redesigns the Junior editing surface around observable picture-block workflows while retaining DUETBlox assets and the official Scratch runtime. It preserves the 13 English/Hindi/Hinglish lessons introduced before this release.

This is a scope and evidence record, not a claim of complete PictoBlox/Scratch/Tinkercad parity or a bug-free product. A local build or passing test does not establish that the hosted production address has been updated. Native Windows packaging and physical hardware acceptance remain separate work.

## What changed

### Junior editing

The main canvas displays multiple editable script stacks. Students can position stacks with pointer or keyboard controls, drag palette blocks into specific gaps, reorder blocks and move root blocks between stacks. Undo treats a cross-stack move as one edit. Category-colored picture blocks, a horizontal palette, stage controls, a coordinate grid and cast/scene thumbnails make the structure easier to see.

All-stack editing retains the existing compiler and real Scratch VM execution. Optional bounded `script.canvas` coordinates persist in Junior stories and full projects without changing their compiled behavior. Concurrent flag scripts, motion, forever-loop stopping/reset, nested branch editing, project import/export and responsive layouts have explicit checks.

The reference audit does not establish pixel-exact PictoBlox parity. DUETBlox retains its own artwork and its own 20-pixel square motion semantics; the grid reflects those coordinates. Nested branches use a focused editing view. Proprietary robot extensions, the reference camera workflow and every reference block were not replicated or verified.

### Circuit Lab and Uno firmware

Circuit Lab stores explicit wires and components rather than only showing commanded pin states. Its bounded DC solver handles resistance, connectivity, switches, potentiometers, breadboard groups and approximate LEDs, with diagnostics for common wiring faults. Supported board profiles are Uno R3, Mega 2560, classic Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM.

Normal Scratch hardware blocks can drive the virtual board's wired circuit. Virtual and physical destinations are explicit; failed virtual operations do not fall back to real hardware. Board changes, navigation and simulation lifecycle stop or reset affected execution.

A separate Uno workflow executes real compiled ATmega328P application HEX using AVR8js 0.21.1. CPU instructions, timers, GPIO/ADC and UART feed the teaching circuit. Run/Pause/Step/Reset and serial output are available. Fixture builds cover blink, analog input, button/pull-up input, servo, tone and PWM. File-read generations and worker identity checks prevent late imports from creating orphan workers or replacing newer firmware.

This is not ESP32/Mega/Nano instruction emulation, a USB upload or a coupled analog/MCU simulator. SPI/I²C peripheral devices, EEPROM, bootloader/USB, motor mechanics and realistic motor current are not modeled. The [simulation guide](simulation.md) gives workflows, component limits and approximations.

### Analog / SPICE

The analog workspace runs the actual eecircuit-engine 1.9.0 bundled ngspice 45.2 WASM in a fresh worker. It supports operating point, DC sweep, AC sweep and transient analysis for a bounded set of R/L/C, independent source and inline diode/BJT/MOS models.

Students can load teaching examples, edit/import/export a netlist, inspect measured traces and samples, switch complex-result views and export complete CSV measurements. Stop terminates the worker. Runtime, input and result limits contain runaway work; logs and actionable validation errors remain visible. File includes, shell/control commands, external models and arbitrary expressions are not accepted.

The solver is bundled locally. A fresh browser tab with network access disabled successfully ran the bundled worker from the prepared production cache. ngspice is separate from the Uno CPU and wired teaching solver; no firmware/SPICE co-simulation is claimed.

### Project persistence and reliability

Workspace archives now use version 5 and retain the previous programs and ML data plus the per-board circuit library and editable SPICE project. Versions 1–4 remain readable with defaults for absent fields. The active circuit also remains available as a compatibility field; the library is the durable source for the individual board circuits.

Switching boards no longer loses inactive wiring when saving/reloading. Late periodic and navigation Scratch saves read current workspace fields after their responses, avoiding stale name/circuit overwrites. Regression coverage holds an actual VM serialization response while editing, then verifies durable data and reload. Invalid imports retain existing work; measurements and CPU execution state are temporary rather than silently presented as saved results.

## Setup and test commands

Use the [README setup](../README.md#run-locally) for pinned dependencies, local assets and source restoration. A development server and a production offline build have different test responsibilities:

```sh
npm test
npm --prefix apps/scratch-editor test
DUETBLOX_BASE_PATH=/duetblox/ npm run dev -- --port 5200 --strictPort
```

With that server running, use another terminal:

```sh
DUETBLOX_TEST_URL=http://127.0.0.1:5200/duetblox/ npm run test:e2e
```

The Playwright configuration uses an installed Chrome channel and fresh contexts. It does not attach to a user browser. The offline test skips unless `DUETBLOX_TEST_PRODUCTION=1` is set against a complete production build. Follow the [production offline procedure](simulation.md#production-offline-check), keeping the server origin, mount and port consistent.

The existing multimodal fixture harness at `src/ml/audio/smoke.html` performs actual sound FFT/transfer training, PoseNet feature extraction/classifier training and image MobileNet training, with inference, artifact round trips and tensor checks. It uses generated/recorded fixture inputs and does not request microphone/camera permission. These checks establish pipeline behavior, not field accuracy or physical input-device acceptance.

## Validation record

Validated on 24 November 2026 using the production build mounted at `/duetblox/`:

| Check | Result |
|---|---|
| Root unit/regression suite | 375 passed |
| Official Scratch editor integration suite | 31 passed |
| Focused Junior browser harness | 5 passed |
| Full production browser scenarios | 17 passed together in the final production run (41.3 seconds) |
| Actual image, sound and pose training/inference pipelines | 3 passed |
| Real Arduino/ESP32 toolchain compilations | 16 passed |
| Cross-board firmware bundle checksum/address validation | 12 passed |
| Production build | Passed; base path `/duetblox/` |
| npm dependency audit | Zero known advisories at validation time |

The initial production browser run passed 15 scenarios; its offline scenario failed because the test expected an asynchronous controlled checkbox to update synchronously. The test now clicks and waits for the checked state. That scenario then passed independently, with no application code change. A final review then reproduced a separate application bug: navigation serialization overwrote a newer name. After fixing that post-response snapshot and adding a regression, the production app was rebuilt and all 17 browser scenarios passed together. Both earlier failure traces are retained.

The complete offline pack contains 3,216 files (328.5 MiB), version `cc25bf342f4a7910ca01`. After preparation, the test disabled network access, opened a fresh tab and exercised SPICE (2.5 V divider), Python, numeric ML training/prediction, Junior execution and Scratch execution. This verifies a cold page opening with prepared browser storage; initial installation still needs the downloaded assets. Source archives are separate from this cache.

Compilation covered Uno R3, Mega 2560, classic Nano with current/old bootloader targets, ESP32-WROOM and ESP32-CAM. Four additional Uno builds covered button, PWM, servo and tone. No physical USB upload or sensor/robot operation was performed: the user had no board available.

The hardware-focused 106 checks, Junior unit checks and SPICE checks are subsets of the suites above, not additional independent totals. This validation is bounded to the documented scenarios and does not establish that every feature is bug-free. The live website has not been updated by this validation.

Evidence categories retained for this release:

- Unit/regression checks for project validation, circuit connectivity, per-board libraries, workers, bounded imports and existing workspaces.
- Actual ngspice numerical comparisons against a voltage divider, analytic RC charging and complex RC transfer function, plus nonlinear/dynamic examples.
- Actual Arduino-toolchain compilation for the five implemented board profiles, kept distinct from physical flashing.
- Actual Uno HEX instruction/timer/ADC/GPIO tests using documented compiled fixtures.
- Official Scratch editor integration checks and full-app browser workflows for wiring, Junior execution, project archives, SPICE, downloads and navigation.
- A delayed real Scratch response regression for metadata persistence and delayed-file lifecycle tests for Uno workers.
- Actual image/sound/pose fixture training and model round-trip checks. Existing TensorFlow.js deprecation warnings are retained in the report; they are not treated as trained-model accuracy evidence.
- Production cold-offline testing is recorded separately from development-server tests. A generated cache manifest alone is insufficient evidence.

Local working evidence is in `work/validation/`, including `spice/report.json`, `spice/integration-audit.json`, `ml/report.json`, browser screenshots and failure traces where produced. Requested-tool and public-reference research is stored in the sibling handoff folder `duetblox-rebuild-20261124-research/`. These research checkouts are not app runtime dependencies and may not be present in a source-only Git clone.

## Requested tools and provenance

The requested repositories were qualified from their primary sources. The table pins the reviewed source snapshots; the installed app test runner and execution binaries may have their own versions recorded below. Reading a skill is not presented as having executed every command in that repository.

| Requested repository | Reviewed commit | Applied scope / limit |
|---|---|---|
| [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser/tree/0a923358ea989d7602f0d06507ad3447c62ffe9b) | `0a923358ea989d7602f0d06507ad3447c62ffe9b` | Isolated exploratory UI workflow, snapshots and reproduction evidence. CLI execution uses the separately pinned local installation. |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/6c0b5c78f5d31776e2210305abaa210cdc0030bf) | `6c0b5c78f5d31776e2210305abaa210cdc0030bf` | Relevant design consistency, labels, focus and responsive review. The supplied `LeonxIns` spelling returned 404; the primary author's spelling is `Leonxlnx`. Its current marketing-site kit was not imposed on a coding IDE, and its marketing gate is not claimed passed. |
| [elementalsouls/Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter/tree/6b710c27c586100511f81acc2d6403aa2e616204) | `6b710c27c586100511f81acc2d6403aa2e616204` | Concrete finding triage and bounded owned-app import validation. No third-party attack campaign, credential extraction or offensive plugin bundle was enabled. |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail/tree/ebd8654c2c627f721eb8f9c0d1bd4090a29f9e10) | `ebd8654c2c627f721eb8f9c0d1bd4090a29f9e10` | Small complete changes, shared caller review and meaningful boundary/regression tests. No global hooks were installed by the skill qualification. |
| [h4ckf0r0day/obscura](https://github.com/h4ckf0r0day/obscura/tree/b9ce93d0ff2b4da75d5951751221350d41cc412b) | `b9ce93d0ff2b4da75d5951751221350d41cc412b` | Qualified as a secondary browser/render experiment. Its documented differences in service workers, media, GPU and Web APIs prevent using it as the offline/ML/WebSerial release gate. No stealth configuration is needed for this app. |
| [microsoft/playwright](https://github.com/microsoft/playwright/tree/d70f422f491cfb875dd5dc05f01c61207e7382b4) | `d70f422f491cfb875dd5dc05f01c61207e7382b4` | Official docs/tooling review. Executed app tests use `@playwright/test` 1.64.0 from the app lockfile, not the separately cloned development source. |

Execution details: agent-browser 0.44.0 was run in an isolated named session for circuit UI inspection and then closed. Obscura 0.2.7's official non-stealth macOS arm64 release (SHA-256 `fc7e73f23058f18d6d5be983d83b24ba374d12167677657a307a9476c0f5a7c1`) produced a nonblank production screenshot, which was visually inspected. Obscura was a secondary rendering check; Chrome/Playwright performed the offline, worker and integration assertions.

Full qualification details and per-tool read/execute boundaries are in the handoff's `tools/TOOL-REVIEW.md` and `tools/tool-inventory.json`. The requested [REA](https://github.com/morluto/rea) skill was already installed; its public Junior-artifact analysis is identified by input hashes rather than an invented repository commit. The selected chunk hash is `055ad5c154a48caa6457f0ad64af523ff1ce3930d61ab5c9a19e3d7176c3eb0f`; `junior/rea-summary.json` preserves its partial graph coverage, unselected files and unknowns. It supports a bounded architectural observation, not complete reconstruction of a competitor's backend.

The public reference included actual opening and a palette-to-canvas drag in PictoBlox Junior. Its full script execution, every snap case and every hardware extension were not independently verified. Independent DUETBlox browser regressions establish DUETBlox behavior. Competitor code, branding and media were not copied into the app. Historical Ghidra work remains described in earlier release records; it is not a universal quality certificate or evidence that this release newly analyzed every competitor binary.

Simulation dependency provenance is distributed with the app in [simulation-licenses](../public/simulation-licenses/README.txt). eecircuit-engine 1.9.0's npm source is pinned to `424c21eb9f9bb91e72c1befe2d7fc2f09641316c`; [the pinned build script](https://github.com/eelab-dev/EEcircuit-engine/blob/424c21eb9f9bb91e72c1befe2d7fc2f09641316c/Docker/run.sh) and [source archive](https://github.com/eelab-dev/EEcircuit-engine/archive/424c21eb9f9bb91e72c1befe2d7fc2f09641316c.tar.gz) are recorded. The wrapper's MIT license does not replace ngspice's component licenses or embedded PDK notices. Exact upstream WASM source/toolchain reproducibility is not established by the npm commit alone.

## Remaining acceptance work

Physical Uno/ESP32 upload and read-back, sensor behavior, real camera/microphone permissions, touch devices and classroom deployment need testing on their intended equipment. Additional robot protocols, ESP32 CPU simulation, broad SPICE-language support, Tinkercad-scale component coverage and firmware/analog co-simulation are not shipped here. Browser installation/offline caching is not a Windows `.exe` package. The DUET STEM logo remains pending; the app uses its original temporary identity.
