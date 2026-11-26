import {test, expect} from '@playwright/test';

async function open(page) {
  await page.routeWebSocket('**', () => {});
  await page.goto('./#/circuits');
  await expect(page.getByLabel('Circuit lesson', {exact:true})).toBeVisible();
}
const lesson = page => page.locator('.circuit-lesson:visible');
const read = (page, key) => page.evaluate(key => new Promise((resolve, reject) => {
  const request = indexedDB.open('duetblox-workspace',1);
  request.onsuccess = () => {const db=request.result, item=db.transaction('records').objectStore('records').get(key); item.onsuccess=()=>{resolve(item.result);db.close();};item.onerror=()=>reject(item.error);};
  request.onerror=()=>reject(request.error);
}),key);
const rpc = (page, type) => page.evaluate(type => new Promise((resolve, reject) => {
  const frame=document.querySelector('iframe[data-duet-editor="normal"]');
  const requestId=crypto.randomUUID(), timeout=setTimeout(()=>{removeEventListener('message',listener);reject(new Error('Editor command timed out'));},15000);
  const listener=event=>{if(event.source!==frame.contentWindow || event.origin!==location.origin || event.data?.channel!=='duetblox' || event.data.requestId!==requestId)return;clearTimeout(timeout);removeEventListener('message',listener);event.data.type==='error'?reject(new Error(event.data.payload.message)):resolve(event.data.payload);};
  addEventListener('message',listener); frame.contentWindow.postMessage({channel:'duetblox',type,payload:{},requestId},location.origin);
}),type);

test('guided LED measurements require working wiring and circuit backup survives reload', async ({page}, info) => {
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await open(page);
  await page.getByLabel('Circuit lesson',{exact:true}).selectOption('pot');
  await page.getByRole('button',{name:'Load lesson wiring',exact:true}).click();
  await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:A0',exact:true})).toBeVisible();
  await page.getByLabel('Circuit lesson',{exact:true}).selectOption('led');
  await page.getByRole('button',{name:'Load lesson wiring',exact:true}).click();
  await expect(lesson(page).locator('section').first().locator('li.complete')).toHaveCount(3);
  await page.getByRole('button',{name:'Enable lesson simulation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Try HIGH',exact:true})).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'Try HIGH',exact:true}).click();
  await expect(lesson(page).locator('.circuit-observations li').filter({hasText:'LED responds to HIGH'})).toHaveClass('complete');
  await page.getByRole('button',{name:'Try LOW',exact:true}).click();
  await expect(lesson(page).locator('.circuit-observations .complete')).toHaveCount(2);
  expect((await read(page,'circuit-starter-recovery:arduino-uno')).circuit.components[0].type).toBe('potentiometer');
  await page.reload();
  await page.getByRole('button',{name:'Restore previous circuit',exact:true}).click();
  await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:A0',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('circuit-lessons.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('button guide observes pull-up logic and does not accept a floating input', async ({page}) => {
  await open(page);
  await page.getByLabel('Circuit lesson',{exact:true}).selectOption('button');
  await page.getByRole('button',{name:'Load lesson wiring',exact:true}).click();
  await page.getByRole('button',{name:'Enable lesson simulation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Set INPUT_PULLUP',exact:true})).toBeEnabled({timeout:60000});
  await expect(lesson(page).locator('.circuit-observations .complete')).toHaveCount(0);
  await page.getByRole('button',{name:'Set INPUT_PULLUP',exact:true}).click();
  await expect(lesson(page).locator('.circuit-observations .complete')).toHaveCount(1);
  await page.getByRole('button',{name:'Press lesson button',exact:true}).click();
  await expect(lesson(page).locator('.circuit-observations .complete')).toHaveCount(2);
});

test('failed circuit recovery preserves the current wiring and explains the save failure', async ({page}) => {
  await open(page);
  await page.getByLabel('Circuit lesson',{exact:true}).selectOption('pot');
  await page.getByRole('button',{name:'Load lesson wiring',exact:true}).click();
  await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:A0',exact:true})).toBeVisible();
  await page.evaluate(() => {const put=IDBObjectStore.prototype.put; IDBObjectStore.prototype.put=function(value,key){if(key==='circuit-starter-recovery:arduino-uno')throw new DOMException('Circuit backup storage full','QuotaExceededError'); return put.call(this,value,key);};});
  await page.getByLabel('Circuit lesson',{exact:true}).selectOption('led');
  await page.getByRole('button',{name:'Load lesson wiring',exact:true}).click();
  await expect(page.locator('.circuit-error')).toContainText('Circuit backup storage full');
  await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:A0',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Wire board:D13 to r1:a',exact:true})).toHaveCount(0);
});

test('lesson controls fit a narrow screen and preserve keyboard reachability', async ({page}, info) => {
  await page.setViewportSize({width:390,height:844}); await open(page);
  const button=page.getByRole('button',{name:'Load lesson wiring',exact:true});
  await button.focus(); await expect(button).toBeFocused();
  const bounds=await button.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:info.outputPath('circuit-lesson-mobile.png'),fullPage:true});
});

test('students can start with loose parts and complete the wiring themselves', async ({page}) => {
  await open(page);
  await page.getByRole('button',{name:'Build the wiring myself',exact:true}).click();
  await expect(page.getByRole('button',{name:'Select LED led1',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Circuit workbench',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Back to lesson guide',exact:true}).click();
  await expect(lesson(page).locator('summary').first()).toBeFocused();
  await page.getByRole('button',{name:'Jump to workbench',exact:true}).click();
  await expect(page.getByRole('region',{name:'Circuit workbench',exact:true})).toBeFocused();
  await expect(lesson(page).locator('section').first().locator('li.complete')).toHaveCount(0);
  for(const [from,to] of [['board:D13','r1:a'],['r1:b','led1:anode'],['led1:cathode','board:GND']]) {
    await page.getByRole('button',{name:`Connect ${from}`,exact:true}).press('Enter');
    await page.getByRole('button',{name:`Connect ${to}`,exact:true}).press('Enter');
  }
  await expect(lesson(page).locator('section').first().locator('li.complete')).toHaveCount(3);
  await page.getByRole('button',{name:'Enable lesson simulation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Try HIGH',exact:true})).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'Try HIGH',exact:true}).click();
  await expect(lesson(page).locator('.circuit-lesson-reading')).toContainText('LED: ON · 12.2 mA');
});

for (const kind of ['led','button']) {
  test(`wired ${kind} lesson opens real Scratch blocks, protects prior work and executes virtual hardware RPC`, async ({page}) => {
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page);
    await page.getByLabel('Circuit lesson',{exact:true}).selectOption('pot');
    await page.getByRole('button',{name:'Load lesson wiring',exact:true}).click();
    await expect(page.getByRole('button',{name:'Wire pot1:wiper to board:A0',exact:true})).toBeVisible();
    await page.getByLabel('Circuit lesson',{exact:true}).selectOption(kind);
    await page.getByRole('button',{name:'Open wired block lesson',exact:true}).click();
    await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
    await expect(page.locator('.toast')).toContainText('Your activity is ready');
    expect((await read(page,'workspace-recovery')).length).toBe(1);
    const project=(await rpc(page,'getProject')).project;
    expect(project.extensions).toContain('duetHardware');
    expect(Object.values(project.targets.find(target=>!target.isStage).blocks).some(block=>block.opcode === (kind==='led'?'duetHardware_digitalWrite':'duetHardware_readDigital'))).toBe(true);
    await expect(page.getByRole('button',{name:'Virtual board on',exact:true})).toBeEnabled();
    const frame=page.frames().find(frame=>frame.url().includes('studio=1'));
    await frame.evaluate(()=>{window.lessonResults=[];window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.channel==='duetblox'&&event.data.type==='extensionResult')window.lessonResults.push(event.data.payload);});});
    const virtualPanel = page.getByRole('button',{name:'Virtual board on',exact:true});
    if (await virtualPanel.getAttribute('aria-expanded') !== 'true') await virtualPanel.click();
    await page.getByRole('button',{name:'Run',exact:true}).click();
    await expect.poll(()=>frame.evaluate(()=>window.lessonResults.some(item=>item.result===1))).toBe(true);
    if(kind==='led') {
      await expect(page.locator('.circuit-canvas:visible')).toContainText('ON · 12.2 mA');
      await expect.poll(()=>frame.evaluate(()=>window.lessonResults.some(item=>item.result===0))).toBe(true);
      await expect(page.locator('.circuit-canvas:visible')).toContainText('OFF · 0.0 mA');
    } else {
      await page.getByRole('button',{name:'Select Push button button1',exact:true}).press('Enter');
      await page.getByRole('button',{name:'Press button',exact:true}).click();
      await expect.poll(()=>frame.evaluate(()=>window.lessonResults.some(item=>item.result===0))).toBe(true);
    }
    expect(await frame.evaluate(()=>window.lessonResults.filter(item=>item.error))).toEqual([]);
    await page.getByRole('button',{name:'Stop',exact:true}).click();expect(errors).toEqual([]);
  });
}
