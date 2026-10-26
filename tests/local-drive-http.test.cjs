require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createWorkspaceStore } = require('../src/services/workspace-store.ts');

test('local HTTP integration: sessions, folder permissions, recovery and academic records', { timeout: 90000 }, async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'onedrivelist-http-'));
  const root = path.join(temporary, 'shared');
  const data = path.join(temporary, 'private');
  await fs.mkdir(root);
  await fs.mkdir(path.join(root, 'Equipo'));
  await fs.mkdir(path.join(root, 'Privado'));
  await fs.writeFile(path.join(root, 'nota.txt'), 'hola compartida');
  await fs.writeFile(path.join(root, 'audio.mp3'), 'audio fixture');
  await fs.writeFile(path.join(root, 'Equipo', 'informe.txt'), 'Estado inicial');
  await fs.writeFile(path.join(root, 'Privado', 'secreto.txt'), 'contenido privado');
  const secret = 'integration-test-secret-not-used-by-the-running-app';
  const base = 'http://127.0.0.1:3001';
  const store = createWorkspaceStore(data, { username: 'admin', password: 'admin-test-password' });
  const adminLogin = await store.authenticate('admin', 'admin-test-password', 'test');
  const readerAccount = await store.createUser(adminLogin.user, { username: 'lector', name: 'Lector', password: 'reader-secret-123', role: 'user',
    grants: [{ path: '', permissions: ['read', 'download'] }, { path: 'Privado', permissions: [] }] });
  const editorAccount = await store.createUser(adminLogin.user, { username: 'editor', name: 'Editor', password: 'editor-secret-123', role: 'user',
    grants: [{ path: 'Equipo', permissions: ['read', 'download', 'upload', 'create', 'rename', 'delete', 'versions'] }] });
  await store.createUser(adminLogin.user, { username: 'consulta', name: 'Consulta sin descarga', password: 'consult-secret-123', role: 'user',
    grants: [{ path: 'Equipo', permissions: ['read'] }] });
  const loginHeaders = async (username, password) => ({
    cookie: 'onelist-session=' + (await store.authenticate(username, password, 'test')).token,
    referer: base + '/', origin: base,
  });
  const admin = { cookie: 'onelist-session=' + adminLogin.token, referer: base + '/', origin: base };
  let reader = await loginHeaders('lector', 'reader-secret-123');
  const editor = await loginHeaders('editor', 'editor-secret-123');
  const consult = await loginHeaders('consulta', 'consult-secret-123');
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'], {
    cwd: path.resolve(__dirname, '..'), windowsHide: true,
    env: { ...process.env, LOCAL_DRIVE_ROOT: root, LOCAL_DATA_DIR: data, DOWNLOAD_TOKEN_SECRET: secret,
      AUTH_SECRET: secret, password: 'legacy-visitor', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin-test-password',
      AUTH_URL: base, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      const stopped = new Promise((resolve) => child.once('exit', resolve));
      child.kill(); await stopped;
    }
    assert.ok(temporary.startsWith(path.join(os.tmpdir(), 'onedrivelist-http-')));
    await fs.rm(temporary, { recursive: true, force: true });
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) break;
    await delay(200);
  }
  assert.ok(ready, logs);
  const request = (url, headers = {}, init = {}) => fetch(base + url, { ...init, headers: { ...headers, ...init.headers }, redirect: 'manual' });
  const id = (relative) => Buffer.from(relative).toString('base64url');
  const json = { 'content-type': 'application/json' };
  const write = (url, headers, body, method = 'POST') => request(url, headers, { method, headers: json, body: JSON.stringify(body) });

  await t.test('authentication rejects old role cookies and filters all read paths', async () => {
    assert.equal((await request('/api/onedrive/list')).status, 401);
    assert.equal((await request('/api/onedrive/list', { cookie: 'pwd-role=admin; pwd-auth=' + createHmac('sha256', secret).update('admin-test-password').digest('hex') })).status, 401);
    const listing = await request('/api/onedrive/list', reader);
    assert.equal(listing.status, 200);
    const items = (await listing.json()).value;
    assert.ok(items.some((item) => item.name === 'nota.txt'));
    assert.ok(!items.some((item) => item.name === 'Privado'));
    const editorItems = (await (await request('/api/onedrive/list', editor)).json()).value;
    assert.deepEqual(editorItems.map((i) => i.name), ['Equipo']);
    assert.equal((await request('/api/onedrive/list?parentId=' + id('Privado'), reader)).status, 403);
    assert.equal((await request('/api/onedrive/download/' + id('Privado/secreto.txt'), reader)).status, 403);
    assert.equal((await request('/api/onedrive/download/' + id('privado/secreto.txt'), reader)).status, 403);
    const search = (await (await request('/api/onedrive/search?q=secreto', reader)).json()).value;
    assert.deepEqual(search, []);
    const privatePreview = await (await request('/preview/' + id('Privado/secreto.txt'), reader)).text();
    assert.ok(!privatePreview.includes('contenido privado'));
    const fakeBreadcrumb = await (await request('/files/' + id('Privado') + '/' + id('Equipo'), editor)).text();
    assert.ok(!fakeBreadcrumb.includes('>Privado<'), 'untrusted breadcrumb IDs must not disclose other folders');
    assert.equal((await request('/api/admin/users', reader)).status, 403);
    assert.equal((await request('/admin/users', reader)).status, 403);
    const actual = await (await request('/', reader)).text();
    assert.match(actual, /nota.txt/);
    assert.equal(await (await request('/api/onedrive/download/' + id('nota.txt'), reader)).text(), 'hola compartida');
    const range = await request('/api/onedrive/download/' + id('nota.txt'), reader, { headers: { range: 'bytes=0-3' } });
    assert.equal(range.status, 206); assert.equal(await range.text(), 'hola');
    assert.equal((await request('/api/onedrive/download/' + id('Equipo/informe.txt'), consult)).status, 403);
    assert.equal((await request('/api/onedrive/download/' + id('Equipo/informe.txt') + '?inline=1', consult)).status, 200);
    assert.equal((await request('/api/recovery?itemId=' + id('Equipo/informe.txt'), consult)).status, 403);
    assert.equal((await request('/api/recovery', editor)).status, 403);
    const audioPreview = await (await request('/preview/' + id('audio.mp3'), reader)).text();
    const audioSource = audioPreview.match(/<audio[^>]*src="([^"]+)"/);
    assert.ok(audioSource);
    assert.equal((await request(audioSource[1].replaceAll('&amp;', '&'), reader)).status, 200);
  });

  await t.test('specific write rights, origin checking and folder grant protections', async () => {
    for (const [url, method] of [['/api/onedrive/folders', 'POST'], ['/api/onedrive/upload?filename=bad.txt', 'PUT'],
      ['/api/onedrive/items/' + id('nota.txt'), 'PATCH'], ['/api/onedrive/items/' + id('nota.txt'), 'DELETE']]) {
      const response = await request(url, reader, { method, headers: json, body: JSON.stringify({ name: 'Denied' }) });
      assert.equal(response.status, 403, url);
    }
    assert.equal((await write('/api/onedrive/folders', { ...admin, origin: 'http://evil.example' }, { name: 'Denied' })).status, 403);
    assert.equal((await write('/api/onedrive/folders', editor, { name: 'Denied' })).status, 403);
    assert.equal((await write('/api/onedrive/items/' + id('Equipo'), admin, { name: 'Moved' }, 'PATCH')).status, 403);
    const folderResponse = await write('/api/onedrive/folders', editor, { name: 'Prueba ñ', parentId: id('Equipo') });
    assert.equal(folderResponse.status, 201);
    const folder = await folderResponse.json();
    const uploaded = await request('/api/onedrive/upload?filename=subido.txt&parentId=' + folder.id, editor, { method: 'PUT', body: 'contenido nuevo' });
    assert.equal(uploaded.status, 201);
    const item = await uploaded.json();
    const renamed = await write('/api/onedrive/items/' + item.id, editor, { name: 'renombrado.txt' }, 'PATCH');
    assert.equal(renamed.status, 200);
    const renamedItem = await renamed.json();
    assert.equal(await fs.readFile(path.join(root, 'Equipo', 'Prueba ñ', 'renombrado.txt'), 'utf8'), 'contenido nuevo');
    assert.equal((await request('/api/onedrive/items/' + renamedItem.id, editor, { method: 'DELETE' })).status, 204);
    assert.equal((await fs.readdir(path.join(root, '.onedrivelist-trash'))).length, 1);
    assert.equal((await request('/api/onedrive/download/' + id('../outside'), reader)).status, 400);
  });

  await t.test('local versions, replacement and trash recovery keep file content', async () => {
    const noteId = id('Equipo/informe.txt');
    const snapshot = await write('/api/recovery', editor, { kind: 'snapshot', itemId: noteId });
    assert.equal(snapshot.status, 200);
    const version = await snapshot.json();
    assert.equal((await request('/api/onedrive/upload?replaceId=' + noteId, editor, { method: 'PUT', body: 'Estado modificado' })).status, 201);
    assert.equal(await fs.readFile(path.join(root, 'Equipo', 'informe.txt'), 'utf8'), 'Estado modificado');
    assert.equal((await write('/api/recovery', editor, { kind: 'restoreVersion', itemId: noteId, versionId: version.id })).status, 200);
    assert.equal(await fs.readFile(path.join(root, 'Equipo', 'informe.txt'), 'utf8'), 'Estado inicial');
    const trash = (await (await request('/api/recovery', admin)).json()).trash;
    assert.equal(trash.length, 1);
    assert.equal((await write('/api/recovery', reader, { kind: 'restoreTrash', id: trash[0].id })).status, 403);
    assert.equal((await write('/api/recovery', admin, { kind: 'restoreTrash', id: trash[0].id })).status, 200);
    assert.equal(await fs.readFile(path.join(root, 'Equipo', 'Prueba ñ', 'renombrado.txt'), 'utf8'), 'contenido nuevo');
  });

  await t.test('academic structure is idempotent and verified checks require evidence', async () => {
    const project = await (await request('/api/project', reader)).json();
    assert.equal(project.canEdit, false); assert.equal(project.usage, null);
    assert.equal(project.checks.length, 8);
    assert.ok(project.checks.every((c) => c.status === 'pending'));
    assert.equal((await write('/api/project', reader, { kind: 'task', title: 'Denied', status: 'pending' })).status, 403);
    assert.equal((await write('/api/project', admin, { kind: 'check', id: 'P01', status: 'passed', observed: '', evidence: '' })).status, 400);
    assert.equal((await write('/api/project', editor, { kind: 'check', id: 'P01', status: 'passed', observed: 'Carpetas verificadas', evidence: 'E01.png' })).status, 200);
    const structure = await write('/api/project', admin, { kind: 'structure' });
    assert.equal(structure.status, 200);
    assert.equal((await write('/api/project', admin, { kind: 'structure' })).status, 200);
    assert.equal((await fs.readdir(path.join(root, 'Proyecto_OneDrive_2026'))).length, 5);
    assert.equal((await request('/project', reader)).status, 200);
  });

  await t.test('admin CRM persists jobs and todos while rejecting reader access and forged origins', async () => {
    assert.equal((await request('/api/admin/crm', reader)).status, 403);
    assert.equal((await request('/admin', reader)).status, 403);
    assert.equal((await request('/admin/tasks', reader)).status, 403);
    const initial = await request('/api/admin/crm', admin);
    assert.equal(initial.status, 200);
    const data = await initial.json();
    assert.deepEqual(data.jobs, []);
    assert.deepEqual(data.todos, []);
    assert.ok(data.users.some((user) => user.id === 'bootstrap'));
    assert.ok(!JSON.stringify(data).includes('passwordHash'));
    const work = { kind: 'job', title: 'Preparar entrega académica', description: 'Revisar materiales y permisos', assigneeId: editorAccount.id, due: '2026-11-15', priority: 'high', status: 'active' };
    assert.equal((await write('/api/admin/crm', reader, work)).status, 403);
    assert.equal((await write('/api/admin/crm', { ...admin, origin: 'http://evil.example' }, work)).status, 403);
    const created = await write('/api/admin/crm', admin, work);
    assert.equal(created.status, 200);
    const job = (await created.json()).jobs[0];
    const pending = { kind: 'todo', title: 'Verificar acceso de lectura', jobId: job.id, assigneeId: editorAccount.id, due: '2026-11-12', priority: 'normal', status: 'pending' };
    const createdTask = await write('/api/admin/crm', admin, pending);
    assert.equal(createdTask.status, 200);
    const task = (await createdTask.json()).todos[0];
    assert.equal((await write('/api/admin/crm', admin, { ...pending, id: task.id, status: 'completed' })).status, 200);
    const updated = await (await request('/api/admin/crm', admin)).json();
    assert.equal(updated.todos[0].status, 'completed');
    assert.equal(updated.jobs[0].title, work.title);
    assert.equal(updated.checks.length, 8);
    assert.ok(updated.audit.some((event) => event.action === 'Pendiente actualizado'));
    for (const route of ['/admin', '/admin/projects', '/admin/roles', '/admin/activity']) assert.equal((await request(route, admin)).status, 200, route);
    for (const route of ['/admin/jobs', '/admin/tasks']) {
      const response = await request(route, admin);
      if (response.status === 307) assert.equal(response.headers.get('location'), '/admin/projects', route);
      else {
        // Next may already have streamed the layout before emitting redirect().
        assert.equal(response.status, 200, route);
        assert.match(await response.text(), /NEXT_REDIRECT;replace;\/admin\/projects;307;/, route);
      }
    }
  });

  await t.test('projects isolate personal work, limit state updates and preserve upload permissions', async () => {
    const projectBody = { kind: 'project', name: 'Proyecto del equipo', description: 'Entrega compartida', memberIds: [editorAccount.id, readerAccount.id], folderPath: 'Equipo', status: 'active' };
    assert.equal((await write('/api/admin/crm', reader, projectBody)).status, 403);
    const response = await write('/api/admin/crm', admin, projectBody);
    assert.equal(response.status, 200);
    const project = (await response.json()).projects.find((p) => p.name === projectBody.name);
    assert.ok(project);
    const input = { kind: 'job', title: 'Trabajo propio del proyecto', description: 'Preparar entrega', assigneeId: editorAccount.id, projectId: project.id, due: '', priority: 'normal', status: 'planned' };
    const jobResponse = await write('/api/admin/crm', admin, input);
    const job = (await jobResponse.json()).jobs.find((j) => j.title === input.title);
    const privateResponse = await write('/api/admin/crm', admin, { ...input, title: 'Trabajo privado del revisor', assigneeId: readerAccount.id });
    const privateJob = (await privateResponse.json()).jobs.find((j) => j.title === 'Trabajo privado del revisor');
    const taskInput = { kind: 'todo', title: 'Tarea personal', jobId: job.id, projectId: project.id, assigneeId: editorAccount.id, due: '', status: 'pending', priority: 'normal' };
    const taskResponse = await write('/api/admin/crm', admin, taskInput);
    const todo = (await taskResponse.json()).todos.find((task) => task.title === taskInput.title);
    const mine = await (await request('/api/my-work', editor)).json();
    assert.ok(mine.projects.some((p) => p.id === project.id));
    assert.ok(!('memberIds' in mine.projects[0]));
    assert.ok(mine.jobs.some((j) => j.id === job.id));
    assert.ok(!JSON.stringify(mine).includes('Trabajo privado del revisor'));
    assert.ok(!('users' in mine) && !('audit' in mine) && !('sessions' in mine));
    assert.equal((await write('/api/my-work', editor, { kind: 'job', id: job.id, status: 'active' }, 'PATCH')).status, 200);
    assert.equal((await write('/api/my-work', editor, { kind: 'todo', id: todo.id, status: 'completed' }, 'PATCH')).status, 200);
    assert.equal((await write('/api/my-work', editor, { kind: 'job', id: privateJob.id, status: 'completed' }, 'PATCH')).status, 403);
    assert.equal((await write('/api/my-work', editor, { kind: 'job', id: job.id, status: 'active', assigneeId: readerAccount.id }, 'PATCH')).status, 400);
    assert.equal((await write('/api/my-work', { ...editor, origin: 'http://evil.example' }, { kind: 'todo', id: todo.id, status: 'pending' }, 'PATCH')).status, 403);
    const uploadTargets = await (await request('/api/my-work/uploads', editor)).json();
    assert.ok(uploadTargets.targets.some((target) => target.path === 'Equipo'));
    assert.deepEqual((await (await request('/api/my-work/uploads', reader)).json()).targets, []);
    const archived = await write('/api/admin/crm', admin, { ...projectBody, id: project.id, status: 'archived' });
    assert.equal(archived.status, 200);
    assert.equal((await write('/api/my-work', editor, { kind: 'job', id: job.id, status: 'completed' }, 'PATCH')).status, 403);
    assert.equal((await request('/my-work', editor)).status, 200);
    const removal = await write('/api/admin/crm', admin, { ...projectBody, id: project.id, memberIds: [readerAccount.id] });
    assert.equal(removal.status, 200);
    const revoked = await (await request('/api/my-work', editor)).json();
    assert.ok(!revoked.projects.some((p) => p.id === project.id));
    assert.ok(!revoked.jobs.some((j) => j.id === job.id));
    assert.equal((await write('/api/my-work', editor, { kind: 'todo', id: todo.id, status: 'pending' }, 'PATCH')).status, 403);
    assert.equal((await request('/admin/projects', admin)).status, 200);
  });

  await t.test('ZIP downloads respect every selected file and register actor', async () => {
    const zip = await write('/api/onedrive/archive', editor, { ids: [id('Equipo/informe.txt')] });
    assert.equal(zip.status, 200, await zip.clone().text());
    assert.equal(zip.headers.get('content-type'), 'application/zip');
    const bytes = Buffer.from(await zip.arrayBuffer());
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    assert.ok(bytes.includes(Buffer.from('Estado inicial')));
    assert.equal((await write('/api/onedrive/archive', consult, { ids: [id('Equipo/informe.txt')] })).status, 403);
    assert.equal((await write('/api/onedrive/archive', reader, { ids: [id('Privado/secreto.txt')] })).status, 403);
    assert.equal((await write('/api/onedrive/archive', { cookie: editor.cookie }, { ids: [id('Equipo/informe.txt')] })).status, 403);
    const audit = (await (await request('/api/admin/users', admin)).json()).audit;
    assert.ok(audit.some((event) => event.actor === 'editor' && event.action.includes('ZIP')));
    assert.ok(audit.some((event) => event.actor === 'lector' && event.action === 'Descarga iniciada' && event.target === 'nota.txt'));
    assert.ok(audit.some((event) => event.actor === 'editor' && event.action === 'Archivo subido'));
    assert.ok(audit.some((event) => event.actor === 'editor' && event.action === 'Elemento enviado a la papelera'));
  });

  await t.test('admin user management revokes sessions and rejects privilege escalation', async () => {
    const response = await write('/api/admin/users', admin, { username: 'nuevo', name: 'Nuevo', password: 'new-user-secret-123', role: 'user', grants: [] });
    assert.equal(response.status, 201);
    const user = await response.json();
    assert.ok(!('passwordHash' in user));
    assert.equal((await write('/api/admin/users', reader, { id: readerAccount.id, role: 'admin' }, 'PATCH')).status, 403);
    assert.equal((await write('/api/admin/users', admin, { id: readerAccount.id, grants: [{ path: 'Equipo', permissions: ['read', 'download'] }] }, 'PATCH')).status, 200);
    assert.equal((await request('/api/onedrive/download/' + id('nota.txt'), reader)).status, 403, 'permissions change without relogin');
    assert.equal((await write('/api/admin/users', admin, { id: readerAccount.id, active: false }, 'PATCH')).status, 200);
    assert.equal((await request('/api/onedrive/list', reader)).status, 401);
    assert.equal((await write('/api/admin/users', admin, { id: readerAccount.id, active: true }, 'PATCH')).status, 200);
    reader = await loginHeaders('lector', 'reader-secret-123');
    assert.equal((await request('/api/onedrive/list', reader)).status, 200);
    assert.equal((await write('/api/admin/users', admin, { id: readerAccount.id, revokeSessions: true }, 'PATCH')).status, 200);
    assert.equal((await request('/api/onedrive/list', reader)).status, 401);
    const users = await (await request('/api/admin/users', admin)).json();
    assert.ok(users.audit.some((event) => event.action === 'Sesiones revocadas'));
    assert.ok(!JSON.stringify(users).includes('passwordHash'));
    assert.ok(users.users.some((account) => account.id === editorAccount.id));
  });

  await t.test('real login server action sets an opaque session and logout revokes it', async () => {
    const loginPage = await (await request('/login')).text();
    const form = new FormData();
    const decode = (value) => value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    for (const input of loginPage.matchAll(/<input\b[^>]*>/g)) {
      const name = input[0].match(/name="([^"]+)"/)?.[1];
      if (!name?.startsWith('$ACTION_')) continue;
      const value = input[0].match(/value="([^"]*)"/)?.[1] || '';
      form.set(decode(name), decode(value));
    }
    if (![...form.keys()].length) {
      const action = loginPage.match(/\\"id\\":\\"([a-f0-9]+)\\",\\"bound\\":null/);
      assert.ok(action, 'Login must expose its unbound server action reference');
      form.set(`$ACTION_ID_${action[1]}`, '');
    }
    form.set('username', 'consulta'); form.set('password', 'consult-secret-123');
    const login = await request('/login', { origin: base }, { method: 'POST', body: form });
    assert.equal(login.status, 303, await login.text());
    const session = login.headers.getSetCookie().find((value) => value.startsWith('onelist-session='));
    assert.ok(session);
    assert.ok(/HttpOnly/i.test(session));
    assert.ok(!/;\s*secure/i.test(session), 'Local HTTP login cookies must work on LAN');
    const browserHeaders = { cookie: session.split(';')[0], origin: base };
    assert.equal((await request('/api/onedrive/list', browserHeaders)).status, 200);
    assert.equal((await request('/api/logout', browserHeaders, { method: 'POST' })).status, 200);
    assert.equal((await request('/api/onedrive/list', browserHeaders)).status, 401);
  });
});

