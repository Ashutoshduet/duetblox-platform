import {test,expect} from '@playwright/test';
import JSZip from 'jszip';

async function studio(page,kind='Image') {
  await page.locator('.sidebar').getByRole('button',{name:/ML Studio/}).click();
  await page.getByRole('tab',{name:`${kind} learning`,exact:true}).click();
  return page.getByRole('tabpanel',{name:`${kind} learning`,exact:true});
}
async function upload(page,button,value,name='dataset.json') {
  const chooser=page.waitForEvent('filechooser');await button.click();
  await(await chooser).setFiles({name,mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});
}
const classData=(kind,names)=>({kind:`duetblox-${kind}-dataset`,version:1,classes:names.map((name,i)=>({id:`class-${i}`,name,samples:[]}))});

test('text example replacement can recover class names and sentences after reload',async({page})=>{
  await page.goto('./');let panel=await studio(page,'Text');
  await panel.getByLabel('Name of text class 1',{exact:true}).fill('My animals');
  await panel.getByLabel('Examples for My animals',{exact:true}).fill('my dog is happy\nmy cat is sleeping\nmy rabbit likes carrots');
  await panel.getByRole('button',{name:'Add examples',exact:true}).first().click();
  await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('Greeting');
  await expect(panel.getByRole('button',{name:'Undo dataset replacement'})).toBeEnabled();
  await page.reload();panel=await studio(page,'Text');
  await panel.getByRole('button',{name:'Undo dataset replacement'}).click();
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('My animals');
  await expect(panel.locator('.text-sample-list li')).toHaveCount(3);
  await expect(panel.getByText('my rabbit likes carrots',{exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Undo dataset replacement'})).toHaveCount(0);
  await page.reload();panel=await studio(page,'Text');
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('My animals');
  await expect(panel.locator('.text-sample-list li')).toHaveCount(3);
});

for(const config of [
  {kind:'Sound',field:'Name of sound class 2',data:classData('sound',['_background_noise_','New sounds'])},
  {kind:'Pose',field:'Name of pose class 1',data:classData('pose',['New pose','Other pose'])},
  {kind:'Object',field:'Name of object class 1',data:{kind:'duetblox-objects-dataset',version:1,classes:[{id:'new-object',name:'New object'}],images:[]}}
])test(`${config.kind} dataset imports keep a durable previous dataset`,async({page})=>{
  await page.goto('./');let panel=await studio(page,config.kind);
  await panel.getByLabel(config.field,{exact:true}).fill(`My ${config.kind} project`);
  await panel.getByLabel(config.field,{exact:true}).press('Tab');
  await upload(page,panel.getByRole('button',{name:config.kind==='Object'?'Open object dataset':'Open dataset',exact:true}),config.data);
  await expect(panel.getByRole('button',{name:'Undo dataset replacement'})).toBeEnabled();
  await page.reload();panel=await studio(page,config.kind);
  await panel.getByRole('button',{name:'Undo dataset replacement'}).click();
  await expect(panel.getByLabel(config.field,{exact:true})).toHaveValue(`My ${config.kind} project`);
});

test('numbers example recovery retains the original table after reload',async({page})=>{
  await page.goto('./');let panel=await studio(page,'Numbers');
  await panel.getByLabel('New row light',{exact:true}).fill('12');await panel.getByLabel('New row temperature',{exact:true}).fill('26');
  await panel.getByLabel('New row target',{exact:true}).fill('My reading');await panel.getByRole('button',{name:'Add row',exact:true}).click();
  await panel.getByRole('button',{name:'Try numbers example',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Undo dataset replacement'})).toBeEnabled();
  await page.reload();panel=await studio(page,'Numbers');await panel.getByRole('button',{name:'Undo dataset replacement'}).click();
  await expect(panel.locator('.numbers-table-wrap tbody tr')).toHaveCount(1);
  await expect(panel.getByRole('cell',{name:'My reading',exact:true})).toBeVisible();
});

test('image recovery preserves samples and thumbnails work with the keyboard',async({page})=>{
  await page.goto('./');let panel=await studio(page);
  await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await panel.getByLabel('Name of class 1',{exact:true}).fill('My orange shapes');
  await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Undo dataset replacement'})).toBeEnabled();
  await page.reload();panel=await studio(page);await panel.getByRole('button',{name:'Undo dataset replacement'}).click();
  await expect(panel.getByLabel('Name of class 1',{exact:true})).toHaveValue('My orange shapes');
  await expect(panel.locator('.samples img')).toHaveCount(24);
  const sample=panel.getByRole('button',{name:'Test My orange shapes sample 1',exact:true});
  await sample.focus();await expect(sample).toBeFocused();await page.keyboard.press('Enter');
  await expect(panel.getByRole('img',{name:'Image being classified',exact:true})).toBeVisible();
});

for(const kind of ['Image','Sound','Pose'])test(`${kind} model import traps focus and cannot activate the background`,async({page})=>{
  await page.goto('./');const panel=await studio(page,kind),opener=panel.getByRole('button',{name:'Import model',exact:true});
  const before=await panel.locator('.class-heading input').evaluateAll(inputs=>inputs.map(input=>input.value));
  await opener.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  for(let i=0;i<12;i++){
    await page.keyboard.press(i%3?'Tab':'Shift+Tab');
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  expect(await panel.locator('.class-heading input').evaluateAll(inputs=>inputs.map(input=>input.value))).toEqual(before);
  expect(await panel.evaluate(el=>Boolean(el.closest('[inert]')))).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
});

test('malformed imports explain the problem while preserving data and its recovery copy',async({page})=>{
  await page.goto('./');let panel=await studio(page,'Text');await panel.getByLabel('Name of text class 1',{exact:true}).fill('Keep my labels');
  await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await upload(page,panel.getByRole('button',{name:'Open dataset',exact:true}),'{broken');
  await expect(panel.locator('.notice')).toContainText('not valid JSON');await expect(panel.locator('.notice')).not.toContainText('Unexpected token');
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('Greeting');
  await page.reload();panel=await studio(page,'Text');await panel.getByRole('button',{name:'Undo dataset replacement'}).click();
  await expect(panel.getByLabel('Name of text class 1',{exact:true})).toHaveValue('Keep my labels');
});

test('trained text model has a visible Blocks action near the top of the studio',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');const panel=await studio(page,'Text');await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await panel.getByRole('button',{name:'Train text model',exact:true}).click();
  const use=panel.getByRole('button',{name:'Use in Blocks',exact:true});await expect(use).toBeEnabled();
  await page.evaluate(()=>window.scrollTo(0,0));await expect(use).toBeInViewport();
  await page.screenshot({path:testInfo.outputPath('text-model-ready.png'),fullPage:false});
  await panel.getByLabel('Text to classify',{exact:true}).fill('hello good morning friend');await panel.getByRole('button',{name:'Classify text',exact:true}).click();
  await expect(panel.locator('.text-result')).toContainText('Greeting');
  await use.click();await expect(page.locator('.sidebar .nav-item.active')).toContainText('Blocks');expect(errors).toEqual([]);
});

test('clearing a trained model asks first and defaults keyboard focus to keeping it',async({page})=>{
  await page.goto('./');const panel=await studio(page,'Text');await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await panel.getByRole('button',{name:'Train text model',exact:true}).click();await expect(panel.getByRole('button',{name:'Use in Blocks',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Clear text model',exact:true}).click();
  await expect(page.getByRole('button',{name:'Keep model',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(panel.getByRole('button',{name:'Use in Blocks',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Clear text model',exact:true}).click();await page.getByRole('button',{name:'Clear trained model',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(panel.getByRole('button',{name:'Use in Blocks',exact:true})).toHaveCount(0);
  await expect(panel.locator('.text-sample-list li')).toHaveCount(16);
});

test('recovery and trained-model actions fit a narrow viewport',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./');const panel=await studio(page,'Text');
  await panel.getByRole('button',{name:'Try an example',exact:true}).click();await panel.getByRole('button',{name:'Train text model',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Use in Blocks',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel.locator('.ml-dataset-recovery').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('text-recovery-mobile.png'),fullPage:false});
});

test('whole-workspace import clears dataset recovery so Undo cannot mix projects',async({page})=>{
  await page.goto('./');const panel=await studio(page,'Text');await panel.getByRole('button',{name:'Try an example',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Undo dataset replacement'})).toBeEnabled();
  const zip=new JSZip();zip.file('duetblox.json',JSON.stringify({kind:'duetblox-project',version:5,name:'Separate ML project'}));
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open',exact:true}).click();
  await(await chooser).setFiles({name:'separate.duet',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await expect(page.getByRole('textbox',{name:'Project name',exact:true})).toHaveValue('Separate ML project');
  await page.reload();const next=await studio(page,'Text');await expect(next.getByRole('button',{name:'Undo dataset replacement'})).toHaveCount(0);
  await expect(next.getByLabel('Name of text class 1',{exact:true})).toHaveValue('Class 1');
});
