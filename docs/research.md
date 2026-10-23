# Research and implementation decisions

Initial research date: 16 October 2026. This is the historical implementation record; sound/pose training and the five Arduino/ESP32 software profiles have since been implemented. See [0.4.0 release details](release-0.4.0.md), [current comparison and REA investigation](comparison-2026-10.md), and [validation](validation.md) for the current state. Direct observations, source findings and engineering decisions are distinguished below. This is an implementation from licensed upstream components and original code; no claim is made to recover PictoBlox’s private source or backend.

## Supplied videos

All three supplied videos were opened and their transcripts reviewed: [AI LABS](https://www.youtube.com/watch?v=rw0fqnrZgNM), [Nick Saraev](https://www.youtube.com/watch?v=dAzs_rU6080), and [Vivek Mishra](https://www.youtube.com/watch?v=fCSNcSHLyWc). They were not reviewed frame by frame. Detailed timestamped findings are in [the video review](research/video-review.md). Their useful shared method is to record observable behavior, inspect relevant code, implement a bounded feature, then test it. Their demonstrations do not establish complete product parity or automatic hardware support.

## REA: actual use and limits

[REA](https://github.com/morluto/rea) is an engineering investigation tool, not a block-programming library. Its [JavaScript artifact analysis](https://github.com/morluto/rea/blob/main/docs/javascript-artifact-reconstruction.md), [application tracing](https://github.com/morluto/rea/blob/main/docs/javascript-application-workflows.md), and [browser observation](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) workflows fit narrow unanswered questions.

REA 6.5.0 was actually run through an isolated `npm exec --package=rea-agents@6.5.0 -- rea` invocation, without changing global agent configuration. Static analysis selected `package.json`, `src/extension-support/extension-manager.js`, and the Pen extension from the official Scratch VM 15.2.0 package. Artifact SHA-256: `a48df2707bbb69cd2cd2e0c969e0b35d4e62110b732b3a61b3df2d5f1ca32f86`. Raw analysis evidence is retained in the separate local handoff; this public repository includes the research summary and implementation source without investigation outputs.

The graph is explicitly partial: 116 unselected files were inventoried but not analyzed. A literal `loadExtensionURL` trace returned no match; this does not establish absence. A module trace matched the extension manager and recorded its selected relationships and unresolved frontiers. Direct source inspection and execution tests supplied the implementation evidence. REA was not run against a private PictoBlox binary and did not generate the application automatically.

## Official foundation

The maintained Scratch editor foundation is [scratchfoundation/scratch-editor](https://github.com/scratchfoundation/scratch-editor); blocks are from [scratchfoundation/scratch-blocks](https://github.com/scratchfoundation/scratch-blocks). The supplied [MIT CML organization](https://github.com/orgs/mit-cml/repositories) primarily develops App Inventor and is not the current Scratch 3 editor source. The exact published package revisions and corresponding source archives are recorded in the source distribution manifest.

Engineering decision: use the official runtime rather than imitate its execution semantics. Pin the GUI/VM/render/storage packages to 15.2.0, retain source and notices, and isolate branding/host integration. Junior is original pictorial UI compiling to the same VM. This provides real program execution while avoiding dependence on an archived ScratchJr web port.

## ML and device decisions

Image training/import follows the official [Teachable Machine community library](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image). The app uses image transfer learning, not an invented training simulation. TensorFlow.js 1.3.1 matches that library’s declared peer requirement. A synthetic classification QA exercise confirms the pipeline, not general model quality. Sound and pose are explicitly scheduled after images.

The [PictoBlox public editor](https://pictoblox.ai/) board selector was inspected read-only; the exact catalog and documentation additions are in [hardware.md](hardware.md). Catalog inclusion is separate from implemented device support. The initial adapter targets ATmega328P Uno/Nano and Mega 2560; ESP32 and vendor robots require separate firmware/transport/code-generation work and device testing.

Browser serial interaction follows the browser’s user-selected-port model documented by [Chrome Web Serial](https://developer.chrome.com/docs/capabilities/serial). The [official Arduino CLI](https://arduino.github.io/arduino-cli/) supplies compilation/flashing through the optional local helper. Hosted JavaScript alone does not contain a native AVR compiler. Live mode and standalone upload are separate execution modes.

## Remaining acceptance gates

Before claiming a production release: test actual Uno/Mega/Nano devices, connection loss and upload recovery; validate Windows drivers/helper and package the desktop application; complete individual ESP/robot adapters; test camera permissions and externally hosted Teachable Machine imports; broaden browser/accessibility/performance testing; resolve the documented inherited runtime security issue; add sound/pose training; integrate the supplied DUET STEM logo.
