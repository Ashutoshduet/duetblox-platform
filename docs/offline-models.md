# Local machine-learning model pack

DUETBlox now resolves pretrained image, sound and pose models from its own `/models/` directory. Both the built local folder and a browser offline cache must retain these assets. Runtime dependencies remain pinned to TensorFlow.js 1.3.1, Teachable Machine Image 0.8.5 and Pose 0.8.6, speech-commands 0.4.0 and PoseNet 2.2.1. This change does not upgrade the model architecture or claim higher prediction accuracy.

| Pipeline | Included checkpoint | Purpose |
| --- | --- | --- |
| Image | MobileNet V2, alpha 0.35, 224 RGB, `out_relu` | Fresh image classifier training |
| Sound | speech-commands v0.4, BROWSER_FFT, 18w | Fresh sound transfer classifier training |
| Pose | MobileNetV1, float32, multipliers 0.5/0.75/1, strides 8/16 | Fresh pose training and compatible saved-model import |
| Pose compatibility | ResNet50, float32, strides 16/32 | Compatible saved-model import |
| Text | No pretrained weights | Existing local Naive Bayes training/inference |

The default pose pipeline remains MobileNetV1 0.75, stride 16, resolution 257. Pose model imports with other included configurations preserve their own resolution (integer 129–513). MobileNet stride-32 URLs returned HTTP 404 from the official model host on 18 October 2026; these imports now report an explicit unsupported-checkpoint error. No silent fallback changes the classifier's feature representation. Imported `modelUrl` metadata is ignored, and the permitted model settings map to fixed local paths.

There are 46 pinned upstream files totaling **123,610,868 bytes** (117.88 MiB), including model JSON, weights, sound labels and license texts. The two stride variants of each PoseNet architecture share their identical binary shards within one directory. `public/models/manifest.json` records the full inventory and original URLs; `scripts/ml-models.lock.json` is the canonical pinned copy. `public/models/NOTICE.txt` attributes the upstream models and links their repositories. The JSON and binary model payloads have not been modified or quantized.

## Loading behavior

- Image training supplies the official Teachable Machine `checkpointUrl` and `trainingLayer` options, retaining the same MobileNet V2 features and pooling. A saved image model already embeds its image backbone, so importing its files requires no additional checkpoint request.
- Sound training resolves local model and metadata paths to absolute URLs on the current app origin before calling official `speech.create`. The legacy 0.4.0 metadata loader rejects relative paths; a regression test exercises that exact upstream parser. Saved sound artifacts continue to load directly from memory.
- The official Teachable Machine Pose factory drops a supplied `modelUrl`. DUETBlox therefore uses official `posenet.load` with the local URL, then constructs the exported official `TeachablePoseNet` class. Pose imports use the same local loader before wrapping their saved classifier in `CustomPoseNet`.
- Dynamic JavaScript modules are bundled by Vite. There is no CDN script import in these services.
- Link-based Teachable Machine imports still fetch the user's external model and need internet. File/ZIP imports, fresh training and predictions use local assets. Camera/microphone require browser permission and a secure page (HTTPS or localhost), independently of internet access.

## Verify or restore the pack

Run `node scripts/prepare-ml-models.mjs` from the project folder. It uses no network and checks every file's byte length and SHA-256 plus the public/canonical manifest match. A missing or altered asset fails validation.

A maintainer with internet can run `node scripts/prepare-ml-models.mjs --download` to restore missing/changed files from their recorded official URLs. Downloaded bytes must match the pinned hash before replacing a file. A changed upstream model is rejected and requires a deliberate new release and compatibility evaluation. The existing complete pack does not download anything.

## Validation scope

Five automated tests cover complete local mappings, rejected configurations, ignoring remote URL metadata, complete relative weight-shard manifests, and the actual legacy speech metadata parser with validated same-origin absolute URLs. The asset verification command passed on 18 October 2026. These checks establish local file integrity; they do not establish camera/microphone behavior or actual browser offline training. Record those outcomes separately in the browser release evidence after observing them.

For browser validation use a fresh profile/cache or the app's explicit network-blocking test setup: load the local built app, block external requests while allowing localhost, train new image/sound/pose classifiers using bundled examples, run predictions, export/save and import/reopen, then check that no external model request succeeded or was attempted. The development-only `/src/ml/audio/smoke.html` exercises actual training, inference and ZIP round-trips with uploaded/generated media; its PoseNet precheck now uses the same local checkpoints. Never interpret generated tone or augmented pose fixtures as real-world accuracy benchmarks.

References: [Teachable Machine image model options](https://github.com/googlecreativelab/teachablemachine-community/blob/master/libraries/image/src/custom-mobilenet.ts), [official PoseNet implementation](https://github.com/tensorflow/tfjs-models/tree/master/posenet), [official speech-commands implementation](https://github.com/tensorflow/tfjs-models/tree/master/speech-commands).
