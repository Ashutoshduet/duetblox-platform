import {test,expect} from '@playwright/test';

async function expectWorkspaceLabelsToFit(page,info){
 await page.evaluate(()=>document.fonts.ready);
 const measurements=await page.locator('.sidebar .nav-item').evaluateAll(buttons=>buttons.map(button=>{
  const label=button.querySelector('span'),box=button.getBoundingClientRect(),text=label.getBoundingClientRect();
  return {name:label.textContent,buttonWidth:box.width,buttonHeight:box.height,labelWidth:label.clientWidth,textWidth:label.scrollWidth,
   fits:text.left>=box.left-1&&text.right<=box.right+1&&text.top>=box.top-1&&text.bottom<=box.bottom+1&&label.scrollWidth<=label.clientWidth+1};
 }));
 await info.attach('workspace-label-measurements',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
 for(const measurement of measurements){
  expect(measurement.buttonWidth,`${measurement.name}: pointer target width`).toBeGreaterThanOrEqual(44);
  expect(measurement.buttonHeight,`${measurement.name}: pointer target height`).toBeGreaterThanOrEqual(44);
  expect(measurement.fits,`${measurement.name}: label stays inside its button — ${JSON.stringify(measurement)}`).toBe(true);
 }
 const nav=page.getByRole('navigation',{name:'Workspaces',exact:true});
 expect(await nav.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Workspace navigation has no horizontal overflow').toBe(true);
}

for(const viewport of [{width:390,height:844},{width:600,height:768},{width:601,height:768},{width:692,height:768},{width:850,height:768},{width:851,height:768},{width:1366,height:768}]){
 test(`students can identify workspaces and open Help by keyboard at ${viewport.width}px`,async({page},info)=>{
  await page.setViewportSize(viewport);await page.goto('./#/learn');
  const nav=page.getByRole('navigation',{name:'Workspaces',exact:true});
  for(const name of ['Workspace','Learn step by step','My projects','Boards & robots','Classroom','Offline']){
   const button=nav.getByRole('button',{name,exact:true});
   await expect(button.locator('span')).toBeVisible();
  }
  await expectWorkspaceLabelsToFit(page,info);
  await expect(nav.getByRole('button',{name:'Learn step by step',exact:true})).toHaveAttribute('aria-current','page');
  const help=page.getByRole('button',{name:'Help & about',exact:true});await help.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(help).toBeFocused();
  const projects=nav.getByRole('button',{name:'My projects',exact:true});await projects.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'My projects',exact:true})).toBeVisible();await expect(projects).toHaveAttribute('aria-current','page');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:info.outputPath('named-workspaces.png'),fullPage:false});
 });
}
test('Blocks keeps compact workspace names and keyboard Help available',async({page},info)=>{
 await page.goto('./#/blocks');
 await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled({timeout:60000});
 const nav=page.getByRole('navigation',{name:'Workspaces',exact:true});
 await expect(nav.getByRole('button',{name:'Junior Blocks',exact:true}).locator('span')).toBeVisible();
 await expect(nav.getByRole('button',{name:'Blocks',exact:true})).toHaveAttribute('aria-current','page');
 await expectWorkspaceLabelsToFit(page,info);
 const help=page.getByRole('button',{name:'Help & about',exact:true});await help.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(help).toBeFocused();
 await page.screenshot({path:info.outputPath('blocks-named-workspaces.png'),fullPage:false});
});
