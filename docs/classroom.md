# Private classroom assignments, sharing and numeric cloud values

This service is for a teacher-run classroom or trusted local network. It adds teacher assignments, private submissions and feedback, a project gallery and numeric room variables to DUETBlox. It is not a public Scratch-style social network: there are no individual accounts, public profiles, comments, moderation or Internet hosting. Anyone with a room's student key can upload/download room projects and change its numbers. Teacher keys can additionally create/close assignments, inspect all submissions, leave private feedback and delete shared gallery projects. Assignment submissions are separate from the gallery: a student needs that submission’s private receipt as well as the room key to read it. Student aliases are self-reported, not authenticated individual identities. Use a separate room and distinct keys for each class.

## Start on this computer

Use Node.js 22 or later. No server dependencies are required. From the DUETBlox folder containing `package.json` and the built `dist` folder:

```sh
node tools/classroom-server/server.mjs --init --room classroom
node tools/classroom-server/server.mjs
```

The first command creates `work/classroom-keys.json` with freshly generated student and teacher keys, and refuses to overwrite an existing file. The second binds only to `127.0.0.1:5191` and serves the built app. Open `http://127.0.0.1:5191/`, select **Classroom**, and enter that address, `classroom` and the appropriate key. A release built for `/duetblox/` redirects that root address to its app path; assets are served under the path recorded in `offline-manifest.json`. In the Classroom connection form, still enter only the server origin (no `/duetblox/` path). Give students only the student key. Keep the terminal open. Ctrl+C stops the server.

Keys and stored projects default to `work/`, excluded from the published source archive. Never put keys in `public/`, `dist/`, a shared project, a screenshot or a repository. Browser access keys stay in memory and are cleared on disconnect/reload. The server stores projects, assignments, submissions, feedback and variables locally in `work/classroom-data`; back up that directory yourself. Restarting the server retains the gallery and values. Stopping the server does not erase them. To rotate keys, stop the server, generate a new configuration file with `--config work/new-classroom-keys.json`, then start with the same `--config` and existing data directory. Connected clients must reconnect with new keys.

## Explicit LAN hosting

Find this computer's actual LAN address, then substitute it for the example below:

```sh
node tools/classroom-server/server.mjs --host 0.0.0.0 --public-origin http://192.168.1.20:5191
```

LAN binding is opt-in and requires the declared public origin. The server checks request hosts and browser origins. It never selects or uploads to an Internet host. Your OS firewall must permit the chosen port on the trusted classroom network. Do not port-forward this prototype onto the Internet.

HTTP over a LAN is **not a secure browser context**. Camera, microphone, Web Serial and offline service-worker installation may be unavailable on that origin. Room access keys and project data also travel without transport encryption on plain HTTP. For a full classroom deployment, an administrator should use trusted HTTPS with a properly configured reverse proxy and set the corresponding `--public-origin https://classroom.example` (the Node service itself still speaks HTTP behind that proxy). Do not disable browser security or certificate checks.

An alternative is to run each student's DUETBlox app on their own localhost origin and explicitly allow that exact origin at the room server:

```sh
node tools/classroom-server/server.mjs --host 0.0.0.0 --public-origin http://192.168.1.20:5191 --allow-origin http://127.0.0.1:5173
```

Then students enter the LAN room-server address in their local app. Local browser feature availability and permission requirements still apply. The shared room requires network access to its server; cloud values and downloads do not function when disconnected. Offline projects remain local. Hosted HTTPS apps cannot generally fetch an HTTP LAN service because of browser mixed-content/local-network controls; use trusted HTTPS in that arrangement.

## Assignments and private feedback

1. Connect using the **teacher** key. Open **Assignments & feedback → Create an assignment**. Write one achievable task and one question asking students to explain a choice or predict a result. Save it; it is now visible to students in that room.
2. Students connect with the **student** key. They complete their work, use **Save project**, select the assignment, enter a teacher-recognized classroom alias, and choose the saved `.duet` or `.sb3` file using **Choose file and submit privately**. Submitting never overwrites their local project and never adds their file to the shared gallery.
3. After submission, the student uses **Save submission receipt**. This small JSON file contains a private access key for that submission. Do not share it, include it in a project archive, or post it publicly. Classroom access keys are never included in it. The browser keeps receipts only in memory until disconnect/reload. Use **Submissions from this session** to return to an earlier submission after navigating to another workspace or uploading a revision. Download each receipt you need to keep beyond this session.
4. The teacher selects **Refresh assignments**, downloads the submitted file, saves their own work, and opens the downloaded copy for inspection. Downloads do not run code. The teacher writes descriptive feedback and chooses **Reviewed**, **Try a revision**, or **Complete**. These are teacher decisions, not automated grades.
5. The student selects **Check my feedback**. After reloading/reconnecting, they use **Open submission receipt** to recover access. A receipt is accepted only for its exact server and room; its key is not sent to a different server. If the receipt is lost, the teacher can still inspect the submission, but the shared student key alone cannot recover it.
6. A revision is a new submission with a new receipt; previous work and feedback remain preserved. The teacher can **Close** an assignment to stop submissions and **Reopen** it later. Closing does not hide existing feedback.

The shared student key is not an individual login. A classroom alias can be copied; do not use this prototype for identity-dependent grades, sensitive student records, or high-stakes assessment. The teacher can see all submissions, and anyone holding both a receipt and the room key can access its submission. Review only intended classroom files; `.duet` may contain training images and recordings. Use trusted HTTPS for network deployments.

Suggested lesson routine: **predict → build → run → change one thing → explain → save → submit**. For beginners, demonstrate one small task first and keep the goal visible. Use feedback such as “Your sequence works; what changes if you double this value?” rather than awarding a score based solely on a running program. Observe where learners ask for help before adding more instructions.

Limits: 100 assignments, 200 submissions, and 512 MB total project/submission bytes per room. Individual uploads retain the existing 64 MB and ZIP-validation limits. Receipt secrets are stored only as hashes on the server; teacher lists and feedback responses never return those hashes. Saved room data from older versions gains empty assignment/submission lists without deleting existing projects or values. Stop the server and back up `work/classroom-data` before upgrading its source.

## Using projects and values

1. Save a `.duet` or `.sb3` file from DUETBlox.
2. Connect in **Classroom**, select **Share project file**, and choose that saved file. A `.duet` can include training images, recordings, datasets and Python source; share only data intended for classmates.
3. Classmates download a copy and open it using **Open project**. Opening/importing the downloaded project uses the application's normal validation; merely listing/downloading never executes its code.
4. Create a number under **Shared values**, or use the classroom extension's set/get blocks. Variable names begin with a letter and use up to 48 letters, digits, spaces, underscores or hyphens. Values must be finite numbers in `[-1e12, 1e12]`. Missing variables return an explicit error. Writes use last-write-wins semantics, not atomic increment/counter semantics.
5. The panel polls values every 1.5 seconds while visible. A teacher can delete a shared file from the room gallery; classmates' downloaded copies remain theirs.

Limits: 64 MB per upload, 200 MB declared expanded archive size, 30 MB project manifest, 5,000 archive entries, 100 shared gallery files/512 MB total gallery and submission bytes per room, 100 numeric variables per room, two simultaneous upload reads, and 300 authenticated requests per room/role per ten seconds. ZIP entry paths are never extracted. Encrypted, multi-volume and ZIP64 archives are rejected. Only the project manifest is parsed by the gallery; importing into DUETBlox performs deeper project/model validation. These bounds deliberately reject larger projects with an explanation.

The API uses Bearer access keys and `/api/classroom/rooms/<room>/…`. Responses are `Cache-Control: no-store`; the DUETBlox service worker must exclude this API from caching. CORS uses exact allowed origins, never `*`. Shared values and gallery writes are serialized and metadata is atomically replaced. This avoids lost unrelated writes in one server process. Do not run multiple processes against the same data directory.

## Verification

```sh
node --test tools/classroom-server/server.test.mjs src/classroom/client.test.js
```

The tests use temporary data and loopback ports: authentication, origin/host checks, room isolation, upload validation/bounds, byte-exact downloads, teacher deletion, concurrent numeric writes, saved metadata, path/symlink protection, generated secrets, client cancellation, teacher-only assignment/review operations, private receipt authorization, cross-room rejection, byte-exact submission downloads, malformed/bounded payload rejection and submission persistence across a server restart. `tests/e2e/classroom-assignments.spec.js` covers the teacher/student workflow in separate browser contexts. They do not establish classroom Wi-Fi reachability, HTTPS deployment or student usability.
