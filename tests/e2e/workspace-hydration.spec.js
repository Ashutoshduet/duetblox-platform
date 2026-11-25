import {test,expect} from '@playwright/test';
import JSZip from 'jszip';

// Fault injection is confined to a new Playwright context for each test.
async function read(page,key) {
  return page.evaluate(key=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('duetblox-workspace',1);
    request.onsuccess=()=>{
      const db=request.result,store=db.transaction('records').objectStore('records');
      const get=window.__hydrationNativeGet?window.__hydrationNativeGet.call(store,key):store.get(key);
      get.onsuccess=()=>{const value=get.result;resolve(Array.isArray(value)?value.map(({blob,...record})=>({...record,blobSize:blob?.size})):value);db.close();};
      get.onerror=()=>reject(get.error);
    };request.onerror=()=>reject(request.error);
  }),key);
}

async function seedWorkspace(page) {
  await page.goto('./');await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Saved original project');
  await page.getByRole('button',{name:'Save project',exact:true}).click();
  await expect.poll(async()=>(await read(page,'projects'))?.length).toBe(1);
  const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:5,name:'Current unexported project'}));
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();
  await(await chooser).setFiles({name:'incoming.duet',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Current unexported project');
  await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Current idea with local edits');
  await expect.poll(async()=>(await read(page,'current-workspace'))?.name).toBe('Current idea with local edits');
  await expect.poll(async()=>(await read(page,'workspace-recovery'))?.length).toBe(1);
}

for(const failingKey of ['projects','workspace-recovery','current-workspace'])test(`failed ${failingKey} hydration cannot overwrite stored work; retry restores it`,async({page})=>{
  await seedWorkspace(page);
  const keys=['current-workspace','projects','workspace-recovery'],before=await Promise.all(keys.map(key=>read(page,key)));
  await page.addInitScript(key=>{
    window.__failHydrationRead=true;window.__hydrationNativeGet=IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get=function(requested){
      if(window.__failHydrationRead&&requested===key)throw new DOMException(`Simulated ${key} read failure`,'UnknownError');
      return window.__hydrationNativeGet.call(this,requested);
    };
  },failingKey);
  await page.reload();
  await expect(page.getByRole('button',{name:'Retry restoration',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save project',exact:true,includeHidden:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Open',exact:true,includeHidden:true})).toBeDisabled();
  // Wait longer than the 600ms autosave debounce: failed hydration must not
  // save the default workspace or replace an unread collection with [].
  await page.waitForTimeout(900);
  for(let i=0;i<keys.length;i++)expect(await read(page,keys[i])).toEqual(before[i]);
  await page.evaluate(()=>{window.__failHydrationRead=false;});
  await page.getByRole('button',{name:'Retry restoration',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Current idea with local edits');
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
  await page.locator('.sidebar').getByRole('button',{name:'My projects',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved original project',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Recovery copies (1)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saved original project',exact:true})).toBeVisible();
  expect((await read(page,'current-workspace')).projectId).toBe(before[0].projectId);
});

test('an invalid editable draft cannot become an unusable recovery copy during replacement',async({page})=>{
  await page.goto('./');await page.getByRole('textbox',{name:'Project name',exact:true}).fill('My unfinished class names');
  await page.locator('.sidebar').getByRole('button',{name:/ML Studio/}).click();await page.getByRole('tab',{name:'Text learning',exact:true}).click();
  const panel=page.getByRole('tabpanel',{name:'Text learning',exact:true});await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await panel.getByLabel('Name of text class 1',{exact:true}).fill('');
  const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:5,name:'Safe incoming project'}));
  const buffer=await zip.generateAsync({type:'nodebuffer'});
  const open=async()=>{const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();await(await chooser).setFiles({name:'incoming.duet',mimeType:'application/zip',buffer});};
  await open();await expect(page.locator('.toast')).toContainText('Nothing was replaced');
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('My unfinished class names');
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('');await expect(panel.locator('.text-sample-list li')).toHaveCount(16);
  expect((await read(page,'workspace-recovery'))||[]).toHaveLength(0);
  await panel.getByLabel('Name of text class 1',{exact:true}).fill('Greeting');await open();
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Safe incoming project');
  await page.locator('.sidebar').getByRole('button',{name:'My projects',exact:true}).click();await page.getByRole('tab',{name:'Recovery copies (1)',exact:true}).click();
  await page.getByRole('button',{name:'Restore copy',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('My unfinished class names');
  await page.locator('.sidebar').getByRole('button',{name:/ML Studio/}).click();await page.getByRole('tab',{name:'Text learning',exact:true}).click();
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('Greeting');await expect(panel.locator('.text-sample-list li')).toHaveCount(16);
});
