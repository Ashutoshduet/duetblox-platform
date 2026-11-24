import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const hexPath=new URL('../../src/circuits/fixtures/uno-blink.hex',import.meta.url);
const choose=async(page,file)=>{const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Load Uno HEX',exact:true}).click();await(await chooser).setFiles(file);};

async function prepare(page){
  await page.addInitScript(()=>{
    if(window!==window.top)return;
    window.__workerRecords=[];
    const OriginalWorker=window.Worker;
    window.Worker=class extends OriginalWorker{
      constructor(url,options){super(url,options);this.record={url:String(url),terminated:false};window.__workerRecords.push(this.record);}
      terminate(){this.record.terminated=true;return super.terminate();}
    };
    const read=File.prototype.text;
    File.prototype.text=async function(){const text=await read.call(this);if(this.name.startsWith('delayed-'))return new Promise(resolve=>{window.__releaseFile=()=>resolve(text);});return text;};
  });
  await page.goto('./');await page.locator('.sidebar').getByRole('button',{name:'Circuit Lab',exact:true}).click();
}
const release=page=>page.evaluate(async()=>{window.__releaseFile();await new Promise(requestAnimationFrame);});

test('leaving during a pending Uno file read cannot create an orphan worker',async({page})=>{
  await prepare(page);
  await choose(page,{name:'delayed-uno.hex',mimeType:'text/plain',buffer:await fs.readFile(hexPath)});
  await page.waitForFunction(()=>typeof window.__releaseFile==='function');
  await page.locator('.sidebar').getByRole('button',{name:'Workspace',exact:true}).click();
  const count=await page.evaluate(()=>window.__workerRecords.length);await release(page);
  expect(await page.evaluate(()=>window.__workerRecords.length)).toBe(count);
  expect(await page.evaluate(()=>window.__workerRecords.filter(worker=>!worker.terminated).length)).toBe(0);
  await page.locator('.sidebar').getByRole('button',{name:'Circuit Lab',exact:true}).click();
  await expect(page.getByRole('button',{name:'Step CPU',exact:true})).toBeDisabled();
  await choose(page,{name:'working-uno.hex',mimeType:'text/plain',buffer:await fs.readFile(hexPath)});
  await expect(page.getByRole('button',{name:'Step CPU',exact:true})).toBeEnabled();
});

test('a late older Uno file cannot replace newer firmware and malformed input stays visible',async({page})=>{
  await prepare(page);const buffer=await fs.readFile(hexPath);
  await choose(page,{name:'delayed-old.hex',mimeType:'text/plain',buffer});await page.waitForFunction(()=>typeof window.__releaseFile==='function');
  await choose(page,{name:'latest-uno.hex',mimeType:'text/plain',buffer});await expect(page.locator('.circuit-cpu-status')).toContainText('latest-uno.hex');
  await release(page);await expect(page.locator('.circuit-cpu-status')).toContainText('latest-uno.hex');
  expect(await page.evaluate(()=>window.__workerRecords.filter(worker=>!worker.terminated).length)).toBe(1);
  await choose(page,{name:'invalid.hex',mimeType:'text/plain',buffer:Buffer.from(':00000001FE\n')});await expect(page.getByRole('alert')).toContainText(/checksum|HEX/i);
  await expect(page.locator('.circuit-cpu-status')).toContainText('latest-uno.hex');
});
