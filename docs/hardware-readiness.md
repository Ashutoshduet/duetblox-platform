# Hardware readiness and connection reliability

The Boards page now separates the five implemented software profiles from planned devices. Uno R3, Mega 2560, classic ATmega328P Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM remain visible in the main list. Planned boards and STEMpedia robots remain inside the collapsed **Other boards** section. No new board adapter, firmware or physical-support claim was added in this change.

## Connection lifecycle

Each live connection attempt has a generation number. Cancel, disconnect, device failure and disposal invalidate that generation. The generation is checked after the browser's port chooser, after native port opening, after each handshake attempt and before reporting a connection as established.

The browser owns its serial chooser and cannot be dismissed by the application. A cancelled chooser's later selection is ignored without opening the selected port. If native `open()` is already pending, the service remains in `disconnecting` until that operation settles, then closes the port without sending a handshake. New connections cannot overlap this cleanup. A stale attempt cannot close or overwrite a later successful connection.

Reconnect is explicit and checks whether permission for the previous selected port still exists. Cancelling during the permission check also invalidates that reconnect. Disposal permanently disables the service instance. A normal disconnect still sends `STOP` before closing; firmware watchdog behavior remains unchanged.

The UI provides **Cancel connection**, **Disconnect**, and **Reconnect last board** actions. A cancelled asynchronous operation cannot overwrite a newer operation's busy/error state. Connection states are announced through a status region.

## Readiness shown in the UI

- Secure context: the page must use HTTPS or localhost.
- Browser serial API: feature detection checks `navigator.serial`; browser names are not used as a proxy for support. User permission, drivers, device ownership and policy may still prevent opening a port.
- Local compiler: a successful health check is required before compiling blocks. Rechecking immediately clears the previous compiler client and health result, so a failed recheck cannot leave the Compile button enabled from stale state. Prepared live firmware and live control do not need the compiler helper.
- Physical validation: all five profiles still say **pending**. Actual device tests have not been fabricated from compilation or a simulated transport.

The capability panel shows exact supported models, logic voltage, digital input/output pins, PWM pins, analog channels/ranges and AVR timer-sharing restrictions. ESP32-CAM remains limited to GPIO 4/13/14 with the documented SD/socket restrictions; camera capture and SD blocks remain unavailable.

Live control executes blocks in the browser and requires the browser/cable connection. A compiled, uploaded program executes the supported hardware subset on an independently powered board after USB disconnection. Stage graphics, sound playback and ML do not become embedded programs.

## Diagnostic export

**Export diagnostics** creates `DUETBlox-hardware-diagnostics.json` locally. The schema is an explicit allowlist containing only registered board identity/capabilities, secure-context and Web Serial availability, an enumerated connection state, protocol version, a boolean error indicator, and compiler-check booleans. It excludes session tokens, compiler logs, error strings, native ports, device identifiers, project data, URLs and personal filesystem paths. Export does not contact a server.

## Verification

Run `node --test src/hardware/tests/hardware.test.mjs`. The suite includes delayed chooser selection, delayed native opening, concurrent connect requests, cancellation during handshake and reconnect-permission lookup, stale chooser completion after a new connection, disposal, failed compiler rechecks and diagnostic redaction. Tests use real Web Streams with a simulated serial peer; they do not establish physical-board validation.

Physical acceptance still requires each exact model/bootloader, USB drivers, actual live GPIO/PWM/ADC/servo/tone behavior, disconnect/watchdog behavior, verified flashing and cold-start execution with USB removed. Browser UI checks complement, but do not replace, those device tests.
