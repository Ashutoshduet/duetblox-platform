# Browser programming implementation

The app supports live control and standalone compilation for Uno R3, Mega2560, classic Nano, ESP32-WROOM DevKit and AI Thinker ESP32-CAM. The board registry is the authority for output, ADC, PWM and reserved pin capabilities. Other catalog entries remain planned; STEMpedia devices appear only after expanding Other boards.

Live firmware is built with the official Arduino CLI1.5.1, Arduino AVR1.8.8/Servo1.3.0 and ESP32 core3.3.7. All ten target/source combinations (live and all-feature exported program per profile) compiled successfully on macOS ARM64. `src/hardware/build-firmware-bundles.mjs` records source and artifact hashes and compiler logs. Compiling verifies C++ compatibility and memory use; it does not validate USB drivers, bootloaders, electrical behavior or sensors.

`src/programming/firmware.js` validates a bundle's selected board, format, SHA256 and memory bounds. AVR HEX records are checked for length/checksum, overlap and EOF and cannot overlap the configured bootloader region. ESP bundles contain the actual compiler-generated merged image at address0 or the complete exported bootloader/partitions/boot_app0/application set. Missing bytes are never synthesized.

Browser upload is an explicit serial-port choice after firmware preparation or compilation. `webserial-flasher`1.0.1 implements STK500v1 and v2; DUETBlox supplies a bounded buffered Web Serial transport so early replies are not lost and DTR/RTS map to the browser API. `mega-programmer.js` corrects the generic v2 programmer for Arduino's actual wiring bootloader: signature index/response offsets, no unsupported device descriptor, and no rejected chip erase (the bootloader erases pages while writing). The correction is based on Arduino AVR1.8.8 `bootloaders/stk500v2/stk500boot.c`, not merely the generic protocol library.

AVR upload checks the chip signature and compares flash read-back bytes. ESP upload uses official `esptool-js`0.7.0, verifies the detected chip is classic ESP32, writes the supplied addresses, and verifies device MD5 for each written image. The supplied merged ESP32 image replaces all 4 MB of flash, including NVS settings and filesystem data; this is shown before upload. AVR fuses are not changed. A DUETBlox transport wrapper releases writer locks on failure, bounds cleanup and closes ports that finish opening after cancellation. Cancel and finalization share one cleanup operation and preserve the original upload error. An interrupted upload may need to be repeated.

The local compiler helper is required for native C++ compilation; the public website does not host an arbitrary compiler. Its loopback service accepts a session token, regenerates C++ from supported blocks and invokes a fixed Arduino CLI profile. The firmware artifact endpoint is authenticated and bounded. Browser uploads require the live-control connection to be disconnected first. Compiled program snapshots and generated code are invalidated on leaving Boards; late compilation results after navigation or a board change cannot become uploadable. The historical `tools/windows-bridge` path contains this cross-platform service, not a Windows desktop build.

## Validation boundaries

- Pure tests exercise corrupted HEX/data, wrong-board rejection, application bounds and cancellation.
- Real STK500v1/v2 protocol implementations execute against emulated serial streams. Tests check write/read-back, wrong signature, corrupt read-back, signal mapping, early/fragmented responses and Mega bootloader differences.
- ESP orchestration tests use a fake loader to check offsets/chip guard/MD5 callback/cleanup. They do not prove an ESP USB upload.
- Integrated browser QA loaded a real `.sb3` blink project, generated C++, connected the temporary local compiler, invoked real Arduino CLI, downloaded the returned artifact and validated it in the browser. Precompiled AVR/ESP live bundles were also prepared in the UI.
- No physical board was connected or flashed. Camera capture on ESP32-CAM is not implemented. Microcontroller-only ML and proprietary robot protocols are outside the implemented subset.
