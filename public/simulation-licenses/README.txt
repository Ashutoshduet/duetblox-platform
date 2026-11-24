DUETBlox simulation dependency notices

eecircuit-engine 1.9.0: MIT license; original EElab.dev copyright retained.
Its embedded WebAssembly engine reports ngspice 45.2. The full matching release COPYING file is preserved, including component exceptions and their license texts. The core is not covered solely by the JavaScript wrapper MIT license.
Embedded model tables also contain GlobalFoundries and SkyWater PDK Apache-2.0 notices and the North Carolina State University FreePDK BSD notice. Their bundled notice text is reproduced in embedded-PDK-notices-extracted.txt, and the full Apache license is included. These built-in tables remain in the upstream engine bundle even though DUETBlox permits only inline numeric user models.
avr8js 0.21.1: MIT license, Uri Shaked copyright retained.

provenance.json records the upstream build-source links, matched license source and hashes. The npm package does not identify the exact source commit used for its WASM; matching the runtime release version is not a claim of a byte-identical reproducible build.
The ngspice COPYING document is itself CC-BY-SA-4.0 (ngspice team,2025); reproduced unchanged from the linked45.2 tag. Dependency source and build provenance URLs are recorded in provenance.json.
