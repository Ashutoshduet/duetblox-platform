# DUETBlox comparison and REA findings — 18 October 2026

DUETBlox 0.3.0 is not yet demonstrably better overall than PictoBlox, Scratch, or mBlock. It provides a useful combination of real Scratch execution, a simpler Junior interface, local image/sound/pose/text training, model evaluation, and Arduino/ESP32 programming. The outstanding offline, physical-device, accessibility, and learner-testing gaps matter more than the number of feature cards.

This baseline review compares the shipped **0.3.0** browser artifact and its recorded functional tests with current official documentation and a bounded static inspection of PictoBlox's public browser bootstrap. Competitor documentation establishes advertised functionality, not a measured head-to-head result. No competitor desktop binary was decompiled and no competitor private service was accessed. The resulting 0.4.0 improvements and their validation are recorded separately in [release notes](release-0.4.0.md) and [validation](validation.md); the 0.3.0 REA result does not certify them.

## What competitors already provide

| Product | Evidence from official sources | Implication for DUETBlox |
|---|---|---|
| Scratch | The [Scratch Foundation](https://scratchfoundation.org/tools) offers both online creation and an offline Scratch app. Its [getting-started guide](https://resources.scratch.mit.edu/www/guides/en/scratch-getting-started-guide.pdf) provides guided first projects. | Reliable offline creative coding and approachable first lessons are established expectations. Using its editor is a foundation, not proof of surpassing it. |
| PictoBlox Junior | The [Junior tutorial](https://ai.thestempedia.com/docs/pictoblox/pictoblox-tutorials/getting-started-with-junior-blocks/) documents pictorial blocks, multiple scripts, motion, looks, sound, control, pen, and AI/robot extensions. Its [educator FAQ](https://thestempedia.com/international-educator-bootcamp-on-ai-and-coding-with-junior-blocks/) states downloaded Junior can be used offline. | Large picture blocks alone are not a unique advance. DUETBlox must make first-time creation and recovery easy and test it with children. |
| PictoBlox ML | The [image-classifier tutorial](https://ai.thestempedia.com/pictoblox-block/identified-class/) describes train/test/export, per-class training accuracy, and a confusion matrix. That page still states model creation is desktop-only. [Object Detection ML](https://ai.thestempedia.com/extension/object-detection-ml/) documents bounding boxes, adjustable thresholds, and several export formats. | DUETBlox's integrated browser training is a bounded distinction from that published desktop-only workflow. Confusion matrices and thresholds are not unique. DUETBlox does not yet match PictoBlox's broader ML catalog. |
| mBlock | [Machine Learning 2.0](https://support.makeblock.com/hc/en-us/articles/24646380612887-FAQ-on-Machine-Learning-2-0) already supports image, audio, and pose transfer learning in the local browser. Its training data is not sent to the vendor. [Direct connection](https://support.makeblock.com/hc/en-us/articles/19412317319191-Introduction-to-Direct-Connection-of-mBlock-5-on-the-web) supports browser serial/Bluetooth on supported hardware. | Browser-local multimodal ML and direct hardware connections are not unique DUETBlox features. An older mLink-only article should not be used to imply all current browser connections require a helper. |
| Teachable Machine | The [official introduction](https://teachablemachine.withgoogle.com/?ld=SDINBlogDirect) describes gathering examples, training/testing, and exporting image/sound/pose models, with on-device use. The [official community repository](https://github.com/googlecreativelab/teachablemachine-community) supplies libraries and examples. | DUETBlox integrates these kinds of models into programming; it must not present the underlying ML technique as its invention. On-device processing by itself does not prove a fresh offline launch works. |
| Machine Learning for Kids | Its [maintained source repository](https://github.com/IBM/taxinomitis) describes guided text, numbers, and image learning connected to Scratch, with a separate worksheet collection. Its [Scratch interface](https://machinelearningforkids.co.uk/scratch/) includes explicit warnings about testing with training examples. | Guided ML lessons, Scratch integration, and leakage warnings have precedents. The storage/offline behavior of each current model type was not tested here. |

The current official pages do not establish a universal winner. For example, the documented PictoBlox image workflow and mBlock browser workflow have different platform coverage. A missing item in this small documentation review means **not established**, not **absent**.

## What is actually established for DUETBlox

The [0.3.0 validation record](validation.md) reports 118 passing automated tests and actual production-browser runs. Those runs establish executable Scratch ML blocks, four-model project save/reopen, separate evaluation examples, and report generation. They also expose weaknesses: the small sound classifier performed poorly on frequencies outside its fixture training distribution. No comparative accuracy or speed benchmark was run against another product.

Useful DUETBlox capabilities already exercised include one `.duet` file containing programs, training data, models, prediction settings, and separate evaluation data; inspectable Hindi/English word-count text classification; explicit Unknown decisions and acceptance blocks; and local hardware-readiness diagnostics. These are concrete capabilities. Their presence does not establish that no competitor has equivalent functionality.

Physical flashing, USB driver behavior, live camera/microphone collection, learner usability, broad browser coverage, and a Windows installer remain acceptance work. Five Arduino/ESP32 software profiles have compiled firmware/program evidence; that is not the same as five physically verified boards. Other board cards remain a catalog of planned adapters. The ESP32-CAM profile does not implement camera or SD-card programming.

## REA: actual shipped-artifact analysis

The requested REA skill was applied to a frozen copy of the production `dist` directory. The connected tool inventory did not expose REA MCP tools, so the authorized, version-pinned CLI fallback was used without changing client configuration. This is separate from ordinary source inspection.

```text
npx -y rea-agents@6.5.0 analyze-javascript-application work/release-040/rea-target \
  --source-path index.html \
  --source-path assets/index-6_5BJe51.js \
  --source-path scratch/index.html \
  --source-path assets/codegen-CawPSwGt.js \
  --analysis-timeout-ms 120000 \
  --max-semantic-nodes 12000 \
  --max-semantic-nodes-per-file 6000 --format json
```

- Evidence ID: `ev_c7733837cd43836764033774cf657dbd218b335bd29288547e11100b063d721f`.
- REA root artifact SHA-256: `55888110662d9951709ba4a27b5de33e1a0b7d25bb76e909363e4f7355481a0d`.
- Complete Evidence JSON SHA-256: `221e64847f6327207694ae0be8edbc7de7db49c4f61985617d2561471dba1d76`.
- The independent file manifest covers 1,816 snapshot files, totaling 285,116,386 bytes. Manifest SHA-256: `36ba8884a1a9833d34dfea73df7070ee51a8c5b480ae0a9a3cf0d69508785636`.
- REA inventoried 87 relevant files, analyzed four selected paths, parsed two JavaScript files, and recorded no parse failures. The other 83 files were not analyzed. The semantic graph reached the selected node ceilings and is explicitly partial/truncated.
- Full evidence is retained under `work/release-040/rea-duet-030.json`, with a small derived projection in `rea-duet-030-summary.json` and byte identities in `rea-target-manifest.json`. Release handoffs may store these under `validation-evidence/release-040/`.

| Finding | Evidence type and exact boundary | Engineering consequence |
|---|---|---|
| Two HTML entrypoints reference the host application and Scratch editor. | Static REA graph nodes `jag_node_4814e3eafad4af00c59eb5a8e83f3b73317bcfcc8449044bc6e2f21e8a992784` and `jag_node_b903d9bb38c2f5504a4133c3cd904f4be1fc608afa14dd40842762a46d07db71`. | Offline caching must include both application surfaces and their assets. |
| `indexedDB.open` is present in the host bundle. | Static syntax, node `jag_node_2d16440c7b235f6328f8fb14e2f955db5413536b0127d6bfa95ce64de120ae13`. | Local data storage is plausible from static evidence; persistence/reopen needs runtime tests, supplied separately in 0.3.0 validation. |
| `/health`, `/boards`, `/compile`, and `/upload` request paths are present. | Static syntax in the main bundle; endpoint nodes are preserved in the summary JSON. | A browser UI does not replace the native compiler service. Offline readiness must distinguish the app from the installed compiler/toolchains. |
| Lazy TensorFlow, speech, and pose imports are present. | REA import relationships are partially unresolved because the emitted specifiers are not ordinary installed-package paths. | The absence of a resolved graph edge does not mean the emitted chunk is missing or unusable. Test actual production loading. |
| Google model URL prefixes and Scratch asset URL templates remain in shipped chunks. | Supplemental inert string inventory in `shipped-url-candidates.json`, with per-file hashes; not proof of an observed request. | Local UI files alone do not establish complete offline ML or costume/sound libraries. Dependencies must be bundled and then exercised without network access. |

REA uses the generic graph role `electron-renderer` for the HTML nodes above. This **does not establish an Electron desktop application**. Its summary recorded zero BrowserWindows, preloads, and IPC operations within the selected scope. Source/build inspection identifies the current target as a browser app, and no Windows desktop package is claimed.

All REA inputs were parsed as inert text; no bundle bootstrap was executed by REA. Static syntax does not prove runtime reachability, permission handling, network activity, safety, or complete application coverage. Full 0.4.0 behavior must be validated against the resulting 0.4.0 build, not inferred from this baseline.

## PictoBlox public bootstrap: bounded reverse engineering

The actual public HTML at [pictoblox.ai](https://pictoblox.ai/) was fetched read-only on 18 October 2026. Its embedded entry manifest identified a CDN-hosted gate, GUI, onboarding, and service-worker registration bundle. Only the HTML and the two small, explicitly referenced bootstrap files were acquired; no asset URL was guessed and no downloaded code was executed.

| Acquired artifact | Bytes | SHA-256 |
|---|---:|---|
| `index.html` | 3,098 | `738589ff7169904bd26e99f3dbfff5fb36593185ba08749c42aae5bf542e5550` |
| `gate.e8424f152a0e020d2cdb.js` | 40,138 | `441ef7a49a8da3daa7786e010a1efa97b030286a41f7c3b323c228b2bb4be7a8` |
| `swRegister.290e656e6b169c9ef872.js` | 4,663 | `64ce1c99d7c3fa56106748eaa4494a7baf228cb16904a405c6036a683935da23` |

The acquisition manifest records the exact public URLs and HTTP results. The referenced main GUI URL responded to HEAD, but its body was not acquired; its size was not supplied by that response. The gate is sufficient to answer the bounded loading-architecture question without analyzing a broad proprietary application bundle.

REA 6.5.0 analyzed these three paths once, using the same 120-second per-source and 6,000/12,000-node limits as the DUETBlox analysis:

- Evidence ID: `ev_c16ed88d7138a5b062db40355c6bfa32a1a4cdd38a583ed77c0089ef1a205b11`.
- Captured-tree SHA-256: `cb73b1eac75f27cbe5cbf751ce50aa2e5b7fdf71525df9fb28d1d8c18a597d94`.
- Full Evidence JSON SHA-256: `2ddc51237612927ff2ea84fe202ca70dd2a79b5a500cfa1224b8b18de6e2c367`.
- Two JavaScript files parsed, zero parse failures; 47,899 text bytes read. The acquisition metadata JSON is the one inventoried file outside selected analysis. The semantic graph is partial/truncated at its configured ceilings; most of the live application was never acquired.
- Files: `work/release-040/rea-pictoblox-public/`, full `rea-pictoblox-public.json`, and derived `rea-pictoblox-public-summary.json`.

REA records the HTML-to-CDN-script relationship at node `jag_node_bf38dcc337f7df374019644be00cc07c795f6dc1140fe66b863806b6f88100a7`. The URL remains classified as external because the original HTML was preserved without rewriting CDN references into local paths. Acquisition hashes bind the locally saved file to that response separately.

Supplemental reading of the same inert bundles establishes that the gate parses the entry manifest and contains dynamic script creation plus download-progress paths. The registration bundle contains a `service-worker.js` registration path and cross-origin-isolation-related text. These observations describe shipped syntax; the actual registration, worker body, cache policy, fallback behavior, and offline launch were not observed. It would be incorrect to infer either complete offline support or its absence from this loader alone.

The bounded architectural comparison is therefore: PictoBlox's observed entry uses a CDN bootstrap/manifest, while DUETBlox 0.3.0 has same-origin host and Scratch HTML entrypoints with separately emitted ML chunks. Neither architecture alone proves simpler student interaction, faster loading, or better offline behavior. No PictoBlox implementation code was copied into DUETBlox.

## Stack and boundaries

The source manifests supply exact component identities that the selected minified-artifact graph cannot fully recover:

| Layer | Current source manifest / implementation | Boundary |
|---|---|---|
| Host UI | React 18.3.1 and Vite 6.4.4; `package.json`, `src/App.jsx` | Chooses Junior, Scratch, ML, boards, and projects. |
| Programming engine | Official Scratch GUI/VM/render/storage packages pinned to 15.2.0; `apps/scratch-editor/package.json` | Real Scratch execution in its editor surface. Junior generates programs for the same VM. |
| Media ML | TensorFlow.js 1.3.1, Teachable Machine image 0.8.5 / pose 0.8.6, speech-commands 0.4.0, PoseNet 2.2.1 | Browser-side training/inference; pretrained backbones and compatibility must be supplied. |
| Text ML | DUETBlox Multinomial Naive Bayes implementation | Learns word counts, not general language understanding or translation. |
| Local projects | IndexedDB plus JSZip 3.10.1; `.duet` version 3 | Browser data can be cleared; portable downloaded projects remain necessary. |
| Hardware | Web Serial, AVR/ESP upload protocols, esptool-js 0.7.0, optional Arduino CLI helper | Board execution and browser inference are separate; the ML model is not automatically deployed to a microcontroller. |

The supplied MIT CML repositories primarily concern App Inventor. DUETBlox uses the actual maintained Scratch component family documented in [research.md](research.md). REA is an analysis tool, not the block editor library.

## Priorities and acceptance criteria

1. **Make offline behavior measurable.** Bundle required ML backbones and the standard media library; provide an explicit offline preparation/status flow. Test a cold local launch with internet blocked, then a prepared hosted app with the origin unavailable. Exercise new projects, save/reopen, image/sound/pose/text training, and media selection. State which cloud extensions and compiler setup still require connectivity.
2. **Make the first activity obvious.** Provide short, local, age-appropriate paths into Junior, normal Blocks, and ML, with visible progress and a recoverable return point. Keep advanced evaluation and hardware details available without making the first screen depend on understanding them.
3. **Retain honest hardware states.** Separate planned, implemented, compiled, connected, and physically verified. Test each exact Arduino/ESP32 model for first flash, reconnect, wrong port, unplug during upload, output behavior, and running a standalone program after disconnecting.
4. **Protect students' work.** Retain all four-model project roundtrips and explicit backups; test cache update interruption, storage quota failures, and reopening after a new app build. An offline-ready badge must not conceal missing or failed assets.
5. **Measure ease of use.** Run the same short tasks with representative students in each tool: first animation, train/test/use a classifier, recover a lost connection, and reopen offline. Record unaided completion, help requests, error recovery, and time. This review did not perform that study.

Object detection, hand-specific pose training, numerical ML, classroom management, proprietary robot adapters, and Windows packaging remain separate projects. Adding their names to the UI would not close the gap.

## Review completeness

- Answered: current documented competing workflows; DUETBlox 0.3.0 artifact identity; selected static entrypoints, storage, compiler paths, and dependency candidates; the bounded PictoBlox public bootstrap architecture; implementation priorities.
- Partially answered: feature comparison and offline readiness. Competitors were compared through current primary documentation, with three public PictoBlox entry artifacts additionally analyzed as inert text; DUETBlox runtime evidence covers bounded fixtures.
- Unresolved by this comparison: comparative learner outcomes, comparative ML accuracy/performance, broad accessibility/device compatibility, physical hardware behavior, and complete offline runtime behavior. Consult the separate release validation for the precise offline workflows subsequently tested.

The defensible release statement is that DUETBlox is improving specific, tested student workflows. A claim that it is generally better than PictoBlox, Scratch, mBlock, or all other tools would need evidence this investigation does not supply.

## 0.6 follow-up: measured additions, not a league table

DUETBlox now supplies an original Studio toolbar, searchable Project map, bounded synchronous Learning steps and a local virtual board I/O model. These address concrete usability and inspection gaps. Snap! and MakeCode already document stepping/debugging; PictoBlox and mBlock already distinguish Live/Upload. The presence of our tools is not proof that those products lack them or that our implementation is broader.

REA selected three further PictoBlox generation/scheduling methods; Ghidra identities were rechecked against the previously analyzed native files. The original analysis scope remains limited. See release-0.6.0.md and validation.md for exact functionality and test evidence.

To support a “better for our students” claim, compare the same nested-loop, wrong-branch, input/LED, ML-decision and offline-reopen tasks with learners. Record completion, time, assistance and errors separately. Hardware breadth, mature general debugging, Python, current robot protocols and classroom/student acceptance remain substantial gaps. The physical boards are at the office; Uno/ESP32 testing and exact Raspberry Pi identification are still required. DUET STEM branding can be finalized when the logo is supplied.

## 0.7 follow-up: screenshot gap status

The screenshot's older DUETBlox column is superseded by these measured additions. Competitor capabilities above remain dated primary-source observations, not a new comparative benchmark.

| Screenshot gap | DUETBlox 0.7 result | Still outside verified scope |
|---|---|---|
| Python | Real bundled CPython, standard library, input/output, Stop, .py and workspace save/open | Block conversion, sprite APIs, optional packages and board Python upload |
| Numerical ML | Classification/regression, independent holdout, real block inference and standalone Arduino/ESP32 C++ | Physical sensor/board acceptance and broader algorithms |
| Object training | Experimental custom crop classifier with boxes, background, bounded scans, holdout reports and blocks | Learned localization, live-camera detector, representative accuracy and competitor parity |
| Community/cloud values | User-selected private classroom gallery and numeric room values | Public social network, accounts/moderation, atomic counters and real classroom network acceptance |
| Advanced lists | Original bounded nested JSON data-list operations in real Scratch programs | Snap-style first-class functions and full higher-order language |
| Debugger/simulator | Retained bounded Learning steps and logical Virtual Board Lab | General asynchronous debugging, CPU and electrical emulation |
| Embedded ML | Numeric model coefficients and inference compiled for five board profiles | Media/object neural models on MCUs, physical disconnected-run verification |
| Robot breadth | Existing five software profiles retained | Additional protocols and physical robot acceptance |

REA inspected seven exact packaged PictoBlox Python/numeric/object methods; Ghidra analyzed a newly compiled sensor-fed Uno classifier and verified loaded flash against its source HEX. The recovered methods show integration glue, not PictoBlox's entire training backend. The implementations in this release are independent. Full evidence and its limitations are retained in `validation-evidence/release-070/` in the local handoff.

The strongest justified claim is narrower: DUETBlox now supports more working offline coding and ML workflows, with explicit errors and portable student projects. A claim that it is easier, more accurate or universally better than competitors still requires representative learner and accuracy studies.
