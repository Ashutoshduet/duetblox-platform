import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const navigate=(page,name)=>page.locator('.sidebar').getByRole('button',{name,exact:true}).click();

test('a student pauses before a chosen command and sees the value before and after stepping',async({page})=>{
  await page.goto('./');await navigate(page,'Blocks');
  await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Open',exact:true}).click();
  await (await chooser).setFiles(path.resolve('public/examples/learning-steps.sb3'));
  await expect(page.locator('.toast')).toContainText(/opened/i);
  await page.getByRole('button',{name:'Learning steps',exact:true}).click();
  const panel=page.getByRole('region',{name:'Learning steps',exact:true});
  await panel.getByRole('button',{name:'Start learning run',exact:true}).click();
  const selected=page.getByLabel('Learning breakpoint',{exact:true});
  await expect(selected).toBeVisible();
  const value=await selected.locator('option').filter({hasText:'Change variable'}).getAttribute('value');
  await selected.selectOption(value);
  await panel.getByRole('button',{name:'Run to breakpoint',exact:true}).click();
  await expect(panel).toContainText('Paused before your breakpoint');
  await expect(panel.locator('.learning-values dd')).toHaveText('5');
  await expect(panel.locator('.learning-sequence').getByText('Change variable',{exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Next step',exact:true}).click();
  await expect(panel).toContainText('Program completed');
  await expect(panel.locator('.learning-values dd')).toHaveText('7');
});

test('real-board observations stay separate from simulated validation and export explicit self-reported results',async({page})=>{
  await page.goto('./');await navigate(page,'Boards & robots');
  await page.getByText('Test your real board · 0/5 observations recorded',{exact:true}).click();
  const panel=page.locator('.board-acceptance');
  await expect(panel).toContainText('not automatic test results');
  await expect(panel.getByLabel('Observation: Identify the exact board',{exact:true})).toHaveValue('not-tested');
  await panel.getByLabel('Observation: Observe a real output',{exact:true}).selectOption('observed-issue');
  await panel.getByLabel('Board test notes',{exact:true}).fill('Test fixture only: no physical board was connected.');
  const downloading=page.waitForEvent('download');await panel.getByRole('button',{name:'Download observations',exact:true}).click();
  const record=JSON.parse(await readFile(await (await downloading).path(),'utf8'));
  expect(record.independentlyVerified).toBe(false);expect(record.softwarePhysicalVerified).toBe(false);
  expect(record.evidenceType).toBe('self-reported physical observations');expect(record.summary).toEqual({observed:1,total:5,issues:1});
  expect(record.checks.find(item=>item.id==='connection').result).toBe('not-tested');
  await page.getByRole('button',{name:'Run after unplugging',exact:false}).click();
  await expect(panel).not.toHaveAttribute('open','');await panel.locator('summary').click();
  await expect(panel.getByLabel('Observation: Observe a real output',{exact:true})).toHaveValue('not-tested');
  await expect(panel.getByLabel('Board test notes',{exact:true})).toHaveValue('');
  await expect(panel.getByLabel('Observation: Run on independent power',{exact:true})).toBeVisible();
  await page.getByLabel('Choose your board',{exact:true}).selectOption('esp32-cam');
  await panel.locator('summary').click();await expect(panel.locator('summary')).toContainText('0/4');
  await expect(panel).toContainText('3.3 V');await expect(panel.getByLabel('Observation: Check a real sensor input',{exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await expect(panel.getByRole('button',{name:'Download observations',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
