import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';

const costumeNames=['Hello','Walk A','Walk B','Jump','Cheer','Think'];
const nav=async(page,name)=>{
 await expect(page.locator('.workspace-switch-status')).toHaveCount(0);
 if(await page.getByRole('region',{name:'Junior coding editor',exact:true}).isVisible())await page.getByRole('button',{name:'Workspace',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
};
const rpc=(page,editor,type)=>page.evaluate(({editor,type})=>new Promise((resolve,reject)=>{
 const frame=document.querySelector(`iframe[data-duet-editor="${editor}"]`);
 if(!frame)return reject(new Error(`${editor} editor is missing`));
 const requestId=crypto.randomUUID();
 const timer=setTimeout(()=>{removeEventListener('message',listener);reject(new Error('Editor did not answer'));},15000);
 function listener(event){
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.channel!=='duetblox'||event.data.requestId!==requestId)return;
  clearTimeout(timer);removeEventListener('message',listener);
  event.data.type==='error'?reject(new Error(event.data.payload?.message)):resolve(event.data.payload);
 }
 addEventListener('message',listener);frame.contentWindow.postMessage({channel:'duetblox',requestId,type,payload:{}},location.origin);
}),{editor,type});
const zuni=async(page,editor)=>(await rpc(page,editor,'getProject')).project.targets.find(target=>!target.isStage&&target.name.includes('Zuni'));
const currentCostume=async(page,editor)=>{const target=await zuni(page,editor);return target?.costumes[target.currentCostume]?.name;};
async function saveWorkspace(page){
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
 return readFile(await(await downloaded).path());
}
async function openFile(page,name,buffer){
 const chooser=page.waitForEvent('filechooser');
 if(await page.getByRole('region',{name:'Junior coding editor',exact:true}).isVisible()){
  await page.locator('.junior-explore summary').click();
  await page.getByRole('button',{name:'Open project',exact:true}).click();
 }else await page.getByRole('button',{name:'Open',exact:true}).click();
 await(await chooser).setFiles({name,mimeType:'application/zip',buffer});
}
async function checkArchiveCostumes(bytes){
 const zip=await JSZip.loadAsync(bytes),project=JSON.parse(await zip.file('project.json').async('string'));
 const target=project.targets.find(target=>!target.isStage&&target.name==='Zuni');
 expect(target.costumes.map(costume=>costume.name)).toEqual(costumeNames);
 expect(new Set(target.costumes.map(costume=>costume.assetId)).size).toBe(6);
 for(const costume of target.costumes){
  const asset=zip.file(costume.md5ext);expect(asset,`Saved asset ${costume.name}`).not.toBeNull();
  const data=await asset.async('nodebuffer');expect(data.length).toBeGreaterThan(100);
  expect(createHash('md5').update(data).digest('hex')).toBe(costume.assetId);
 }
 return {zip,project,target};
}

test('Junior Zuni has six named costumes, programmable changes, independent scripts and project recovery',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('./#/junior');
 await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
 await page.getByRole('button',{name:'Add character',exact:true}).click();
 await page.locator('.junior-character-picker').getByRole('button',{name:'Zuni',exact:true}).click();
 const characters=page.locator('.junior-characters');
 await expect(characters.getByRole('button',{name:'Zuni',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Junior project title',{exact:true}).fill('Zuni costume story');
 await page.locator('.junior-properties summary').click();
 const starting=page.getByRole('combobox',{name:'Starting costume',exact:true});
 await expect(starting.locator('option')).toHaveText(costumeNames);
 await starting.selectOption({label:'Think'});
 await page.locator('.junior-properties summary').click();
 await expect.poll(()=>currentCostume(page,'junior')).toBe('Think');
 expect((await zuni(page,'junior')).costumes.map(costume=>costume.name)).toEqual(costumeNames);
 await page.getByRole('tab',{name:/Looks/}).click();
 await page.getByRole('button',{name:'Add Costume block',exact:true}).click();
 await page.getByRole('combobox',{name:'Costume choice',exact:true}).selectOption({label:'Walk A'});
 await page.getByRole('tab',{name:/Control/}).click();
 await page.getByRole('button',{name:'Add Wait block',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Wait seconds',exact:true}).fill('1.5');
 await page.getByRole('tab',{name:/Looks/}).click();
 await page.getByRole('button',{name:'Add Next costume block',exact:true}).click();
 await page.getByRole('tab',{name:/Control/}).click();
 await page.getByRole('button',{name:'Add Wait block',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Wait seconds',exact:true}).last().fill('1.5');
 await page.getByRole('tab',{name:/Looks/}).click();
 await page.getByRole('button',{name:'Add Costume block',exact:true}).click();
 await page.getByRole('combobox',{name:'Costume choice',exact:true}).last().selectOption({label:'Cheer'});
 await characters.getByRole('button',{name:'Fox',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Costume choice',exact:true})).toHaveCount(0);
 await characters.getByRole('button',{name:'Zuni',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Costume choice',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Play story',exact:true}).click();
 await expect.poll(()=>currentCostume(page,'junior'),{intervals:[100]}).toBe('Walk A');
 await expect.poll(()=>currentCostume(page,'junior'),{intervals:[100]}).toBe('Walk B');
 await expect.poll(()=>currentCostume(page,'junior'),{intervals:[100]}).toBe('Cheer');
 await expect(page.locator('.junior-run-caption')).toHaveText('Ready');
 expect((await zuni(page,'junior')).visible).toBe(true);
 await page.frameLocator('iframe[data-duet-editor="junior"]').locator('canvas').screenshot({path:info.outputPath('junior-zuni-cheer.png')});
 const saved=await saveWorkspace(page);
 await page.locator('.junior-properties summary').click();await starting.selectOption({label:'Hello'});
 await openFile(page,'Zuni costume story.duet',saved);
 await expect(page.getByRole('heading',{name:'What will you create today?'})).toBeVisible();
 await nav(page,'Junior Blocks');
 await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
 await expect(page.getByLabel('Junior project title',{exact:true})).toHaveValue('Zuni costume story');
 await page.locator('.junior-properties summary').click();
 await expect(starting.locator('option')).toHaveText(costumeNames);await expect(starting).toHaveValue('5');
 await page.locator('.junior-properties summary').click();
 await expect(page.getByRole('combobox',{name:'Costume choice',exact:true}).first()).toHaveValue('builtin:walk-a');
 await expect(page.getByRole('combobox',{name:'Costume choice',exact:true}).last()).toHaveValue('builtin:cheer');
 // Story controls restore before the queued Scratch stage load has completed.
 await expect.poll(async()=>(await zuni(page,'junior'))?.costumes.map(costume=>costume.name)).toEqual(costumeNames);
 await page.getByRole('button',{name:'Play story',exact:true}).click();
 await expect.poll(()=>currentCostume(page,'junior')).toBe('Cheer');
 expect(errors).toEqual([]);
});

test('official Blocks picker adds Zuni and real Looks programs survive an sb3 round-trip',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('./#/blocks');await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
 const frame=page.frameLocator('iframe[data-duet-editor="normal"]');
 await frame.getByRole('button',{name:'Choose a Sprite',exact:true}).first().click();
 await frame.getByPlaceholder('Search',{exact:true}).fill('Zuni');
 await frame.getByRole('button',{name:'Zuni',exact:true}).click();
 await expect.poll(async()=>(await zuni(page,'normal'))?.costumes.map(costume=>costume.name)).toEqual(costumeNames);
 await expect.poll(()=>currentCostume(page,'normal')).toBe('Hello');
 const addedWorkspace=await JSZip.loadAsync(await saveWorkspace(page));
 const {zip,project,target}=await checkArchiveCostumes(await addedWorkspace.file('project.sb3').async('nodebuffer'));
 // Add a standard Scratch program to the archive exported from the real picker.
 // Its six assets remain the exact files the student added; no VM is mocked.
 target.blocks={
  flag:{opcode:'event_whenflagclicked',next:'walk',parent:null,inputs:{},fields:{},shadow:false,topLevel:true,x:40,y:40},
  walk:{opcode:'looks_switchcostumeto',next:'waitA',parent:'flag',inputs:{COSTUME:[1,'walkName']},fields:{},shadow:false,topLevel:false},
  walkName:{opcode:'looks_costume',next:null,parent:'walk',inputs:{},fields:{COSTUME:['Walk A',null]},shadow:true,topLevel:false},
  waitA:{opcode:'control_wait',next:'next',parent:'walk',inputs:{DURATION:[1,[4,'1.5']]},fields:{},shadow:false,topLevel:false},
  next:{opcode:'looks_nextcostume',next:'waitB',parent:'waitA',inputs:{},fields:{},shadow:false,topLevel:false},
  waitB:{opcode:'control_wait',next:'cheer',parent:'next',inputs:{DURATION:[1,[4,'1.5']]},fields:{},shadow:false,topLevel:false},
  cheer:{opcode:'looks_switchcostumeto',next:null,parent:'waitB',inputs:{COSTUME:[1,'cheerName']},fields:{},shadow:false,topLevel:false},
  cheerName:{opcode:'looks_costume',next:null,parent:'cheer',inputs:{},fields:{COSTUME:['Cheer',null]},shadow:true,topLevel:false}
 };
 zip.file('project.json',JSON.stringify(project));
 await openFile(page,'Zuni Looks.sb3',await zip.generateAsync({type:'nodebuffer'}));
 await expect(page.locator('.toast')).toContainText('Scratch project opened');
 await page.getByRole('button',{name:'Run',exact:true}).click();
 await expect.poll(()=>currentCostume(page,'normal'),{intervals:[100]}).toBe('Walk A');
 await expect.poll(()=>currentCostume(page,'normal'),{intervals:[100]}).toBe('Walk B');
 await expect.poll(()=>currentCostume(page,'normal'),{intervals:[100]}).toBe('Cheer');
 expect((await zuni(page,'normal')).visible).toBe(true);
 await page.screenshot({path:info.outputPath('blocks-zuni-costumes.png'),fullPage:true});
 const completedWorkspace=await JSZip.loadAsync(await saveWorkspace(page));
 const finalBytes=await completedWorkspace.file('project.sb3').async('nodebuffer');
 expect((await checkArchiveCostumes(finalBytes)).target.currentCostume).toBe(4);
 await openFile(page,'Zuni restored.sb3',finalBytes);
 await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Zuni restored');
 await expect.poll(()=>currentCostume(page,'normal')).toBe('Cheer');
 await page.getByRole('button',{name:'Run',exact:true}).click();
 await expect.poll(()=>currentCostume(page,'normal'),{intervals:[100]}).toBe('Walk A');
 await expect.poll(()=>currentCostume(page,'normal')).toBe('Cheer');
 expect((await zuni(page,'normal')).costumes.map(costume=>costume.name)).toEqual(costumeNames);
 expect(errors).toEqual([]);
});
