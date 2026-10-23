/**
 * Opaque Scratch SVG/Paper sandboxes cannot use the host's service worker cache.
 * Use upstream's bundled source-text delivery on every host so prepared offline
 * projects can still render and edit costumes on HTTPS deployments. The parent
 * loads the source chunk through its service worker; the isolated iframe then
 * receives scripts in its CSP-protected srcdoc. Keep allow-scripts isolation.
 * This patch applies only to the copied, pinned 15.2.0 distributions.
 */
// Parentheses also keep minified `return"http:"` syntactically separate when
// replacing its string expression with a boolean expression.
export const inlineSandboxDelivery = '(false/* DUETBlox offline sandbox delivery */)';
const upstreamDelivery = '"http:"===window.location.protocol||"https:"===window.location.protocol';
const expectedByFile = {
  'scratch-gui-standalone.js': 1,
  'vendor/scratch-vm.js': 1,
  'vendor/scratch-render.min.js': 1,
  'vendor/scratch-storage.js': 0,
  'vendor/scratch-svg-renderer.js': 1
};

export function patchSandboxDelivery(source, file) {
  const expected = expectedByFile[file];
  if (expected === undefined || source.split(upstreamDelivery).length - 1 !== expected || source.includes(inlineSandboxDelivery)) {
    throw new Error(`Sandbox delivery did not match the pinned ${file} bundle exactly.`);
  }
  return source.replaceAll(upstreamDelivery, inlineSandboxDelivery);
}
