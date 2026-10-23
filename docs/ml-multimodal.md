# Sound and pose learning

DUETBlox now has separate image, sound and pose studios. The new sound and pose code is in `src/ml/audio` and `src/ml/pose`. The existing image model service remains unchanged.

## Official dependencies and compatibility

- `@tensorflow-models/speech-commands` **0.4.0** uses the official Teachable Machine BROWSER_FFT sound-model format and transfer-learning API. Its peer is TensorFlow.js `^1.3.0`.
- `@teachablemachine/pose` **0.8.6** supplies PoseNet feature extraction and the trainable pose classifier. Its peer is TensorFlow.js **1.3.1**.
- `@tensorflow-models/posenet` is pinned to **2.2.1**, including the nested dependency override. Version 2.2.2 requires TensorFlow.js 3 and must not be pulled into this runtime.
- The three studios share the existing TensorFlow.js **1.3.1** runtime. They do not require iframes or duplicate TensorFlow installations.

Primary references: [Teachable Machine audio instructions](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/audio), [official speech-commands APIs](https://github.com/tensorflow/tfjs-models/tree/master/speech-commands), [Teachable Machine pose library](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/pose), [official pose training implementation](https://github.com/googlecreativelab/teachablemachine-community/blob/master/libraries/pose/src/teachable-posenet.ts). The pinned npm sources, declarations and peer metadata were inspected rather than assuming the latest package versions were compatible.

Speech Commands has a `util.promisify` import for its optional Node filesystem metadata reader. `browser-util.js` supplies that callback-to-Promise adapter through an exact Vite `util` alias. Browser imports use HTTPS or in-memory artifacts. The shim does not supply Node filesystem access. Production Vite bundling was verified after adding this alias.

## Sound workflow

Create a background-noise class and one or more target sound classes. The reserved internal label `_background_noise_` is shown as “Background noise” and cannot be removed. Training requires at least six clips per class. Use varied real background recordings, not only digital silence.

Audio uploads are decoded at 44.1 kHz and converted into mono PCM WAV clips of 1.1 seconds. Longer files produce multiple clips. Accepted input duration is 0.3–30 seconds, maximum upload size 20 MB, maximum 20 clips from one file, and maximum 120 samples per class. A short clip is zero-padded. The dataset JSON retains actual WAV data, so it can be downloaded, reopened and retrained independently of the model.

OfflineAudioContext and native AnalyserNode compute the same kind of BROWSER_FFT representation used by the official runtime: a 2048-sample FFT window, 1024-sample hop, no smoothing, and truncated frequency bins. The default model uses 43 frames by 232 bins. Uploaded files are processed without playing sound or requesting microphone permission. Infinite silence bins are replaced with a finite floor, and prediction normalization matches the official recognizer's mean/standard-deviation normalization. A real `speechCommands.Dataset` feeds the official transfer model; training includes held-out examples and background-noise mixing augmentation.

“Start microphone” is the only entry point that requests microphone access. Recording captures an actual MediaRecorder clip and sends it through the same WAV conversion pipeline. Live inference reads the owned microphone's analyser; Blocks cannot implicitly request permission. Stopping recognition from Blocks closes the input. Studio tab changes stop recognition and release that studio's media device.

The example generator synthesizes actual PCM background noise, low tones and high tones. It is an instructional dataset and a numerical integration fixture, not a simulated model or fabricated prediction.

## Pose workflow

Upload full-body photographs or explicitly start the camera and capture examples. Images are letterboxed to 400 × 400 so body parts are not cropped. The official TeachablePoseNet runtime extracts 17 body landmarks plus its heatmap/offset feature vector. Default settings are MobileNetV1, multiplier 0.75, input resolution 257 and stride 16, resulting in 14,739 classifier features.

The official classifier trains on those extracted features, with 15% per-class validation (rounded up), 100 dense units, dropout and RMSprop at a learning rate of 0.0001. The lower rate avoids saturation observed with offset features at 0.001. Six images per class are required. If every example has very low body-detection confidence, training stops with a request for clearer full-body images. Mixed datasets report the count of low-confidence examples.

Prediction shows body-detection confidence separately from class confidence. When body confidence is below 0.15, the service clears class predictions instead of reporting a confident classification without a clear person. These confidence values describe model output; they are not calibrated guarantees of correctness.

The pose dataset JSON contains the actual image samples. Pose model ZIPs contain the classifier topology, weights, labels and PoseNet settings; the fixed pretrained PoseNet backbone is included in the local DUETBlox model pack, so model-file imports do not need internet. Imported models must have the official `@teachablemachine/pose` metadata, matching feature dimensions, supported MobileNetV1 (multipliers 0.5/0.75/1, strides 8/16) or ResNet50 (multiplier 1, strides 16/32) settings and integer input resolution 129–513. The MobileNet stride-32 upstream URL returns 404 and is rejected explicitly. See `offline-models.md` for pinned artifact provenance. Other pose-estimation or action-recognition formats are not interchangeable.

## Integration contract

`SoundStudio` and `PoseStudio` accept `active`, `onStatus` and `onUseModel`. The services export `soundModel` and `poseModel` and support the existing image-service integration pattern:

- `subscribe`, `snapshot`, `restore`, `train`, `cancelTraining`, `clear`;
- `exportArtifact`, `prepareArtifact`, `replaceModel`, `disposeModel`, `importArtifact`, `importFiles`, `importURL`;
- `beginWorkspaceImport` and `endWorkspaceImport`, with `clear(token)` enforcing active workspace ownership;
- `rpc(method, args)` for `predict`, `label`, `confidence`, `confidenceFor`, `isReady`, `startRecognition`, `stopRecognition`.

Confidence reporters return 0–100. `predict` returns the winning label through RPC. `startRecognition` only works with an input already supplied by the user; it does not open a device. `stopRecognition` through RPC also releases the device.

Model artifacts are `{modelTopology, weightSpecs, weightData, metadata, format, version}`. `weightData` is an ArrayBuffer. Model ZIPs use standard `model.json`, `metadata.json` and `weights.bin` files. Imports also support multiple weight shards declared by model.json. Sound metadata contains `wordLabels`; pose metadata contains `labels` and `modelSettings`.

Datasets are `{kind, version:1, classes:[{id,name,samples}]}`, with kind `duetblox-sound-dataset` or `duetblox-pose-dataset`. The exported validators are `validateSoundDataset` and `validatePoseDataset`, and defaults are `defaultSoundClasses` and `defaultPoseClasses`. IndexedDB keys are `sound-model`, `sound-dataset`, `pose-model`, `pose-dataset`. Workspace import refresh events are `duetblox:sound-dataset-import` and `duetblox:pose-dataset-import`.

## Verification

Run the fast numerical/data checks with:

```sh
node --test src/ml/audio/waveform.test.js
```

Six tests cover valid PCM WAV encoding/clipping, finite silence normalization, genuine portable sound fixtures including background noise, dataset/modality validation, workspace operation ownership/status and cleanup of late-arriving camera/microphone streams after Stop.

The development-only browser harness is `src/ml/audio/smoke.html`. Start it with:

```sh
npx vite --config src/ml/audio/smoke.vite.config.js --host 127.0.0.1 --port 5178 --strictPort
```

This disables HMR so unrelated editor builds regenerating public HTML cannot interrupt training. It is not an entry point in the production build. The “Check sound training and import” control performs native FFT extraction from an actual WAV File, real transfer training, numerical inference, repeated-prediction tensor-count checks, ZIP export/import and clearing. The pose control decodes a real uploaded-image File, extracts landmarks/features, trains the real pose service on deterministic original/mirrored image augmentations and checks the expected class for both postures, then validates ZIP round-trip predictions. It preserves downloadable validated model and dataset fixtures for the root workspace integration check.

Observed browser results: sound FFT had 9,976 finite bins and a meaningful frequency range; the low-tone sample was classified correctly. PoseNet found 17 landmarks with 0.757 body confidence in the test image; the 40-epoch classifier identified both original and mirrored postures above 99.9% on this small fixture. This controlled fixture is not evidence of general real-world accuracy. Both model ZIP round-trips preserved numerical predictions. Real WAV and photo uploads were also exercised through each studio's file picker in Chrome. No camera or microphone permission was requested during these checks. Physical device recording/capture remains a user-device check.

The pose fixture is TensorFlow.js's public `pose-detection/test_data/pose.jpg`, with its repository license and source notice retained in `src/ml/pose/fixtures`. It is used only by the development harness. The deterministic fixture generator is `src/ml/pose/fixtures.js`; it creates real image transformations, then the genuine PoseNet/classifier pipeline processes them.

The existing image service also passed actual MobileNet training and inference after the sound and pose libraries were imported in the same page: TensorFlow.js remained 1.3.1, the fixture Circle prediction was 99.87%, and repeated image predictions did not grow tensor counts. The original image model implementation was not changed by this work. Validated model ZIPs and dataset JSON files were saved under `work/ml-validation` for the parent workspace save/reopen checks; these are test artifacts, not pretrained general-purpose models.
