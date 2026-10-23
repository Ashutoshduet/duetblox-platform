# DUETBlox board programming

Two independent modes are implemented: **live** blocks talk to the supplied firmware through Web Serial; **upload** converts a supported Scratch script into standalone Arduino C++, compiles it with the local Arduino CLI helper, and transfers the resulting firmware using an explicit upload action. Merely selecting a board, compiling, or importing a project does not connect or flash it. A successful compile is not physical validation.

## Exact targets

| Profile | Fixed Arduino FQBN | GPIO choices | Analog input |
|---|---|---|---|
| Uno R3 | `arduino:avr:uno` | D2–D13; PWM 3,5,6,9,10,11 | A0–A5, 0–1023 |
| Mega 2560 | `arduino:avr:mega:cpu=atmega2560` | D2–D53; PWM 2–13,44–46 | A0–A15, 0–1023 |
| Classic Nano ATmega328P | `arduino:avr:nano:cpu=atmega328` | D2–D13; PWM 3,5,6,9,10,11 | A0–A7, 0–1023 |
| ESP32-WROOM DevKit | `esp32:esp32:esp32` | Output/PWM: 4,13,14,16,17,18,19,21,22,23,25,26,27,32,33. Input adds 34,35,36,39. | GPIO 32,33,34,35,36,39, 0–4095 |
| AI Thinker ESP32-CAM | `esp32:esp32:esp32cam` | GPIO 4,13,14 only, with the SD card removed | None exposed by this adapter |

AVR pins 0/1 are reserved for the serial connection. ESP32 profiles use 3.3 V GPIO; they are not 5 V tolerant. The WROOM profile excludes flash, boot-strapping and serial pins. GPIO 34/35/36/39 are input-only and have no internal pull-ups. ADC1 inputs are deliberately used so an eventual Wi-Fi extension will not share ADC2.

The CAM profile reserves all camera, PSRAM, flash, UART and boot-strapping pins. GPIO 4 drives its white flash LED; 4/13/14 are also wired to the SD socket. Camera image capture, streaming, SD storage and camera ML are **not implemented**. These are not generic pin maps for ESP32-C3/S3, WROVER or other camera boards. The CAM normally needs a USB-to-UART adapter or compatible programming base, and manual boot/reset may be required. Select the exact board and follow its electrical documentation before wiring.

Other catalog entries remain planned. `status: implemented-unverified` refers to software implementation; `physicalVerified` remains false until actual board tests are recorded.

## Live protocol and controls

`ArduinoSerialService` exposes `connect`, `reconnect`, `disconnect`, `stop`, `setPinMode`, `digitalWrite`, `analogWrite`, `readDigital`, `readAnalog`, `servoWrite`, `servoDetach`, `tone` and `noTone`. Connect must run from a user gesture. Reconnect only uses a previously authorized port. Firmware identity is checked against the selected profile before GPIO commands are enabled.

At 115200 baud, ASCII requests use `<id> <command> [arguments]\n`; responses use `<id> OK [value]` or `<id> ERR <reason>`. IDs range from 1 to 65535. Supported commands: `HELLO`, `PING`, `STOP`, `MODE pin INPUT|INPUT_PULLUP|OUTPUT`, `WRITE pin 0|1`, `PWM pin 0..255`, `READ pin`, `ANALOG channel`, `SERVO pin 0..180`, `DETACH pin`, `TONE pin 31..20000 durationMilliseconds`, `NOTONE pin`. AVR analog channel 0 means A0; ESP analog pin 34 means GPIO 34. Tone duration 0 plays until stopped; positive durations are at least 1 ms and at most one hour. Stop, disconnect and the 4-second communication watchdog detach outputs and reset touched pins to inputs. Servo detachment removes its control pulses; it cannot guarantee a mechanical position.

Use `getLiveFirmwareURL(boardId)` for the matching standalone `.ino`. The CAM firmware is deliberately a separate sketch because Espressif assigns both FQBNs the same `ARDUINO_ESP32_DEV` macro. `HELLO` reports `ESP32CAM` only for the CAM sketch. Install the supplied firmware again after uploading a standalone program to return to live mode.

Four servos and one tone are available per adapter. Servo pulses use 50 Hz and 1000–2000 microseconds; check the actuator's range and power requirements. ESP PWM uses 1000 Hz / 8 bits and at most eight active channels. ESP PWM channels use one LEDC speed group; servos and tone use another, distinct resolutions/frequencies and separate channels, so reattaching a tone cannot retune a servo. LEDC allocation failures are returned as errors.

On Uno/Nano the Servo library takes Timer1 (PWM 9/10), while tone takes Timer2 (PWM 3/11). Mega uses Timer5 for these four servos (PWM 44/45/46), and tone uses Timer2 (PWM 9/10). Upload rejects projects mixing those timer functions and conflicting PWM pins, even if they appear sequentially. Live firmware rejects conflicts. After a live servo/tone has used an AVR timer, its PWM pins stay reserved until a board reset, because detaching a library is not a reliable restoration of PWM timer configuration.

## Upload conversion contract

`exportArduino(project,{boardId,name})` accepts actual Scratch `project.json` or version-1 numeric portable IR. It returns `{ok,code,filename,diagnostics,boardId,fqbn}`; any diagnostic prevents code export. `scratchToIR` is also exported by `codegen.js`.

Exactly one green-flag or `duetHardware_whenBoardStarts` script is required. Supported statements are hardware pin mode/write/PWM/servo/detach/tone/noTone, variable set/change, wait, repeat, forever, if/else, wait-until and repeat-until. Expressions support numeric variables, analog/digital reads, arithmetic, comparison, boolean operators, random, round and map. Unsupported motion, sound, sprite events, concurrent scripts, strings, lists and extension blocks are diagnosed; they are never silently dropped. Board pins and modes must be constants. The repeat count follows numeric rounding; random uses a deterministic PRNG seed on each reset, integer endpoints inclusively, and decimal ranges otherwise. Map is linear, unclamped, and returns 0 for a dynamically zero-width input interval; a literal zero-width interval is rejected. AVR floats have less precision than Scratch's JavaScript numbers.

| Hardware opcode suffix | Argument names | Live service |
|---|---|---|
| `servoWrite` | `PIN`, `ANGLE` | `servoWrite(pin,angle)` |
| `servoDetach` | `PIN` | `servoDetach(pin)` |
| `tone` | `PIN`, `FREQUENCY`, `DURATION` (seconds) | `tone(pin,hz,seconds)` |
| `noTone` | `PIN` | `noTone(pin)` |
| `map` | `VALUE`, `IN_MIN`, `IN_MAX`, `OUT_MIN`, `OUT_MAX` | local numeric reporter |

## Verification and reproduction

Node tests run without a device:

```sh
node --test src/hardware/tests/hardware.test.mjs tools/windows-bridge/server.test.mjs
node src/hardware/build-firmware.mjs
node src/hardware/tests/build-fixtures.mjs
```

`build-firmware-bundles.mjs` invokes a real, separately installed Arduino CLI, compiles both live firmware and an all-feature generated sketch for each selected board, then writes `public/firmware/<id>.json`. It never invokes upload. Set `DUETBLOX_ARDUINO_CLI` and optional `DUETBLOX_ARDUINO_CONFIG`; use `--boards=arduino-uno,esp32` to select targets. Build logs live under `work/hardware-builds/<id>/validation.json`. Bundles include SHA-256 hashes, exact FQBN, actual CLI/core version data and `physicalVerified:false`. Rebuild after changing runtime source; do not manually relabel stale binaries. Actual device timing, wiring, bootloaders, USB reset behavior, servo motion, and browser flashing still require physical validation.

## Primary references

- [Espressif DevKitC pin and module differences](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- [Official AI Thinker camera pin mapping](https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h)
- [Espressif official board definitions and FQBN options](https://github.com/espressif/arduino-esp32/blob/master/boards.txt)
- [ESP32 ADC API and 12-bit default](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html)
- [ESP32 LEDC API and timer sharing](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html)
- [ESP32 SD MMC pin assignments](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/sdmmc.html)
- [Arduino Servo timer implementation](https://github.com/arduino-libraries/Servo/blob/master/src/avr/ServoTimers.h)
- [Arduino AVR tone timer implementation](https://github.com/arduino/ArduinoCore-avr/blob/master/cores/arduino/Tone.cpp)
- [Arduino CLI compile command](https://arduino.github.io/arduino-cli/1.5/commands/arduino-cli_compile/)
