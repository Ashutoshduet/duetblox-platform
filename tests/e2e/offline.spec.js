import {test,expect} from '@playwright/test';

const nav=(page,title)=>page.locator('.sidebar').getByRole('button',{name:title,exact:true}).click();
test('prepared production app cold-opens offline and runs SPICE, Python, ML and Scratch',async({context,page},info)=>{
 test.skip(process.env.DUETBLOX_TEST_PRODUCTION!=='1','Requires an already-built app with its real service worker and complete offline pack.');
 test.setTimeout(300000);
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await nav(page,'Offline');
 await expect(page.getByRole('button',{name:'Make available offline',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Make available offline',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your offline pack is ready',exact:true})).toBeVisible({timeout:180000});
 await page.getByLabel('Use offline mode',{exact:true}).click();await expect(page.getByLabel('Use offline mode',{exact:true})).toBeChecked();
 await context.setOffline(true);await page.close();page=await context.newPage();
 await page.goto('./',{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'What will you create today?'})).toBeVisible();expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
 await nav(page,'Analog / SPICE');await page.getByRole('button',{name:'Run circuit',exact:true}).click();await expect(page.locator('.spice-status')).toContainText('Solved',{timeout:40000});await page.getByLabel('Measure',{exact:true}).selectOption({label:'v(out)'});await expect(page.locator('.spice-readout')).toContainText('2.5 V');
 await nav(page,'Python');await page.getByLabel('Python code',{exact:true}).fill('import math\nprint("Offline answer:", math.sqrt(144))');await page.getByRole('button',{name:'Run Python',exact:true}).click();await expect(page.getByLabel('Python console',{exact:true})).toContainText('Offline answer: 12.0',{timeout:60000});
 await nav(page,'ML Studio NEW');await page.getByRole('tab',{name:'Numbers learning',exact:true}).click();await page.getByRole('button',{name:'Try numbers example',exact:true}).click();await page.getByRole('button',{name:'Train numbers model',exact:true}).click();await expect(page.getByText('Active model: classification',{exact:true})).toBeVisible();await page.getByLabel('Numbers to predict',{exact:true}).fill('740,29');await page.getByRole('button',{name:'Predict numbers',exact:true}).click();await expect(page.locator('.numbers-result')).toContainText('Sun');
 await nav(page,'Junior Blocks');await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});await page.getByRole('button',{name:'Play story',exact:true}).click();await page.getByRole('button',{name:'Stop story',exact:true}).click();await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled();
 await nav(page,'Blocks');await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});await page.getByRole('button',{name:'Add an example',exact:true}).click();await page.getByRole('button',{name:/Animate a sprite/}).click();await expect(page.locator('.toast')).toContainText('added as a separate sprite');await page.getByRole('button',{name:'Run',exact:true}).click();await expect(page.locator('.studio-destination')).toContainText('Running');await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.screenshot({path:info.outputPath('cold-offline-blocks.png'),fullPage:true});expect(errors).toEqual([]);
});
