import {test,expect} from '@playwright/test';

const welcome=page=>page.getByRole('region',{name:'Hi, I’m Zuni!',exact:true});
const navigate=(page,name)=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
const read=(page,key)=>page.evaluate(key=>new Promise((resolve,reject)=>{
 const opening=indexedDB.open('duetblox-workspace',1);
 opening.onerror=()=>reject(opening.error);
 opening.onsuccess=()=>{
  const db=opening.result,get=db.transaction('records').objectStore('records').get(key);
  get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>{reject(get.error);db.close();};
 };
}),key);
const stageZuni=page=>page.evaluate(()=>new Promise((resolve,reject)=>{
 const frame=document.querySelector('iframe[data-duet-editor="junior"]');
 if(!frame)return reject(new Error('Junior stage is not available'));
 const requestId=crypto.randomUUID(),timer=setTimeout(()=>{removeEventListener('message',listener);reject(new Error('Junior stage did not answer'));},10000);
 function listener(event){
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.channel!=='duetblox'||event.data.requestId!==requestId)return;
  clearTimeout(timer);removeEventListener('message',listener);
  if(event.data.type==='error')return reject(new Error(event.data.payload?.message));
  const target=event.data.payload.project.targets.find(target=>!target.isStage&&target.name.includes('Zuni'));
  resolve(target?{x:target.x,y:target.y,costume:target.currentCostume,costumeName:target.costumes[target.currentCostume]?.name,visible:target.visible}:null);
 }
 addEventListener('message',listener);frame.contentWindow.postMessage({channel:'duetblox',requestId,type:'getProject',payload:{}},location.origin);
}));

for(const viewport of [{width:1366,height:768},{width:768,height:1024},{width:375,height:812}]){
 test(`home Zuni artwork and keyboard action fit at ${viewport.width}px with reduced motion`,async({page},info)=>{
  await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./#/home');await page.evaluate(()=>document.fonts.ready);
  const panel=welcome(page),art=panel.getByRole('img',{name:'Zuni waving hello',exact:true});
  await expect(panel.getByRole('heading',{name:'Hi, I’m Zuni!',exact:true})).toBeVisible();
  await expect(art).toBeVisible();
  await expect.poll(()=>art.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  const imageBounds=await art.boundingBox();expect(imageBounds.width).toBeGreaterThan(80);expect(imageBounds.height).toBeGreaterThan(80);
  const action=panel.getByRole('button',{name:'Create with Zuni',exact:true});
  await expect(action).toBeEnabled();await action.focus();await expect(action).toBeFocused();
  await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(action).toBeFocused();
  const bounds=await action.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await panel.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await expect.poll(()=>panel.evaluate(element=>element.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  await expect(panel).toContainText('Your current work gets a recovery copy.');
  await page.screenshot({path:info.outputPath(`zuni-welcome-${viewport.width}.png`),fullPage:true});
 });
}

test('Create with Zuni runs a real costume story and preserves earlier work across home visits and recovery',async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('./#/home');
 await page.getByLabel('Project name',{exact:true}).fill('Keep my earlier invention');
 await navigate(page,'Circuit Lab');await page.getByRole('button',{name:'Load circuit',exact:true}).click();
 await navigate(page,'Junior Blocks');
 await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
 await page.getByLabel('Junior project title',{exact:true}).fill('My original Fox story');
 await page.getByRole('spinbutton',{name:'Move pixels',exact:true}).fill('121');
 await page.getByRole('button',{name:'Workspace',exact:true}).click();
 await expect.poll(async()=>(await read(page,'current-workspace'))?.junior.title).toBe('My original Fox story');
 await expect.poll(async()=>(await read(page,'current-workspace'))?.junior.scenes[0].sprites[0].scripts[0].blocks.find(block=>block.type==='move')?.value).toBe(121);
 const original=await read(page,'current-workspace');
 const recoveries=(await read(page,'workspace-recovery'))||[];
 // Merely seeing the welcome, revisiting home, or reloading cannot start a lesson.
 await expect(welcome(page)).toBeVisible();
 await navigate(page,'Learn step by step');await navigate(page,'Workspace');await page.reload();
 await expect(welcome(page).getByRole('button',{name:'Create with Zuni',exact:true})).toBeEnabled();
 expect((await read(page,'current-workspace')).junior).toEqual(original.junior);
 expect((await read(page,'current-workspace')).circuit).toEqual(original.circuit);
 expect((await read(page,'workspace-recovery'))||[]).toEqual(recoveries);
 const action=welcome(page).getByRole('button',{name:'Create with Zuni',exact:true});
 await action.focus();await page.keyboard.press('Enter');
 await expect(page.getByLabel('Junior project title',{exact:true})).toHaveValue('Hello from Zuni');
 await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
 await expect.poll(()=>stageZuni(page)).toEqual({x:0,y:-38,costume:0,costumeName:'Hello',visible:true});
 await expect.poll(async()=>((await read(page,'workspace-recovery'))||[]).length).toBe(recoveries.length+1);
 const current=await read(page,'current-workspace');
 expect(current.name).toBe('Keep my earlier invention');expect(current.circuit).toEqual(original.circuit);
 for(let run=0;run<2;run++){
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  // The greeting holds Hello for two seconds. Observe this reset on replay,
  // rather than accepting the previous run's Cheer pose as a fresh result.
  await expect.poll(()=>stageZuni(page),{intervals:[100]}).toEqual({x:40,y:-38,costume:0,costumeName:'Hello',visible:true});
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect.poll(()=>stageZuni(page)).toEqual({x:40,y:-38,costume:4,costumeName:'Cheer',visible:true});
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled();
 }
 await page.screenshot({path:info.outputPath('zuni-welcome-story-ran.png'),fullPage:true});
 await page.getByRole('button',{name:'Workspace',exact:true}).click();await navigate(page,'My projects');
 await page.getByRole('tab',{name:'Recovery copies (1)',exact:true}).click();
 await page.getByRole('button',{name:'Restore copy',exact:true}).click();
 await navigate(page,'Junior Blocks');
 await expect(page.getByLabel('Junior project title',{exact:true})).toHaveValue('My original Fox story');
 await expect(page.getByRole('spinbutton',{name:'Move pixels',exact:true})).toHaveValue('121');
 await page.getByRole('button',{name:'Workspace',exact:true}).click();await navigate(page,'Circuit Lab');
 await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('a failed recovery prevents the Zuni welcome action from replacing the current story',async({page})=>{
 await page.goto('./#/home');await page.getByLabel('Project name',{exact:true}).fill('Keep my unsaved idea');
 await expect.poll(async()=>(await read(page,'current-workspace'))?.name).toBe('Keep my unsaved idea');
 const original=await read(page,'current-workspace');
 await page.evaluate(()=>{
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,key){
   if(['workspace-recovery','projects'].includes(key))throw new DOMException('Test full storage','QuotaExceededError');
   return put.call(this,value,key);
  };
 });
 await welcome(page).getByRole('button',{name:'Create with Zuni',exact:true}).click();
 await expect(page.locator('.toast')).toContainText('Nothing was opened',{ignoreCase:true});
 await expect(welcome(page)).toBeVisible();await expect(page.locator('.workspace-save-warning')).toBeVisible();
 expect((await read(page,'current-workspace')).junior).toEqual(original.junior);
 expect((await read(page,'current-workspace')).name).toBe('Keep my unsaved idea');
});
