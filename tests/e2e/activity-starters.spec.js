import {test,expect} from '@playwright/test';
const nav=(page,name)=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();
const read=(page,key)=>page.evaluate(key=>new Promise((resolve,reject)=>{const opening=indexedDB.open('duetblox-workspace',1);opening.onsuccess=()=>{const db=opening.result,get=db.transaction('records').objectStore('records').get(key);get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};opening.onerror=()=>reject(opening.error);}),key);
const rpc=(page,type,payload={})=>page.evaluate(({type,payload})=>new Promise((resolve,reject)=>{
  const frame=document.querySelector('iframe[data-duet-editor="normal"]')||document.querySelector('iframe[data-duet-editor="blocks"]');
  if(!frame)return reject(new Error('Normal editor frame missing'));
  const requestId=crypto.randomUUID(),timer=setTimeout(()=>{removeEventListener('message',listener);reject(new Error('Editor command timed out'));},15000);
  const listener=event=>{if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!=='duetblox'||event.data.requestId!==requestId)return;clearTimeout(timer);removeEventListener('message',listener);event.data.type==='error'?reject(new Error(event.data.payload.message)):resolve(event.data.payload);};
  addEventListener('message',listener);frame.contentWindow.postMessage({channel:'duetblox',type,payload,requestId},location.origin);
}),{type,payload});
const lesson=async(page,title,button)=>{
  await page.goto('./#/learn');await page.getByRole('navigation',{name:'Choose a lesson'}).getByRole('button',{name:new RegExp(title)}).click();
  await page.getByRole('button',{name:button,exact:true}).click();await expect(page.locator('.toast')).toContainText('Your activity is ready',{timeout:60000});
};

test('normal block starter runs and keeps a full previous-workspace recovery',async({page})=>{
  await lesson(page,'Build your first block sequence','Open block starter');
  await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
  await expect(page.locator('.toast')).toContainText('Your activity is ready');
  const before=await rpc(page,'status');expect(before.running).toBe(false);
  await page.getByRole('button',{name:'Run',exact:true}).click();
  await expect.poll(async()=>{const state=await rpc(page,'status');return state.targets.find(t=>t.name==='My first animation')?.x;}).toBe(100);
  expect((await read(page,'workspace-recovery')).length).toBe(1);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
});

test('image and text starters select their studio, keep old datasets and train only on request',async({page})=>{
  await lesson(page,'Teach a Hindi / English greeting helper','Open text examples');
  await expect(page.getByRole('tab',{name:'Text learning',exact:true})).toHaveAttribute('aria-selected','true');
  const train=page.getByRole('button',{name:'Train text model',exact:true});await expect(train).toBeEnabled();
  expect(await read(page,'text-model')).toBeNull();
  await train.click();await page.getByLabel('Text to classify',{exact:true}).fill('hello friend');await expect(page.getByRole('button',{name:'Classify text',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Classify text',exact:true}).click();
  expect((await read(page,'text-model')).classes.map(c=>c.name)).toContain('Greeting');
  await nav(page,'Learn step by step');
  await page.getByRole('navigation',{name:'Choose a lesson'}).getByRole('button',{name:/Teach a shape detective/}).click();
  await page.getByRole('button',{name:'Open image examples',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Image learning',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('button',{name:'Train model',exact:true})).toBeEnabled();
  expect(await read(page,'image-model')).toBeNull();
  const saved=await read(page,'image-dataset');expect(saved.classes.map(c=>c.samples.length)).toEqual([12,12]);
  expect((await read(page,'text-model')).classes.map(c=>c.name)).toContain('Greeting');
  expect((await read(page,'workspace-recovery')).length).toBe(2);
});

test('Python lesson opens runnable code while preserving the old Python program',async({page})=>{
  await lesson(page,'Python: print any times table','Open Python starter');
  const saved=await read(page,'current-workspace');expect(saved.python.name).toBe('times-table.py');
  await page.getByRole('button',{name:'Run Python',exact:true}).click();
  await expect(page.locator('.python-output')).toContainText('7 x 10 = 70',{timeout:60000});
  expect((await read(page,'workspace-recovery')).length).toBe(1);
});

test('failed dataset transaction retains original dataset and current page',async({page})=>{
  await page.goto('./#/learn');
  await page.getByRole('navigation',{name:'Choose a lesson'}).getByRole('button',{name:/Teach a Hindi \/ English greeting helper/}).click();
  const original=await read(page,'text-dataset');
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='text-dataset')throw new DOMException('Test full storage','QuotaExceededError');return put.call(this,value,key);};});
  await page.getByRole('button',{name:'Open text examples',exact:true}).click();
  await expect(page.locator('.workspace-save-warning')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Learn by making',exact:true})).toBeVisible();
  expect(await read(page,'text-dataset')).toEqual(original);
});

for(const [title,button,extension] of [['Draw shapes with Pen and loops','Open drawing starter','pen'],['Compose a tune','Open music starter','music']]){
  test(`${extension} starter loads its real extension and completes`,async({page})=>{
    await lesson(page,title,button);await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
    await expect(page.locator('.toast')).toContainText('Your activity is ready');
    expect((await rpc(page,'status')).extensions).toContain(extension);
    await page.getByRole('button',{name:'Run',exact:true}).click();
    await expect.poll(async()=>(await rpc(page,'status')).running,{timeout:15000}).toBe(false);
    expect(await page.locator('.toast').innerText()).not.toMatch(/unknown|failed|error/i);
  });
}

test('quiz answers produce an actual score and stop cleanly',async({page})=>{
  await lesson(page,'Build a quiz that checks answers','Open quiz starter');
  await page.getByRole('button',{name:'Run',exact:true}).click();
  const frame=page.frameLocator('iframe[data-duet-editor="normal"]');
  const answer=frame.locator('[class*="question_question-input"] input');
  await answer.fill('56');await answer.press('Enter');
  await expect.poll(async()=>(await rpc(page,'watchValues')).values.find(v=>v.name==='score')?.value).toBe('1');
  await expect.poll(async()=>(await rpc(page,'status')).running).toBe(false);
});

test('decision story opens editable branches and traffic light includes three resistor-protected outputs',async({page})=>{
  await lesson(page,'Choose between two actions','Open decision story');
  await expect(page.getByLabel('Junior project title')).toHaveValue('Two ways for Fox');
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await page.getByRole('button',{name:'Stop story',exact:true}).click();
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  await nav(page,'Learn step by step');
  await page.getByRole('navigation',{name:'Choose a lesson'}).getByRole('button',{name:/Program a traffic light without a board/}).click();
  await page.getByRole('button',{name:'Open traffic light starter',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('Your activity is ready',{timeout:60000});
  await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
  await expect.poll(async()=>(await read(page,'current-workspace'))?.circuit.components.filter(c=>c.type==='led').length).toBe(3);
  const current=await read(page,'current-workspace');expect(current.circuit.components.filter(c=>c.type==='led').length).toBe(3);expect(current.circuit.components.filter(c=>c.type==='resistor').length).toBe(3);
  await page.getByRole('button',{name:'Run',exact:true}).click();
  await expect.poll(async()=>(await rpc(page,'status')).running).toBe(true);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await expect.poll(async()=>(await rpc(page,'status')).running).toBe(false);
});
