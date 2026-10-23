# DUETBlox 0.7.0

This release addresses concrete gaps from the 18 October comparison using independent implementations guided by bounded REA evidence. It does not establish superiority over every block-programming platform.

## Implemented

- Real offline Python: Pyodide 314.0.7 / CPython 3.14.2, standard library, queued input, output/errors, Stop by worker termination, .py files and .duet persistence. A fresh interpreter starts for each Run.
- Numerical classification and regression: validated CSV/JSON/manual tables, local softmax/ridge training, independent holdout metrics, test inputs, confidence/Unknown policy, portable models and Scratch extension.
- Numerical model deployment: generated normalization, coefficients, inference and acceptance logic run in standalone Arduino/ESP32 C++. Input bounds and unsupported shapes fail explicitly. Image/sound/pose models are still browser-side.
- Private classroom/LAN: separate room and role keys, bounded gallery, exact project downloads, shared numeric values and Scratch blocks. No public community is implied. The service binds loopback by default; LAN access is an explicit operator setup.
- Nested Data lists: original immutable operations over bounded JSON values in normal Scratch variables. This is not Snap's first-class functions/list language.
- Experimental object finder: labeled foreground/background boxes, local crop-classifier training, bounded image scanning, holdout IoU/precision/recall, portable datasets/models and real Scratch reporters. This learns crop classes, not box coordinates; it does not establish general object-detector parity. See [method and limits](object-learning.md).
- Workspace v4 keeps Python and all implemented model sections together and resets missing legacy sections. Import candidates validate before persistent state is committed.
- Dataset ownership checks prevent old autosave timers or late file reads from overwriting an incoming workspace. Python output and undo history reset when a different workspace is opened.

## Research and tests

REA inspected seven exact PictoBlox packaged methods/excerpts for worker startup and numeric/object import/inference glue. Those excerpts do not establish training backend internals. Evidence `ev_74e03976497f72d9fe3c391d6f1a84a629363c7def370ec11d8413b9c175d2cb` retains unresolved semantic coverage.

Ghidra 12.1.4 analyzed a new sensor-fed Uno classifier, not an unchanged binary. All 4,992 flash bytes matched independent HEX decoding; 60 functions decompiled. Toolchain symbols corroborate retained exponential inference calls. Source/generator/differential tests establish the higher-level intent; Ghidra alone does not prove accuracy or device operation. See retained `native-findings.md` and `native-identity.json`.

Final browser, unit, compiler, offline-pack and handoff results are recorded in [validation](validation.md). Python production testing caught a missing .mjs MIME type and classroom testing caught an unbound browser fetch receiver; both were corrected before handoff.

Object testing exposed a localization-grid defect: some ordinary target positions had no candidate box capable of meeting the holdout IoU threshold. Denser, edge-covering windows corrected that structural issue. A real trained synthetic fixture then produced a matching box with IoU 0.869; its deliberately permissive confidence setting also produced four false positives. This proves execution and improved geometric coverage, not real-world accuracy or superiority.

The final production integration run at 80% confidence produced one true positive, two false positives and no false negatives. Its eight workspace/model/block scenarios passed. Twelve final offline scenarios also passed with browser networking disabled and a newly opened page. Final root and editor totals are 277 and 20 passing tests respectively; detailed scope and pack identities are retained in the validation record.

## Still bounded or pending

Physical Uno/ESP32/Raspberry Pi and sensor/robot acceptance needs the user's office devices. No board has been flashed in this release. Additional board/robot protocols remain planned; unsupported catalog entries are not represented as functioning adapters. Windows packaging follows browser validation.

Learning steps still supports the documented synchronous subset; the logical board lab does not emulate a CPU or electrical circuit. Full asynchronous debugging, broader simulations, first-class higher-order block functions and image/audio/pose microcontroller deployment are not completed by this release. Python is a separate text workspace, without block conversion, sprite API or board Python upload.
