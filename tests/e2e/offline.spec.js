import {test,expect} from '@playwright/test';

const nav=async(page,title)=>{if(await page.locator('.junior-editor').isVisible())await page.getByRole('button',{name:'Workspace',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:title,exact:true}).click();};
test('prepared production app cold-opens offline and runs SPICE, Python, ML and Scratch',async({context,page},info)=>{
 test.skip(process.env.DUETBLOX_TEST_PRODUCTION!=='1','Requires an already-built app with its real service worker and complete offline pack.');
 // A hosted first install downloads the verified shell before STATUS can answer,
 // then prepares the complete 328 MiB pack. Keep these network-dependent waits
 // separate from the short assertions used after the network is disabled.
 const prepareTimeout=Number(process.env.DUETBLOX_TEST_OFFLINE_PREPARE_MS||180000);
 test.setTimeout(prepareTimeout+180000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await nav(page,'Offline');
 const installStarted=Date.now();
 await expect(page.getByRole('button',{name:'Make available offline',exact:true})).toBeEnabled({timeout:90000});
 console.log(`Offline shell installed in ${Date.now()-installStarted} ms`);
 await page.getByRole('button',{name:'Make available offline',exact:true}).click();
 const prepareStarted=Date.now();
 await expect(page.getByRole('heading',{name:'Your offline pack is ready',exact:true})).toBeVisible({timeout:prepareTimeout});
 console.log(`Offline pack verified in ${Date.now()-prepareStarted} ms`);
 await page.getByLabel('Use offline mode',{exact:true}).click();await expect(page.getByLabel('Use offline mode',{exact:true})).toBeChecked();
 await context.setOffline(true);await page.close();page=await context.newPage();
 await page.goto('./',{waitUntil:'domcontentloaded'});await expect(page.locator('.sidebar .nav-item.active')).toHaveText('Offline');expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
 await nav(page,'Analog / SPICE');await page.getByRole('button',{name:'Run circuit',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Solved',{timeout:40000});await page.getByLabel('Measure',{exact:true}).selectOption({label:'v(out)'});await expect(page.locator('.spice-readout')).toContainText('2.5 V');
 await nav(page,'Python');await page.getByLabel('Python code',{exact:true}).fill('import math\nprint("Offline answer:", math.sqrt(144))');await page.getByRole('button',{name:'Run Python',exact:true}).click();await expect(page.getByLabel('Python console',{exact:true})).toContainText('Offline answer: 12.0',{timeout:60000});
 await nav(page,'ML Studio NEW');await page.getByRole('tab',{name:'Numbers learning',exact:true}).click();await page.getByRole('button',{name:'Try numbers example',exact:true}).click();await page.getByRole('button',{name:'Train numbers model',exact:true}).click();await expect(page.getByText('Active model: classification',{exact:true})).toBeVisible();await page.getByLabel('Numbers to predict',{exact:true}).fill('740,29');await page.getByRole('button',{name:'Predict numbers',exact:true}).click();await expect(page.locator('.numbers-result')).toContainText('Sun');
 await nav(page,'Junior Blocks');await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
 await page.getByRole('button',{name:'Play story',exact:true}).click();
 await expect(page.locator('.junior-status')).toContainText('Story finished');
 const celebration=page.getByRole('region',{name:'Mascot celebration',exact:true});
 await expect(celebration).toContainText('You brought your story to life!');
 await expect(celebration).toHaveAttribute('data-playing','false',{timeout:7000});
 await celebration.getByRole('button',{name:'Replay celebration',exact:true}).click();
 const reducedMotion=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 await expect(celebration).toHaveAttribute('data-playing',reducedMotion?'false':'true');
 await expect(celebration).toContainText('You brought your story to life!');
 await expect(page.locator('.junior-run-caption')).toHaveText('Ready');
 expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
 const offlineStatus=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('Offline worker STATUS timed out'));},15000);
  channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
  navigator.serviceWorker.controller.postMessage({type:'STATUS'},[channel.port2]);
 }));
 expect(offlineStatus.ready).toBe(true);expect(offlineStatus.offline).toBe(true);
 expect(offlineStatus.version).toMatch(/^[0-9a-f]{20}$/);
 console.log(`Cold-offline mascot verified on pack ${offlineStatus.version}`);
 await info.attach('offline-pack-status',{body:JSON.stringify(offlineStatus,null,2),contentType:'application/json'});
 await page.screenshot({path:info.outputPath('cold-offline-junior-mascot.png'),fullPage:true});
 await celebration.getByRole('button',{name:'Skip celebration',exact:true}).click();
 await nav(page,'Blocks');await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});await page.getByRole('button',{name:'Add an example',exact:true}).click();await page.getByRole('button',{name:/Animate a sprite/}).click();await expect(page.locator('.toast')).toContainText('added as a separate sprite');await page.getByRole('button',{name:'Run',exact:true}).click();await expect(page.locator('.studio-destination')).toContainText('Running');await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.screenshot({path:info.outputPath('cold-offline-blocks.png'),fullPage:true});expect(errors).toEqual([]);
});
