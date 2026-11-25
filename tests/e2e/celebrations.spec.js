import {test, expect} from '@playwright/test';
import {makeJuniorBlock, makeJuniorProject} from '../../src/junior/model.js';
import {lessonById} from '../../src/learn/lessons.js';

const celebration = page => page.getByRole('region', {name: 'Mascot celebration', exact: true});
const piece = (type, values = {}) => ({...makeJuniorBlock(type), ...values});

function storyWith(blocks, title = 'My mascot story') {
  const story = makeJuniorProject();
  story.title = title;
  story.scenes[0].sprites[0].x = 0;
  story.scenes[0].sprites[0].y = 0;
  story.scenes[0].sprites[0].scripts[0].blocks = blocks;
  return story;
}

async function openJunior(page) {
  await page.goto('./#/junior');
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
}

async function importStory(page, story) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name: 'Open story', exact: true}).click();
  await (await chooser).setFiles({name: 'mascot-story.junior.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(story))});
  await expect(page.getByRole('textbox', {name: 'Junior project title', exact: true})).toHaveValue(story.title);
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled();
}

async function firstCharacterX(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const frame = document.querySelector('iframe[data-duet-editor="junior"]');
    const requestId = `mascot-check-${crypto.randomUUID()}`;
    const timeout = setTimeout(() => {window.removeEventListener('message', receive); reject(new Error('The Junior stage did not answer.'));}, 5000);
    function receive(event) {
      if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.channel !== 'duetblox' || event.data.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      if (event.data.type === 'error') {reject(new Error(event.data.payload?.message)); return;}
      let project = event.data.payload.project;
      if (typeof project === 'string') project = JSON.parse(project);
      resolve(Math.round(project.targets.find(target => !target.isStage && target.visible).x));
    }
    window.addEventListener('message', receive);
    frame.contentWindow.postMessage({channel: 'duetblox', requestId, type: 'getProject'}, location.origin);
  }));
}

async function settings(page, open = true) {
  const summary = page.locator('summary').filter({hasText: /^Mascot settings$/});
  const isOpen = await summary.evaluate(node => node.parentElement.open);
  if (isOpen !== open) await summary.click();
}

async function noMovingCelebration(page) {
  await expect.poll(() => page.locator('.celebration-card').evaluateAll(cards => cards.flatMap(card => card.getAnimations({subtree: true})).filter(animation => animation.playState === 'running').length)).toBe(0);
}

async function finishStory(page) {
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(celebration(page)).toBeVisible();
  await expect(celebration(page)).toContainText('You brought your story to life!');
}

test('a real Junior result earns one celebration; replay does not run code or steal focus', async ({page}, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.addInitScript(() => {
    if (window.top !== window) return;
    window.__mascotOscillators = 0;
    const prototype = (window.AudioContext || window.webkitAudioContext)?.prototype;
    if (!prototype) return;
    const create = prototype.createOscillator;
    prototype.createOscillator = function (...args) {window.__mascotOscillators++; return create.apply(this, args);};
  });
  await openJunior(page);
  await importStory(page, storyWith([piece('right', {value: 3}), piece('wait', {value: 0.8})]));
  await settings(page);
  await expect(page.getByLabel('Celebration sound', {exact: true})).not.toBeChecked();
  await settings(page, false);
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  const stop = page.getByRole('button', {name: 'Stop story', exact: true});
  await stop.focus();
  await expect.poll(() => firstCharacterX(page)).toBe(60);
  await expect(celebration(page)).toContainText('You brought your story to life!');
  await expect(stop).toBeFocused();
  await expect(celebration(page)).toHaveAttribute('data-playing', 'false', {timeout: 7000});
  await noMovingCelebration(page);
  expect(await page.evaluate(() => window.__mascotOscillators), 'Celebration audio stays off by default').toBe(0);
  await celebration(page).getByRole('button', {name: 'Replay celebration', exact: true}).click();
  await expect(celebration(page)).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => firstCharacterX(page)).toBe(60);
  await celebration(page).getByRole('button', {name: 'Skip celebration', exact: true}).click();
  await expect(celebration(page)).toHaveAttribute('data-playing', 'false');
  await noMovingCelebration(page);
  await page.screenshot({path: info.outputPath('junior-mascot-success.png'), fullPage: true});
  await settings(page);
  await page.getByLabel('Celebration sound', {exact: true}).check();
  await settings(page, false);
  await celebration(page).getByRole('button', {name: 'Replay celebration', exact: true}).click();
  await expect.poll(() => page.evaluate(() => window.__mascotOscillators)).toBeGreaterThan(0);
  await celebration(page).getByRole('button', {name: 'Skip celebration', exact: true}).click();
  await expect(celebration(page)).toHaveAttribute('data-playing', 'false');
  // A normal second run is allowed, but cannot repeatedly earn the same milestone.
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect(celebration(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
  await expect(celebration(page)).toHaveCount(0);
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect(celebration(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stopping after a real action does not pretend the story completed', async ({page}) => {
  await openJunior(page);
  await importStory(page, storyWith([piece('right', {value: 1}), piece('wait', {value: 5}), piece('right', {value: 2})], 'Stopped before finishing'));
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect.poll(() => firstCharacterX(page)).toBe(20);
  await expect(page.locator('.junior-run-caption')).toHaveText('Playing');
  await page.getByRole('button', {name: 'Stop story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Program stopped');
  await expect(celebration(page)).toHaveCount(0);
  await expect.poll(() => firstCharacterX(page)).toBe(20);
});

test('empty stories and continuing forever loops cannot earn completion', async ({page}) => {
  await openJunior(page);
  await importStory(page, storyWith([], 'No actions yet'));
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect(celebration(page)).toHaveCount(0);
  await importStory(page, storyWith([piece('right', {value: 1}), piece('forever', {children: [piece('wait', {value: 0.1})]})], 'Keep exploring'));
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect.poll(() => firstCharacterX(page)).toBe(20);
  await expect(page.locator('.junior-run-caption')).toHaveText('Playing');
  await expect(celebration(page)).toHaveCount(0);
  await page.getByRole('button', {name: 'Stop story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Program stopped');
  await expect(celebration(page)).toHaveCount(0);
});

test('a disconnected device command does not earn a successful-story celebration', async ({page}) => {
  await openJunior(page);
  await importStory(page, storyWith([piece('right', {value: 1}), piece('pinHigh', {choice: '13'})], 'Board is not connected'));
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect.poll(() => firstCharacterX(page)).toBe(20);
  await expect(page.locator('.junior-status')).toContainText(/Story finished|connect|board|device/i);
  await expect(celebration(page)).toHaveCount(0);
});

test('system reduced motion preserves feedback while disabling all celebration movement', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await openJunior(page);
  await importStory(page, storyWith([piece('right', {value: 2})]));
  await finishStory(page);
  await noMovingCelebration(page);
  await celebration(page).getByRole('button', {name: 'Replay celebration', exact: true}).click();
  await noMovingCelebration(page);
  await expect(celebration(page)).toContainText('You brought your story to life!');
  await expect.poll(() => firstCharacterX(page)).toBe(40);
});

test('mascot choices and quiet/motion preferences persist and celebrations can be switched off', async ({page}) => {
  await openJunior(page);
  await settings(page);
  await expect(page.getByLabel('Celebrate milestones', {exact: true})).toBeChecked();
  await expect(page.getByLabel('Celebration sound', {exact: true})).not.toBeChecked();
  await page.getByLabel('Mascot', {exact: true}).selectOption('tiko');
  await page.getByLabel('Celebration dance', {exact: true}).selectOption('high-five');
  await page.getByLabel('Mascot colours', {exact: true}).selectOption('ocean');
  await page.getByLabel('Reduce celebration motion', {exact: true}).check();
  await page.getByLabel('Celebrate milestones', {exact: true}).uncheck();
  await page.reload();
  await expect(page.getByRole('button', {name: 'Play story', exact: true})).toBeEnabled({timeout: 60000});
  await settings(page);
  await expect(page.getByLabel('Mascot', {exact: true})).toHaveValue('tiko');
  await expect(page.getByLabel('Celebration dance', {exact: true})).toHaveValue('high-five');
  await expect(page.getByLabel('Mascot colours', {exact: true})).toHaveValue('ocean');
  await expect(page.getByLabel('Reduce celebration motion', {exact: true})).toBeChecked();
  await expect(page.getByLabel('Celebration sound', {exact: true})).not.toBeChecked();
  await expect(page.getByLabel('Celebrate milestones', {exact: true})).not.toBeChecked();
  await settings(page, false);
  await importStory(page, storyWith([piece('right', {value: 2})], 'Quiet creating'));
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect.poll(() => firstCharacterX(page)).toBe(40);
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect(celebration(page)).toHaveCount(0);
  await settings(page);
  await page.getByLabel('Celebrate milestones', {exact: true}).check();
  await settings(page, false);
  await importStory(page, storyWith([piece('right', {value: 3})], 'A new quiet celebration'));
  await finishStory(page);
  await noMovingCelebration(page);
});

test('lesson celebration acknowledges self-reported completion only on the final new check', async ({page}) => {
  await page.goto('./#/learn');
  const lesson = lessonById('junior-story');
  await page.getByRole('navigation', {name: 'Choose a lesson'}).getByRole('button', {name: new RegExp(lesson.title.en)}).click();
  await expect(page.locator('.learn-local-note')).toContainText('not an automatic assessment');
  for (const [index, step] of lesson.steps.entries()) {
    if (index) await page.getByRole('button', {name: 'Next step', exact: true}).click();
    await page.getByRole('checkbox', {name: step.check.en, exact: true}).check();
    if (index < lesson.steps.length - 1) await expect(celebration(page)).toHaveCount(0);
  }
  await expect(celebration(page)).toContainText('You checked every step!');
  await expect(celebration(page)).not.toContainText(/verified|passed/i);
  await page.reload();
  await expect(page.locator('.learn-final-step')).toHaveText('All steps checked');
  await expect(celebration(page)).toHaveCount(0);
});

test('phone celebration leaves playback and its own controls reachable without covering the stage', async ({page}, info) => {
  for (const viewport of [{width: 390, height: 844}, {width: 375, height: 667}]) {
    await page.setViewportSize(viewport);
    await openJunior(page);
    await importStory(page, storyWith([piece('right', {value: 3})], `Phone celebration ${viewport.width}`));
    await finishStory(page);
    await expect(page.getByRole('button', {name: 'Stage', exact: true})).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => firstCharacterX(page)).toBe(60);
    const hitTest = async locator => {
      await locator.scrollIntoViewIfNeeded();
      return locator.evaluate(element => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 && !!hit && (hit === element || element.contains(hit));
      });
    };
    for (const name of ['Play story', 'Stop story', 'Replay celebration', 'Skip celebration']) {
      expect(await hitTest(page.getByRole('button', {name, exact: true})), `${viewport.width}: ${name} accepts input`).toBe(true);
    }
    const overlap = await page.evaluate(() => {
      const card = document.querySelector('.celebration-card').getBoundingClientRect();
      const stage = document.querySelector('.junior-stage-frame').getBoundingClientRect();
      return Math.min(card.right, stage.right) > Math.max(card.left, stage.left) && Math.min(card.bottom, stage.bottom) > Math.max(card.top, stage.top);
    });
    expect(overlap, 'The celebration occupies its own space beside or below the stage').toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({path: info.outputPath(`mascot-phone-${viewport.width}.png`), fullPage: true});
  }
});

test('a selected motion goal checks the real result, celebrates a correction once and keeps free play separate', async ({page}, info) => {
  await openJunior(page);
  await importStory(page, storyWith([piece('right', {value: 2})], 'Three squares challenge'));
  await page.locator('summary').filter({hasText: /^Try a small challenge$/}).click();
  await page.getByLabel('Story goal', {exact: true}).selectOption('right');
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect.poll(() => firstCharacterX(page)).toBe(40);
  await expect(page.locator('.junior-challenge [role=status]')).toContainText('Try this');
  await expect(celebration(page)).toHaveCount(0);
  await page.getByRole('spinbutton', {name: 'Go right squares', exact: true}).fill('3');
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect.poll(() => firstCharacterX(page)).toBe(60);
  await expect(celebration(page)).toContainText('You reached your goal!');
  await expect(celebration(page)).not.toContainText('You brought your story to life!');
  await page.screenshot({path: info.outputPath('mascot-verified-goal.png'), fullPage: true});
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect(celebration(page)).toHaveCount(0);
  await expect.poll(() => firstCharacterX(page)).toBe(60);
});

test('replacing a running story with the same ID cancels its pending celebration', async ({page}) => {
  await openJunior(page);
  const original = storyWith([piece('right', {value: 3}), piece('wait', {value: 3})], 'Before replacement');
  await importStory(page, original);
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect.poll(() => firstCharacterX(page)).toBe(60);
  await expect(page.locator('.junior-run-caption')).toHaveText('Playing');
  const replacement = structuredClone(original);
  replacement.title = 'Same ID, new empty story';
  replacement.scenes[0].sprites[0].scripts[0].blocks = [];
  await importStory(page, replacement);
  await expect(page.locator('.junior-run-caption')).toHaveText('Ready');
  await expect(celebration(page)).toHaveCount(0);
  await expect.poll(() => firstCharacterX(page)).toBe(0);
  // Outwait the superseded story's real three-second wait to catch late results.
  await page.waitForTimeout(3300);
  await expect(celebration(page)).toHaveCount(0);
  await expect(page.locator('.junior-run-caption')).toHaveText('Ready');
});

test('replacing an idle completed story with the same ID clears the old success card', async ({page}) => {
  await openJunior(page);
  const original = storyWith([piece('right', {value: 3})], 'A completed story');
  await importStory(page, original);
  await finishStory(page);
  const replacement = structuredClone(original);
  replacement.title = 'Same ID, different work';
  replacement.scenes[0].sprites[0].scripts[0].blocks = [];
  await importStory(page, replacement);
  await expect(celebration(page)).toHaveCount(0);
  await expect.poll(() => firstCharacterX(page)).toBe(0);
  await page.getByRole('button', {name: 'Play story', exact: true}).click();
  await expect(page.locator('.junior-status')).toContainText('Story finished');
  await expect(celebration(page)).toHaveCount(0);
});

test('unchecking and resetting lesson progress clear obsolete celebration cards', async ({page}) => {
  await page.goto('./#/learn');
  const checkLesson = async id => {
    const lesson = lessonById(id);
    await page.getByRole('navigation', {name: 'Choose a lesson'}).getByRole('button', {name: new RegExp(lesson.title.en)}).click();
    for (const [index, step] of lesson.steps.entries()) {
      if (index) await page.getByRole('button', {name: 'Next step', exact: true}).click();
      await page.getByRole('checkbox', {name: step.check.en, exact: true}).check();
    }
    await expect(celebration(page)).toContainText('You checked every step!');
    return lesson;
  };
  const junior = await checkLesson('junior-story');
  const lastCheck = page.getByRole('checkbox', {name: junior.steps.at(-1).check.en, exact: true});
  await lastCheck.uncheck();
  await expect(celebration(page)).toHaveCount(0);
  await expect(page.locator('.learn-final-step')).toContainText('check your work');
  await lastCheck.check();
  await expect(page.locator('.learn-final-step')).toHaveText('All steps checked');
  await expect(celebration(page)).toHaveCount(0);
  const scratch = await checkLesson('scratch-animation');
  await page.getByRole('button', {name: 'Reset this lesson’s progress', exact: true}).click();
  await page.getByRole('button', {name: 'Reset this progress', exact: true}).click();
  await expect(celebration(page)).toHaveCount(0);
  await expect(page.getByRole('checkbox', {name: scratch.steps[0].check.en, exact: true})).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', {name: scratch.steps[0].check.en, exact: true})).not.toBeChecked();
  await expect(celebration(page)).toHaveCount(0);
});

async function installDeferredAudioResume(page) {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const state = window.__mascotAudioGate = {hold: false, pending: [], starts: 0, completedResumes: 0};
    const Context = window.AudioContext || window.webkitAudioContext;
    const resume = Context.prototype.resume;
    Context.prototype.resume = function (...args) {
      const finish = () => resume.apply(this, args).then(value => {state.completedResumes++; return value;});
      return state.hold ? new Promise((resolve, reject) => state.pending.push(() => finish().then(resolve, reject))) : finish();
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {state.starts++; return start.apply(this, args);};
    window.__releaseMascotAudio = async () => {
      state.hold = false;
      await Promise.all(state.pending.splice(0).map(release => release()));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };
  });
}

for (const action of ['disable celebrations', 'start a story']) test(`a deferred audio resume cannot revive a celebration after ${action}`, async ({page}) => {
  await installDeferredAudioResume(page);
  await openJunior(page);
  await importStory(page, storyWith([piece('right', {value: 1}), piece('wait', {value: 5})], 'A story without interruption'));
  await settings(page);
  await page.getByLabel('Celebration sound', {exact: true}).check();
  await expect.poll(() => page.evaluate(() => window.__mascotAudioGate.completedResumes)).toBe(1);
  if (action === 'disable celebrations') {
    await page.getByRole('button', {name: 'Preview dance', exact: true}).click();
    await expect(celebration(page)).toBeVisible();
    await celebration(page).getByRole('button', {name: 'Skip celebration', exact: true}).click();
    await expect(celebration(page)).toHaveAttribute('data-playing', 'false');
  }
  const before = await page.evaluate(() => {window.__mascotAudioGate.hold = true; return window.__mascotAudioGate.starts;});
  const request = action === 'disable celebrations' ? celebration(page).getByRole('button', {name: 'Replay celebration', exact: true}) : page.getByRole('button', {name: 'Preview dance', exact: true});
  await request.click();
  await expect.poll(() => page.evaluate(() => window.__mascotAudioGate.pending.length)).toBe(1);
  if (action === 'disable celebrations') {
    await page.getByLabel('Celebrate milestones', {exact: true}).uncheck();
  } else {
    await settings(page, false);
    await page.getByRole('button', {name: 'Play story', exact: true}).click();
    await expect(page.locator('.junior-run-caption')).toHaveText('Playing');
  }
  await expect(celebration(page)).toHaveCount(0);
  await page.evaluate(() => window.__releaseMascotAudio());
  expect(await page.evaluate(() => window.__mascotAudioGate.starts), 'Cancelled resume must not schedule any new tones').toBe(before);
  await expect(celebration(page)).toHaveCount(0);
  if (action === 'start a story') {
    await expect.poll(() => firstCharacterX(page)).toBe(20);
    await page.getByRole('button', {name: 'Stop story', exact: true}).click();
    await expect(page.locator('.junior-status')).toContainText('Program stopped');
    await expect(celebration(page)).toHaveCount(0);
  }
});
