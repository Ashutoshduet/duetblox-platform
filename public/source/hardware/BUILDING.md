# Rebuilding DUETBlox board firmware

These downloads accompany the five firmware bundles at `/firmware/`. They provide the exact application sketches/generator, installed AVR platform and Servo sources, and the exact official Arduino ESP32 core archive used for compilation. Original per-file notices are retained. DUETBlox source is provided under the repository's AGPL-3.0 license; Arduino core and Servo notices describe LGPL-2.1 terms; components retain their own licenses. See `notices/`, the source archives and `sdk-source-references.json`.

The ESP32 SDK is separately precompiled by Espressif. `esp32-sdk-versions.txt` is copied directly from the installed SDK. Its IDF, Arduino, TinyUSB and library-builder commits are resolved in the source references. Component registry versions and source URLs are listed without claiming every component is part of the final firmware. The SDK's camera version is blank upstream; it is not guessed. Camera capture and SD features are not implemented in the GPIO firmware. This page mirrors the Arduino core and build configuration, while the larger SDK component/submodule and compiler sources remain available at those pinned upstream links.

## Verify and reconstruct downloads

On macOS/Linux, from this download directory:

```sh
shasum -a 256 -c SHA256SUMS
cat esp32-core-3.3.7.zip.part-001 esp32-core-3.3.7.zip.part-002 > esp32-core-3.3.7.zip
shasum -a 256 esp32-core-3.3.7.zip
```

The reconstructed ZIP must be exactly 27,546,724 bytes and SHA256 `5267dc9a240daf4b8d26d3a1eb4c4f1dc8a40d43d527e6f6ce08cb6baaf6efac`. On Windows use Command Prompt `copy /b esp32-core-3.3.7.zip.part-001+esp32-core-3.3.7.zip.part-002 esp32-core-3.3.7.zip` and PowerShell `Get-FileHash -Algorithm SHA256 esp32-core-3.3.7.zip`. Each part is at most 24 MiB. This is the original official package ZIP, including its own scripts and notices, rather than a newly generated tag archive.

## Install the pinned build tools

Install Arduino CLI1.5.1 from Arduino's official release, and a supported Node.js release (22+). Compiler executables are intentionally not copied into the source bundle. Use an isolated CLI configuration if desired; `DUETBLOX_ARDUINO_CONFIG` selects it. These commands download Arduino's and Espressif's unmodified toolchain packages:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install arduino:avr@1.8.8
arduino-cli lib install Servo@1.3.0
arduino-cli core install esp32:esp32@3.3.7 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
```

If using `--config-file /path/arduino-cli.yaml`, pass it to each command above. To rebuild with modified core/library sources, use `arduino-cli config dump` to locate its configured data/user directories. Replace the corresponding installed `packages/arduino/hardware/avr/1.8.8`, `packages/esp32/hardware/esp32/3.3.7` or user `libraries/Servo` contents with the unpacked sources, preserving the package structure. The full source archives include platform build recipes and variant files needed to recompile and relink.

## Rebuild and relink

Extract `duetblox-hardware-sources.tar.gz` into an empty working directory. It contains both standalone `.ino` files, all JavaScript source needed by the generator, feature fixtures, tests and these reproducible build scripts. No npm dependencies are required for these hardware scripts.

```sh
node src/hardware/build-firmware.mjs
node --test src/hardware/tests/hardware.test.mjs tools/windows-bridge/server.test.mjs
node src/hardware/build-firmware-bundles.mjs
```

Set `DUETBLOX_ARDUINO_CLI` to an absolute executable path and `DUETBLOX_ARDUINO_CONFIG` to an absolute YAML path when needed. The build script compiles each live firmware and an all-feature generated program, records memory reports and actual toolchain versions under `work/hardware-builds/<boardId>/validation.json`, and writes new bundles under `public/firmware/`. Use `--boards=esp32,esp32-cam` to select targets. Changing a library or sketch and running this build produces newly linked, user-modifiable firmware; no signing key is required by DUETBlox.

The equivalent direct commands are:

```sh
arduino-cli compile --fqbn arduino:avr:uno src/hardware/firmware/DuetBloxLive
arduino-cli compile --fqbn arduino:avr:mega:cpu=atmega2560 src/hardware/firmware/DuetBloxLive
arduino-cli compile --fqbn arduino:avr:nano:cpu=atmega328 src/hardware/firmware/DuetBloxLive
arduino-cli compile --fqbn esp32:esp32:esp32 src/hardware/firmware/DuetBloxLive
arduino-cli compile --fqbn esp32:esp32:esp32cam src/hardware/firmware/DuetBloxLiveESP32CAM
```

These commands compile only. Uploading requires the user's explicit device selection and flash action. A successful compile does not validate wiring, bootloaders, physical behavior or timing. All supplied bundles retain `physicalVerified:false`. Build success is reproducible with the listed inputs; byte-identical output across host platforms or changing toolchain cache paths is not promised.

## Underlying SDK sources

The mirrored lib-builder archive is commit `8cabf2c3eaa169754f55f58675e224c918815eb7`. Its README and scripts explain rebuilding the SDK. ESP-IDF is `87912cd291d68f4319f13695718af6754879a83f`; obtain its recursive submodules at that commit. The SDK's Arduino source reference is `86c2c0046d4c732aa7cf6e049ac3b76a4da148b3`. TinyUSB is `2883403ed010c54c33a38c28358a4dd0c67d67c0`. The SDK's original configuration, flags and linker scripts are in `esp32-sdk-build-configuration.tar.gz`. SDK components and compiler runtime libraries have their own copyright/license notices in their referenced source repositories.

`manifest.json` maps downloadable archives to SHA256 values and records each compiled firmware's source hash, exact FQBN, build time and compiler/library versions. The core package's generated git-description marker is retained inside the original archive; its checksum, not an assumed equality to a GitHub tag snapshot, identifies the supplied source files.
