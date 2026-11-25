import test from 'node:test';
import assert from 'node:assert/strict';
import {ArduinoBridgeClient} from './bridge-client.js';

test('compiler timeouts are visible errors, not indistinguishable from a cancelled port chooser', async () => {
  let cleared = false;
  const client = new ArduinoBridgeClient({timers: {setTimeout(fn) { queueMicrotask(fn); return 7; }, clearTimeout(id) { assert.equal(id, 7); cleared = true; }}, fetchImpl: async (_url, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))});
  await assert.rejects(client.compile({}, 'arduino-uno'), error => error.name === 'CompilerTimeoutError' && /Compilation timed out/.test(error.message));
  assert.equal(cleared, true);
});
test('connection failure gives exact setup steps without leaking token', async () => {
  const client = new ArduinoBridgeClient({token: 'secret-session', fetchImpl: async () => { throw new TypeError('Failed to fetch'); }});
  await assert.rejects(client.health(), error => /127.0.0.1:8765/.test(error.message) && /exact origin/.test(error.message) && !error.message.includes('secret-session'));
});
test('compiler diagnostics retain details, and successful requests keep authentication in headers only', async () => {
  const client = new ArduinoBridgeClient({token: 'session-token', fetchImpl: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8765/compile'); assert.equal(options.headers.Authorization, 'Bearer session-token'); assert.equal(options.credentials, 'omit');
    return {ok: false, status: 422, json: async () => ({error: 'Unsupported blocks', diagnostics: [{message: 'Motion cannot run on Arduino'}], log: 'compile stopped'})};
  }});
  await assert.rejects(client.compile({}, 'arduino-uno'), error => error.details.diagnostics[0].message === 'Motion cannot run on Arduino');
});
