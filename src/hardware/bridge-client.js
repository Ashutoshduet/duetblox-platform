/** Explicit local Arduino CLI helper integration. Token stays only in this instance. */
export class ArduinoBridgeClient {
  constructor({token, fetchImpl = (...args) => globalThis.fetch(...args)} = {}) { this.token = token || ''; this.fetch = fetchImpl; this.baseURL = 'http://127.0.0.1:8765'; }
  async request(path, body) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), path === '/compile' ? 610000 : path === '/upload' ? 190000 : 30000);
    try {
      const response = await this.fetch(`${this.baseURL}${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: {Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : {'Content-Type':'application/json'})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}), cache: 'no-store', credentials: 'omit'
      });
      const result = await response.json();
      if (!response.ok) { const error = new Error(result.error || `Bridge returned ${response.status}.`); error.details = result; throw error; }
      return result;
    } finally { clearTimeout(timer); }
  }
  health() { return this.request('/health'); }
  boards() { return this.request('/boards'); }
  compile(project, boardId, variant) { return this.request('/compile', {project, boardId, ...(variant ? {variant} : {})}); }
  artifact(artifactId) {
    if(typeof artifactId!=='string' || !/^[0-9a-f]{48}$/.test(artifactId)) throw new Error('Invalid compiled artifact identifier.');
    return this.request(`/artifact/${artifactId}`);
  }
  upload(artifactId, port) { return this.request('/upload', {artifactId, port, confirm: true}); }
}
