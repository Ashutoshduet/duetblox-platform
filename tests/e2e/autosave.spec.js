import {test,expect} from '@playwright/test';

async function savedWorkspace(page){
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('duetblox-workspace',1);
    request.onsuccess=()=>{const db=request.result,read=db.transaction('records').objectStore('records').get('current-workspace');read.onsuccess=()=>{resolve(read.result);db.close();};read.onerror=()=>{reject(read.error);db.close();};};
    request.onerror=()=>reject(request.error);
  }));
}

test('delayed periodic Scratch save preserves newer project and circuit metadata after reload',async({page})=>{
  await page.addInitScript(()=>{
    // Capture the actual app interval callback without speeding up any timers or replacing VM operations.
    const schedule=window.setInterval.bind(window);
    window.setInterval=(callback,delay,...args)=>{
      if(delay===30000&&window===window.top)window.__periodicAutosave=callback;
      return schedule(callback,delay,...args);
    };
    window.addEventListener('message',event=>{
      const frame=document.querySelector('iframe[data-duet-editor="normal"]');
      if(!window.__holdSaveResponse||event.source!==frame?.contentWindow||event.origin!==location.origin||event.data?.channel!=='duetblox'||event.data.type!=='result'||typeof event.data.payload?.base64!=='string')return;
      event.stopImmediatePropagation();
      window.__heldSave={data:event.data,origin:event.origin,source:event.source};
      window.__holdSaveResponse=false;
    },true);
  });
  await page.goto('./');
  await page.getByRole('button',{name:'Blocks',exact:true}).click();
  await expect(page.locator('.studio-run')).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'Analog / SPICE',exact:true}).click();
  await expect(page.getByLabel('Circuit name',{exact:true})).toBeVisible();
  await page.waitForFunction(()=>typeof window.__periodicAutosave==='function');
  await page.evaluate(()=>{
    window.__heldSave=null;window.__holdSaveResponse=true;window.__periodicDone=false;
    Promise.resolve(window.__periodicAutosave()).finally(()=>{window.__periodicDone=true;});
  });
  await page.waitForFunction(()=>!!window.__heldSave,{timeout:15000});
  await page.getByLabel('Project name',{exact:true}).fill('Project edited during Scratch save');
  await page.getByLabel('Circuit name',{exact:true}).fill('Circuit edited during Scratch save');
  await expect.poll(async()=>{const saved=await savedWorkspace(page);return [saved?.name,saved?.spice?.name];}).toEqual(['Project edited during Scratch save','Circuit edited during Scratch save']);
  // Deliver the original real iframe response, retaining its request id, origin, source and actual .sb3 bytes.
  await page.evaluate(()=>{const held=window.__heldSave;window.__heldSave=null;window.dispatchEvent(new MessageEvent('message',held));});
  await page.waitForFunction(()=>window.__periodicDone);
  const after=await savedWorkspace(page);
  expect(after.name).toBe('Project edited during Scratch save');
  expect(after.spice.name).toBe('Circuit edited during Scratch save');
  expect(after.sb3).toMatch(/^UEs/); // Actual ZIP serialization supplied by Scratch VM.
  await page.reload();
  await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Project edited during Scratch save');
  await page.getByRole('button',{name:'Analog / SPICE',exact:true}).click();
  await expect(page.getByLabel('Circuit name',{exact:true})).toHaveValue('Circuit edited during Scratch save');
});

test('delayed navigation Scratch save preserves a rename already saved during navigation',async({page})=>{
  await page.addInitScript(()=>{
    window.addEventListener('message',event=>{
      const frame=document.querySelector('iframe[data-duet-editor="normal"]');
      if(!window.__holdNavigationSaves||event.source!==frame?.contentWindow||event.origin!==location.origin||event.data?.channel!=='duetblox'||event.data.type!=='result'||typeof event.data.payload?.base64!=='string')return;
      event.stopImmediatePropagation();
      window.__navigationSaves.push({data:event.data,origin:event.origin,source:event.source});
    },true);
  });
  await page.goto('./');
  await page.getByRole('button',{name:'Blocks',exact:true}).click();
  await expect(page.locator('.studio-run')).toBeEnabled({timeout:60000});
  await page.getByLabel('Project name',{exact:true}).fill('Before navigation');
  await expect.poll(async()=>(await savedWorkspace(page))?.name).toBe('Before navigation');
  await page.evaluate(()=>{window.__navigationSaves=[];window.__holdNavigationSaves=true;});
  await page.getByRole('button',{name:'Analog / SPICE',exact:true}).click();
  await page.waitForFunction(()=>window.__navigationSaves.length>0);
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeDisabled();
  await page.getByLabel('Project name',{exact:true}).fill('Renamed while leaving Blocks');
  await expect.poll(async()=>(await savedWorkspace(page))?.name).toBe('Renamed while leaving Blocks');
  // Release actual VM serializations. Concurrent saves retain their original request ids and ZIP bytes.
  await page.evaluate(()=>{
    window.__holdNavigationSaves=false;
    for(const response of window.__navigationSaves)window.dispatchEvent(new MessageEvent('message',response));
    window.__navigationSaves=[];
  });
  await expect(page.getByLabel('Circuit name',{exact:true})).toBeVisible();
  const after=await savedWorkspace(page);
  expect(after.name).toBe('Renamed while leaving Blocks');
  expect(after.sb3).toMatch(/^UEs/);
  await page.reload();
  await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Renamed while leaving Blocks');
});
