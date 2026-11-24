import {test, expect} from '@playwright/test';

// Fail only the next worker started by the Run action. The replacement never
// requests a network resource; subsequent attempts execute the real solver.
async function prepare(page, failures = 1) {
  await page.goto('./');
  await page.locator('.sidebar').getByRole('button', {name: 'Analog / SPICE', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Run circuit', exact: true})).toBeEnabled();
  await page.evaluate(failures => {
    const NativeWorker = window.Worker;
    const probe = {created: 0, failures, terminated: 0};
    window.__spiceStartupProbe = probe;
    window.Worker = class {
      constructor(url, options) {
        probe.created++;
        if (!probe.failures) return new NativeWorker(url, options);
        probe.failures--;
        let terminated = false;
        const worker = {
          postMessage() { queueMicrotask(() => { if (!terminated) worker.onerror?.({message: 'Injected startup download interruption', preventDefault() {}}); }); },
          terminate() { terminated = true; probe.terminated++; }
        };
        return worker;
      }
    };
  }, failures);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
}
const run = page => page.getByRole('button', {name: 'Run circuit', exact: true}).click();
const state = page => page.locator('.spice-status');

test('one startup interruption retries and then runs the real ngspice solver', async ({page}) => {
  await prepare(page); await run(page);
  await expect(state(page)).toContainText('Retrying once');
  await page.clock.runFor(300);
  await expect(state(page)).toContainText('Solved', {timeout: 25000});
  expect(await page.evaluate(() => window.__spiceStartupProbe.created)).toBe(2);
  await page.getByLabel('Measure', {exact: true}).selectOption({label: 'v(out)'});
  await expect(page.locator('.spice-readout')).toContainText('2.5 V');
});

test('Stop and leaving the workspace cancel a scheduled startup retry', async ({page}) => {
  await prepare(page); await run(page); await expect(state(page)).toContainText('Retrying once');
  await page.getByRole('button', {name: 'Stop simulation', exact: true}).click();
  await page.clock.runFor(300); await expect(state(page)).toContainText('Stopped');
  expect(await page.evaluate(() => window.__spiceStartupProbe.created)).toBe(1);
  await page.evaluate(() => { window.__spiceStartupProbe.failures = 1; });
  await run(page); await expect(state(page)).toContainText('Retrying once');
  await page.locator('.sidebar').getByRole('button', {name: 'Workspace', exact: true}).click();
  await page.clock.runFor(300);
  expect(await page.evaluate(() => window.__spiceStartupProbe.created)).toBe(2);
  await expect(state(page)).toContainText('Stopped when you left');
  await page.locator('.sidebar').getByRole('button', {name: 'Analog / SPICE', exact: true}).click();
  await run(page); await expect(state(page)).toContainText('Solved', {timeout: 25000});
});

test('two startup failures show loading guidance, preserve the circuit and allow a manual rerun', async ({page}) => {
  await prepare(page, 2); const circuit = await page.getByLabel('SPICE netlist', {exact: true}).inputValue();
  await run(page); await page.clock.runFor(300);
  await expect(state(page)).toContainText('Solver unavailable');
  await expect(state(page)).toContainText('connection or offline pack');
  await page.clock.runFor(3000);
  expect(await page.evaluate(() => window.__spiceStartupProbe.created)).toBe(2);
  await expect(page.getByLabel('SPICE netlist', {exact: true})).toHaveValue(circuit);
  await run(page); await expect(state(page)).toContainText('Solved', {timeout: 25000});
});
