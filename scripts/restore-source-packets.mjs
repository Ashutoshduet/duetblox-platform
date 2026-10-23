import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultHost = 'https://duetblox.ashotosh01singh2000.chatgpt.site';
const sha = data => createHash('sha256').update(data).digest('hex');
const maximumArchiveBytes = 512 * 1024 * 1024;
function safeName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid source packet path.');
  return value;
}
function httpsURL(value) {
  let url;
  try {url = new URL(value);} catch {throw new Error('Invalid source download URL.');}
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) throw new Error('Source downloads require HTTPS URLs without credentials or fragments.');
  return url.href;
}
function identity(bytes, digest, label) {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > maximumArchiveBytes || !/^[0-9a-f]{64}$/.test(digest)) throw new Error(`Invalid source identity: ${label}.`);
}
// Manifest paths cannot traverse directories or follow existing symlinks.
async function safeLocation(root, relative, createDirectories = false) {
  safeName(relative); let current = root; const segments = relative.split('/');
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]); let stat;
    try {stat = await fs.lstat(current);} catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (createDirectories && index < segments.length - 1) {await fs.mkdir(current); stat = await fs.lstat(current);}
    }
    if (stat?.isSymbolicLink() || (stat && index < segments.length - 1 && !stat.isDirectory()) || (stat && index === segments.length - 1 && !stat.isFile())) throw new Error(`Source packet path is not a regular file: ${relative}.`);
  }
  return current;
}
function checksumEntries(text) {
  const result = new Map();
  for (const line of text.trim().split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s+(.+)$/);
    if (!match) throw new Error('Invalid source packet checksum entry.');
    const name = safeName(match[2]);
    if (result.has(name)) throw new Error(`Duplicate source checksum: ${name}.`);
    result.set(name, match[1]);
  }
  return result;
}
async function readExisting(root, relative, expected, bytes) {
  const file = await safeLocation(root, relative); let data;
  try {data = await fs.readFile(file);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  if ((bytes !== undefined && data.length !== bytes) || sha(data) !== expected) throw new Error(`Existing source packet failed verification: ${relative}. Move it aside before restoring; it was not overwritten.`);
  return data;
}
async function download(fetchImpl, address, label, expectedBytes) {
  let url = httpsURL(address);
  for (let redirect = 0; redirect <= 5; redirect++) {
    let response;
    try {response = await fetchImpl(url, {redirect: 'manual', signal: AbortSignal.timeout(120000)});} catch {throw new Error(`Could not download source packet ${label}. Check the connection and try again.`);}
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location || redirect === 5) throw new Error(`Source packet ${label} has too many or invalid redirects.`);
      let next;
      try {next = new URL(location, url).href;} catch {throw new Error(`Source packet ${label} has an invalid redirect.`);}
      // Signed redirect URLs are validated but never printed in diagnostics.
      url = httpsURL(next); continue;
    }
    if (!response.ok) {await response.body?.cancel(); throw new Error(`Source packet ${label}: HTTP ${response.status}. Use the matching release or laptop handoff.`);}
    const maximum = expectedBytes ?? 16 * 1024 * 1024, declared = response.headers.get('content-length');
    if (declared !== null && Number(declared) > maximum) {await response.body?.cancel(); throw new Error(`Source packet ${label} exceeds its expected size.`);}
    const chunks = []; let size = 0; const reader = response.body?.getReader();
    if (!reader) throw new Error(`Source packet ${label} has no response body.`);
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maximum) {await reader.cancel(); throw new Error(`Source packet ${label} exceeds its expected size.`);}
        chunks.push(Buffer.from(value));
      }
    } finally {reader.releaseLock();}
    if (expectedBytes !== undefined && size !== expectedBytes) throw new Error(`Source packet ${label} has a byte-count mismatch.`);
    return Buffer.concat(chunks, size);
  }
  throw new Error(`Could not download source packet ${label}.`);
}
async function writeMissing(root, relative, data, expected) {
  const file = await safeLocation(root, relative, true), temporary = path.join(path.dirname(file), `.source-restore-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, data, {flag: 'wx'});
    // Commit a complete file atomically without replacing concurrent edits.
    try {await fs.link(temporary, file); return true;} catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await readExisting(root, relative, expected, data.length); return false;
    }
  } finally {await fs.rm(temporary, {force: true});}
}

/** Restore exact source packets. Inject fetchImpl for tests without network. */
export async function restoreSourcePackets({root = defaultRoot, host = defaultHost, fetchImpl = globalThis.fetch} = {}) {
  root = await fs.realpath(root);
  const base = new URL(httpsURL(host));
  if (base.search || base.pathname !== '/') throw new Error('The source host must be an HTTPS origin.');
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch implementation is required.');
  const groups = new Map();
  for (const group of ['upstream', 'hardware']) {
    const prefix = `public/source/${group}`;
    const sums = checksumEntries(await fs.readFile(await safeLocation(root, `${prefix}/SHA256SUMS`), 'utf8'));
    const manifestBytes = await fs.readFile(await safeLocation(root, `${prefix}/manifest.json`));
    if (!sums.has('manifest.json') || sha(manifestBytes) !== sums.get('manifest.json')) throw new Error(`Source manifest failed verification: ${group}.`);
    let manifest;
    try {manifest = JSON.parse(manifestBytes);} catch {throw new Error(`Invalid source manifest: ${group}.`);}
    groups.set(group, {prefix, sums, manifest, entries: new Map()});
  }
  const plans = [];
  function addPlan(groupName, archive) {
    const group = groups.get(groupName);
    safeName(archive.name); identity(archive.bytes, archive.sha256, archive.name); archive.url = httpsURL(archive.url);
    if (!Array.isArray(archive.parts) || archive.parts.length === 0) throw new Error('Source archive parts are required.');
    let total = 0;
    for (const part of archive.parts) {
      safeName(part.file); identity(part.bytes, part.sha256, part.file);
      if (group.entries.has(part.file) || group.sums.get(part.file) !== part.sha256) throw new Error(`Conflicting source part identity: ${part.file}.`);
      total += part.bytes; group.entries.set(part.file, part);
    }
    if (total !== archive.bytes) throw new Error(`Source part byte counts do not match ${archive.name}.`);
    plans.push({...archive, groupName});
  }
  const upstream = groups.get('upstream').manifest;
  if (!Array.isArray(upstream.archives)) throw new Error('Upstream source archives are required.');
  for (const archive of upstream.archives) addPlan('upstream', {name: archive.archive, bytes: archive.bytes, sha256: archive.sha256, url: archive.url, parts: archive.parts});
  const hardware = groups.get('hardware').manifest;
  if (!Array.isArray(hardware.files) || !hardware.splitArchive || !Array.isArray(hardware.splitArchive.parts)) throw new Error('Hardware source metadata is required.');
  const hardwareFiles = new Map();
  for (const file of hardware.files) {
    safeName(file.name); identity(file.size, file.sha256, file.name);
    if (hardwareFiles.has(file.name) || groups.get('hardware').sums.get(file.name) !== file.sha256) throw new Error(`Conflicting hardware source identity: ${file.name}.`);
    hardwareFiles.set(file.name, {file: file.name, bytes: file.size, sha256: file.sha256});
  }
  const split = hardware.splitArchive;
  addPlan('hardware', {name: split.name, bytes: split.size, sha256: split.sha256, url: split.upstream,
    parts: split.parts.map(name => {safeName(name); const part = hardwareFiles.get(name); if (!part) throw new Error('Missing hardware split-part identity.'); return part;})});
  for (const [name, file] of hardwareFiles) if (!groups.get('hardware').entries.has(name)) groups.get('hardware').entries.set(name, file);

  // Validate all metadata, paths and existing files before downloading/writing.
  const existing = new Map(); let verified = 0, restored = 0, archivesFetched = 0;
  for (const [groupName, group] of groups) for (const [name, digest] of group.sums) {
    const data = await readExisting(root, `${group.prefix}/${name}`, digest, group.entries.get(name)?.bytes);
    existing.set(`${groupName}/${name}`, data !== null); if (data !== null) verified++;
  }
  const downloadCache = new Map();
  for (const archive of plans) {
    const group = groups.get(archive.groupName), missing = archive.parts.filter(part => !existing.get(`${archive.groupName}/${part.file}`));
    if (!missing.length) {
      const hash = createHash('sha256');
      for (const part of archive.parts) hash.update(await fs.readFile(await safeLocation(root, `${group.prefix}/${part.file}`)));
      if (hash.digest('hex') !== archive.sha256) throw new Error(`Complete local source archive failed verification: ${archive.name}.`);
      continue;
    }
    if (!downloadCache.has(archive.url)) {downloadCache.set(archive.url, await download(fetchImpl, archive.url, archive.name, archive.bytes)); archivesFetched++;}
    const data = downloadCache.get(archive.url);
    if (data.length !== archive.bytes || sha(data) !== archive.sha256) throw new Error(`Full source archive failed verification: ${archive.name}. No split parts were written.`);
    const slices = []; let offset = 0;
    for (const part of archive.parts) {
      const bytes = data.subarray(offset, offset + part.bytes); offset += part.bytes;
      if (bytes.length !== part.bytes || sha(bytes) !== part.sha256) throw new Error(`Split source part failed verification: ${part.file}. No split parts were written.`);
      slices.push({part, bytes});
    }
    for (const {part, bytes} of slices) if (!existing.get(`${archive.groupName}/${part.file}`)) {
      if (await writeMissing(root, `${group.prefix}/${part.file}`, bytes, part.sha256)) restored++; else verified++;
      existing.set(`${archive.groupName}/${part.file}`, true);
    }
  }
  // Smaller hardware packets and source instructions remain on the same host.
  for (const [groupName, group] of groups) for (const [name, expected] of group.sums) if (!existing.get(`${groupName}/${name}`)) {
    const address = new URL(`/source/${groupName}/${name.split('/').map(encodeURIComponent).join('/')}`, base).href;
    const data = await download(fetchImpl, address, name, group.entries.get(name)?.bytes);
    if (sha(data) !== expected) throw new Error(`Hosted source packet failed verification: ${name}.`);
    if (await writeMissing(root, `${group.prefix}/${name}`, data, expected)) restored++; else verified++;
    existing.set(`${groupName}/${name}`, true);
  }
  return {verified, restored, archivesFetched};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {const result = await restoreSourcePackets(); console.log(`Source packets verified: ${result.verified}; restored: ${result.restored}; full archives downloaded: ${result.archivesFetched}.`);}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}
