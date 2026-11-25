const pages = new Set(['home', 'junior', 'blocks', 'python', 'ml', 'boards', 'circuits', 'spice', 'projects', 'classroom', 'learn', 'offline']);

export function pageFromHash(hash) {
  const match = /^#\/([a-z]+)$/.exec(hash || '');
  return match && pages.has(match[1]) ? match[1] : null;
}

export function initialWorkspacePage() {
  const explicit = pageFromHash(window.location.hash);
  if (explicit) return explicit;
  if (window.location.hash) return 'home';
  try {
    const saved = localStorage.getItem(`duetblox:last-page:${window.location.pathname}`);
    return pages.has(saved) ? saved : 'home';
  } catch { return 'home'; }
}

export function rememberWorkspacePage(page, {replace = false, navigate = true} = {}) {
  if (!pages.has(page)) return;
  try { localStorage.setItem(`duetblox:last-page:${window.location.pathname}`, page); } catch {}
  const hash = `#/${page}`;
  if (navigate && window.location.hash !== hash) {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }
}
