/**
 * Scratch's only hull.js call passes pixel coordinate arrays and Infinity, with
 * no third format argument (RenderWebGL.js in pinned 15.2.0). The unused format
 * branch in hull.js 0.2.10 evaluates strings with new Function (GHSA-q849-wxrc-vqrp).
 * Remove that branch from the actual shipped bundles, without changing the
 * point-array algorithm. This is deliberately exact and fails on version drift.
 */
export const safeHullFormatSource = 'toXy:function(points,format){if(format!==undefined)throw new Error("DUETBlox does not support dynamic hull point formats");return points.slice()},fromXy:function(points,format){if(format!==undefined)throw new Error("DUETBlox does not support dynamic hull point formats");return points.slice()}';
export function patchHullFormat(source, file) {
  let replacements = 0;
  for (const [point, format] of [['e','t'], ['A','B']]) {
    const old = `toXy:function(${point},${format}){return void 0===${format}?${point}.slice():${point}.map(function(${point}){return new Function("pt","return [pt"+${format}[0]+",pt"+${format}[1]+"];")(${point})})},fromXy:function(${point},${format}){return void 0===${format}?${point}.slice():${point}.map(function(${point}){return new Function("pt","var o = {}; o"+${format}[0]+"= pt[0]; o"+${format}[1]+"= pt[1]; return o;")(${point})})}`;
    if (source.includes(old)) {source=source.replace(old,safeHullFormatSource);replacements++;}
  }
  if (replacements !== 1 || source.includes('new Function("pt"')) throw new Error(`Hull format hardening did not match the pinned ${file} bundle exactly.`);
  return source;
}
