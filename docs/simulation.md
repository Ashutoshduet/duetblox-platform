# Circuit and firmware simulation

DUETBlox offers three different simulation workflows. Choose the one that matches the question you want to investigate; their engines and outputs are separate.

| Workflow | Runs | Use it to answer | Boundary |
|---|---|---|---|
| Circuit Lab with Blocks | Scratch commands plus a wired DC teaching solver | Does this pin, resistor, switch or sensor connect to the intended component? | Does not execute compiled microcontroller instructions. LEDs, PWM, servo and buzzer behavior use documented approximations. |
| Circuit Lab with Uno HEX | Actual ATmega328P application instructions in AVR8js, connected to the same teaching circuit | Does compiled Uno code drive/read these GPIO/ADC connections and timers? | Uno R3 at 16 MHz; not USB hardware, an ESP32 emulator or SPICE co-simulation. |
| Analog / SPICE | ngspice compiled to WebAssembly | What are the operating voltages, sweep response, phase or transient waveforms of this analog netlist? | Standalone analog analysis; no firmware/MCU coupling. |

## Start the browser app

Follow [repository setup](../README.md#run-locally). Use **Circuit Lab** or **Analog / SPICE** in the sidebar. The app needs no remote simulation account. Local compiler installation is a separate step for producing new Arduino/ESP32 binaries; it is not needed for the included SPICE examples or wiring tests.

## Wire a circuit and run Blocks

1. Open **Circuit Lab**, choose **Circuit board**, choose a starter, then **Load circuit**. Available profiles are Uno R3, Mega 2560, classic Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM. The CAM profile has no exposed analog input in this app.
2. Click a terminal and then another terminal to add a wire. Escape cancels an unfinished wire. Select a part to change its value; select a wire or use the Connections list to remove it. Undo/redo restores circuit edits. Drag parts, use their arrow keys, or change the canvas zoom to inspect a larger layout.
3. Choose **Enable virtual board** to test HIGH/LOW, PWM, pull-ups, servo or tone where that board supports them. The app stops the Scratch program before changing its destination. Disconnect physical live control first.
4. Choose **Program this circuit with blocks**. Add the Boards and robots extension or one of the provided LED/sensor scripts. Use a green-flag event for live browser execution. **Run** executes the Scratch program against the virtual board and its actual wired connections.
5. Inspect readings and diagnostics. Removing a return wire changes the circuit; an LED does not stay lit merely because a pin was set HIGH. Reversed LEDs, missing series resistance, overcurrent, excessive pin voltage, supply shorts and floating connections have diagnostics.

The model uses nodal DC analysis, an assumed 25 Ω GPIO output resistance, piecewise-linear LEDs and average PWM voltage. Breadboard rows connect a–e and f–j separately; the central gap isolates those halves. Each power rail joins its four holes. Servo and piezo displays represent control signals; motor mechanics, realistic supply current, transistor dynamics, capacitance, inductance and heating are not modeled here. Use the separate analog workspace for supported SPICE components.

A circuit is limited to 36 components and 160 wires. It is a learning model, not an electrical safety certification. The virtual service cannot write to a physical device. A failed virtual command is not retried against connected hardware.

## Execute compiled Uno firmware

Keep the Blocks virtual destination off. In **Run actual Uno firmware**:

1. Load an Uno R3 **application** `.hex` file. Use **Boards & robots → Compile current blocks → Download verified HEX**, or a matching Arduino IDE build. Do not load the bootloader image.
2. Choose **Run firmware** for continuous execution, **Pause**, or **Step CPU** to advance up to 160,000 cycles (10 ms at 16 MHz; the wall-time budget may stop a step sooner).
3. Inspect the circuit, simulated time/cycle count and Serial monitor. Change a connected potentiometer or switch to change the inputs that the CPU reads.
4. **Reset** reloads the application. Leaving the workbench terminates its worker. A pending file read cannot create a worker after navigation or replace a newer selected firmware file.

AVR8js 0.21.1 supplies the CPU, timers, GPIO, ADC and UART implementation. DUETBlox connects them to its circuit model and decodes timed servo/tone pulses for display. The board profile exposes D2–D13 digital pins and A0–A5 analog inputs; reserved serial pins are not wiring terminals. Servo display uses the app's 1000–2000 μs mapping. Real Arduino-compiled fixtures cover blink, ADC input, button/pull-up input, servo, tone and PWM; see [fixture build provenance](../src/circuits/fixtures/README.md).

This emulator does not implement peripheral SPI/I²C devices, EEPROM, bootloader flashing, USB, motor supply behavior or analog/MCU co-simulation. Loading or passing an emulator test is not a physical board upload. Mega, Nano and ESP32 instruction execution is not enabled here; their supported wired Blocks profiles are separate.

## Measure an analog circuit

Open **Analog / SPICE** and start with a provided example:

- **Voltage divider · DC:** two 1 kΩ resistors give 2.5 V from 5 V.
- **Capacitor charging · transient:** 1 kΩ and 1 µF give a 1 ms time constant.
- **RC low-pass filter · AC:** compare magnitude and phase around the approximately 159 Hz cutoff.
- **Diode characteristic · DC sweep**, **NPN transistor · DC sweep**, and **RLC oscillation · transient** exercise nonlinear devices and dynamic response.

Choose **Run circuit**, select a signal under **Measure**, and inspect the trace. The sample slider and table expose individual measured values. Complex AC results support magnitude, dB relative to one unit, phase in degrees and the real part. **Export CSV** includes every returned sample and, for complex results, separate real and imaginary values. Charts draw at most 1,200 vertices to keep interaction responsive; the table, cursor and CSV retain the full measured dataset.

**Save netlist** downloads `.cir` text. **Open netlist** accepts `.cir`, `.spice` and text files. Loading an example or netlist offers **Undo replacement**. The workspace keeps editable text even when it is incomplete; syntax is validated when Run is pressed. Solver logs remain available for diagnosis. **Stop simulation** terminates the current worker, and a failed or timed-out run can be corrected and run again.

### Supported netlist dialect

The first line is a plain title. Ground is node `0`; node names may use letters, digits and underscores. Use standard numeric engineering suffixes: `1k`, `1u`, `1m`, `1meg`. SPICE is case-insensitive here: `M` means milli, not mega.

```text
Voltage divider
V1 supply 0 5
R1 supply out 1k
R2 out 0 1k
.op
.end
```

Supported parts: R, C, L, independent V/I sources (numeric DC, AC, PULSE or SIN), diode, BJT and MOSFET. Supported analyses: one `.op`, `.dc`, `.ac` or `.tran` per run. Inline `.model` supports D, NPN, PNP, NMOS and PMOS with numeric parameters. Capacitors/inductors may specify numeric initial conditions; MOSFET geometry accepts W/L.

Limits: 24,000 characters, 250 lines, 64 components, 64 nodes, 16 inline models, 10,000 requested sweep/time intervals, 20,000 returned points and 20 seconds per run. Transient stop time is at most 10 seconds. Unsupported constructs are rejected before loading the solver: `.include`, `.lib`, `.control`, shell commands, external model files, arbitrary expressions and subcircuits. This bounded dialect is not the full ngspice language.

The dependency is eecircuit-engine 1.9.0, whose bundled runtime reports ngspice 45.2. Its WASM is bundled inside the worker asset; the app does not download a remote solver when Run is pressed. See [dependency notices](../public/simulation-licenses/README.txt) and [pinned provenance](../public/simulation-licenses/provenance.json). The npm source commit is known; byte-identical reconstruction of the upstream WASM is not claimed.

## Project files and autosave

**Save project** creates `.duet` workspace version 5. Alongside Scratch, Junior, Python and ML data, it contains:

- The active wired circuit and a versioned library of the individual circuits for all five implemented board profiles.
- The current SPICE circuit name and editable netlist.

Switching boards preserves each board's wiring; saving/opening or reloading preserves that library. Versions 1–4 still open with default circuit/SPICE state when absent. Standalone **Save circuit** exports only the current board's JSON circuit, not the whole workspace. A circuit import must match its selected board. The editable SPICE netlist is persisted; measured results and Uno CPU execution/loaded firmware state are temporary and must be rerun/reloaded. Export CSV to keep measurements.

Autosave writes browser IndexedDB. A periodic Scratch serialization reads the latest other workspace fields after its asynchronous response, preventing an older save from overwriting new circuit metadata. Workspace replacement validates incoming data before committing it. Keep `.duet` backups: clearing browser storage removes local data.

## Validation commands

```sh
node --test src/circuits/*.test.js src/spice/*.test.js
npm test
npm --prefix apps/scratch-editor test
```

With an independently running `/duetblox/` development server at port 5200:

```sh
DUETBLOX_TEST_URL=http://127.0.0.1:5200/duetblox/ npm run test:e2e -- tests/e2e/circuits.spec.js tests/e2e/spice.spec.js tests/e2e/autosave.spec.js tests/e2e/firmware-lifecycle.spec.js tests/e2e/workspace.spec.js
```

The numerical tests execute the real ngspice WASM and compare a divider, an analytic RC transient and complex AC transfer function. Firmware tests execute compiled HEX instructions. Browser tests exercise wiring, controls, downloads, imports, keyboard/layout behavior, actual VM autosave responses and worker lifecycle. These are distinct from real USB flashing or sensor/camera/microphone acceptance.

## Production offline check

Prepare a production build with its complete local asset packs:

```sh
DUETBLOX_BASE_PATH=/duetblox/ npm run build
DUETBLOX_PORT=5201 npm start
```

Keep that server running and use a second terminal:

```sh
DUETBLOX_TEST_PRODUCTION=1 DUETBLOX_TEST_URL=http://127.0.0.1:5201/duetblox/ npm run test:e2e -- tests/e2e/offline.spec.js
```

The test prepares the real service-worker pack, enables offline mode, turns network access off in its isolated browser context, closes the first page, then opens a new page and exercises supported workflows. A dev-server pass does not establish offline readiness. Before classroom use, prepare the pack in each intended browser profile and test the same origin/path. Browser storage can be evicted; local compilation and private classroom sharing still need their separately installed local services.
