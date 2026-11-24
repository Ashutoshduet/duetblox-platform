import {test,expect} from '@playwright/test';
import {makeJuniorProject,makeJuniorBlock} from '../../src/junior/model.js';
async function openJunior(page){await page.goto('./#/junior');await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled({timeout:60000});}
async function chooseStory(page,story){const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open story',exact:true}).click();await(await chooser).setFiles({name:'story.junior.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(story))});await expect(page.getByRole('textbox',{name:'Junior project title'})).toHaveValue(story.title);}
async function xPosition(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const requestId=Date.now()+Math.random(),frame=document.querySelector('iframe[data-duet-editor="junior"]');const timeout=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('Stage did not respond'));},5000);function listener(event){if(event.source!==frame.contentWindow||event.data?.requestId!==requestId)return;window.removeEventListener('message',listener);clearTimeout(timeout);const data=event.data.payload.project;const project=typeof data==='string'?JSON.parse(data):data;resolve(Math.round(project.targets.find(t=>!t.isStage).x));}window.addEventListener('message',listener);frame.contentWindow.postMessage({channel:'duetblox',requestId,type:'getProject'},location.origin);}));}
function quietWav(){const buffer=Buffer.alloc(44+16000);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(16000,24);buffer.writeUInt32LE(32000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(16000,40);return buffer;}
test('Junior paint and sound dialogs keep keyboard focus and recover from an invalid audio upload',async({page},info)=>{
 await openJunior(page);const paint=page.getByRole('button',{name:'Paint selected character',exact:true});await paint.click();
 const drawing=page.getByRole('dialog',{name:'Draw a costume'});await expect(drawing.getByRole('textbox',{name:'Name',exact:true})).toBeFocused();
 await expect(page.locator('#root')).toHaveAttribute('inert','');await drawing.getByRole('button',{name:'Use drawing'}).focus();await page.keyboard.press('Tab');await expect(drawing.getByRole('textbox',{name:'Name',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(drawing).toHaveCount(0);await expect(paint).toBeFocused();
 await page.getByRole('tab',{name:'Sound',exact:true}).click();const sounds=page.getByRole('button',{name:'Your sounds',exact:true});await sounds.click();
 const audio=page.getByRole('dialog',{name:'Your sounds'});await expect(audio.getByRole('textbox',{name:'Recording name'})).toBeFocused();
 await audio.locator('input[type=file]').setInputFiles({name:'bad.wav',mimeType:'audio/wav',buffer:Buffer.from('not audio')});
 await expect(audio.getByRole('alert')).toContainText('Could not add this sound');await expect(audio.getByRole('alert')).toBeVisible();
 await page.screenshot({path:info.outputPath('audio-error-inline.png')});
 await audio.locator('input[type=file]').setInputFiles({name:'quiet.wav',mimeType:'audio/wav',buffer:quietWav()});
 await expect(audio.locator('audio')).toHaveCount(1);await expect(audio.getByRole('alert')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(sounds).toBeFocused();
});
test('opening a replacement Junior story can be undone without losing the previous story',async({page})=>{
 await openJunior(page);await page.getByRole('textbox',{name:'Junior project title'}).fill('My original story');
 const before=await page.locator('[data-junior-block-id]').count(),next=makeJuniorProject();next.title='Replacement';next.scenes[0].sprites[0].scripts[0].blocks=[];
 await chooseStory(page,next);await expect(page.locator('[data-junior-block-id]')).toHaveCount(0);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await expect(page.getByRole('textbox',{name:'Junior project title'})).toHaveValue('My original story');await expect(page.locator('[data-junior-block-id]')).toHaveCount(before);
});
for(const viewport of [{width:390,height:844},{width:375,height:667}])test(`phone ${viewport.width}×${viewport.height} Junior keeps playback and Help reachable, pages hidden blocks and executes in the stage tab`,async({page},info)=>{
 await page.setViewportSize(viewport);await openJunior(page);
 const inViewport=async locator=>{const box=await locator.boundingBox();expect(box).not.toBeNull();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);};
 await inViewport(page.getByRole('button',{name:'Play story',exact:true}));await inViewport(page.getByRole('button',{name:'Stop story',exact:true}));await inViewport(page.locator('.junior-palette-content'));for(const button of await page.locator('.junior-canvas-tools button').all())await inViewport(button);
 const palette=page.locator('.junior-palette-content');await expect(page.getByRole('button',{name:'More blocks',exact:true})).toBeEnabled();await page.getByRole('button',{name:'More blocks',exact:true}).click();await expect.poll(()=>palette.evaluate(node=>node.scrollLeft)).toBeGreaterThan(100);
 await page.getByRole('button',{name:'Previous blocks',exact:true}).click();await expect.poll(()=>palette.evaluate(node=>node.scrollLeft)).toBeLessThanOrEqual(2);
 await page.getByRole('button',{name:'Junior help',exact:true}).click();const help=page.getByRole('dialog',{name:'Your first story'});await expect(help).toBeVisible();await expect(help.getByRole('button',{name:'Got it'})).toBeFocused();await page.keyboard.press('Escape');
 const story=makeJuniorProject();story.title='Phone story';story.scenes[0].sprites[0].scripts[0].blocks=[{...makeJuniorBlock('right'),value:3}];await chooseStory(page,story);
 await page.screenshot({path:info.outputPath('phone-code.png')});await page.getByRole('button',{name:'Play story',exact:true}).click();
 await expect(page.getByRole('button',{name:'Stage',exact:true})).toHaveAttribute('aria-pressed','true');await inViewport(page.locator('.junior-stage-frame'));await expect.poll(()=>xPosition(page)).toBe(60);
 await page.screenshot({path:info.outputPath('phone-stage.png')});await page.getByRole('button',{name:'Stop story',exact:true}).click();
 await page.getByRole('button',{name:'Code',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Go right squares',exact:true})).toHaveValue('3');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
});
