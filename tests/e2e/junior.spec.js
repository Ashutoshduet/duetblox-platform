import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {makeJuniorProject,makeJuniorScript,makeJuniorBlock} from '../../src/junior/model.js';

const navigate=(page,name)=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
const piece=(type,patch={})=>({...makeJuniorBlock(type),...patch});
function parallelStory(){
  const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];
  project.title='Parallel classroom story';sprite.x=0;sprite.y=0;sprite.size=100;
  sprite.scripts[0].blocks=[piece('wait',{value:3}),piece('move',{value:30})];
  sprite.scripts.push({...makeJuniorScript('flag'),blocks:[piece('grow',{value:10})]});
  return project;
}
async function importStory(page,project){
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open story',exact:true}).click();
  await(await chooser).setFiles({name:'parallel.junior.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByRole('textbox',{name:'Junior project title',exact:true})).toHaveValue(project.title);
}
async function stageProject(page){
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const frame=document.querySelector('iframe[data-duet-editor="junior"]'),requestId=`verify-${crypto.randomUUID()}`;
    const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('No VM project response'));},5000);
    function listener(event){if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.channel!=='duetblox'||event.data.requestId!==requestId)return;clearTimeout(timer);window.removeEventListener('message',listener);if(event.data.type==='error')reject(new Error(event.data.payload?.message));else resolve(event.data.payload.project);}
    window.addEventListener('message',listener);frame.contentWindow.postMessage({channel:'duetblox',requestId,type:'getProject'},location.origin);
  }));
}
async function storedJunior(page){
  return page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('duetblox-workspace',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('records').objectStore('records').get('current-workspace');read.onsuccess=()=>{db.close();resolve(read.result?.junior);};read.onerror=()=>{db.close();reject(read.error);};};}));
}

test('full App Junior has directly editable parallel stacks, saved positions and concurrent flag execution',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');await navigate(page,'Junior Blocks');
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
  await importStory(page,parallelStory());
  const stacks=page.locator('.junior-canvas-stack');await expect(stacks).toHaveCount(2);
  await stacks.nth(1).getByRole('spinbutton',{name:'Grow percent',exact:true}).fill('20');
  await stacks.nth(0).getByRole('spinbutton',{name:'Move pixels',exact:true}).fill('31');
  await expect(stacks.nth(1).getByRole('spinbutton',{name:'Grow percent',exact:true})).toHaveValue('20');
  const handle=page.getByRole('button',{name:'Move script 1',exact:true}),box=await handle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+20);await page.mouse.down();await page.mouse.move(box.x+box.width/2+85,box.y+65,{steps:12});await page.mouse.up();
  await expect(stacks.nth(0)).toHaveCSS('left','97px');await expect(stacks.nth(0)).toHaveCSS('top','57px');
  await handle.focus();await page.keyboard.press('ArrowRight');
  await expect(stacks.nth(0)).toHaveCSS('left','107px');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  // The second flag stack grows immediately while the first is still waiting.
  await expect.poll(async()=>{const sprite=(await stageProject(page)).targets.find(t=>!t.isStage);return {x:Math.round(sprite.x),size:Math.round(sprite.size)};}).toEqual({x:0,size:120});
  await expect.poll(async()=>Math.round((await stageProject(page)).targets.find(t=>!t.isStage).x)).toBe(31);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save story',exact:true}).click();
  const saved=JSON.parse(await readFile(await(await downloadEvent).path(),'utf8'));
  expect(saved.scenes[0].sprites[0].scripts[0].canvas).toEqual({x:107,y:57});
  const archiveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
  const archive=await JSZip.loadAsync(await readFile(await(await archiveEvent).path()));
  const manifest=JSON.parse(await archive.file('duetblox.json').async('string'));
  expect(manifest.junior.scenes[0].sprites[0].scripts[0].canvas).toEqual({x:107,y:57});
  await expect.poll(async()=>(await storedJunior(page))?.scenes[0].sprites[0].scripts[0].canvas).toEqual({x:107,y:57});
  await page.reload();await navigate(page,'Junior Blocks');
  await expect(stacks).toHaveCount(2);await expect(stacks.nth(0)).toHaveCSS('left','107px');
  await expect(stacks.nth(0).getByRole('spinbutton',{name:'Move pixels',exact:true})).toHaveValue('31');
  await importStory(page,saved);await expect(stacks.nth(0)).toHaveCSS('top','57px');
  await expect.poll(async()=>(await stageProject(page)).targets.find(t=>!t.isStage)?.name).toContain('Fox');
  await page.screenshot({path:info.outputPath('junior-full-app.png'),fullPage:true});
  await navigate(page,'Workspace');await navigate(page,'Junior Blocks');
  await expect(stacks).toHaveCount(2);expect(errors).toEqual([]);
});
