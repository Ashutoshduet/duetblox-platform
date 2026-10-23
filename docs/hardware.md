# DUETBlox hardware implementation

The browser includes Web Serial live control, supplied firmware, and a block-to-C++ exporter. The local Arduino CLI helper now runs on macOS/Linux/Windows; it is not a packaged desktop app. Uno R3, Mega2560, classic Nano, ESP32-WROOM DevKit and AI Thinker ESP32-CAM live firmware plus representative generated programs have passed real toolchain compilation. No physical board has been connected or flashed. See the [current hardware contract](../src/hardware/README.md) for the expanded servo/tone/map/random/until blocks, ESP pin restrictions, CAM limitations and reproducible checks; historical protocol notes below describe the original subset.

## Board catalog and implementation status

On 16 October 2026, the public [PictoBlox web editor](https://pictoblox.ai/) → Blocks → Board modal showed these exact 14 names: evive, Quarky, Wizbot, Arduino Uno, Arduino Mega, Arduino Nano, ESP32, T-Watch, micro:bit, TECbits, LEGO EV3, LEGO BOOST, LEGO WeDo 2.0, Go DFA. This was a read-only catalog inspection; no hardware functions were tested there.

Official [extension documentation](https://ai.thestempedia.com/extension/3d-and-xr-studio-my-blocks/) additionally lists Boffin. Official [release notes](https://thestempedia.com/product/pictoblox/release-notes/) describe Quarky Intellio and Wizbot Maxx. The registry contains this 17-entry union plus the separately requested AI Thinker ESP32-CAM profile, retaining `inCurrentWebCatalog` to distinguish the visible web menu. An entry is a roadmap item, not a support claim.

| DUETBlox target | Live GPIO | C++ export | Physical validation |
|---|---|---|---|
| Uno R3, ATmega328P | Implemented | Implemented | Pending |
| Mega 2560 | Implemented | Implemented | Pending |
| Classic Nano, ATmega328P | Implemented | Implemented | Pending |
| ESP32-WROOM DevKit, AI Thinker ESP32-CAM (limited GPIO) | Implemented | Implemented | Pending |
| evive, T-Watch, Boffin, TECbits | Planned | Planned | Pending |
| micro:bit, LEGO EV3/Boost/WeDo 2.0, Go DFA | Planned | Planned per device | Pending |
| Quarky, Quarky Intellio, Wizbot, Wizbot Maxx | Planned final hardware stage | Planned per device | Pending |

“Uno” does not include Uno R4/WiFi Rev2, and “Nano” does not include Nano Every, Nano ESP32 or Nano 33. Board families must never be substituted silently. The Nano bridge has an explicit old-bootloader option for ATmega328P boards. ATmega168 Nano support is not implemented.

## Live mode

`src/hardware/serial-service.js` exports `ArduinoSerialService`. Instantiate once in the host app. `connect()` must be called from the user's Connect action because the browser owns the serial chooser. The constructor does not open any device.

```js
const board = new ArduinoSerialService({
  boardId: 'arduino-uno',
  onState: state => renderConnection(state),
  onTelemetry: event => renderReading(event)
});
await board.connect({boardId: 'arduino-uno'});
await board.setPinMode(2, 'INPUT_PULLUP');
await board.digitalWrite(13, 1);
const reading = await board.readAnalog('A0');
await board.stop();
await board.disconnect();
```

Other methods: `analogWrite(pin,value)`, `readDigital(pin)`, `servoWrite(pin,angle)`, `servoDetach(pin)`, `tone(pin,hertz,seconds)`, `noTone(pin)`, `reconnect()`, `getState()`, `subscribe(listener)`, and `dispose()`. State contains `status` (`disconnected`, `connecting`, `connected`, `error`), `boardId`, `firmwareVersion`, `error`, and browser API availability `supported`. Reconnect uses the last user-selected port only while its permission remains granted and does not restore output states.

The matching firmware must be installed before live connection. `getLiveFirmwareURL(boardId)` selects the standalone source sketch; the CAM has its own sketch because Espressif assigns its FQBN the same build macro as a generic ESP32. Real compiled bundles are available under `public/firmware/` for explicit browser installation. The firmware uses an original documented protocol; existing Firmata, Scratch Link or PictoBlox firmware is not assumed compatible.

AVR pins 0/1 are reserved for serial. Supported AVR PWM pins are Uno/Nano 3,5,6,9,10,11; Mega 2–13,44–46, subject to documented servo/tone timer conflicts. `digitalWrite` accepts 0/1; `analogWrite` accepts integers 0–255; both configure output mode. `setPinMode` accepts `INPUT`, `INPUT_PULLUP`, `OUTPUT`; `readDigital` preserves configured input mode. Servo and tone are implemented. Motor-driver, ultrasonic, I2C and SPI blocks remain unimplemented. See the current hardware contract for the exact ESP32 output/input-only/ADC1 and CAM pin maps.

The client validates pins before sending. It requires a protocol-version and board-identity handshake, handles split frames, limits input lines and pending requests, times out requests, releases stream locks and reports device removal. The firmware validates commands independently. `stop()` resets touched pins to LOW/input; a four-second communication watchdog performs the same reset. The host should call `stop()` when its Stop button is pressed. Closing the browser cannot guarantee delivery of a command, so the watchdog is required. Browser background throttling can trigger it; reconnection is explicit.

### Wire protocol, version 1

USB serial: 115200 baud, 8 data bits, no parity, one stop bit. ASCII lines terminated by LF; CR is ignored. Request IDs are 1–65535. Firmware input is bounded to 95 characters. Replies are `<id> OK [payload]` or `<id> ERR <reason>`.

| Request | Successful payload |
|---|---|
| `1 HELLO` | `DUETBLOX 1` followed by `UNO`, `MEGA`, `NANO`, `ESP32` or `ESP32CAM` |
| `2 PING` | empty |
| `3 MODE 2 INPUT_PULLUP` | empty |
| `4 WRITE 13 1` | empty |
| `5 PWM 3 128` | empty |
| `6 READ 2` | `0` or `1` |
| `7 ANALOG 0` | analog sample `0`–`1023` (`0` means A0) |
| `8 STOP` | empty |
| `9 ANALOG 34` | ESP32-WROOM GPIO 34 sample 0–4095 |
| `10 SERVO 9 90` | empty; board/pin/resource validation applies |
| `11 DETACH 9` | empty |
| `12 TONE 8 440 500` | empty; frequency in Hz, duration in milliseconds |
| `13 NOTONE 8` | empty |

`HELLO` also resets touched outputs. A watchdog expiry emits `0 EVENT SAFE` and invalidates the session. A fresh handshake is then required. Commands do not contain executable code.

## Scratch extension and export contract

The VM extension id is `duetHardware`. The implementation belongs in the official Scratch-based editor, while the parent app owns the serial service. No block opens a serial chooser.

| Opcode suffix | Arguments | Function |
|---|---|---|
| `whenBoardStarts` | none | Upload entry hat; does not auto-run hardware in live mode |
| `setPinMode` | `PIN`, `MODE` | command |
| `digitalWrite` | `PIN`, `VALUE` | command |
| `analogWrite` | `PIN`, `VALUE` | command |
| `readAnalog` | `PIN` (`A0`, etc.) | numeric reporter |
| `readDigital` | `PIN` | numeric reporter |
| `servoWrite` / `servoDetach` | `PIN`, `ANGLE` / `PIN` | command |
| `tone` / `noTone` | `PIN`, `FREQUENCY`, `DURATION` seconds / `PIN` | command |
| `map` | `VALUE`, `IN_MIN`, `IN_MAX`, `OUT_MIN`, `OUT_MAX` | numeric reporter |

`src/hardware/codegen.js` exports `exportArduino(project, {boardId, name})`, `scratchToIR(project)`, `scratchProjectToIR(project)`, `generateArduino(ir, options)`, and `downloadArduino(result)`. `project` is parsed Scratch `project.json`, not raw `.sb3` ZIP bytes. The host extracts the JSON. `exportArduino` also accepts portable IR directly. It returns `{ok, code, filename, diagnostics, boardId?, fqbn?}`. Errors result in empty code and no downloadable artifact.

Supported export features: one green-flag or board-start entry script; the hardware blocks above; repeat/forever/if/if-else/wait/wait-until/repeat-until; numeric variable set/change/read; add/subtract/multiply/divide/mod/random/round/map; numeric comparison; Boolean and/or/not; and reachable, nonrecursive My Blocks with numeric or Boolean inputs. A final outer forever body becomes Arduino `loop()`. Pins and pin modes must be constants. Menu shadows are supported. Variable, procedure and input names never enter C++ identifiers: generated identifiers are assigned internally.

My Blocks definitions must be in the same sprite as the start script. Calls may be nested but cannot recurse, directly or indirectly; the exporter permits at most 64 used procedures and 32 inputs per procedure. Numeric inputs require numeric values/expressions, Boolean inputs require Boolean expressions, and malformed or stale call metadata is rejected. Each call input is evaluated once in order. Boolean and/or evaluates both reporters before combining them, matching Scratch's eager evaluation for the supported expressions. Uncalled definitions are not emitted.

Parallel entry scripts, other event hats, sprite motion/appearance/audio, clones, broadcasts, lists/text, recursive or text-argument procedures, ML and other unknown blocks are diagnosed explicitly. Cyclic/missing block references and excessive nesting are rejected. There is no claim that arbitrary Scratch projects run on an Arduino. `preflightArduino` and `arduinoCapabilities`, exported from `src/hardware/generator.js`, expose this limited upload scope without a downloadable artifact.

The portable IR is `{version:1, variables:[{id,name,initial}], setup:[statements], loop:[statements], procedures:[{id,parameters,body}]}`; `procedures` is optional for earlier programs. Each procedure parameter has an `id` and a `type` of `number` or `boolean`; `call` statements supply the procedure `id` and ordered `arguments`, and `parameter` expressions reference the current procedure's input `id`. The original statement/expression subset includes `setPinMode`, `digitalWrite`, `analogWrite`, `wait` (`seconds`), `repeat` (`times`, `body`), `forever` (`body`), `if` (`condition`, `then`, `else`), `setVariable`/`changeVariable` (`id`, `value`), finite numeric literals, booleans, `variable` (`id`), `readAnalog`/`readDigital` (`pin`), `not` (`value`), and `add/subtract/multiply/divide/mod/lt/gt/eq/and/or` (`left`, `right`). See `src/hardware/generator.js` for the complete current hardware/control operations. Optional `blockId` makes diagnostics refer to original blocks.

AVR floating-point precision differs from browser JavaScript; this subset is not numerical bit-for-bit equivalence. Repeat counts are rounded to the nearest integer and bounded to an unsigned 32-bit range. Invalid dynamic output values leave the pin unchanged; invalid constant output values prevent export. Waits execute on the board and are blocking. These constraints must remain visible in export help.

## Browser and toolchain boundaries

[Chrome Web Serial documentation](https://developer.chrome.com/docs/capabilities/serial) specifies user-selected port access and secure-context requirements. [Mozilla](https://hacks.mozilla.org/2026/05/web-serial-support-in-firefox/) added Web Serial in Firefox 151 desktop with site-permission gating; managed installations may disable it. Do not hard-code “Firefox unsupported.” Feature-detect `navigator.serial` and test the actual OS/browser/device combination. WebUSB and Web Bluetooth are separate APIs; serial support alone does not implement either.

[Arduino CLI](https://arduino.github.io/arduino-cli/1.5/) is a build/upload toolchain, not a Scratch translator. The optional [bridge source](../tools/windows-bridge/README.md) wraps it. Browser download of an `.ino` is not board upload. Web Serial live mode does not compile code or install firmware.

Pin and board evidence: [Uno R3](https://docs.arduino.cc/hardware/uno-rev3/), [Mega 2560](https://docs.arduino.cc/hardware/mega-2560/), [classic Nano](https://docs.arduino.cc/hardware/nano/). [micro:bit transfer documentation](https://microbit.org/get-started/user-guide/transfer-code-to-the-microbit/) describes WebUSB/HEX workflows; integration here is planned. [Scratch Link architecture](https://github.com/scratchfoundation/scratch-link/blob/develop/Documentation/Architecture.md) is Bluetooth-oriented and does not supply a generic Arduino code generator.

## Validation performed and remaining

Run `node --test src/hardware/tests/hardware.test.mjs tools/windows-bridge/server.test.mjs` from the app directory. The tests exercise conversion and real Web Streams with a simulated serial peer, plus an HTTP bridge with a simulated CLI. All five live firmware targets and all five generated feature fixtures passed actual Arduino CLI1.5.1 compilation using AVR1.8.8, Servo1.3.0 and ESP32 core3.3.7. Versioned logs and memory reports are in `work/hardware-builds/<boardId>/validation.json`; source and binary SHA256 values are recorded in `public/firmware/<boardId>.json`.

For 0.5.0, `node --test src/hardware/tests/*.test.mjs` also covers the limited My Blocks translator and preflight. The new nested numeric/Boolean procedure fixture passed five actual board-toolchain builds; a Boolean-heavy fixture passed two additional builds for Uno and ESP32-WROOM. Selected generated host-C++ outcomes were compared against the installed official Scratch VM, including nested calls, parameter scope, ordered input evaluation and eager Boolean logic. Reproduction commands, source/binary hashes and precise limits are in `work/release-050/hardware-procedures.md`. These results are independent of the historical firmware builds above and do not count as physical uploads or device tests.

Still required before physical support is verified: board/bootloader identification; Windows host/driver validation; live pin/read/PWM/servo/tone checks; unplug/reconnect and watchdog checks; actual upload; cold-start disconnected execution; and invalid/missing-driver handling for each exact board. No board is marked physically verified until those checks have evidence.

## Firmware sources and notices

The [hardware source download page](../public/source/hardware/index.html) includes the exact DUETBlox firmware/generator sources, installed AVR 1.8.8 platform and Servo 1.3.0 sources, the official ESP32 core 3.3.7 archive, original license notices, SHA256 manifests, build commands, and the ESP-IDF/lib-builder/component versions used by the precompiled SDK. Large ESP source archives are split into parts of at most 24 MiB and can be reassembled without modification. The source manifest distinguishes mirrored sources from upstream SDK/submodule references; it does not claim that every component in the upstream SDK is used by DUETBlox. Compiler executables and unrelated toolchain archives are not included in these source downloads.

## Virtual Board Lab (0.6)

In Blocks, Try virtual board enables an explicit local I/O destination for the five implemented profiles. Use the green flag, set digital/analog inputs, and inspect GPIO/PWM/servo/tone commands. The same pin catalog and resource restrictions apply. A real board connection blocks simulation, and simulated failures never retry on hardware. Closing only the help panel keeps simulation active; Close Virtual Board Lab disables it. Mode/board changes, navigation and project import stop the program.

Stop clears virtual outputs while preserving controlled inputs and AVR timer reservations. Reset clears both. This does not run compiled code or emulate a CPU, circuit, voltage, sensor or camera. The bundled Uno example compares A0 with 512 and drives pin 13. Save before opening it. Hardware acceptance on the user's office devices remains pending.

## Standalone numerical learning in 0.7

Numbers learning can embed a trained small classifier or regressor into generated C++. It includes normalization, learned coefficients and prediction acceptance rules; predictions can drive the existing GPIO/control blocks after upload and disconnection. Set every feature input, predict, then check `numbers prediction accepted?` before using results. For classification use the one-based class index listed in the generated source; label text is browser-only. Regression acceptance means a successful finite result. Input indices must be fixed constants; sensor values can be expressions. See [numeric learning and exact limits](number-learning.md).

The helper source archive includes the generator's pure numerical model and prediction-policy dependencies. Five official board profiles compiled both algorithms, with a separate sensor-fed Uno build used for Ghidra validation. This is compiler/static evidence, not a physical sensor/USB test. Image, sound, pose and object-finder models are not uploaded by this path.
