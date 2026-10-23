# DUETBlox 0.6.0 — learn, inspect and try

This local browser release turns the selected REA/Ghidra comparison into three concrete tools. It retains official Scratch 15.2.0 execution and `.sb3` compatibility inside an original DUETBlox Studio shell. It is not an independently implemented language, a complete PictoBlox reconstruction, or evidence that DUETBlox outperforms every competitor.

## Original studio controls and Project map

Normal Blocks opens with DUETBlox Run/Stop, an execution-destination label, and one toolbar for learning and boards. More editor tools reveals the retained official menu. Code, Costumes/Backdrops and Sounds remain directly accessible. Standalone editor use preserves its native menu.

Project map searches character names, block labels, variables and literal text, including nested branches and My Blocks. Selecting a result opens Code, selects the character and highlights the owning script. It does not automatically scroll to off-screen code. It inspects at most 500 stacks and 20,000 block entries per target and shows at most 100 results. Large-project results are explicitly partial.

## Learning steps

Start learning run first checks the entire project, including disconnected blocks, before starting any execution. Accepted green-flag scripts begin paused. Next step uses the pinned official interpreter to execute one stack-block visit with its reporter inputs. The panel displays the last and next operation, owning script highlight, and up to twelve variable/list previews. Continue normally releases the actual VM stacks back to normal scheduling. Stop, project edits, load/reset, leaving Blocks and closing the panel end a held run.

Supported scope is synchronous core motion/looks/data/operators/sensing, conditions, loops and non-warp My Blocks. The green-flag hat is skipped. Loop checks and procedure entries may each consume a step. Multiple scripts are stepped round-robin; timing and interleaving can differ from normal execution. Waits, glides, sound, other event hats, clones, hardware, ML and other extensions require normal Run. Scratch stage monitors refresh during normal execution; the panel reads variable values directly while paused. This is a bounded teaching mode, not general debugger parity with Snap! or MakeCode. The adapter checks VM version and tests hashes of three pinned upstream interpreter files; upgrades need re-review.

The learning starter sets `counter = 2 + 3`, moves ten steps, then changes counter by two. Opening an example is explicit and replaces the current Scratch program; Save first. A second full run moves another ten steps.

## Virtual Board Lab

Enable Try virtual board explicitly. Normal Scratch hardware extension requests then go exclusively to a local I/O model. A physical connection prevents enabling the lab; a conflicting connection stops it. Virtual failures never fall back to USB. Changing modes, changing board profiles, resetting/stopping the lab, opening a project or leaving Blocks stops the current program. Closing only the tool panel keeps simulation enabled, visibly indicated in the toolbar; Close Virtual Board Lab disables it.

Five implemented profiles are available: Uno R3, Mega 2560, classic Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM. Students choose digital/analog input values and inspect GPIO, PWM, servo and tone output commands. The same pin catalog validates capabilities; firmware resource limits and AVR timer reservations are modeled. Stop clears outputs but retains controlled inputs and timer reservations; Reset clears all. The Uno example continuously compares A0 against 512 and controls pin 13; its 0.1-second wait bounds the polling loop.

This is logical I/O simulation. It does not emulate a microcontroller CPU, compiled firmware, electrical circuits, voltage, waveform timing, sensor physics, network or camera/SD capture. Tone is visual only. No physical-device validation is implied. Junior hardware commands cannot use a running normal-editor simulation. A physical Raspberry Pi adapter is not implemented; the reported family name does not identify its board variant.

## Research scope and next acceptance

REA parsed three exact selected methods from a previously captured PictoBlox bundle: generation buffers and thread/stack scheduling. Ordinary `stepThread` can execute multiple stack entries, which informed the one-visit adapter above. Ghidra evidence for unchanged historical mBlock 4 firmware and current DUET Uno firmware was reused only after identity checks. No redundant decompilation, complete-company inspection, source reconstruction or runtime benchmark is claimed. Evidence and primary-source links are in `validation-evidence/release-060/research-design-findings.md` in the local handoff.

The release retains image/sound/pose/text learning, Junior decisions, supported My Blocks C++ generation and the prepared offline assets from earlier releases. New tools and examples are included in the versioned offline pack. Prepare that pack once from Offline before relying on the cached browser alone. Hardware compilation still needs the prepared local toolchain/helper; remote model URL downloads and online-only extensions need a network.

Remaining acceptance includes physical Uno/ESP32 uploads and disconnected operation, exact Raspberry Pi requirements, camera/microphone devices, representative student trials, broad accessibility/cross-browser trials and Windows installer packaging. Thirteen catalog adapters remain planned. The user's hardware is at the office today. The supplied DUET STEM logo is still pending. The hosted site has not been updated from this account.
