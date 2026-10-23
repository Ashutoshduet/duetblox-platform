/** A same-origin deployment directory, never a URL or an origin-root alias. */
export function normalizeAppBase(value = '/') {
  if (typeof value !== 'string' || !/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error('DUETBLOX_BASE_PATH must be an absolute directory path such as / or /duetblox/.');
  }
  if (value.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('DUETBLOX_BASE_PATH cannot contain path traversal.');
  }
  return value.endsWith('/') ? value : `${value}/`;
}

/** Resolve a bundled resource; external service URLs must not use this helper. */
export function appPath(value = '', base = import.meta.env?.BASE_URL || '/') {
  const prefix = normalizeAppBase(base);
  if (typeof value !== 'string' || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) {
    throw new Error('App resources must use a same-origin path.');
  }
  const suffixAt = value.search(/[?#]/);
  const pathname = suffixAt < 0 ? value : value.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? '' : value.slice(suffixAt);
  for (const part of pathname.split('/')) {
    let decoded;
    try { decoded = decodeURIComponent(part); } catch { throw new Error('App resource path is not valid URL encoding.'); }
    if (decoded === '.' || decoded === '..' || /[\\/\u0000-\u001f]/.test(decoded)) throw new Error('App resource path cannot leave its deployment directory.');
  }
  if (pathname === prefix.slice(0, -1) || !pathname || pathname === '/') return prefix + suffix;
  if (pathname.startsWith(prefix)) return pathname + suffix;
  return prefix + pathname.replace(/^\//, '') + suffix;
}
