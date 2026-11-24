import {test,expect} from '@playwright/test';
import JSZip from 'jszip';
import fs from 'node:fs/promises';

const navigate=(page,name)=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
async function open(page){await page.goto('./');await expect(page.getByRole('heading',{name:'What will you create today?'})).toBeVisible();}

test('wired circuit and SPICE source survive download, replacement, import and reload',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page);
 await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Circuit classroom');
 await navigate(page,'Circuit Lab');await page.getByRole('button',{name:'Load circuit',exact:true}).click();
 await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
 await navigate(page,'Analog / SPICE');const netlist='Saved classroom divider\nV1 supply 0 9\nR1 supply out 2k\nR2 out 0 1k\n.op\n.end';
 await page.getByLabel('SPICE netlist').fill(netlist);
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();const download=await downloadEvent;
 const bytes=await fs.readFile(await download.path());const zip=await JSZip.loadAsync(bytes);const manifest=JSON.parse(await zip.file('duetblox.json').async('string'));
 expect(manifest.version).toBe(5);expect(manifest.circuit.wires).toHaveLength(3);expect(manifest.spice.netlist).toBe(netlist);
 await page.getByLabel('SPICE netlist').fill('Replacement draft');await navigate(page,'Circuit Lab');
 await page.getByLabel('Starter circuit').selectOption('blank');await page.getByRole('button',{name:'Load circuit',exact:true}).click();
 await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toHaveCount(0);
 const chooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();const chooser=await chooserEvent;
 await chooser.setFiles({name:'classroom.duet',mimeType:'application/zip',buffer:bytes});
 await expect(page.getByRole('heading',{name:'What will you create today?'})).toBeVisible();
 await navigate(page,'Circuit Lab');await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
 await navigate(page,'Analog / SPICE');await expect(page.getByLabel('SPICE netlist')).toHaveValue(netlist);
 await page.reload();await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Circuit classroom');
 await navigate(page,'Analog / SPICE');await expect(page.getByLabel('SPICE netlist')).toHaveValue(netlist);expect(errors).toEqual([]);
});

test('invalid imported circuit preserves the existing project and remains editable',async({page})=>{
 await open(page);await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Keep this work');
 const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:5,name:'Should never replace',circuit:{kind:'duetblox-circuit',version:1,boardId:'arduino-uno',components:[],wires:[{id:'bad',from:'board:D13',to:'missing:pin'}]}}));
 const bytes=await zip.generateAsync({type:'nodebuffer'}),chooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();await(await chooserEvent).setFiles({name:'invalid.duet',mimeType:'application/zip',buffer:bytes});
 await expect(page.locator('.toast')).toContainText('pin that does not exist');await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Keep this work');await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
});

test('normal Blocks executes an example, stops, and keeps circuit data when saving its autosave',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page);
 await navigate(page,'Circuit Lab');await page.getByRole('button',{name:'Load circuit',exact:true}).click();
 await navigate(page,'Blocks');await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
 await page.getByRole('button',{name:'Add an example',exact:true}).click();await page.getByRole('button',{name:/Animate a sprite/}).click();
 await expect(page.locator('.toast')).toContainText('added as a separate sprite');await page.getByRole('button',{name:'Run',exact:true}).click();
 await expect(page.locator('.studio-destination')).toContainText('Running');await page.getByRole('button',{name:'Stop',exact:true}).click();
 await expect(page.locator('.studio-destination')).toContainText('Browser workspace');await navigate(page,'Circuit Lab');
 await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
 await page.reload();await navigate(page,'Circuit Lab');await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();expect(errors).toEqual([]);
});


test('empty board workspace gains matching wiring when a hardware example is added',async({page})=>{
 await open(page);await navigate(page,'Blocks');await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
 await page.getByRole('button',{name:'Add an example',exact:true}).click();await page.getByRole('button',{name:/Blink an LED/}).click();
 await expect(page.locator('.toast')).toContainText('added as a separate sprite');await page.getByRole('button',{name:'Try virtual board',exact:true}).click();
 await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Run',exact:true}).click();await expect(page.locator('.circuit-canvas:visible')).toContainText('ON · 12.2 mA');
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('.circuit-canvas:visible')).toContainText('OFF · 0.0 mA');
});
