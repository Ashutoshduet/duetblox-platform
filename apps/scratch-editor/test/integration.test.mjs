import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import JSZip from 'jszip';
import {makeJuniorProject, makeJuniorBlock, compileJuniorProject} from '../../../src/junior/model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.resolve(root, '../../public');
let server, origin, browser;
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm'};
const harness = mode => `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><iframe title="DUETBlox editor" src="/scratch/index.html${mode==='stage'?'?mode=stage':''}" style="border:0;width:100vw;height:100vh"></iframe><script>
window.messages=[];window.rpcCalls=[];window.addEventListener('message',event=>{
const frame=document.querySelector('iframe');if(event.source!==frame.contentWindow||event.origin!==location.origin)return;
const data=event.data;window.messages.push(data);
if(data.type==='extensionRequest'){window.rpcCalls.push(data.payload);const values={predict:undefined,label:'Robot',confidence:92,confidenceFor:92,isReady:true,readAnalog:432,readDigital:1};frame.contentWindow.postMessage({channel:'duetblox',type:'extensionResult',requestId:data.requestId,payload:{result:values[data.payload.method]}},location.origin);}
});
window.send=(type,payload={})=>new Promise((resolve,reject)=>{const requestId='test-'+crypto.randomUUID();const timeout=setTimeout(()=>{removeEventListener('message',listener);reject(Error('Command timed out: '+type))},12000);const listener=event=>{if(event.source!==document.querySelector('iframe').contentWindow||event.origin!==location.origin||event.data?.requestId!==requestId)return;if(!['result','error'].includes(event.data.type))return;clearTimeout(timeout);removeEventListener('message',listener);event.data.type==='error'?reject(Error(event.data.payload.message)):resolve(event.data.payload);};addEventListener('message',listener);document.querySelector('iframe').contentWindow.postMessage({channel:'duetblox',type,requestId,payload},location.origin);});
</script></body></html>`;
before(async () => {
  server = http.createServer(async (req,res) => {
    const url = new URL(req.url, 'http://local');
    if(url.pathname==='/harness'){res.writeHead(200,{'Content-Type':mime['.html']});res.end(harness(url.searchParams.get('mode')));return;}
    let file = path.join(publicRoot, decodeURIComponent(url.pathname));
    if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403);res.end();return;}
    try {if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});res.end(data);}catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await fs.mkdir(path.join(root,'work/test-results'),{recursive:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
const command=(page,type,payload={})=>page.evaluate(({type,payload})=>window.send(type,payload),{type,payload});
async function open(mode){const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`${origin}/harness?mode=${mode}`);await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'),null,{timeout:30000});return {page,errors,frame:page.frames().find(f=>f.url().includes('/scratch/index.html'))};}
function juniorFixture(){const p=makeJuniorProject();const sprite=p.scenes[0].sprites[0];sprite.x=0;sprite.y=0;sprite.direction=90;sprite.scripts[0].blocks=[{...makeJuniorBlock('repeat'),value:3,children:[{...makeJuniorBlock('move'),value:20}]},makeJuniorBlock('sound')];return compileJuniorProject(p);}

for (const mode of ['stage','editor']) test(`${mode}: official VM executes Junior repeat/sound and preserves an sb3 roundtrip`,{timeout:60000},async()=>{
  const {page,errors,frame}=await open(mode);
  try{
    const initial=await command(page,'getProject');assert.equal(initial.project.targets[1].name,'Duet');
    const fixture=juniorFixture();await command(page,'loadProject',{...fixture,encoding:'json'});
    await frame.locator('canvas').first().click({position:{x:10,y:10}});
    await page.evaluate(()=>{window.messages=[]});await command(page,'greenFlag');
    await page.waitForFunction(()=>{const started=window.messages.findIndex(m=>m.type==='status'&&m.payload.running===true);return started>=0&&window.messages.slice(started+1).some(m=>m.type==='status'&&m.payload.running===false)},null,{timeout:8000});
    const status=await command(page,'status');assert.equal(status.targets.find(t=>!t.isStage).x,60);
    assert.equal(status.running,false);
    const saved=await command(page,'saveProject');const zip=await JSZip.loadAsync(Buffer.from(saved.base64,'base64'));const project=JSON.parse(await zip.file('project.json').async('string'));
    assert.equal(project.targets[1].x,60);assert.equal(project.targets[1].sounds[0].name,'Chime');
    assert.ok(zip.file(project.targets[1].costumes[0].md5ext));assert.ok(zip.file(project.targets[1].sounds[0].md5ext));
    await command(page,'loadProject',{project:saved.base64,encoding:'base64'});assert.equal((await command(page,'status')).targets[1].x,60);
    await command(page,'addExtension',{id:'pen'});assert.ok((await command(page,'status')).extensions.includes('pen'));
    await assert.rejects(command(page,'addExtension',{id:'https://invalid.example/extension.js'}),/not in the DUETBlox catalog/);
    if(mode==='editor'){
      const body=await frame.locator('body').innerText();for(const category of ['Motion','Looks','Sound','Events','Control','Sensing','Operators','Variables','My Blocks','Boards and robots','Image learning'])assert.ok(body.includes(category),`Missing toolbox category ${category}`);
      await frame.getByRole('tab',{name:'Costumes'}).click();
      await frame.getByText('Convert to Bitmap',{exact:true}).waitFor({timeout:12000});
      assert.equal(await frame.getByText('Convert to Bitmap',{exact:true}).count(),1);
      await page.screenshot({path:path.join(root,'work/test-results/costume-editor.png')});
      await frame.getByRole('tab',{name:'Sounds'}).click();await frame.locator('input[value="Chime"]').waitFor({timeout:10000});
      await page.screenshot({path:path.join(root,'work/test-results/sound-editor.png')});
      await frame.getByRole('tab',{name:'Code',exact:true}).click();
    }
    await page.screenshot({path:path.join(root,`work/test-results/${mode}.png`)});
    const reset = await command(page,'resetProject');assert.equal(reset.targets[1].name,'Duet');assert.equal(reset.targets[1].x,0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('custom blocks execute through the checked parent RPC and persist in sb3',{timeout:60000},async()=>{
 const {page,errors}=await open('editor');
 try{
  const {project}=await command(page,'getProject');const sprite=project.targets[1];sprite.variables={testResult:['result','']};
  sprite.blocks={
    flag:{opcode:'event_whenflagclicked',next:'predict',parent:null,inputs:{},fields:{},topLevel:true,shadow:false,x:60,y:60},
    predict:{opcode:'duetML_predict',next:'set',parent:'flag',inputs:{},fields:{},topLevel:false,shadow:false},
    set:{opcode:'data_setvariableto',next:'write',parent:'predict',inputs:{VALUE:[3,'label',[10,'']]},fields:{VARIABLE:['result','testResult']},topLevel:false,shadow:false},
    label:{opcode:'duetML_label',next:null,parent:'set',inputs:{},fields:{},topLevel:false,shadow:false},
    write:{opcode:'duetHardware_digitalWrite',next:'move',parent:'set',inputs:{PIN:[1,[4,'13']],VALUE:[1,[4,'1']]},fields:{},topLevel:false,shadow:false},
    move:{opcode:'motion_changexby',next:null,parent:'write',inputs:{DX:[3,'confidence',[4,'0']]},fields:{},topLevel:false,shadow:false},
    confidence:{opcode:'duetML_confidence',next:null,parent:'move',inputs:{},fields:{},topLevel:false,shadow:false}
  };project.extensions=['duetML','duetHardware'];
  await command(page,'loadProject',{project});await page.evaluate(()=>{window.messages=[]});await command(page,'greenFlag');
  await page.waitForFunction(()=>window.rpcCalls.some(c=>c.method==='confidence'),null,{timeout:8000});
  await page.waitForFunction(()=>{const started=window.messages.findIndex(m=>m.type==='status'&&m.payload.running===true);return started>=0&&window.messages.slice(started+1).some(m=>m.type==='status'&&m.payload.running===false)},null,{timeout:8000});
  const result=(await command(page,'getProject')).project.targets[1];assert.equal(result.variables.testResult[1],'Robot');assert.equal(result.x,92);
  const calls=await page.evaluate(()=>window.rpcCalls);assert.deepEqual(calls.map(c=>[c.extension,c.method,c.args]),[['ml','predict',[]],['ml','label',[]],['hardware','digitalWrite',[13,1]],['ml','confidence',[]]]);
  const saved=await command(page,'saveProject');await command(page,'loadProject',{project:saved.base64,encoding:'base64'});const reloaded=(await command(page,'getProject')).project;assert.ok(reloaded.extensions.includes('duetML'));assert.ok(reloaded.targets[1].blocks.predict);
  await page.screenshot({path:path.join(root,'work/test-results/custom-extension-program.png')});assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
