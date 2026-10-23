# DUETBlox local Arduino CLI helper

This cross-platform local helper connects the browser editor to Arduino CLI on Windows, macOS or Linux. Its folder name is retained for compatibility. It is not a desktop application or packaged installer. Automated tests cover HTTP authorization, port discovery and firmware artifacts; physical serial uploads remain unverified.

The browser editor already supports downloading `.ino` code. This helper adds local Arduino CLI compilation and optional flashing, independent of the live Web Serial firmware. Do not hold a port open in live mode while uploading.

## Setup

Install a supported Node.js release (22 or newer) and [Arduino CLI from Arduino](https://arduino.github.io/arduino-cli/1.5/installation/). Install the AVR platform using the CLI's documented core manager:

```powershell
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install Servo
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.7 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
```

From the DUETBlox application directory, start the helper with the **exact** app origin:

```powershell
$env:DUETBLOX_ALLOWED_ORIGINS = 'http://localhost:5173'
node tools/windows-bridge/server.mjs
```

On macOS/Linux use `DUETBLOX_ALLOWED_ORIGINS=http://localhost:5173 node tools/windows-bridge/server.mjs`. The server prints a fresh pairing token. Paste it into the app's bridge settings. The browser client retains it only in memory. The token must never be placed in a URL, published, or included in project files. Set `DUETBLOX_ARDUINO_CLI` to an absolute executable path if it is not on PATH. Optional `DUETBLOX_ARDUINO_CONFIG` names the local CLI YAML configuration, useful for isolated core/library installations. These settings are read only from the helper process, never supplied by a browser request. Comma-separated exact origins are allowed; wildcards and remote plain-HTTP origins are rejected. For a hosted app, configure its exact HTTPS origin. Browser local-network permissions still apply.

Compilation works by default. To explicitly enable later user-triggered upload, restart with:

```powershell
$env:DUETBLOX_ENABLE_UPLOAD = '1'
node tools/windows-bridge/server.mjs
```

This flag does not flash anything by itself. The app must submit a separate upload action naming a build artifact and discovered serial port. The browser may instead retrieve the authenticated compiled artifact and flash it directly through its own explicit Web Serial action. Stop the helper with Ctrl+C when finished.

## API

The server binds only to `127.0.0.1:8765`. Every non-preflight request needs an exact allowed `Origin`, `Host: 127.0.0.1:8765`, and `Authorization: Bearer <pairing token>`. JSON POST bodies are limited to 1 MiB. The origin allowlist is not a substitute for the token.

| Route | Request | Response |
|---|---|---|
| `GET /health` | headers only | version, OS platform, supported board IDs, upload-enabled state, `cliAvailable`, `cliVersion`, `cliError`, required cores/libraries (not an installed-core claim) |
| `GET /boards` | headers only | `{ports:[{address,protocol,label,matchingBoards}]}` |
| `POST /compile` | `{boardId, project, variant?}` | `{artifactId,artifactURL,boardId,fqbn,expiresInSeconds,log,uploadEnabled}` |
| `GET /artifact/<artifactId>` | headers only | firmware bundle described below |
| `POST /upload` | `{artifactId,port,confirm:true}` | `{uploaded:true,boardId,boardName,port,log}` |

`project` is Scratch `project.json` or DUETBlox portable IR. The helper **regenerates** C++ itself. It never accepts browser-supplied C++ source, file paths, executable names, CLI options or arbitrary FQBNs. Unknown or unsupported blocks return HTTP 422 with diagnostics. The compiled artifact lasts 30 minutes, is bound to its chosen board, and is stored in a temporary directory; a maximum of eight artifacts is retained. Graceful shutdown and expiry remove these temporary files.

The fixed board map is Uno R3 → `arduino:avr:uno`, Mega 2560 → `arduino:avr:mega:cpu=atmega2560`, classic Nano → `arduino:avr:nano:cpu=atmega328`, classic ESP32-WROOM DevKit → `esp32:esp32:esp32`, AI Thinker ESP32-CAM → `esp32:esp32:esp32cam`. The only alternate variant is `{boardId:'arduino-nano',variant:'old-bootloader'}` → `arduino:avr:nano:cpu=atmega328old`. ESP32 uses Arduino core 3.x; 3.3.7 is the pinned validation target. See [hardware scope](../../src/hardware/README.md) for pin restrictions and unsupported camera features.

Before flashing, the helper checks the selected Windows `COM`, macOS `/dev/cu.*`, or Linux `/dev/ttyUSB*`/`ttyACM*`/serial-by-id port against a fresh CLI discovery result. It does not infer board identity from a USB serial chip: the user must select the correct model/bootloader. Upload errors remain errors.

`src/hardware/bridge-client.js` exports `ArduinoBridgeClient({token})` with `health()`, `boards()`, `compile(project,boardId,variant?)`, `artifact(artifactId)` and `upload(artifactId,port)`. Call upload only from a dedicated, explicit user action. Each subprocess uses argument arrays without a shell; concurrency is one job at a time. Compile timeout is 10 minutes for the ESP toolchain's first build; upload timeout is 3 minutes. Logs are bounded to 512 KiB.

Firmware responses use `{kind:'duetblox-firmware',version:1,artifactId,boardId,fqbn,format:'ihex'|'esp32',source:'compiled-project',physicalVerified:false,files:[{name,address,size,data,sha256}]}`. `data` is Base64 bytes; AVR bytes contain UTF-8 Intel HEX. AVR returns only the application `.hex`, never the `.with_bootloader.hex`. ESP32 uses the compiler-generated merged image at address 0; if absent, all four exact compiler-exported segments are required. Missing segments are an error, never fabricated. Only fixed compiler output filenames are readable, symlinks are rejected, and total binary size is capped at 8 MiB. SHA-256 detects corruption; the authenticated helper and verified toolchain remain the trust boundary.

## Tests

```powershell
node --test tools/windows-bridge/server.test.mjs
```

These tests use a fake CLI and verify origin/Host/token checks, fixed argument generation, server-side conversion, platform port validation, upload confirmation, bounded artifact reads and checksums. Separately, `src/hardware/build-firmware-bundles.mjs` performs real compiler checks and records toolchain versions/build logs. Neither check proves USB drivers, bootloader compatibility or physical device behavior.
