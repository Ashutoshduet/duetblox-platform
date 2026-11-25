# Uno emulator integration fixtures

These are real application HEX files, compiled on 2026-11-24 from the adjacent DUETBlox-generated `.ino` sources. They are not manually invented output traces.

- Compiler: Arduino CLI `1.5.2-rc.1` (commit `fef6e48df`); core `arduino:avr@1.8.8`; FQBN `arduino:avr:uno`; AVR GCC `7.3.0-atmel3.6.1-arduino7`; Servo library `1.3.0`.
- `uno-blink`: D13 HIGH for 20 ms, LOW for 20 ms, repeat. Exercises AVR instructions, Timer0 / `millis()` and circuit GPIO.
- `uno-analog`: A0 above 511 drives D13 HIGH; otherwise LOW. Reads every 2 ms. Exercises real ADC register conversion and the connected potentiometer.
- `uno-button`: D2 `INPUT_PULLUP` controls D13. Exercises external GPIO values reaching the AVR PIN register.
- `uno-servo`: D9 servo at 120 degrees using DUETBlox's 1000–2000 microsecond mapping. Exercises Timer1 and measured servo pulses.
- `uno-tone`: D8 at 440 Hz for one second. Exercises Timer2 and measured pulse period.
- `uno-pwm`: D5 PWM at 128/255. Tests real timer output transitions, without substituting a prerecorded trace.
- Build: put one `.ino` into a matching sketch directory, then `arduino-cli compile --fqbn arduino:avr:uno --output-dir output path/to/sketch`. Rename only the resulting application `.hex`, not `.with_bootloader.hex`.
- Run: `node --test src/circuits/uno-runner.test.js`.

Board behavior is emulated at 16 MHz with 2 KB SRAM. These tests do not verify a physical USB upload or prove electrical safety. AVR8js is MIT licensed: https://github.com/wokwi/avr8js . The circuit model is a bounded DC approximation and does not invoke SPICE.
