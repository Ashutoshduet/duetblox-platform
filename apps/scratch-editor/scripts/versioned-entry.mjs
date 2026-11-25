import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 20);

/**
 * Old service workers normalize away URL queries. New content therefore needs
 * a new pathname for both the iframe document and its own JavaScript/CSS.
 * Keep the stable document as a compatibility alias for existing integrations.
 */
export async function writeVersionedScratchEntry(output, basePath) {
  const script = await readFile(path.join(output, 'duetblox-editor.js'));
  const style = await readFile(path.join(output, 'editor.css'));
  const scriptName = `duetblox-editor-${digest(script)}.js`;
  const styleName = `editor-${digest(style)}.css`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DUETBlox · Block editor</title><link rel="stylesheet" href="./${styleName}"></head><body><main id="app"><p style="padding:24px;color:#53536b">Opening DUETBlox…</p></main><script src="./${scriptName}"></script></body></html>`;
  const entryName = `index-${digest(html)}.html`;
  const entry = {version: 1, basePath, path: `/scratch/${entryName}`, script: `/scratch/${scriptName}`, style: `/scratch/${styleName}`};
  await Promise.all([
    writeFile(path.join(output, scriptName), script),
    writeFile(path.join(output, styleName), style),
    writeFile(path.join(output, entryName), html),
    writeFile(path.join(output, 'index.html'), html)
  ]);
  // Publish the discovery file last so a failed write cannot advertise a partial entry.
  await writeFile(path.join(output, 'runtime-entry.json'), JSON.stringify(entry, null, 2) + '\n');
  return entry;
}
