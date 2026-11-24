import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('tests/components/dialog-test.html');});
test('nested portals trap focus, preserve inert state and restore both triggers under StrictMode',async({page})=>{
 const opener=page.getByRole('button',{name:'Open parent',exact:true});await opener.click();
 await expect(page.getByRole('textbox',{name:'Parent name'})).toBeFocused();
 await expect(page.locator('#root')).toHaveAttribute('inert','');
 await page.getByRole('button',{name:'Open child',exact:true}).click();
 const child=page.getByRole('dialog',{name:'Child dialog'});await expect(child.getByRole('button',{name:'Close child',exact:true})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(child.getByRole('button',{name:'Close both',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');await expect(child.getByRole('button',{name:'Close child',exact:true})).toBeFocused();
 await page.evaluate(()=>{const button=document.createElement('button');button.id='late-background';button.textContent='Outside';document.body.append(button);});
 await expect(page.locator('#late-background')).toHaveAttribute('inert','');
 await page.evaluate(()=>document.querySelector('#late-background').focus());
 await expect(child.getByRole('button',{name:'Close child',exact:true})).toBeFocused();
 await child.getByRole('button',{name:'Start work'}).click();await page.keyboard.press('Escape');await expect(child).toBeVisible();
 await child.getByRole('button',{name:'Finish work'}).click();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Open child',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(opener).toBeFocused();
 await expect(page.locator('#root')).not.toHaveAttribute('inert','');await expect(page.locator('#late-background')).not.toHaveAttribute('inert','');
 await expect(page.locator('#already-inert')).toHaveAttribute('inert','');
});
test('simultaneous nested mounting keeps child on top and unmounting both restores page focus',async({page})=>{
 const opener=page.getByRole('button',{name:'Open both',exact:true});await opener.click();
 await expect(page.getByRole('dialog',{name:'Child dialog'}).getByRole('button',{name:'Close child',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Close both',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused();
});
test('empty dialog retains focus and successful workspace navigation closes the top layer',async({page})=>{
 const opener=page.getByRole('button',{name:'Open empty',exact:true});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Empty dialog'});await expect(dialog).toBeFocused();
 await page.keyboard.press('Tab');await expect(dialog).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(dialog).toBeFocused();
 await page.evaluate(()=>window.dispatchEvent(new Event('duetblox:workspace-navigation')));
 await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
});
