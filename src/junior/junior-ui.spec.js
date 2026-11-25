import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const blocks = page => page.locator('.junior-program[data-selected="true"] > .junior-block');
const names = page => blocks(page).evaluateAll(items => items.map(item => item.querySelector(':scope > strong').textContent));
async function open(page) {
  await page.goto('src/junior/smoke.html');
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
}
async function vmSprite(page) {
  await page.getByRole('button', {name: 'Read VM state', exact: true}).click();
  await expect(page.locator('#test-status')).toContainText('"x"');
  return JSON.parse(await page.locator('#test-status').innerText()).find(target => target.name !== 'Stage');
}

test('palette drop inserts at a gap; reorder, keyboard, undo and export preserve exact sequence', async ({page}, info) => {
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await open(page);
  await expect(blocks(page)).toHaveCount(6);
  await page.getByRole('button', {name:'Add Go right block',exact:true}).dragTo(blocks(page).first(), {targetPosition:{x:4,y:45}});
  await expect(blocks(page)).toHaveCount(7);
  await expect.poll(()=>names(page)).toEqual(['Go right','Speed','Go right','Hop','Grow','Shrink','Turn left']);
  // Moving a connected piece to a later gap must not introduce an off-by-one error.
  await blocks(page).first().dragTo(blocks(page).nth(3), {targetPosition:{x:88,y:45}});
  await expect.poll(()=>names(page)).toEqual(['Speed','Go right','Hop','Go right','Grow','Shrink','Turn left']);
  await blocks(page).nth(3).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect.poll(()=>names(page)).toEqual(['Speed','Go right','Go right','Hop','Grow','Shrink','Turn left']);
  await blocks(page).nth(2).focus();
  await page.keyboard.press('Delete');
  await expect(blocks(page)).toHaveCount(6);
  await page.getByRole('button',{name:'Undo edit',exact:true}).click();
  await expect(blocks(page)).toHaveCount(7);
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save story',exact:true}).click();
  const saved=JSON.parse(await readFile(await (await downloadEvent).path(),'utf8'));
  expect(saved.scenes[0].sprites[0].scripts[0].blocks.map(block=>block.type)).toEqual(['speed','right','right','hop','grow','shrink','turnLeft']);
  expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('junior-desktop.png'),fullPage:true});
});

test('nested loop edits and keyboard category navigation keep branch boundaries', async ({page}) => {
  await open(page);
  await page.getByRole('button',{name:'Load forever scenario',exact:true}).click();
  await page.getByRole('button',{name:'1 step inside'}).click();
  await expect(blocks(page)).toHaveCount(1);
  await page.getByRole('button',{name:'Add Go right block',exact:true}).dragTo(page.locator('.junior-drop-hint'));
  await expect.poll(()=>names(page)).toEqual(['Turn','Go right']);
  await page.getByRole('button',{name:'Back one level',exact:true}).click();
  await expect.poll(()=>names(page)).toEqual(['Forever']);
  await expect(page.getByRole('button',{name:'2 steps inside'})).toBeVisible();
  await page.getByRole('tab',{name:'Motion',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Looks',exact:true})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab',{name:'All blocks',exact:true})).toHaveAttribute('aria-selected','true');
});

test('a block moves between two visible script stacks as one undoable edit',async({page})=>{
  await open(page);
  const stacks=page.locator('.junior-canvas-stack');
  const source=stacks.nth(0).locator('.junior-block').first();
  await source.dragTo(stacks.nth(1).locator('.junior-drop-hint'));
  await expect(stacks.nth(0).locator('.junior-block')).toHaveCount(5);
  await expect(stacks.nth(1).locator('.junior-block')).toHaveCount(2);
  await expect(stacks.nth(1).locator('.junior-block').last()).toHaveAccessibleName('2. Speed block');
  await page.getByRole('button',{name:'Undo edit',exact:true}).click();
  await expect(stacks.nth(0).locator('.junior-block')).toHaveCount(6);
  await expect(stacks.nth(1).locator('.junior-block')).toHaveCount(1);
});

test('real Scratch VM runs motion, stops forever, resumes and resets; grid toggles', async ({page}) => {
  await open(page);
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await expect.poll(async()=>{
    const sprite=await vmSprite(page); return {x:Math.round(sprite.x),y:Math.round(sprite.y),direction:Math.round(sprite.direction)};
  },{timeout:20000}).toEqual({x:40,y:0,direction:60});
  await page.getByRole('button',{name:'Show stage grid',exact:true}).click();
  await expect(page.locator('.junior-stage-grid')).toBeVisible();
  await page.getByRole('button',{name:'Show stage grid',exact:true}).click();
  await expect(page.locator('.junior-stage-grid')).toHaveCount(0);
  await page.getByRole('button',{name:'Load forever scenario',exact:true}).click();
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await page.getByRole('button',{name:'Stop story',exact:true}).click();
  await expect(page.locator('.junior-status')).toContainText('Program stopped');
  await expect(page.getByRole('button',{name:'Play story',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Play story',exact:true}).click();
  await page.getByRole('button',{name:'Reset starting positions',exact:true}).click();
  await expect(page.locator('.junior-status')).toContainText('Back to the starting positions');
  await expect.poll(async()=>Math.round((await vmSprite(page)).direction)).toBe(90);
});

test('thumbnail selection, properties and responsive widths remain usable', async ({page}, info) => {
  await open(page);
  await page.getByRole('button',{name:'Add scene',exact:true}).click();
  await expect(page.locator('.junior-scene-tab')).toHaveCount(2);
  await expect(page.locator('.junior-scene-tab').nth(1)).toHaveAttribute('aria-pressed','true');
  await page.getByText('Edit character & scene',{exact:true}).click();
  await page.getByRole('textbox',{name:'Scene name',exact:true}).fill('Moon mission');
  await expect(page.locator('.junior-scene-tab').nth(1)).toContainText('Moon mission');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await page.getByRole('button',{name:'robot',exact:true}).click();
  await expect(page.locator('.junior-character')).toHaveCount(2);
  await expect(page.locator('.junior-character.junior-selected')).toContainText('Robot');
  for(const width of [1024,768,390]) {
    await page.setViewportSize({width,height:1000});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('button',{name:'Stop story',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Save story',exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath(`junior-${width}.png`),fullPage:true});
  }
});
