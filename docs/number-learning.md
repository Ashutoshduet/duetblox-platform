# Number learning and standalone numeric inference

DUETBlox trains numerical classification and regression models in the browser. These are original small linear models, not an imported competitor model. Training does not use a server or download machine-learning weights. This workspace addresses the numerical-learning gap; it does not add object-detection training or deploy the existing image, sound, pose or text models to microcontrollers.

## Student workflow

1. Open Machine Learning → Numbers learning. Choose classification (a class label) or regression (a number). Changing the dataset type starts an empty table and offers an Undo button; the current trained model remains available until replaced.
2. Name 1–8 numeric input columns and one target column. Add rows manually, load dataset JSON, import CSV, or try the small illustrative example. CSV must have a header and put the target in the last column. Numeric blanks, nonfinite values, formulas, inconsistent columns and broken quoting are rejected. JSON preserves exact dataset metadata.
3. Train numbers model. Classification needs at least three distinct input rows in each of at least two classes. Regression needs at least four distinct rows and at least one more row than the number of input columns. Duplicate inputs with the same target count once; conflicting targets for identical inputs are rejected.
4. Test a new input vector, in the displayed feature order. Values outside the training ranges are marked. A classification prediction can return Unknown when its score or its lead over the next class is too small. The class scores are not calibrated probabilities of correctness.
5. Export the model JSON, dataset JSON/CSV or evaluation report. Use numbers in Blocks installs the Numbers extension. `.duet` workspace integration is supplied by the parent application.

The bounded dataset accepts 1,000 rows and 12 classification labels. Inputs and regression targets must be finite numbers between −1 billion and 1 billion. Feature and class names accept Unicode and are limited to 60 characters.

## What is actually trained

Classification uses multiclass softmax regression with fixed full-batch gradient descent. It runs 600 deterministic updates, learning rate `0.3 / (featureCount + 1)`, and L2 weight penalty `0.001`. Biases are not penalized. Features use their training mean and population standard deviation; a constant feature uses scale one.

Regression solves the standardized ridge normal equations with Cholesky decomposition and regularization `0.0001` on the mean squared error objective. Targets are centered; the intercept is the training target mean and is not penalized. This small positive penalty handles correlated columns. These algorithms learn linear relationships; neither automatically discovers curved or XOR boundaries. Model quality depends on representative data and appropriate features.

Algorithm background: [scikit-learn linear models](https://scikit-learn.org/stable/modules/linear_model.html) and [Ridge objective](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html). DUETBlox implements its own bounded JavaScript solver; it does not embed scikit-learn or claim identical solver output.

## Separate evaluation

Classification uses a deterministic stratified 20% holdout when every class has at least five unique input rows. Regression uses a deterministic 20% holdout with at least two test rows when there are at least `max(10, featureCount + 3)` unique rows. Content hashing fixes the split without depending on row order. Duplicate input rows never straddle training and test sets.

A temporary model is fitted only on training rows, including normalization statistics. Held-out rows are never used to fit its coefficients or normalization. Classification reports accuracy, per-class precision/recall/F1, macro F1 and a confusion matrix in the exported report. Regression reports mean absolute error, RMSE and R²; R² is unavailable when held-out targets have zero variance. Every held-out row can be inspected in the UI. The deployed model is trained separately on all examples. The UI clearly distinguishes these two models.

If there are insufficient examples, no evaluation score is invented. Repeatedly tuning against the same held-out rows can still overfit that diagnostic; the demonstration datasets and automated tests are not independent real-world benchmarks. [Data leakage reference](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage).

## Portable model format

The common version-1 artifact fields are:

```text
format: "duetblox-numbers-model"
version: 1
task: "classification" | "regression"
features: [input names in order]
targetName: string
means: [one training mean per input]
scales: [one positive training scale per input]
inputRanges: [[training minimum, training maximum] per input]
trainingRows: integer
predictionPolicy: {minimumConfidence, minimumMargin} // optional, common DUETBlox defaults
```

Classification adds `algorithm: "standardized-softmax-v1"`, sorted `labels`, `weights[class][input]`, `biases[class]`, `regularization: 0.001`, and `iterations: 600`. Regression adds `algorithm: "standardized-ridge-v1"`, `coefficients[input]`, `intercept`, and `regularization: 0.0001`.

Both predictors compute `z[j] = (input[j] - means[j]) / scales[j]`. Regression computes `intercept + sum(coefficients[j] * z[j])`. Classification computes class logits, subtracts their maximum, exponentiates and normalizes. Its winner must pass the minimum confidence and minimum lead; an exact tie is always Unknown. Model imports validate dimensions, algorithm, bounds, scales, coefficients and policy. No model source code is evaluated.

## Blocks and board code

The service stores a separate input slot for every feature. `setInput(index, value)` uses one-based indices. A new/imported/cleared model resets all slots; `predict()` rejects incomplete inputs. Explicit manual test vectors can also be passed to the pure predictor. Failed predictions clear the previous result. `classIndex` is one-based in the model's label order and returns zero for Unknown or regression. `value` is the last regression result (zero before a valid prediction); use `isAccepted` to distinguish a valid numerical zero. Regression accepts only a successful finite prediction. Classifier `confidence` is the top raw score ×100 even if rejected by policy.

The Arduino generator embeds the validated numerical model into C++ when the Scratch project supplies `duetbloxModels.numbers`. Supported blocks are set input, predict, input count, numeric value, class index, confidence, is ready and is accepted. Input indices must be constants from 1 to the model feature count; their values can be numeric expressions, variables or sensor readings. Label strings and runtime confidence-setting blocks are diagnosed as unsupported for board upload. Export freezes the current policy into the firmware. The UI/browser model can continue to change its policy normally.

C++ uses finite checks, required-input tracking, stable softmax and the same threshold/margin rule. Missing/invalid values clear predictions rather than keeping an old success. Constants that underflow or overflow a 32-bit float are refused. Very small feature variation relative to a large offset is also refused because AVR uses 32-bit `double`. Ordinary float rounding remains; predictions very close to a class threshold or boundary may differ across hardware. Inputs should be appropriately scaled, and the actual sensor/model/program combination must be tested on its intended board.

The compiler supports the existing software profiles: Uno R3, Mega 2560, classic Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM. This does not add camera inference to ESP32-CAM, Raspberry Pi support, TinyML image/sound models or additional robot adapters. No physical board was available during this work.

## Verification and reproduction

- Unit tests: `node --test src/ml/numbers/model.test.js src/hardware/tests/numbers.test.mjs src/hardware/tests/generator.test.mjs`.
- Host C++ parity: `node src/hardware/tests/numbers-parity.mjs`. Twelve scenarios compare browser predictions and generated C++ compiled as double and float. They include class scores, both classes, Unknown thresholds, exact ties, numerical regression/extrapolation and invalid-input clearing. These execute real native code, with no physical device claim.
- Official toolchain builds: `node src/hardware/tests/numbers-compile.mjs`. Two real sketches for each of the five implemented profiles compile with the installed Arduino CLI and official cores. Reports record source/artifact SHA-256, CLI/core versions and `physicalVerified:false`.
- Dynamic sensor target: `node src/hardware/tests/numbers-sensor-compile.mjs`. A separate Uno artifact reads A0 at runtime, runs the trained classifier, and uses the accepted result on digital pin 13. This provides a new binary for Ghidra analysis without relying only on fixed-input compiler optimization.

Evidence is under `work/release-070/numbers-*`; these paths are development evidence, not source-archive runtime dependencies. Numerical code generation imports `src/ml/numbers/model.js` and `src/ml/decision.js`, which must accompany hardware sources in redistributed build tools.
