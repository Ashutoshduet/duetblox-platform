import test from 'node:test';
import assert from 'node:assert/strict';
import {VirtualBoardService} from './virtual-board.js';

const create = (boardId = 'arduino-uno', options = {}) => {
  const lab = new VirtualBoardService({boardId, ...options}); lab.enable(); return lab;
};
const pin = (lab, number) => lab.getState().pins.find(p => p.pin === number);
function fakeClock() {
  let sequence = 0, now = 1000;
  const pending = new Map(), callbacks = [];
  return {
    timers: {setTimeout(callback, delay) { const id = ++sequence; pending.set(id, {callback, at: now + delay}); callbacks.push(callback); return id; }, clearTimeout(id) { pending.delete(id); }},
    now: () => now, pending, callbacks,
    tick(milliseconds) { now += milliseconds; for (const [id, timer] of [...pending]) if (timer.at <= now) { pending.delete(id); timer.callback(); } }
  };
}

test('virtual commands require explicit enablement and planned boards cannot be enabled', async () => {
  const lab = new VirtualBoardService();
  assert.equal(lab.getState().status, 'disabled');
  await assert.rejects(lab.digitalWrite(13, 1), /Enable the Virtual/);
  assert.throws(() => lab.enable({boardId: 'quarky'}), /planned/);
  assert.equal(lab.getState().enabled, false);
  lab.enable(); await lab.digitalWrite(13, 1);
  assert.throws(() => lab.setBoard('microbit'), /planned/);
  assert.equal(pin(lab, 13).value, 1, 'failed board selection preserves the existing model');
  assert.throws(() => lab.setBoard('raspberry-pi'), /Unknown board/);
  lab.dispose();
});

for (const [boardId, output, analog, max] of [
  ['arduino-uno', 13, 'A5', 1023], ['arduino-mega', 53, 'A15', 1023],
  ['arduino-nano', 13, 'A7', 1023], ['esp32', 25, '39', 4095], ['esp32-cam', 14, null, null]
]) test(`${boardId}: valid output and exact analog profile`, async () => {
  const lab = create(boardId);
  await lab.digitalWrite(output, 1); assert.equal(await lab.readDigital(output), 1);
  await lab.setPinMode(output, 'INPUT'); lab.setDigitalInput(output, 0);
  assert.equal(await lab.readDigital(output), 0);
  if (analog) {
    lab.setAnalogInput(analog, max); assert.equal(await lab.readAnalog(analog), max);
    assert.throws(() => lab.setAnalogInput(analog, max + 1), /integer/);
    assert.equal(await lab.readAnalog(analog), max, 'rejected input does not alter the reading');
  } else {
    assert.deepEqual(lab.getState().analogInputs, {});
    await assert.rejects(lab.readAnalog('4'), /unavailable/);
    assert.throws(() => lab.setAnalogInput('4', 5), /unavailable/);
  }
  await assert.rejects(lab.digitalWrite(1, 1), /reserved/);
  lab.dispose();
});

test('ESP32 input-only and pull-up restrictions are enforced', async () => {
  const lab = create('esp32'); lab.setDigitalInput(34, 1);
  assert.equal(await lab.readDigital(34), 1);
  await assert.rejects(lab.digitalWrite(34, 1), /input-only/);
  await assert.rejects(lab.servoWrite(34, 90), /input-only/);
  await assert.rejects(lab.tone(34, 440), /input-only/);
  await assert.rejects(lab.setPinMode(34, 'INPUT_PULLUP'), /no internal pull-up/);
  await assert.rejects(lab.analogWrite(34, 127), /does not support PWM/);
  assert.equal(pin(lab, 34).input, 1); lab.dispose();
});

test('digital inputs have explicit defaults, pull-ups and output isolation', async () => {
  const lab = create();
  assert.equal(await lab.readDigital(2), 0);
  await lab.setPinMode(2, 'INPUT_PULLUP'); assert.equal(await lab.readDigital(2), 1);
  lab.setDigitalInput(2, 0); assert.equal(await lab.readDigital(2), 0);
  lab.setDigitalInput(2, null); assert.equal(await lab.readDigital(2), 1);
  await lab.digitalWrite(2, 0); lab.setDigitalInput(2, 1);
  assert.equal(await lab.readDigital(2), 0, 'external control does not overwrite an output command');
  await lab.setPinMode(2, 'INPUT'); assert.equal(await lab.readDigital(2), 1);
  lab.dispose();
});

test('invalid values and pins reject without changing outputs', async () => {
  const lab = create(); await lab.digitalWrite(13, 1);
  for (const value of [2, -1, 0.5, NaN, Infinity, true, null, '']) await assert.rejects(lab.digitalWrite(13, value), /integer/);
  assert.equal(pin(lab, 13).value, 1);
  await assert.rejects(lab.analogWrite(13, 128), /PWM/);
  await assert.rejects(lab.analogWrite(3, 256), /integer/);
  await assert.rejects(lab.servoWrite(4, 181), /integer/);
  await assert.rejects(lab.setPinMode(2, 'BAD'), /Pin mode/);
  await assert.rejects(lab.readDigital('2.0'), /Invalid digital pin/);
  assert.throws(() => lab.setAnalogInput('A0', -1), /integer/);
  assert.throws(() => lab.setAnalogInput('A6', 0), /unavailable/);
  lab.dispose();
});

test('waveform reads explicitly reject instead of fabricating instantaneous electrical values', async () => {
  const lab = create();
  for (const action of [() => lab.analogWrite(3, 128), () => lab.servoWrite(3, 90), () => lab.tone(3, 440)]) {
    lab.reset(); await action(); await assert.rejects(lab.readDigital(3), /waveform is not simulated/);
    await lab.digitalWrite(3, 1); assert.equal(await lab.readDigital(3), 1);
  }
  lab.dispose();
});

test('servo capacity is bounded and detach releases a slot without clearing unrelated outputs', async () => {
  const lab = create();
  for (const p of [2, 3, 4, 5]) await lab.servoWrite(p, 90);
  await lab.servoWrite(2, 180);
  await assert.rejects(lab.servoWrite(6, 0), /four|4 servo slots/);
  await lab.servoDetach(3); await lab.servoWrite(6, 0);
  assert.equal(lab.getState().pins.filter(p => p.kind === 'servo').length, 4);
  assert.equal(pin(lab, 2).value, 180);
  await lab.digitalWrite(13, 1); await lab.servoDetach(13);
  assert.equal(pin(lab, 13).value, 1); lab.dispose();
});

test('AVR timer conflicts persist after detach/stop and reset clears reservations', async () => {
  const lab = create(); await lab.analogWrite(9, 100);
  await assert.rejects(lab.servoWrite(4, 90), /conflicts/);
  await lab.digitalWrite(9, 0); await lab.servoWrite(4, 90); await lab.servoDetach(4);
  await assert.rejects(lab.analogWrite(9, 100), /reserved/);
  await lab.stop(); await assert.rejects(lab.analogWrite(10, 100), /reserved/);
  lab.reset(); await lab.analogWrite(9, 100); await lab.analogWrite(3, 100);
  await assert.rejects(lab.tone(4, 440), /conflicts/);
  await lab.digitalWrite(3, 0); await lab.tone(4, 440); await lab.noTone(4);
  await assert.rejects(lab.analogWrite(3, 100), /reserved/);
  assert.equal(pin(lab, 9).value, 100); lab.dispose();
});

test('Mega uses its own servo/tone timer pin restrictions', async () => {
  const lab = create('arduino-mega'); await lab.servoWrite(2, 90);
  await lab.analogWrite(9, 10);
  await assert.rejects(lab.analogWrite(44, 10), /reserved/);
  await assert.rejects(lab.tone(4, 440), /conflicts/);
  await lab.digitalWrite(9, 0); await lab.tone(4, 440);
  await assert.rejects(lab.analogWrite(10, 10), /reserved/);
  await lab.analogWrite(3, 10); lab.dispose();
});

test('ESP32 has eight PWM slots; changing an output frees one and servo does not reserve AVR pins', async () => {
  const lab = create('esp32');
  for (const p of [4, 13, 14, 16, 17, 18, 19, 21]) await lab.analogWrite(p, 100);
  await lab.analogWrite(4, 200);
  await assert.rejects(lab.analogWrite(22, 100), /eight PWM slots/);
  await lab.digitalWrite(4, 0); await lab.analogWrite(22, 100);
  await lab.servoWrite(25, 180); await lab.tone(26, 440);
  assert.equal(lab.getState().pins.filter(p => p.kind === 'pwm').length, 8);
  assert.equal(lab.getState().servoTimerUsed, false); lab.dispose();
});

test('tone timers are bounded, replace the previous tone and cannot mutate after cancellation', async () => {
  const clock = fakeClock(), lab = create('esp32', clock);
  for (const value of [null, '', -1, Infinity, 3601]) await assert.rejects(lab.tone(4, 440, value), /duration/);
  await assert.rejects(lab.tone(4, 30), /frequency/);
  await lab.tone(4, 440, 3600); assert.equal([...clock.pending.values()][0].at, 3601000);
  const cancelled = clock.callbacks[0];
  await lab.tone(13, 880, 0.1); assert.equal(clock.pending.size, 1);
  assert.equal(pin(lab, 4).kind, null); cancelled(); assert.equal(pin(lab, 13).kind, 'tone');
  clock.tick(99); assert.equal(pin(lab, 13).kind, 'tone');
  clock.tick(1); assert.equal(pin(lab, 13).kind, null); assert.equal(clock.pending.size, 0);
  await lab.tone(4, 440, 0); assert.equal(clock.pending.size, 0);
  await lab.noTone(13); assert.equal(pin(lab, 4).kind, 'tone');
  await lab.noTone(4); assert.equal(pin(lab, 4).kind, null); lab.dispose();
});

test('stop clears all outputs and timers but keeps inputs; reset clears inputs too', async () => {
  const clock = fakeClock(), lab = create('esp32', clock);
  lab.setDigitalInput(34, 1); lab.setAnalogInput('39', 2800);
  await lab.digitalWrite(4, 1); await lab.analogWrite(13, 128); await lab.servoWrite(14, 90); await lab.tone(16, 440, 5);
  const cancelled = clock.callbacks[0]; await lab.stop();
  assert.equal(clock.pending.size, 0); assert.ok(lab.getState().pins.every(p => p.kind === null && p.mode === 'INPUT'));
  assert.equal(await lab.readDigital(34), 1); assert.equal(await lab.readAnalog('39'), 2800);
  await lab.digitalWrite(16, 1); cancelled(); assert.equal(pin(lab, 16).value, 1);
  lab.reset(); assert.equal(await lab.readDigital(34), 0); assert.equal(await lab.readAnalog('39'), 0); lab.dispose();
});

test('board changes and disabling cancel prior timers and reset inputs', async () => {
  const clock = fakeClock(), lab = create('arduino-uno', clock);
  lab.setDigitalInput(2, 1); await lab.tone(4, 440, 2); const old = clock.callbacks[0];
  lab.setBoard('esp32-cam'); assert.equal(clock.pending.size, 0); assert.equal(lab.getState().enabled, true);
  await lab.digitalWrite(4, 1); old(); assert.equal(pin(lab, 4).value, 1);
  assert.deepEqual(lab.getState().pins.map(p => p.pin), [4, 13, 14]);
  await lab.tone(13, 440, 1); lab.disable(); assert.equal(clock.pending.size, 0);
  await assert.rejects(lab.readDigital(4), /Enable/); lab.enable(); assert.equal(pin(lab, 4).kind, null); lab.dispose();
});

test('subscriptions return isolated snapshots, unsubscribe and dispose clean up', async () => {
  const clock = fakeClock(), lab = create('arduino-uno', clock); let calls = 0;
  const off = lab.subscribe(state => { calls++; state.pins[0].value = 999; state.analogInputs.A0 = 999; });
  const badOff = lab.subscribe(() => { throw new Error('consumer'); });
  assert.equal(calls, 1); assert.equal(pin(lab, 2).value, 0); assert.equal(await lab.readAnalog('A0'), 0);
  off(); const count = calls; await lab.digitalWrite(13, 1); assert.equal(calls, count);
  await lab.tone(4, 440, 1); const stale = clock.callbacks[0]; badOff(); lab.dispose();
  assert.equal(clock.pending.size, 0); assert.equal(lab.listeners.size, 0);
  stale(); assert.equal(lab.getState().enabled, false);
  await assert.rejects(lab.digitalWrite(13, 1), /disposed/);
  assert.throws(() => lab.enable(), /disposed/); assert.throws(() => lab.subscribe(() => {}), /disposed/);
});
