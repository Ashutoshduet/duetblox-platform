import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';

// Original project JSON and SVG assets are checked into public/examples/source.
// No test output, network download, browser state or generated dist is required.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'public/examples'), source = path.join(destination, 'source');
const examples = ['learning-steps', 'virtual-input-output', 'nested-data-lists'];
// JSZip serializes UTC calendar fields; fix the instant across all host zones.
const date = new Date('2000-01-01T00:00:00.000Z');
for (const name of examples) {
  const json = await fs.readFile(path.join(source, `${name}.json`), 'utf8');
  const project = JSON.parse(json), zip = new JSZip();
  zip.file('project.json', json, {date, unixPermissions: 0o644});
  const assets = new Map();
  for (const target of project.targets) for (const asset of [...target.costumes, ...target.sounds]) {
    const filename = `${asset.assetId}.${asset.dataFormat}`;
    if (!/^[a-f0-9]{32}\.(svg|png|jpg|wav|mp3)$/.test(filename) || filename !== asset.md5ext) throw new Error(`Invalid example asset: ${filename}`);
    assets.set(filename, asset.assetId);
  }
  for (const [filename, expectedHash] of [...assets].sort(([a], [b]) => a.localeCompare(b))) {
    const data = await fs.readFile(path.join(source, filename));
    if (createHash('md5').update(data).digest('hex') !== expectedHash) throw new Error(`Example asset hash mismatch: ${filename}`);
    zip.file(filename, data, {date, unixPermissions: 0o644});
  }
  const output = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: {level: 9}, platform: 'UNIX'});
  await fs.writeFile(path.join(destination, `${name}.sb3`), output);
  console.log(`${name}.sb3: ${output.length} bytes; SHA256 ${createHash('sha256').update(output).digest('hex')}`);
}
