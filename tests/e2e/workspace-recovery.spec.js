import {test, expect} from '@playwright/test';
import JSZip from 'jszip';

const navigate = (page, name) => page.locator('.sidebar').getByRole('button', {name, exact:true}).click();
const read = (page, key) => page.evaluate(key => new Promise((resolve,reject) => {
  const request=indexedDB.open('duetblox-workspace',1);
  request.onsuccess=()=>{const db=request.result;const get=db.transaction('records').objectStore('records').get(key);get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};
  request.onerror=()=>reject(request.error);
}),key);

async function openProject(page, name='Incoming project') {
  const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:5,name}));
  const buffer=await zip.generateAsync({type:'nodebuffer'});
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();
  await(await chooser).setFiles({name:'incoming.duet',mimeType:'application/zip',buffer});
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue(name);
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
}

test('opening another project creates a complete recoverable copy of unexported work',async({page})=>{
  await page.goto('./');await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Unexported circuit story');
  await navigate(page,'Circuit Lab');await page.getByRole('button',{name:'Load circuit',exact:true}).click();
  await navigate(page,'Analog / SPICE');const netlist='Recovery divider\nV1 in 0 3\nR1 in out 1k\nR2 out 0 2k\n.op\n.end';
  await page.getByLabel('SPICE netlist').fill(netlist);
  await openProject(page);
  await navigate(page,'My projects');await page.getByRole('tab',{name:'Recovery copies (1)'}).click();
  await expect(page.getByRole('heading',{name:'Unexported circuit story'})).toBeVisible();
  await page.getByRole('button',{name:'Restore copy',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Unexported circuit story');
  await navigate(page,'Circuit Lab');await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toBeVisible();
  await navigate(page,'Analog / SPICE');await expect(page.getByLabel('SPICE netlist')).toHaveValue(netlist);
  await page.reload();await expect(page.getByLabel('SPICE netlist')).toHaveValue(netlist);
  await navigate(page,'My projects');await page.getByRole('tab',{name:'Recovery copies (2)'}).click();
  await expect(page.getByRole('heading',{name:'Incoming project'})).toBeVisible();
});

test('Save updates a project, copies retain more than twelve, and trash can be restored',async({page})=>{
  await page.goto('./');const name=page.getByRole('textbox',{name:'Project name',exact:true});await name.fill('Original story');
  await page.getByRole('button',{name:'Save project',exact:true}).click();
  await expect.poll(async()=> (await read(page,'projects'))?.length).toBe(1);
  await name.fill('Edited story');await page.getByRole('button',{name:'Save project',exact:true}).click();
  await expect.poll(async()=> (await read(page,'projects'))?.[0]?.name).toBe('Edited story');
  expect((await read(page,'projects')).length).toBe(1);
  for(let index=2;index<=13;index++){
    await name.fill(`Separate story ${index}`);await page.getByRole('button',{name:'Save a copy',exact:true}).click();
    await expect.poll(async()=> (await read(page,'projects'))?.length).toBe(index);
  }
  await navigate(page,'My projects');await expect(page.getByRole('tab',{name:'Saved projects (13)'})).toBeVisible();
  await page.getByRole('button',{name:'Move Edited story to trash',exact:true}).click();
  await page.getByRole('tab',{name:'Trash (1)'}).click();await expect(page.getByRole('heading',{name:'Edited story',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore project',exact:true}).click();
  await page.getByRole('tab',{name:'Saved projects (13)'}).click();await expect(page.getByRole('heading',{name:'Edited story',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('tab',{name:'Saved projects (13)'})).toBeVisible();
});

test('workspace URLs support refresh, Back, Forward, and direct links',async({page})=>{
  await page.goto('./');await navigate(page,'Learn step by step');await expect(page).toHaveURL(/#\/learn$/);
  await navigate(page,'Circuit Lab');await expect(page).toHaveURL(/#\/circuits$/);
  await page.goBack();await expect(page.locator('.sidebar .nav-item.active')).toHaveText('Learn step by step');
  await page.goForward();await expect(page.locator('.sidebar .nav-item.active')).toHaveText('Circuit Lab');
  await page.reload();await expect(page.locator('.sidebar .nav-item.active')).toHaveText('Circuit Lab');
  await page.goto('./#/projects');await expect(page.getByRole('heading',{name:'My projects',exact:true})).toBeVisible();
});

test('the latest direct workspace link is retained while browser storage restores',async({page})=>{
  await page.addInitScript(()=>{
    window.navigationRestoreProbe={held:false,events:0};
    addEventListener('popstate',()=>{window.navigationRestoreProbe.events++;});
    const get=IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get=function(key){
      const request=get.call(this,key);
      if(key==='current-workspace')Object.defineProperty(request,'onsuccess',{configurable:true,set(fn){
        request.addEventListener('success',event=>{window.navigationRestoreProbe.held=true;window.releaseWorkspaceRestore=()=>fn.call(request,event);});
      }});
      return request;
    };
  });
  await page.goto('./#/circuits');
  await expect.poll(()=>page.evaluate(()=>window.navigationRestoreProbe.held)).toBe(true);
  await expect(page.locator('.sidebar .nav-item.active')).toHaveText('Circuit Lab');
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeDisabled();
  await page.goto('./#/learn');
  await expect.poll(()=>page.evaluate(()=>window.navigationRestoreProbe.events)).toBe(1);
  await page.goto('./#/projects');
  await expect.poll(()=>page.evaluate(()=>window.navigationRestoreProbe.events)).toBe(2);
  await page.evaluate(()=>window.releaseWorkspaceRestore());
  await expect(page.getByRole('heading',{name:'My projects',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
});

test('Help traps keyboard focus, closes on Escape and returns focus to its opener',async({page})=>{
  await page.goto('./');const opener=page.getByRole('button',{name:'Help & about',exact:true});await opener.click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  for(let index=0;index<9;index++){await page.keyboard.press(index%2?'Shift+Tab':'Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
});

test('unexported Junior edits survive replacement and recovery',async({page})=>{
  await page.goto('./');await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Junior recovery story');
  await navigate(page,'Junior Blocks');await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
  await page.getByRole('spinbutton',{name:'Move pixels',exact:true}).fill('121');
  await expect.poll(async()=> (await read(page,'current-workspace'))?.junior?.scenes[0].sprites[0].scripts[0].blocks.find(block=>block.type==='move')?.value).toBe(121);
  await page.getByRole('button',{name:'Workspace',exact:true}).click();await openProject(page);
  await navigate(page,'My projects');await page.getByRole('tab',{name:'Recovery copies (1)'}).click();await page.getByRole('button',{name:'Restore copy',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Junior recovery story');
  await navigate(page,'Junior Blocks');await expect(page.getByRole('spinbutton',{name:'Move pixels',exact:true})).toHaveValue('121');
});

test('a failed recovery write aborts opening and preserves the current workspace',async({page})=>{
  await page.goto('./');await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Keep my work');
  await expect.poll(async()=> (await read(page,'current-workspace'))?.name).toBe('Keep my work');
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='workspace-recovery')throw new DOMException('Storage full: download a copy before opening another project.','QuotaExceededError');return original.call(this,value,key);};});
  const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:5,name:'Must not replace'}));
  const buffer=await zip.generateAsync({type:'nodebuffer'}),chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();
  await(await chooser).setFiles({name:'incoming.duet',mimeType:'application/zip',buffer});
  await expect(page.locator('.toast')).toContainText('Storage full');await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Keep my work');
  expect((await read(page,'current-workspace')).name).toBe('Keep my work');
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
});

test('Save still downloads the current project if local storage is full',async({page})=>{
  await page.goto('./');await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Download my unsaved idea');
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='projects')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,value,key);};});
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
  const file=await downloading;expect(file.suggestedFilename()).toBe('Download my unsaved idea.duet');
  await expect(page.locator('.toast')).toContainText('Project downloaded, but this browser could not save it');
  expect(await read(page,'projects')).toBeUndefined();
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
});
