import {test,expect} from '@playwright/test';

const oldVersion='aaaaaaaaaaaaaaaaaaaa',latestVersion='bbbbbbbbbbbbbbbbbbbb';
async function mockWorker(page,version=oldVersion){
 await page.addInitScript(({version})=>{
  const events=new EventTarget();
  window.offlineProbe={version,prepareCalls:0,ready:false,offline:false,changeController(next){this.version=next;events.dispatchEvent(new Event('controllerchange'));}};
  const worker={scriptURL:new URL('./sw.js',location.href).href,state:'activated',postMessage(message,ports){
   const probe=window.offlineProbe;
   if(message.type==='PREPARE')probe.prepareCalls++;
   if(message.type==='SET_OFFLINE')probe.offline=message.enabled;
   ports[0].postMessage({type:'status',version:probe.version,files:10,bytes:1024,ready:probe.ready,offline:probe.offline});
  }};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:worker,register:async()=>({active:worker}),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)}});
 },{version});
 await page.route('**/offline-manifest.json',route=>route.fulfill({json:{version:latestVersion,basePath:new URL(route.request().url()).pathname.replace('offline-manifest.json','')}}));
}
async function openOffline(page){
 await page.goto('./');
 if(await page.locator('.junior-editor').isVisible())await page.getByRole('button',{name:'Workspace',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:'Offline',exact:true}).click();
}
test('older controller cannot prepare stale files, and preparation rechecks the version',async({page})=>{
 test.skip(process.env.DUETBLOX_TEST_PRODUCTION!=='1','Offline commands require a production build.');
 await mockWorker(page);await openOffline(page);
 const prepare=page.getByRole('button',{name:'Make available offline',exact:true});
 await expect(page.getByRole('heading',{name:'A newer version is available',exact:true})).toBeVisible();
 await expect(prepare).toBeDisabled();
 await expect(page.getByRole('link',{name:'Load latest version',exact:true})).toHaveAttribute('href',`/duetblox/update.html?release=${latestVersion}`);
 expect(await page.evaluate(()=>window.offlineProbe.prepareCalls)).toBe(0);
 await page.evaluate(version=>{window.offlineProbe.version=version;},latestVersion);
 await page.getByRole('button',{name:'Check status',exact:true}).click();
 await expect(prepare).toBeEnabled();
 await page.evaluate(version=>{window.offlineProbe.version=version;},oldVersion);
 await prepare.click();
 await expect(page.getByRole('heading',{name:'A newer version is available',exact:true})).toBeVisible();
 await expect(prepare).toBeDisabled();
 expect(await page.evaluate(()=>window.offlineProbe.prepareCalls)).toBe(0);
});
test('network failure preserves an existing offline pack and an observed update warning',async({page})=>{
 test.skip(process.env.DUETBLOX_TEST_PRODUCTION!=='1','Offline commands require a production build.');
 await mockWorker(page);await openOffline(page);
 await expect(page.getByRole('heading',{name:'A newer version is available',exact:true})).toBeVisible();
 await page.route('**/offline-manifest.json',route=>route.abort('internetdisconnected'));
 await page.evaluate(()=>{window.offlineProbe.ready=true;});
 await page.getByRole('button',{name:'Check status',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your offline pack is ready',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'A newer version is available',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Check / repair offline files',exact:true})).toBeDisabled();
 await page.getByLabel('Use offline mode',{exact:true}).click();
 await expect(page.getByLabel('Use offline mode',{exact:true})).toBeChecked();
 expect(await page.evaluate(()=>window.offlineProbe.prepareCalls)).toBe(0);
});

test('a delayed prepare check cannot overwrite a newer controller check or start stale preparation',async({page})=>{
 test.skip(process.env.DUETBLOX_TEST_PRODUCTION!=='1','Offline commands require a production build.');
 const newestVersion='cccccccccccccccccccc';
 await mockWorker(page,oldVersion);
 const manifest=(route,version)=>({version,basePath:new URL(route.request().url()).pathname.replace('offline-manifest.json','')});
 await page.route('**/offline-manifest.json',route=>route.fulfill({json:manifest(route,oldVersion)}));
 await openOffline(page);
 const prepare=page.getByRole('button',{name:'Make available offline',exact:true});
 const check=page.getByRole('button',{name:'Check status',exact:true});
 await expect(prepare).toBeEnabled();
 let release,held=false,first=true;
 const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/offline-manifest.json',async route=>{
  if(first){first=false;held=true;await gate;await route.fulfill({json:manifest(route,oldVersion)});}
  else await route.fulfill({json:manifest(route,newestVersion)});
 });
 try{
  await prepare.click();await expect.poll(()=>held).toBe(true);
  await page.evaluate(version=>window.offlineProbe.changeController(version),latestVersion);
  await expect(page.getByRole('heading',{name:'A newer version is available',exact:true})).toBeVisible();
  release();
  await expect(check).toBeEnabled();await expect(prepare).toBeDisabled();
  expect(await page.evaluate(()=>window.offlineProbe.prepareCalls)).toBe(0);
  // A stale response must not poison the remembered manifest either. Returning
  // to its old controller during an outage still needs the newer known pack.
  let failedChecks=0;
  await page.route('**/offline-manifest.json',route=>{failedChecks++;return route.abort('internetdisconnected');});
  await page.evaluate(version=>window.offlineProbe.changeController(version),oldVersion);
  await expect.poll(()=>failedChecks).toBe(1);await expect(check).toBeEnabled();
  await expect(page.getByRole('heading',{name:'A newer version is available',exact:true})).toBeVisible();
  await expect(prepare).toBeDisabled();
  expect(await page.evaluate(()=>window.offlineProbe.prepareCalls)).toBe(0);
 }finally{release();}
});
