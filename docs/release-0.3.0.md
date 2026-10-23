# DUETBlox 0.3.0

This browser release helps learners check whether their models work on new examples, understand when a prediction should be rejected, and learn text classification. It also improves the Arduino/ESP32 connection workflow. These are working additions to the local application, not evidence that DUETBlox outperforms every competing product. The existing hosted site is not updated by saving this release locally.

## Separate evaluation for image, sound and pose

The new **Check with new examples** panel accepts labelled evaluation uploads that remain separate from training. Upload new images or sound clips for each model class, then run a batch evaluation. You can review and remove examples before evaluating.

The report shows:

- A confusion matrix with actual classes as rows and predictions as columns, including an Unknown column.
- Precision, recall and F1 for each class, with example and abstention counts.
- Accuracy, raw top-1 accuracy, macro F1, coverage and accuracy among accepted predictions.
- Failed inputs separately, so decoding or inference failures are visible.
- Downloadable JSON and CSV reports, plus import/export of the evaluation examples themselves.

Accuracy counts Unknown as a miss. Top-1 accuracy ignores the acceptance limits. Coverage is the fraction of evaluated examples accepted by those limits; accepted accuracy uses only those accepted predictions. Macro F1 averages classes with evaluation examples, so the panel also identifies missing classes. Failed inputs are counted separately and excluded from prediction metrics.

Exact media duplicates are checked using SHA-256. Copies of the available training examples and repeated evaluation examples are rejected before evaluation. This does not detect every resized, edited or otherwise transformed copy, and an imported model's original training data may be unavailable. Collect evaluation data in new sessions, with varied people, backgrounds and conditions. Keep a final test set that you do not use to tune the model or thresholds.

Batch evaluation holds the model operation lock and uses one captured model. It waits for an existing prediction, supports cancellation, and stops when its studio is left. Reports are cleared when the model or examples change; changing acceptance limits recalculates the report from the same raw predictions. Evaluation examples are saved locally and included in `.duet` v3 projects. Reports need to be rerun after reopening or replacing a model.

## Explicit prediction acceptance

Image, sound, pose and text now have configurable minimum top-score and minimum-lead settings. The defaults are a 70% top score and a lead of 10 percentage points over second place. Predictions below a limit, and tied predictions, are not accepted. The displayed result and block APIs expose that decision; programs can check **prediction accepted?** before acting.

Model scores are not calibrated probabilities of correctness. A model can confidently misclassify an unfamiliar input, so Unknown thresholds do not replace representative testing. Pose inputs without a sufficiently clear body produce no class prediction and count as abstentions during evaluation. Text with no learned words returns Unknown.

## Text learning with explanations

The fourth ML workspace trains a local Multinomial Naive Bayes text classifier. It supports Unicode word tokenization, including Hindi vowel marks, so learners can provide English and Hindi examples. No account, API key, remote inference or pretrained model download is required for this text pipeline.

Learners can create classes, add examples one per line, train, test sentences and use the model in Scratch blocks. Dataset and model JSON import/export are available. **Why this prediction?** shows learned and unfamiliar words, their contributions to the winning class versus the runner-up, and the contribution of class frequencies. The interface explains the algorithm's word counts and Laplace smoothing.

At least three distinct examples per class are required for training. With five or more, a temporary model performs a fixed, stratified 20% holdout check; duplicate examples are removed before splitting. The report shows accuracy, macro F1, per-class results and each held-out prediction. The model used in Blocks is then trained separately on all examples. These holdout scores use the top class before Unknown thresholds and are not an independent benchmark of the final model.

This classifier learns word patterns. It does not understand word order, sarcasm or meaning, and it does not translate between Hindi and English. Its JSON format is a DUETBlox text model, not a Teachable Machine image/sound/pose export.

## Board connection improvements

The five implemented software profiles remain Arduino Uno R3, Mega 2560, classic ATmega328P Nano, classic ESP32-WROOM and AI Thinker ESP32-CAM. This release does not add unverified adapters under the name of broader hardware support.

The Boards page now shows secure-context, Web Serial and local compiler readiness, together with exact supported models, logic voltage, usable pins and restrictions. **Cancel connection**, **Disconnect** and **Reconnect last board** make connection recovery explicit. A cancelled connection cannot report success when its older browser chooser or native port-open operation eventually completes. A failed compiler recheck cannot leave compilation enabled using an older successful result.

**Export diagnostics** saves a local JSON file containing the registered board's capabilities and limited readiness/connection state. It excludes compiler tokens, project content, logs, native device identifiers and personal filesystem paths. It does not send the report to a server.

All five profiles still show physical validation as pending. Compilation and protocol tests do not prove USB drivers, flashing or electrical outputs on a real board. ESP32-CAM remains a limited GPIO profile; camera and SD-card blocks are not implemented. Planned devices, including STEMpedia boards and robots, remain collapsed under **Other boards**. See [hardware readiness](hardware-readiness.md) for the exact lifecycle and validation limits.

## Project format and existing work

`.duet` v3 adds text datasets/models, trained-model prediction settings and separate image/sound/pose evaluation datasets to the existing Junior story, Scratch project and media-model content. Older v1/v2 projects can still be opened. The existing Junior editor, Scratch editor and browser hardware programming workflows remain part of the application.

## Browser observations

The release was exercised with real models in the production browser build. These small functional fixtures verify wiring and reporting, not general accuracy or superiority to other tools:

| Check | Observed result | What it establishes |
|---|---|---|
| Four new synthetic circle/square images | All four classified correctly; setting the minimum top score to 100% made all four Unknown | Image batch inference, acceptance policy and report recalculation work on this fixture. |
| New sound control WAVs: 448 Hz, 1774 Hz and noise | Three correct results | Uploaded audio processing and sound-model evaluation work near the training distribution. |
| Sound stress WAVs: 230 Hz, 910 Hz and noise | Only one correct accepted prediction among three inputs; one input was Unknown | Different inputs can defeat a small training dataset. The report exposes this limitation instead of reporting only successful examples. |
| Blank pose image | No body detected; counted as Unknown in the confusion matrix | A missing body is not silently removed from evaluation. |
| Evaluation import containing a training copy | Import rejected and the previous four evaluation examples retained | Leakage rejection preserves the existing test set. |
| Hindi text in the actual Scratch VM | Greeting returned with acceptance true; unfamiliar words returned Unknown with acceptance false | Text predictions and acceptance decisions reach executable Scratch blocks. |

The definitive test commands, results and build evidence are recorded in [release validation](validation.md).

## Remaining gaps

No physical board flashing or live camera/microphone capture took place during these checks. Those acceptance tests, broad browser/device testing and learner usability testing remain necessary. Windows desktop packaging is deferred until the browser work is ready.

Object detection training, hand-pose training, numerical ML, classroom collaboration and the planned board adapters are not implemented. ML inference runs in the browser, not on the microcontrollers. The local compiler helper is still required to compile standalone native board programs. The new evaluation and explanation features improve what learners can inspect, but they do not establish feature parity with PictoBlox or a comparative performance win.
