# Python workspace

DUETBlox runs actual CPython 3.14.2 through the pinned Pyodide 314.0.7 WebAssembly runtime. The Python page is a separate text-programming workspace; it does not convert Scratch blocks or upload Python to boards.

Write code, put answers for `input()` in the Input box (one answer per line), then choose **Run Python**. Output and Python errors appear beside the editor. **Stop Python** terminates the execution worker, including an infinite loop. Leaving the page, importing a different Python project, or closing the workspace also stops it. Each run starts a new interpreter with fresh variables and temporary files. Download `.py` saves source only; a DUETBlox project keeps source and input together.

Four editable examples cover input, loops and nested lists, functions, and standard-library number operations. Loading an example or opening a `.py` file offers one-step undo. Code is limited to 200,000 characters; supplied input to 64,000. `input()` raises a normal `EOFError` if there are not enough supplied answers. This is queued input, not an interactive terminal.

## Offline runtime and source

`public/python/runtime/` contains six unchanged files from the [official core release](https://github.com/pyodide/pyodide/releases/tag/314.0.7): 13,534,206 bytes. The archive digest is pinned to the GitHub release's SHA-256 value; individual extracted files are pinned in `public/python/runtime-manifest.json`. No optional Python wheel packages are bundled or automatically installed.

Build verification is offline:

```sh
node scripts/prepare-python-runtime.mjs
```

If files need restoring, download the exact release and verify it with:

```sh
node scripts/prepare-python-runtime.mjs --download
# Or verify and extract a previously downloaded official archive:
node scripts/prepare-python-runtime.mjs --archive=/path/to/pyodide-core-314.0.7.tar.bz2
```

The build includes these runtime files in DUETBlox's offline pack. Prepare that pack once while online, then keep the same origin and browser profile. A local server can also serve all files without an internet connection. Python runtime files are not fetched from a CDN during a run.

The unmodified upstream runtime source, commit, release URL, and license copies are recorded in `public/python/NOTICE.txt`, `upstream-release.json`, and `LICENSE-*.txt`. Pyodide uses MPL-2.0; the separate DUETBlox integration uses the repository's AGPL-3.0-only license.

## Execution boundaries

The interpreter runs in a dedicated module worker. It cannot directly modify the app's DOM. A parent-thread timer ends execution after 30 seconds; loading has a separate 60-second timeout. Displayed output is capped at 64,000 characters and reaching that cap terminates the worker. The browser controls available memory: there is no per-run hard memory quota, and allocating huge objects can exhaust it.

The loader allows only its own local runtime requests. Before user code runs, ordinary worker network APIs are disabled and `js` receives an empty global object. There is no package auto-install call. This is a learning environment for code the student understands, not a hardened security boundary for hostile Python. Browser-side Python does not have the host computer's shell or native filesystem. Files made during a run live only in the worker's memory and disappear afterward.

The bundled standard library excludes browser-incompatible modules such as Tkinter and Turtle. Installable packages, a graphical Python canvas, native serial/GPIO access, and MicroPython board deployment are outside this workspace's current scope.

## Integration and validation

`PythonStudio` is controlled by the application through `project`, `onProjectChange`, and `active`. `validatePythonProject()` validates the bounded version-1 record before import. Parent workspace persistence and archives own the record; the component does not create an unrelated browser draft.

The runtime follows the official [worker guidance](https://pyodide.org/en/stable/usage/webworker.html), [standard-stream API](https://pyodide.org/en/stable/usage/streams.html), and [local deployment instructions](https://pyodide.org/en/stable/usage/downloading-and-deploying.html). Development evidence is in `work/release-070/python-*`: lifecycle/data tests and real headless Chrome runs cover Unicode input, the actual CPython version, standard-library imports, exceptions, nested lists, fresh state, infinite-loop Stop/recovery, output flooding, disabled JavaScript fetch access, page-leave cleanup, and exact `.py` round trips. Production offline-pack validation is recorded separately in the release validation record.
