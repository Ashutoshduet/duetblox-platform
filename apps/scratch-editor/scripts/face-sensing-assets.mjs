/**
 * The pinned Scratch 15.2.0 distributions load Face Sensing independently of
 * webpack's public path. DUETBlox hosts the official MediaPipe files below
 * /scratch, so fix the copied bundles and keep initialization entirely local.
 * Fail on upstream drift instead of silently shipping a broken offline path.
 */
export const faceSensingSolutionPath = '/scratch/chunks/mediapipe/face_detection';
export const faceSensingFailureMessage = 'Face Sensing could not load its local model. Open Offline and check / repair offline files, then reload the editor.';
export const faceSensingAssetNames = [
  'face_detection.js',
  'face_detection_short.binarypb',
  'face_detection_full.binarypb',
  'face_detection_short_range.tflite',
  'face_detection_full_range.tflite',
  'face_detection_full_range_sparse.tflite',
  'face_detection_solution_simd_wasm_bin.js',
  'face_detection_solution_simd_wasm_bin.data',
  'face_detection_solution_simd_wasm_bin.wasm',
  'face_detection_solution_wasm_bin.js',
  'face_detection_solution_wasm_bin.wasm'
];

const upstreamPath = 'solutionPath:"/chunks/mediapipe/face_detection"';
const cloudPrefix = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@';
const fallbackByFile = {
  'scratch-gui-standalone.js': '.catch(()=>{const e={runtime:"mediapipe",solutionPath:`https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@${g.version}`,maxFaces:1};return c.createDetector(t,e)})',
  'vendor/scratch-vm.js': '.catch(()=>{const A={runtime:"mediapipe",solutionPath:"https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@".concat(c.version),maxFaces:1};return Q.createDetector(e,A)})'
};
const successByFile = {
  'scratch-gui-standalone.js': '.then(e=>{this._faceDetector=e,this.runtime.ioDevices&&this._loop()})',
  'vendor/scratch-vm.js': '.then(A=>{this._faceDetector=A,this.runtime.ioDevices&&this._loop()})'
};

export function patchFaceSensingAssets(source, file) {
  const fallback = fallbackByFile[file];
  const success = successByFile[file];
  if (!fallback || source.split(upstreamPath).length !== 2 || source.split(fallback).length !== 2 || source.split(success).length !== 2) {
    throw new Error(`Face Sensing offline paths did not match the pinned ${file} bundle exactly.`);
  }
  const adjusted = source.replace(upstreamPath, `solutionPath:${JSON.stringify(faceSensingSolutionPath)}`)
    .replace(fallback, '')
    .replace(success, `${success}.catch(()=>{this.runtime.emit("EXTENSION_DATA_LOADING",false),this.runtime.emit("DUET_EXTENSION_ERROR",{extension:"faceSensing",message:${JSON.stringify(faceSensingFailureMessage)}})})`);
  if (adjusted.includes(cloudPrefix) || adjusted.includes(upstreamPath)) {
    throw new Error(`Face Sensing retained an unexpected external asset path in ${file}.`);
  }
  return adjusted;
}
