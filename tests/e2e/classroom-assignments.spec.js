import {test, expect} from '@playwright/test';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {createClassroomServer} from '../../tools/classroom-server/server.mjs';

test('teacher assigns, student submits privately, and receipt restores teacher feedback', async ({browser, baseURL}) => {
 const dataDir = await mkdtemp(path.join(os.tmpdir(), 'duet-classroom-ui-'));
 const teacherKey = 'T'.repeat(43), studentKey = 'S'.repeat(43);
 const server = await createClassroomServer({dataDir, rooms:{classroom:{teacher:teacherKey, student:studentKey}}, origins:[new URL(baseURL).origin]});
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const serverURL = `http://127.0.0.1:${server.address().port}`;
 const teacherContext = await browser.newContext({baseURL, acceptDownloads:true});
 const studentContext = await browser.newContext({baseURL, acceptDownloads:true});
 const teacher = await teacherContext.newPage(), student = await studentContext.newPage();
 try {
  // Model consent for the hosted app to reach our temporary loopback server.
  // Permissions affect only these disposable contexts, not the user's Chrome profile.
  const origin = new URL(baseURL).origin;
  await teacherContext.grantPermissions(['local-network-access'], {origin});
  await studentContext.grantPermissions(['local-network-access'], {origin});
  const join = async (page, key) => {
   await page.goto('./#/classroom');
   await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
   await page.getByLabel('Server address').fill(serverURL);
   await page.getByLabel('Room', {exact:true}).fill('classroom');
   await page.getByLabel('Access key', {exact:true}).fill(key);
   await expect(page.getByLabel('Server address')).toHaveValue(serverURL);
   await page.getByRole('button', {name:'Connect to classroom',exact:true}).click();
   await expect(page.getByRole('button', {name:'Disconnect',exact:true})).toBeVisible();
  };
  await join(teacher, teacherKey);
  await teacher.getByText('Create an assignment',{exact:true}).click();
  await teacher.getByLabel('Assignment title',{exact:true}).fill('Tell a tiny story');
  await teacher.getByLabel('Instructions',{exact:true}).fill('Move your character and explain one change.');
  await teacher.getByRole('button',{name:'Create assignment',exact:true}).click();
  await expect(teacher.getByRole('heading',{name:'Tell a tiny story',exact:true})).toBeVisible();
  await teacher.locator('.sidebar').getByRole('button',{name:'Workspace',exact:true}).click();
  await teacher.locator('.sidebar').getByRole('button',{name:'Classroom',exact:true}).click();
  await expect(teacher.getByLabel('Server address')).toHaveValue(serverURL);
  await join(student, studentKey);
  await expect(student.getByText('Create an assignment',{exact:true})).toHaveCount(0);
  await student.getByLabel('Assignment',{exact:true}).selectOption({label:'Tell a tiny story'});
  await student.getByLabel('Classroom alias',{exact:true}).fill('Blue Fox');
  const zip = new JSZip(); zip.file('project.json',JSON.stringify({targets:[{isStage:true,name:'Stage'}]}));
  const bytes = await zip.generateAsync({type:'nodebuffer'});
  const chooser = student.waitForEvent('filechooser');
  await student.getByRole('button',{name:'Choose file and submit privately',exact:true}).click();
  await (await chooser).setFiles({name:'Tiny story.sb3',mimeType:'application/octet-stream',buffer:bytes});
  await expect(student.getByRole('article',{name:'Your private feedback'})).toContainText('Waiting for teacher feedback');
  const receiptDownload = student.waitForEvent('download');
  await student.getByRole('button',{name:'Save submission receipt',exact:true}).click();
  const receipt = await readFile(await (await receiptDownload).path());
  const parsed = JSON.parse(receipt); expect(parsed.key).toHaveLength(43);
  await student.locator('.sidebar').getByRole('button',{name:'Workspace',exact:true}).click();
  await student.locator('.sidebar').getByRole('button',{name:'Classroom',exact:true}).click();
  await student.getByLabel('Submissions from this session',{exact:true}).selectOption(parsed.id);
  await expect(student.getByRole('article',{name:'Your private feedback'})).toContainText('Waiting for teacher feedback');
  await teacher.getByRole('button',{name:'Refresh assignments',exact:true}).click();
  await expect(teacher.getByRole('heading',{name:'Teacher review · 1 submissions'})).toBeVisible();
  await teacher.getByLabel('Review status',{exact:true}).selectOption('revise');
  await teacher.getByLabel('Feedback for this student',{exact:true}).fill('Try a larger move and predict where Fox will land.');
  await teacher.getByRole('button',{name:'Save feedback',exact:true}).click();
  await student.getByRole('button',{name:'Check my feedback',exact:true}).click();
  await expect(student.getByRole('article',{name:'Your private feedback'})).toContainText('Try a larger move');
  await expect(student.locator('.classroom-projects')).toContainText('The gallery is empty');
  await student.reload(); await join(student, studentKey);
  await expect(student.getByRole('button',{name:'Save submission receipt',exact:true})).toHaveCount(0);
  const receiptChooser = student.waitForEvent('filechooser');
  await student.getByRole('button',{name:'Open submission receipt',exact:true}).click();
  await (await receiptChooser).setFiles({name:'receipt.json',mimeType:'application/json',buffer:receipt});
  await expect(student.getByRole('article',{name:'Your private feedback'})).toContainText('Try a larger move');
  const submittedDownload = student.waitForEvent('download');
  await student.getByRole('button',{name:'Download my submitted file',exact:true}).click();
  expect(await readFile(await (await submittedDownload).path())).toEqual(bytes);
  await teacher.getByRole('button',{name:'Close Tell a tiny story',exact:true}).click();
  await student.getByRole('button',{name:'Refresh assignments',exact:true}).click();
  await expect(student.getByLabel('Assignment',{exact:true}).getByRole('option',{name:'Tell a tiny story'})).toHaveCount(0);
 } finally {
  await teacherContext.close(); await studentContext.close();
  await new Promise(resolve => server.close(resolve)); await rm(dataDir,{recursive:true,force:true});
 }
});

test('hosted classroom explains a denied loopback connection and recovers after consent', async ({browser, browserName, baseURL}) => {
 const appURL = new URL(baseURL);
 test.skip(browserName !== 'chromium' || appURL.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(appURL.hostname), 'Requires a public HTTPS app origin and Chromium local-network permission enforcement.');
 const dataDir = await mkdtemp(path.join(os.tmpdir(), 'duet-classroom-permission-'));
 const teacherKey = 'T'.repeat(43), studentKey = 'S'.repeat(43);
 const server = await createClassroomServer({dataDir, rooms:{classroom:{teacher:teacherKey, student:studentKey}}, origins:[appURL.origin]});
 const received = [];
 server.on('request', request => received.push(request.url));
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const context = await browser.newContext({baseURL});
 try {
  // Chromium denies unlisted permissions for this origin; no security flags are disabled.
  await context.grantPermissions([], {origin:appURL.origin});
  const page = await context.newPage();
  await page.goto('./#/classroom');
  await expect(page.getByRole('button',{name:'Save project',exact:true})).toBeEnabled();
  await page.getByLabel('Server address').fill(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel('Room',{exact:true}).fill('classroom');
  await page.getByLabel('Access key',{exact:true}).fill(studentKey);
  await page.getByRole('button',{name:'Connect to classroom',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach the classroom server.');
  await expect(page.getByRole('alert')).toContainText('local-network or loopback permission');
  await expect(page.getByRole('alert')).toContainText('Teacher setup and network notes');
  await page.getByText('Teacher setup and network notes',{exact:true}).click();
  await expect(page.getByText('Using the hosted app with a local classroom server?',{exact:false})).toBeVisible();
  await expect(page.getByText('Using the hosted app with a local classroom server?',{exact:false})).toContainText('Chrome may ask for local-network or loopback access.');
  await expect(page.getByRole('button',{name:'Connect to classroom',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Disconnect',exact:true})).toHaveCount(0);
  expect(received).toEqual([]);
  await context.grantPermissions(['local-network-access'], {origin:appURL.origin});
  await page.getByRole('button',{name:'Connect to classroom',exact:true}).click();
  await expect(page.getByRole('button',{name:'Disconnect',exact:true})).toBeVisible();
  expect(received).toContain('/api/classroom/rooms/classroom/session');
  await expect(page.getByRole('alert')).toHaveCount(0);
 } finally {
  await context.close();
  await new Promise(resolve => server.close(resolve));
  await rm(dataDir,{recursive:true,force:true});
 }
});
