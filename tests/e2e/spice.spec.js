import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const ready=async page=>{await page.goto('./');await page.getByRole('button',{name:'Analog / SPICE',exact:true}).click();await expect(page.getByRole('button',{name:'Run circuit',exact:true})).toBeEnabled();};
const run=async page=>{await page.getByRole('button',{name:'Run circuit',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Solved',{timeout:25000});};

test('real browser ngspice solves DC/AC/transient and exports measured CSV',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);await run(page);
  await page.getByLabel('Measure',{exact:true}).selectOption({label:'v(out)'});await expect(page.locator('.spice-readout')).toContainText('2.5 V');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();const download=await downloadPromise,csv=await fs.readFile(await download.path(),'utf8');expect(csv).toContain('v(out)');expect(csv).toContain('2.5');
  await page.locator('.spice-studio').getByLabel('Start with an example').selectOption('rc');await page.getByRole('button',{name:'Load circuit',exact:true}).click();await run(page);await page.getByLabel('Measure',{exact:true}).selectOption({label:'v(out)'});
  await expect(page.getByRole('img',{name:/v\(out\) measured real trace/})).toBeVisible();
  await page.locator('.spice-studio').getByLabel('Start with an example').selectOption('filter');await page.getByRole('button',{name:'Load circuit',exact:true}).click();await run(page);await page.getByLabel('Measure',{exact:true}).selectOption({label:'v(out)'});await page.getByLabel('Display',{exact:true}).selectOption('phase');await expect(page.locator('.spice-readout')).toContainText('°');
  expect(errors).toEqual([]);
});

test('invalid netlist reports line, recovery runs and leaving cancels a pending solver',async({page})=>{
  await ready(page);await page.getByLabel('SPICE netlist',{exact:true}).fill('Test\n.include remote.cir\n.op\n.end');await page.getByRole('button',{name:'Run circuit',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Line 2');
  await page.getByRole('button',{name:'Load circuit',exact:true}).click();
  const startedWorker=page.waitForEvent('worker');await run(page);const solverUrl=(await startedWorker).url();
  // Hold the real solver worker's initial message, not its network request:
  // Chromium completes intercepted fetches when terminate() cancels a worker,
  // so a delayed route.continue() introduces a race unrelated to the app.
  await page.evaluate(solverUrl=>{
    const NativeWorker=window.Worker;
    const probe={pending:0,terminated:0,restore:()=>{window.Worker=NativeWorker;delete window.__spiceCancellationProbe;}};
    window.__spiceCancellationProbe=probe;
    window.Worker=class extends NativeWorker{
      constructor(url,options){
        super(url,options);
        if(new URL(url,location.href).href!==solverUrl)return;
        this.postMessage=()=>{probe.pending++;};
        this.terminate=()=>{probe.terminated++;super.terminate();};
      }
    };
  },solverUrl);
  await page.getByRole('button',{name:'Run circuit',exact:true}).click();
  expect(await page.evaluate(()=>window.__spiceCancellationProbe.pending)).toBe(1);
  await page.getByRole('button',{name:'Stop simulation',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Stopped');
  expect(await page.evaluate(()=>window.__spiceCancellationProbe.terminated)).toBe(1);
  await page.getByRole('button',{name:'Run circuit',exact:true}).click();
  expect(await page.evaluate(()=>window.__spiceCancellationProbe.pending)).toBe(2);
  await page.getByRole('button',{name:'Workspace',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Stopped when you left');
  expect(await page.evaluate(()=>window.__spiceCancellationProbe.terminated)).toBe(2);
  await page.evaluate(()=>window.__spiceCancellationProbe.restore());
  await page.getByRole('button',{name:'Analog / SPICE',exact:true}).click();await run(page);
});

test('tablet layout and keyboard retain usable netlist, controls and measured chart',async({page})=>{
  await page.setViewportSize({width:820,height:1180});await ready(page);await page.getByLabel('SPICE netlist',{exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByLabel('SPICE netlist',{exact:true})).not.toBeFocused();
  await run(page);await expect(page.getByRole('img',{name:/measured real trace/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
