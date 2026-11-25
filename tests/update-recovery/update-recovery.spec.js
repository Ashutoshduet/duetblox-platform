import {test, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const repairFile = new URL('../../public/update.html', import.meta.url);
let server, origin, latestRequested, latestReleased, failPreflight, wrongWorkerVersion, requests;
const latestPack='64fa7621d0f8ac576d6b';

function documentFor(version) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${version} Junior fixture</title><h1>${version} Junior</h1><script>window.fixtureReady=navigator.serviceWorker.register('/duetblox/sw.js',{scope:'/duetblox/'}).then(()=>navigator.serviceWorker.ready);</script></html>`;
}

function workerFor(version) {
  return `const cacheName=${JSON.stringify('fixture-shell-' + version.toLowerCase())};
  const html=${JSON.stringify(documentFor(version))};
  const version=${JSON.stringify(version==='Latest'&&!wrongWorkerVersion?latestPack:'11111111111111111111')};
  self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(cacheName);for(const path of ['/duetblox/','/duetblox/index.html'])await cache.put(path,new Response(html,{headers:{'Content-Type':'text/html'}}));})()));
  self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
  self.addEventListener('message',event=>{if(event.data?.type==='STATUS')event.ports[0]?.postMessage({type:'status',version});});
  self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==location.origin)return;if(['/duetblox/','/duetblox/index.html'].includes(u.pathname))event.respondWith(caches.open(cacheName).then(cache=>cache.match(u.pathname)));});`;
}

test.beforeAll(async()=>{
  server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://fixture.test');
      requests.push(url.pathname+url.search);
      res.setHeader('Cache-Control','no-store');
      if(url.pathname==='/duetblox/update.html') {
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end(await readFile(repairFile));
      } else if(url.pathname==='/duetblox/offline-manifest.json') {
        res.setHeader('Content-Type','application/json');
        res.statusCode=failPreflight?503:200;
        res.end(JSON.stringify(failPreflight?{error:'Fixture network outage'}:{format:'duetblox-offline-pack',schema:1,basePath:'/duetblox/',version:'64fa7621d0f8ac576d6b',files:[]}));
      } else if(url.pathname==='/duetblox/sw.js') {
        res.setHeader('Content-Type','application/javascript');
        res.setHeader('Cache-Control','max-age=315360000');
        res.end(workerFor(latestReleased?'Latest':'Old'));
      } else if(['/other/sw.js','/duetblox/foreign-worker.js'].includes(url.pathname)) {
        res.setHeader('Content-Type','application/javascript');
        res.end("self.addEventListener('activate',e=>e.waitUntil(Promise.resolve()));");
      } else if(['/duetblox/','/duetblox/index.html'].includes(url.pathname)) {
        if(url.searchParams.has('refresh'))latestRequested=true;
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.setHeader('Cache-Control','max-age=315360000');
        res.end(documentFor(latestRequested?'Latest':'Old'));
      } else {
        res.statusCode=404;res.end('Fixture route not found');
      }
    } catch(error) {res.statusCode=500;res.end(String(error));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});
test.beforeEach(()=>{latestRequested=false;latestReleased=false;failPreflight=false;wrongWorkerVersion=false;requests=[];});

async function seedOldApp(page) {
  await page.addInitScript(()=>{
    const register=ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register=function(scriptURL,options){
      const calls=JSON.parse(sessionStorage.getItem('fixture-registration-calls')||'[]');
      calls.push({scriptURL:String(scriptURL),options});
      sessionStorage.setItem('fixture-registration-calls',JSON.stringify(calls));
      return register.call(this,scriptURL,options);
    };
  });
  await page.goto(origin+'/duetblox/');
  await page.evaluate(()=>window.fixtureReady);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(async()=>{
    localStorage.setItem('fixture-student-work','Keep my Junior story');
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('fixture-student-projects',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('projects');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({story:'Keep my saved story',samples:[1,2,3]},'student');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};
    });
    await (await caches.open('fixture-user-cache')).put('/fixture-user-cache',new Response('Keep my offline resources'));
    const other=await navigator.serviceWorker.register('/other/sw.js',{scope:'/other/'});
    if(!other.active)await new Promise((resolve,reject)=>{const worker=other.installing||other.waiting;if(!worker)return reject(new Error('Other worker missing'));worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();else if(worker.state==='redundant')reject(new Error('Other worker failed'));});});
  });
  // A query string does not fix the old worker: its pathname lookup still
  // returns the cached old document, exactly as the deployed DUETBlox worker.
  await page.goto(origin+'/duetblox/index.html?ordinaryReload=1');
  await expect(page.getByRole('heading',{name:'Old Junior',exact:true})).toBeVisible();
  await page.evaluate(()=>window.fixtureReady);
  await page.goto(origin+'/duetblox/update.html');
  await expect(page.getByRole('heading',{name:'Load the latest DUETBlox',exact:true})).toBeVisible();
  latestReleased=true;
}

test('explicit update leaves old shell behind while preserving student data, caches and unrelated worker',async({page})=>{
  await seedOldApp(page);
  const before=await page.evaluate(async()=>({cacheKeys:await caches.keys(),scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope).sort()}));
  await page.getByRole('checkbox',{name:'I have saved my work and closed other DUETBlox tabs.',exact:true}).check();
  await page.getByRole('button',{name:'Load latest version',exact:true}).click();
  await expect(page).toHaveURL(/\/duetblox\/index\.html\?refresh=.+#\/junior$/).catch(async error=>{
    console.log('Worker lifecycle diagnostic',await page.evaluate(async()=>({controller:navigator.serviceWorker.controller?.state,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,cache:r.updateViaCache,active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),status:document.querySelector('#status')?.textContent})));
    throw error;
  });
  await expect(page.getByRole('heading',{name:'Latest Junior',exact:true})).toBeVisible();
  await page.evaluate(()=>window.fixtureReady);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  const workerState=await page.evaluate(async()=>{
    const version=await new Promise((resolve,reject)=>{const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(new Error('STATUS timed out'));},5000);channel.port1.onmessage=event=>{clearTimeout(timeout);channel.port1.close();resolve(event.data.version);};navigator.serviceWorker.controller.postMessage({type:'STATUS'},[channel.port2]);});
    return {calls:JSON.parse(sessionStorage.getItem('fixture-registration-calls')),version};
  });
  expect(workerState.version).toBe(latestPack);
  expect(workerState.calls.some(call=>call.scriptURL===origin+'/duetblox/sw.js'&&call.options?.scope===origin+'/duetblox/'&&call.options?.updateViaCache==='none')).toBe(true);
  // Verify re-registration fetched the new worker despite the old script's
  // long HTTP lifetime, rather than only showing one fresh network document.
  await page.reload();
  await expect(page.getByRole('heading',{name:'Latest Junior',exact:true})).toBeVisible();
  await page.goto(origin+'/duetblox/');
  await expect(page.getByRole('heading',{name:'Latest Junior',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Latest Junior',exact:true})).toBeVisible();
  const after=await page.evaluate(async()=>({
    local:localStorage.getItem('fixture-student-work'),cacheKeys:await caches.keys(),
    cached:await (await (await caches.open('fixture-user-cache')).match('/fixture-user-cache')).text(),
    scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope).sort(),
    project:await new Promise((resolve,reject)=>{const request=indexedDB.open('fixture-student-projects');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('projects').objectStore('projects').get('student');get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>{db.close();reject(get.error);};};})
  }));
  expect(after.local).toBe('Keep my Junior story');
  expect(after.project).toEqual({story:'Keep my saved story',samples:[1,2,3]});
  expect(after.cached).toBe('Keep my offline resources');
  for(const key of before.cacheKeys)expect(after.cacheKeys).toContain(key);
  expect(after.scopes).toContain(origin+'/other/');
  expect(after.scopes).toContain(origin+'/duetblox/');
  expect(requests.some(url=>/^\/duetblox\/offline-manifest\.json\?check=/.test(url))).toBe(true);
  // The verified new worker may already serve this navigation from its cache;
  // successful URL + UI + worker STATUS assertions prove the resulting build.
});

test('failed network preflight keeps the old registration and student data intact',async({page})=>{
  await seedOldApp(page);failPreflight=true;
  await page.getByRole('checkbox',{name:'I have saved my work and closed other DUETBlox tabs.',exact:true}).check();
  await page.getByRole('button',{name:'Load latest version',exact:true}).click();
  await expect(page.getByRole('status')).toContainText(/could not|unable|failed|connect|retry|network|HTTP/i);
  await expect(page).toHaveURL(origin+'/duetblox/update.html');
  expect(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).some(r=>r.scope===location.origin+'/duetblox/'&&r.active?.scriptURL===location.origin+'/duetblox/sw.js'))).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('fixture-student-work'))).toBe('Keep my Junior story');
  expect(requests.some(url=>/^\/duetblox\/index\.html\?refresh=/.test(url))).toBe(false);
});

test('backup and closed-tab acknowledgement gates the update action',async({page})=>{
  await page.goto(origin+'/duetblox/update.html');
  const button=page.getByRole('button',{name:'Load latest version',exact:true});
  const saved=page.getByRole('checkbox',{name:'I have saved my work and closed other DUETBlox tabs.',exact:true});
  await expect(button).toBeDisabled();await saved.check();await expect(button).toBeEnabled();await saved.uncheck();await expect(button).toBeDisabled();
  expect(requests.some(url=>url.startsWith('/duetblox/offline-manifest.json'))).toBe(false);
});

test('a different worker at the same scope is preserved and blocks the repair',async({page})=>{
  await seedOldApp(page);
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.register('/duetblox/foreign-worker.js',{scope:'/duetblox/'});
    if(!registration.waiting)await new Promise((resolve,reject)=>{const worker=registration.installing;if(!worker)return reject(new Error('Foreign worker did not install'));const check=()=>{if(worker.state==='installed'||worker.state==='activated')resolve();else if(worker.state==='redundant')reject(new Error('Foreign worker failed'));};worker.addEventListener('statechange',check);check();});
  });
  await page.getByRole('checkbox',{name:'I have saved my work and closed other DUETBlox tabs.',exact:true}).check();
  await page.getByRole('button',{name:'Load latest version',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('A different offline app controls this address');
  await expect(page).toHaveURL(origin+'/duetblox/update.html');
  expect(await page.evaluate(async()=>{
    const registration=(await navigator.serviceWorker.getRegistrations()).find(r=>r.scope===location.origin+'/duetblox/');
    return !!registration&&[registration.active,registration.waiting,registration.installing].filter(Boolean).some(w=>w.scriptURL===location.origin+'/duetblox/foreign-worker.js');
  })).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('fixture-student-work'))).toBe('Keep my Junior story');
});

test('a stale worker version is reported without entering the editor or deleting student work',async({page})=>{
  await seedOldApp(page);wrongWorkerVersion=true;
  await page.getByRole('checkbox',{name:'I have saved my work and closed other DUETBlox tabs.',exact:true}).check();
  await page.getByRole('button',{name:'Load latest version',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('older offline version');
  expect(new URL(page.url()).pathname).toBe('/duetblox/update.html');
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(()=>localStorage.getItem('fixture-student-work'))).toBe('Keep my Junior story');
  expect(await page.evaluate(async()=>(await caches.keys()).includes('fixture-user-cache'))).toBe(true);
  expect(requests.some(url=>/^\/duetblox\/index\.html\?refresh=/.test(url))).toBe(false);
});

test('a forged second-phase link cannot bypass the saved-work acknowledgement',async({page})=>{
  await page.goto(origin+'/duetblox/update.html?install=not-a-confirmed-session&release='+latestPack);
  await expect(page.getByRole('heading',{name:'Load the latest DUETBlox',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Load latest version',exact:true})).toBeDisabled();
  expect(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect(requests.some(url=>url.startsWith('/duetblox/sw.js'))).toBe(false);
  expect(requests.some(url=>/^\/duetblox\/index\.html\?refresh=/.test(url))).toBe(false);
});
