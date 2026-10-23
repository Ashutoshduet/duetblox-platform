# Private classroom sharing and numeric cloud values

This service is for a teacher-run classroom or trusted local network. It adds a project gallery and numeric room variables to DUETBlox. It is not a public Scratch-style social network: there are no individual accounts, public profiles, comments, moderation or Internet hosting. Anyone with a room's student key can upload/download room projects and change its numbers. Teacher keys can additionally delete shared projects. Use a separate room and distinct keys for each class.

## Start on this computer

Use Node.js 22 or later. No server dependencies are required. From the DUETBlox folder containing `package.json` and the built `dist` folder:

```sh
node tools/classroom-server/server.mjs --init --room classroom
node tools/classroom-server/server.mjs
```

The first command creates `work/classroom-keys.json` with freshly generated student and teacher keys, and refuses to overwrite an existing file. The second binds only to `127.0.0.1:5191` and serves the built app. Open `http://127.0.0.1:5191/`, select **Classroom**, and enter that address, `classroom` and the appropriate key. Give students only the student key. Keep the terminal open. Ctrl+C stops the server.

Keys and stored projects default to `work/`, excluded from the published source archive. Never put keys in `public/`, `dist/`, a shared project, a screenshot or a repository. Browser access keys stay in memory and are cleared on disconnect/reload. The server stores projects/variables locally in `work/classroom-data`; back up that directory yourself. Restarting the server retains the gallery and values. Stopping the server does not erase them. To rotate keys, stop the server, generate a new configuration file with `--config work/new-classroom-keys.json`, then start with the same `--config` and existing data directory. Connected clients must reconnect with new keys.

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

## Using projects and values

1. Save a `.duet` or `.sb3` file from DUETBlox.
2. Connect in **Classroom**, select **Share project file**, and choose that saved file. A `.duet` can include training images, recordings, datasets and Python source; share only data intended for classmates.
3. Classmates download a copy and open it using **Open project**. Opening/importing the downloaded project uses the application's normal validation; merely listing/downloading never executes its code.
4. Create a number under **Shared values**, or use the classroom extension's set/get blocks. Variable names begin with a letter and use up to 48 letters, digits, spaces, underscores or hyphens. Values must be finite numbers in `[-1e12, 1e12]`. Missing variables return an explicit error. Writes use last-write-wins semantics, not atomic increment/counter semantics.
5. The panel polls values every 1.5 seconds while visible. A teacher can delete a shared file from the room gallery; classmates' downloaded copies remain theirs.

Limits: 64 MB per upload, 200 MB declared expanded archive size, 30 MB project manifest, 5,000 archive entries, 100 shared files/512 MB stored files per room, 100 numeric variables per room, two simultaneous upload reads, and 300 authenticated requests per room/role per ten seconds. ZIP entry paths are never extracted. Encrypted, multi-volume and ZIP64 archives are rejected. Only the project manifest is parsed by the gallery; importing into DUETBlox performs deeper project/model validation. These bounds deliberately reject larger projects with an explanation.

The API uses Bearer access keys and `/api/classroom/rooms/<room>/…`. Responses are `Cache-Control: no-store`; the DUETBlox service worker must exclude this API from caching. CORS uses exact allowed origins, never `*`. Shared values and gallery writes are serialized and metadata is atomically replaced. This avoids lost unrelated writes in one server process. Do not run multiple processes against the same data directory.

## Verification

```sh
node --test tools/classroom-server/server.test.mjs src/classroom/client.test.js
```

The tests use temporary data and loopback ports: authentication, origin/host checks, room isolation, upload validation/bounds, byte-exact downloads, teacher deletion, concurrent numeric writes, saved metadata, path/symlink protection, generated secrets and client cancellation. They do not establish classroom Wi-Fi reachability, HTTPS deployment or student usability.
