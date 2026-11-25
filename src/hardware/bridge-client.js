/** Explicit local Arduino CLI helper integration. Token stays only in this instance. */
export class ArduinoBridgeClient {
  constructor({token, fetchImpl = (...args) => globalThis.fetch(...args), timers = globalThis} = {}) { this.token = token || ''; this.fetch = fetchImpl; this.timers = timers; this.baseURL = 'http://127.0.0.1:8765'; }
  async request(path, body) {
    const controller = new AbortController(); const timer = this.timers.setTimeout(() => controller.abort(), path === '/compile' ? 610000 : path === '/upload' ? 190000 : 30000);
    let responseReceived = false;
    try {
      const response = await this.fetch(`${this.baseURL}${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: {Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : {'Content-Type':'application/json'})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}), cache: 'no-store', credentials: 'omit'
      });
      responseReceived = true;
      const result = await response.json();
      if (!response.ok) { const error = new Error(result.error || `Bridge returned ${response.status}.`); error.details = result; throw error; }
      return result;
    } catch (cause) {
      if (controller.signal.aborted) {
        const error = new Error(path === '/compile' ? 'Compilation timed out. Check the local compiler log and installed board core, then retry. No firmware was uploaded.' : 'The local compiler did not respond in time. Check that the helper is running, then reconnect.', {cause});
        error.name = 'CompilerTimeoutError'; throw error;
      }
      if (!responseReceived && cause instanceof TypeError) throw new Error('Cannot reach the local compiler at 127.0.0.1:8765. Start the helper with this page’s exact origin, allow local-network access if prompted, and paste its current session token.', {cause});
      if (responseReceived && cause instanceof SyntaxError) throw new Error('The local helper returned an unreadable response. Check that DUETBlox’s compiler helper is the service running on port 8765.', {cause});
      throw cause;
    } finally { this.timers.clearTimeout(timer); }
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
