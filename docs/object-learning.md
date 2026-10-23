# Experimental object finder

DUETBlox can train a custom still-image object finder entirely in the browser. Students provide their own object classes and labeled image regions, including background regions with no target objects. It uses the existing local MobileNet V2 feature extractor and trains a new classifier for those crops.

This is a deliberately bounded sliding-window method. The learned model classifies image crops; it does **not** learn box coordinates or use a YOLO/SSD detection network. It checks a bounded grid of overlapping square windows at three scales and reports approximate regions. Small, narrow, overlapping, or partly visible objects may be missed, and background can be mistaken for a target. This feature does not establish parity with a general object-detection platform.

## Student workflow

1. Open **ML Studio → Object learning**. Give each object class a distinct name.
2. Add photos. Drag a box around each target and choose the correct class. A keyboard form also accepts box coordinates as percentages. Draw separate **Background** boxes containing no targets.
3. Collect at least three varied training boxes for every object class and three background boxes. More varied photos matter more than repeated identical crops.
4. Keep different photos as **Holdout test** and label every target in them. A holdout photo containing no target objects needs no foreground boxes; it still counts in evaluation and can reveal false positives.
5. Train, choose a separate test photo, and use **Find objects**. Inspect the reported boxes. A confidence score is not a probability that the location is correct.
6. Use **Check holdout boxes** to count matches, extra detections, and missed objects. A match needs the right class and at least 0.5 intersection over union (IoU). Export the evaluation report to inspect per-image results.
7. **Use this test photo in Blocks** makes the selected still image available to the Object Finder extension. Its detect block runs a new scan; reporters return count, class, confidence, and box position/size. It does not read the Scratch stage or turn on a camera.

Changing the test image, model, or applied confidence clears previous detections. Failed and cancelled scans also clear them. An invalid object index raises an explicit error; check the count before reading object 1. Coordinates use percentages measured from the image's top-left corner, not Scratch stage coordinates.

## Data, models, and offline operation

Datasets contain 1–6 custom classes, at most 30 photos and 200 annotations. Imported photos are resized to a maximum side of 640 pixels while retaining aspect ratio; dataset records allow up to 1024-pixel images. Image data must be local JPEG, PNG or WebP data URLs, with a combined limit of 20 million encoded characters. Every saved box uses normalized coordinates inside its source image.

Object datasets export as JSON. Models export as ZIP files containing TF.js topology, weights and metadata. DUETBlox project archives keep these with the other programming workspaces. A selected test photo and the latest detections are temporary; select a test photo again after opening a project or importing a model. Dataset photos can be selected again without uploading them.

The existing bundled MobileNet assets support training and inference offline after the offline pack is prepared. No new pretrained detector is downloaded. The classifier artifact includes its feature-extraction network and the learned head. Import validation checks class order, the background class, tensor input/output shapes, bounded artifact size, and finite normalized scores on a small probe before accepting a model.

Metadata also stores SHA-256 fingerprints of the encoded source images used during training. Holdout evaluation rejects exact matches against the model's training fingerprints even if a user later changes a training image's split or imports the model elsewhere. This catches reuse of saved images; it does not detect visually similar photos or re-encoded variants. Holdout results are measurements on the student's chosen images, not an independent accuracy benchmark.

## Method and bounds

The local MobileNet V2 0.35 checkpoint produces features for each annotated crop, resized to 224 × 224 pixels. Teachable Machine's pinned browser library trains a 64-unit dense layer and softmax output with a background class. Default training is 20 epochs, adjustable from 1 to 100. Cancellation is checked between extraction, training epochs, and scan windows.

Scanning uses square side lengths of 100%, 65%, and 40% of the source image's shorter side. Grid spacing is at most one quarter of each window’s side, with both image edges included. A square image uses 66 windows; source aspect ratio is limited to 4:1 in either direction, and no scan may exceed 400 windows. Unsupported extreme shapes are rejected rather than dropping the remaining image area. This gives square targets at one of the scanned sizes a candidate IoU above 0.6 throughout the image; the classifier and suppression can still choose a worse box. A window contributes its highest-scoring class only when that class is not Background and meets the applied minimum confidence. Same-class non-maximum suppression removes overlaps above IoU 0.3; at most 10 candidates remain. Localization quality is constrained by these fixed windows.

The browser tests use synthetic labeled pictures to check actual training, model serialization, inference, class/box outputs, cancellation, and evaluation correctness. Those synthetic examples are engineering tests and make no claim about accuracy on real classroom photos. Evidence is saved in `work/release-070/object-*`.
