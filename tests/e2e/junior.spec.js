import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {makeJuniorProject,makeJuniorScript,makeJuniorBlock,parseJuniorProject} from '../../src/junior/model.js';
import {md5,validateMediaAsset} from '../../src/junior/media.js';

const navigate=async(page,name)=>{
  // Stopping a running stage is asynchronous. Wait for the previous navigation
  // to finish before deciding whether the requested editor is already open.
  await expect(page.locator('.workspace-switch-status')).toHaveCount(0);
  if(name==='Junior Blocks'&&await page.getByRole('region',{name:'Junior coding editor',exact:true}).isVisible())return;
  await page.getByRole('button',{name,exact:true}).click();
  if(name==='Workspace')await expect(page).toHaveURL(/#\/home$/);
  if(name==='Junior Blocks')await expect(page).toHaveURL(/#\/junior$/);
};
const piece=(type,patch={})=>({...makeJuniorBlock(type),...patch});
function parallelStory(){
  const project=makeJuniorProject(),sprite=project.scenes[0].sprites[0];
  project.title='Parallel classroom story';sprite.x=0;sprite.y=0;sprite.size=100;
  sprite.scripts[0].blocks=[piece('wait',{value:3}),piece('move',{value:30})];
  sprite.scripts.push({...makeJuniorScript('flag'),blocks:[piece('grow',{value:10})]});
  return project;
}
async function importStory(page,project){
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open story',exact:true}).click();
  await(await chooser).setFiles({name:'parallel.junior.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await expect(page.getByRole('textbox',{name:'Junior project title',exact:true})).toHaveValue(project.title);
}
async function stageProject(page){
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const frame=document.querySelector('iframe[data-duet-editor="junior"]'),requestId=`verify-${crypto.randomUUID()}`;
    const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('No VM project response'));},5000);
    function listener(event){if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.channel!=='duetblox'||event.data.requestId!==requestId)return;clearTimeout(timer);window.removeEventListener('message',listener);if(event.data.type==='error')reject(new Error(event.data.payload?.message));else resolve(event.data.payload.project);}
    window.addEventListener('message',listener);frame.contentWindow.postMessage({channel:'duetblox',requestId,type:'getProject'},location.origin);
  }));
}
async function storedJunior(page){
  return page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('duetblox-workspace',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('records').objectStore('records').get('current-workspace');read.onsuccess=()=>{db.close();resolve(read.result?.junior);};read.onerror=()=>{db.close();reject(read.error);};};}));
}

test('full App Junior has directly editable parallel stacks, saved positions and concurrent flag execution',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');await navigate(page,'Junior Blocks');
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
  await importStory(page,parallelStory());
  const stacks=page.locator('.junior-canvas-stack');await expect(stacks).toHaveCount(2);
  await stacks.nth(1).getByRole('spinbutton',{name:'Grow percent',exact:true}).fill('20');
  await stacks.nth(0).getByRole('spinbutton',{name:'Move pixels',exact:true}).fill('31');
  await expect(stacks.nth(1).getByRole('spinbutton',{name:'Grow percent',exact:true})).toHaveValue('20');
  const handle=page.getByRole('button',{name:'Move script 1',exact:true}),box=await handle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+20);await page.mouse.down();await page.mouse.move(box.x+box.width/2+85,box.y+65,{steps:12});await page.mouse.up();
  await expect(stacks.nth(0)).toHaveCSS('left','97px');await expect(stacks.nth(0)).toHaveCSS('top','57px');
  await handle.focus();await page.keyboard.press('ArrowRight');
  await expect(stacks.nth(0)).toHaveCSS('left','107px');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  // The second flag stack grows immediately while the first is still waiting.
  await expect.poll(async()=>{const sprite=(await stageProject(page)).targets.find(t=>!t.isStage);return {x:Math.round(sprite.x),size:Math.round(sprite.size)};}).toEqual({x:0,size:120});
  await expect.poll(async()=>Math.round((await stageProject(page)).targets.find(t=>!t.isStage).x)).toBe(31);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save story',exact:true}).click();
  const saved=JSON.parse(await readFile(await(await downloadEvent).path(),'utf8'));
  expect(saved.scenes[0].sprites[0].scripts[0].canvas).toEqual({x:107,y:57});
  const archiveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
  const archive=await JSZip.loadAsync(await readFile(await(await archiveEvent).path()));
  const manifest=JSON.parse(await archive.file('duetblox.json').async('string'));
  expect(manifest.junior.scenes[0].sprites[0].scripts[0].canvas).toEqual({x:107,y:57});
  await expect.poll(async()=>(await storedJunior(page))?.scenes[0].sprites[0].scripts[0].canvas).toEqual({x:107,y:57});
  await page.reload();await navigate(page,'Junior Blocks');
  await expect(stacks).toHaveCount(2);await expect(stacks.nth(0)).toHaveCSS('left','107px');
  await expect(stacks.nth(0).getByRole('spinbutton',{name:'Move pixels',exact:true})).toHaveValue('31');
  await importStory(page,saved);await expect(stacks.nth(0)).toHaveCSS('top','57px');
  await expect.poll(async()=>(await stageProject(page)).targets.find(t=>!t.isStage)?.name).toContain('Fox');
  await page.screenshot({path:info.outputPath('junior-full-app.png'),fullPage:true});
  await navigate(page,'Workspace');await navigate(page,'Junior Blocks');
  await expect(stacks).toHaveCount(2);expect(errors).toEqual([]);
});


async function openFreshJunior(page){
  await page.goto('./');await navigate(page,'Junior Blocks');
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});
}
async function removeStarterBlocks(page){
  const blocks=page.locator('.junior-canvas-stack [data-junior-block-id]');
  while(await blocks.count()){await blocks.first().focus();await page.keyboard.press('Delete');}
}
async function positionOfFirstCharacter(page){
  const target=(await stageProject(page)).targets.find(t=>!t.isStage&&t.visible);
  return {x:Math.round(target.x),y:Math.round(target.y)};
}
async function dropInEmptyCanvas(page,source,x=180){
  const viewport=page.getByRole('region',{name:'Scrollable script canvas',exact:true});
  const bounds=await viewport.boundingBox();
  await source.dragTo(viewport,{targetPosition:{x:Math.min(x,bounds.width-45),y:bounds.height-45}});
}

test('a child can build by dragging picture blocks onto empty canvas, edit, play, reset and reopen without importing a fixture',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openFreshJunior(page);await removeStarterBlocks(page);
  await page.getByRole('textbox',{name:'Junior project title',exact:true}).fill('Built with picture blocks');
  const right=page.getByRole('button',{name:'Add Go right block',exact:true});
  await dropInEmptyCanvas(page,right);
  const stacks=page.locator('.junior-canvas-stack');
  await expect(stacks).toHaveCount(1);
  await expect(stacks.locator('[data-junior-block-id]')).toHaveCount(1);
  await page.getByRole('spinbutton',{name:'Go right squares',exact:true}).fill('3');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:60,y:-38});
  await page.getByRole('button',{name:'Reset starting positions',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:0,y:-38});
  // A second loose drop starts another connected script instead of disappearing.
  await page.getByRole('button',{name:'Arrange scripts',exact:true}).click();
  await page.getByRole('tab',{name:/Looks/}).click();
  await dropInEmptyCanvas(page,page.getByRole('button',{name:'Add Grow block',exact:true}),380);
  await expect(stacks).toHaveCount(2);
  await stacks.nth(1).getByRole('spinbutton',{name:'Grow percent',exact:true}).fill('20');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:60,y:-38});
  await expect.poll(async()=>Math.round((await stageProject(page)).targets.find(t=>!t.isStage).size)).toBe(105);
  await page.getByRole('button',{name:'Reset starting positions',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:0,y:-38});
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save story',exact:true}).click();
  const saved=JSON.parse(await readFile(await(await downloadEvent).path(),'utf8'));
  expect(saved.title).toBe('Built with picture blocks');
  expect(saved.scenes[0].sprites[0].scripts.map(s=>s.blocks.map(b=>[b.type,b.value]))).toEqual([[['right',3]],[['grow',20]]]);
  expect(saved.scenes[0].sprites[0].scripts[1].canvas.x).toBeGreaterThan(0);
  await expect.poll(async()=>(await storedJunior(page))?.scenes[0].sprites[0].scripts.length).toBe(2);
  await page.reload();await navigate(page,'Junior Blocks');
  await expect(stacks).toHaveCount(2);
  await expect(page.getByRole('spinbutton',{name:'Go right squares',exact:true})).toHaveValue('3');
  await expect(page.getByRole('spinbutton',{name:'Grow percent',exact:true})).toHaveValue('20');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:60,y:-38});
  await expect.poll(async()=>Math.round((await stageProject(page)).targets.find(t=>!t.isStage).size)).toBe(105);
  await page.getByRole('button',{name:'Stop story',exact:true}).click();
  await page.screenshot({path:info.outputPath('junior-created-by-dragging.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('Junior keeps the canvas, stage and picture-block dock visible together at laptop size',async({page},info)=>{
  await page.setViewportSize({width:1440,height:900});await openFreshJunior(page);
  const bounds=await page.evaluate(()=>{
    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {viewport:{width:innerWidth,height:innerHeight},canvas:box('.junior-canvas-viewport'),palette:box('.junior-palette-content'),stage:box('.junior-stage-frame'),play:box('.junior-runbar'),pageWidth:document.documentElement.scrollWidth};
  });
  expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.viewport.width+1);
  for(const part of [bounds.canvas,bounds.palette,bounds.stage,bounds.play]){
    expect(part.x).toBeGreaterThanOrEqual(0);expect(part.y).toBeGreaterThanOrEqual(0);
    expect(part.right).toBeLessThanOrEqual(bounds.viewport.width+1);expect(part.bottom).toBeLessThanOrEqual(bounds.viewport.height+1);
  }
  expect(bounds.canvas.width).toBeGreaterThan(bounds.stage.width*1.3);
  expect(bounds.canvas.height).toBeGreaterThan(350);
  await page.screenshot({path:info.outputPath('junior-desktop-layout.png'),fullPage:true});
  const motion=page.getByRole('tab',{name:/Motion/});await motion.focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:/Looks/})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('button',{name:'Add Say block',exact:true})).toBeVisible();
  await page.setViewportSize({width:1366,height:768});
  for(const selector of ['.junior-canvas-viewport','.junior-palette-content','.junior-stage-frame','.junior-runbar']){
    const box=await page.locator(selector).boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(769);
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(1367);
  }
  await page.screenshot({path:info.outputPath('junior-laptop-layout.png'),fullPage:true});
  // Browser chrome and dock space leave many real laptops only 650px of page
  // height. Every floating tool must remain inside the canvas and unobscured.
  for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1366,height:650},{width:1470,height:656}]){
    await page.setViewportSize(viewport);
    const tools=await page.locator('.junior-canvas-tools button').evaluateAll(buttons=>{
      const canvas=document.querySelector('.junior-canvas-viewport').getBoundingClientRect();
      return buttons.map(button=>{
        const box=button.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);
        return {name:button.getAttribute('aria-label'),insideCanvas:box.left>=canvas.left&&box.top>=canvas.top&&box.right<=canvas.right&&box.bottom<=canvas.bottom,insideWindow:box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,hit:!!hit&&(hit===button||button.contains(hit))};
      });
    });
    expect(tools).toHaveLength(6);
    for(const tool of tools){
      expect(tool.insideCanvas,`${viewport.width}×${viewport.height}: ${tool.name} fits canvas`).toBe(true);
      expect(tool.insideWindow,`${viewport.width}×${viewport.height}: ${tool.name} fits viewport`).toBe(true);
      expect(tool.hit,`${viewport.width}×${viewport.height}: ${tool.name} can receive pointer input`).toBe(true);
    }
    if(viewport.height<700)await page.screenshot({path:info.outputPath(`junior-short-${viewport.width}x${viewport.height}.png`),fullPage:true});
  }
});

test('character selection does not consume Undo, and separate character/scene programs survive reopening',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openFreshJunior(page);await removeStarterBlocks(page);
  await page.locator('.junior-add-character').click();
  await page.locator('.junior-character-picker').getByRole('button',{name:'robot',exact:true}).click();
  await page.getByRole('button',{name:'Add Go right block',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Go right squares',exact:true}).fill('2');
  await page.locator('.junior-characters').getByRole('button',{name:'Fox',exact:true}).click();
  await page.getByRole('button',{name:'Undo edit',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Go right squares',exact:true})).toHaveValue('1');
  await expect(page.locator('.junior-characters').getByRole('button',{name:'Robot',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Redo edit',exact:true}).click();
  await page.locator('.junior-characters').getByRole('button',{name:'Robot',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Go right squares',exact:true})).toHaveValue('2');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(async()=>Math.round((await stageProject(page)).targets.find(t=>!t.isStage&&t.name.includes('Robot')).x)).toBe(95);
  await page.getByRole('button',{name:'Add scene',exact:true}).click();
  await expect(page.locator('.junior-scene-tab')).toHaveCount(2);
  await page.locator('.junior-properties summary').click();
  await page.getByRole('textbox',{name:'Scene name',exact:true}).fill('Our classroom');
  await page.locator('.junior-properties summary').click();
  await page.getByRole('button',{name:'Add Go up block',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Go up squares',exact:true}).fill('2');
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:0,y:2});
  await page.getByRole('button',{name:'Stop story',exact:true}).click();
  await expect.poll(async()=>(await storedJunior(page))?.scenes[1]?.name).toBe('Our classroom');
  await page.reload();await navigate(page,'Junior Blocks');
  await expect(page.locator('.junior-scene-tab')).toHaveCount(2);
  await expect(page.getByRole('spinbutton',{name:'Go up squares',exact:true})).toHaveValue('2');
  await page.locator('.junior-scene-tab').first().click();
  await page.locator('.junior-characters').getByRole('button',{name:'Robot',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Go right squares',exact:true})).toHaveValue('2');
  await page.screenshot({path:info.outputPath('junior-characters-scenes.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('nested picture blocks execute a repeat and a forever story stops without freezing the editor',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openFreshJunior(page);await removeStarterBlocks(page);
  await page.getByRole('tab',{name:/Control/}).click();await page.getByRole('button',{name:'Add Repeat block',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Repeat times',exact:true}).fill('3');
  await page.getByRole('button',{name:'0 steps inside',exact:true}).click();
  await page.getByRole('tab',{name:/Motion/}).click();await page.getByRole('button',{name:'Add Go right block',exact:true}).click();
  await page.getByRole('button',{name:'Back one level',exact:true}).click();
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:60,y:-38});
  await page.getByRole('button',{name:'Reset starting positions',exact:true}).click();
  await expect.poll(()=>positionOfFirstCharacter(page)).toEqual({x:0,y:-38});
  await removeStarterBlocks(page);
  await page.getByRole('tab',{name:/Control/}).click();await page.getByRole('button',{name:'Add Forever block',exact:true}).click();
  await page.getByRole('button',{name:'0 steps inside',exact:true}).click();
  await page.getByRole('button',{name:'Add Wait block',exact:true}).click();await page.getByRole('spinbutton',{name:'Wait seconds',exact:true}).fill('0.1');
  await page.getByRole('button',{name:'Back one level',exact:true}).click();
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect(page.locator('.junior-run-caption')).toHaveText('Playing');
  await page.getByRole('button',{name:'Stop story',exact:true}).click();
  await expect(page.locator('.junior-run-caption')).toHaveText('Ready');
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled();
  await page.getByRole('textbox',{name:'Junior project title',exact:true}).fill('Still responsive after stop');
  await expect.poll(async()=>(await storedJunior(page))?.title).toBe('Still responsive after stop');
  expect(errors).toEqual([]);
});


test('a full twenty-costume story keeps media limits and round-trips while the sound-library tile stays usable',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await openFreshJunior(page);
  // Use actual distinct PNG encodings: twenty duplicate IDs would not exercise
  // the per-character limit after import normalization de-duplicates them.
  const images=await page.evaluate(()=>Array.from({length:20},(_,index)=>{
    const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;
    const context=canvas.getContext('2d');context.fillStyle=`rgb(${index*11},${255-index*7},${index*5})`;context.fillRect(0,0,8,8);
    return canvas.toDataURL('image/png').split(',')[1];
  }));
  const assets=images.map((data,index)=>validateMediaAsset({id:md5(Uint8Array.from(Buffer.from(data,'base64'))),name:`Costume ${index+1}`,dataFormat:'png',data,width:8,height:8}));
  expect(new Set(assets.map(asset=>asset.id)).size).toBe(20);
  const story=makeJuniorProject();story.title='Twenty costumes';story.assets=assets;
  const character=story.scenes[0].sprites[0];character.costumeAssetIds=assets.map(asset=>asset.id);character.initialCostume=20;character.scripts[0].blocks=[];
  await importStory(page,story);
  await expect(page.getByRole('button',{name:'Paint selected character',exact:true})).toBeDisabled();
  await page.locator('.junior-properties summary').click();
  await expect(page.getByRole('button',{name:'Paint costume',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Upload costume',exact:true})).toBeDisabled();
  await expect(page.getByRole('combobox',{name:'Starting costume',exact:true})).toHaveValue('20');
  await page.locator('.junior-properties summary').click();
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(async()=>{
    const target=(await stageProject(page)).targets.find(target=>!target.isStage);
    return {costumes:target.costumes.length,currentCostume:target.currentCostume};
  }).toEqual({costumes:21,currentCostume:20});
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save story',exact:true}).click();
  const saved=parseJuniorProject(await readFile(await(await downloadEvent).path(),'utf8'));
  expect(saved.assets.map(asset=>asset.id)).toEqual(assets.map(asset=>asset.id));
  expect(saved.scenes[0].sprites[0].costumeAssetIds).toHaveLength(20);
  await importStory(page,saved);
  await expect(page.getByRole('button',{name:'Paint selected character',exact:true})).toBeDisabled();
  await page.getByRole('tab',{name:/Sound/}).click();
  const sounds=page.getByRole('button',{name:/^Your sounds/});await expect(sounds).toBeVisible();
  await sounds.screenshot({path:info.outputPath('sound-library-tile.png')});
  await sounds.click();
  const dialog=page.getByRole('dialog',{name:'Your sounds',exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Upload sound',exact:true})).toBeEnabled();
  await expect(dialog.getByRole('button',{name:'Record microphone',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('sound-library-open.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Done',exact:true}).click();await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});
