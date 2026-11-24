import {test,expect} from '@playwright/test';
import path from 'node:path';

async function open(page){await page.routeWebSocket('**',()=>{});await page.goto('./');await page.locator('.sidebar').getByRole('button',{name:'Circuit Lab',exact:true}).click();}
async function loadStarter(page,name='led'){await page.getByLabel('Starter circuit',{exact:true}).selectOption(name);await page.getByRole('button',{name:'Load circuit',exact:true}).click();}

test('real wiring controls LED current; disconnected wire turns it off and Undo restores it',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await loadStarter(page);
 await page.getByRole('button',{name:'Enable virtual board',exact:true}).click();await expect(page.getByRole('button',{name:'HIGH',exact:true})).toBeEnabled({timeout:60000});
 await page.getByRole('button',{name:'HIGH',exact:true}).click();await expect(page.locator('.circuit-canvas:visible')).toContainText('ON · 12.2 mA');
 await page.locator('.circuit-connections:visible summary').click();await page.getByRole('button',{name:'Delete wire led1:cathode to board:GND',exact:true}).click();
 await expect(page.locator('.circuit-canvas:visible')).toContainText('OFF · 0.0 mA');await page.getByRole('button',{name:'Undo circuit change',exact:true}).click();await expect(page.locator('.circuit-canvas:visible')).toContainText('ON · 12.2 mA');
 await page.getByRole('button',{name:'LOW',exact:true}).click();await expect(page.locator('.circuit-canvas:visible')).toContainText('OFF · 0.0 mA');expect(errors).toEqual([]);
});

test('both Uno and ESP32 circuit wiring survive board switches, workspace download and reload',async({page})=>{
 await open(page);await loadStarter(page);await page.getByLabel('Circuit board',{exact:true}).selectOption('esp32');await loadStarter(page,'pot');
 await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:D32',exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();await download;
 await page.reload();await page.locator('.sidebar').getByRole('button',{name:'Circuit Lab',exact:true}).click();await expect(page.getByLabel('Circuit board',{exact:true})).toHaveValue('esp32');
 await page.getByLabel('Circuit board',{exact:true}).selectOption('arduino-uno');await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
 await page.getByLabel('Circuit board',{exact:true}).selectOption('esp32');await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:D32',exact:true})).toBeVisible();
});

test('actual Uno HEX executes CPU steps and pauses without freezing the UI',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await loadStarter(page);
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Load Uno HEX',exact:true}).click();await(await chooser).setFiles(path.resolve('src/circuits/fixtures/uno-blink.hex'));
 await expect(page.getByRole('button',{name:'Step CPU',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Step CPU',exact:true}).click();
 await expect(page.locator('.circuit-cpu-status')).not.toContainText('· 0 CPU cycles');await expect(page.locator('.circuit-firmware-readings')).toContainText('ON');
 await page.getByRole('button',{name:'Run firmware',exact:true}).click();await expect(page.locator('.circuit-cpu-status')).toContainText('Running');await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('.circuit-cpu-status')).toContainText('Paused');
 await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(page.locator('.circuit-cpu-status')).toContainText('0 CPU cycles');
 await page.screenshot({path:info.outputPath('uno-firmware.png'),fullPage:true});await page.locator('.sidebar').getByRole('button',{name:'Workspace',exact:true}).click();await expect(page.getByRole('heading',{name:'What will you create today?'})).toBeVisible();expect(errors).toEqual([]);
});

test('wired GPIO snapshot exports a real netlist that ngspice solves',async({page})=>{
 await open(page);await loadStarter(page);await page.getByRole('button',{name:'Enable virtual board',exact:true}).click();await expect(page.getByRole('button',{name:'HIGH',exact:true})).toBeEnabled({timeout:60000});await page.getByRole('button',{name:'HIGH',exact:true}).click();
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export static SPICE snapshot',exact:true}).click();const file=await downloaded;
 const fs=await import('node:fs/promises'),netlist=await fs.readFile(await file.path(),'utf8'),pinNode=netlist.match(/\* board D13 = (\w+)/)[1];
 await page.locator('.sidebar').getByRole('button',{name:'Analog / SPICE',exact:true}).click();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open netlist',exact:true}).click();await(await chooser).setFiles({name:'Wired LED.cir',mimeType:'text/plain',buffer:Buffer.from(netlist)});
 await page.getByRole('button',{name:'Run circuit',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Solved');await page.getByLabel('Measure',{exact:true}).selectOption({label:`v(${pinNode})`});
 const voltage=Number(await page.locator('.spice-readout strong').nth(1).innerText().then(text=>text.replace(' V','')));expect(voltage).toBeGreaterThan(4.6);expect(voltage).toBeLessThan(4.8);
});
