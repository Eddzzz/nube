require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('individual sessions, private credentials, concurrent users and immediate revocation', async (t) => {
  const { createWorkspaceStore } = require('../src/services/workspace-store.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-accounts-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createWorkspaceStore(directory, { username: 'admin', password: 'bootstrap-secret' });
  const login = await store.authenticate('admin', 'bootstrap-secret', 'local');
  assert.equal(login.user.role, 'admin');
  const admin = login.user;
  const users = await Promise.all(['ana', 'luis'].map((username) => store.createUser(admin, {
    username, name: username, password: 'student-secret-123', role: 'user',
    grants: [{ path: 'Equipo', permissions: ['read', 'download'] }],
  })));
  assert.equal((await store.listUsers(admin)).length, 2);
  const session = await store.authenticate('ANA', 'student-secret-123', 'student');
  assert.notEqual(session.token, (await store.authenticate('ana', 'student-secret-123', 'student')).token);
  assert.equal((await store.getSession(session.token)).username, 'ana');
  assert.equal(await store.getSession('forged-token'), null);
  await assert.rejects(store.createUser(session.user, { username: 'evil' }), /administrador/i);
  const raw = await fs.readFile(path.join(directory, 'workspace.json'), 'utf8');
  assert.ok(!raw.includes('student-secret-123') && !raw.includes(session.token));
  await store.updateUser(admin, users[0].id, { active: false });
  assert.equal(await store.getSession(session.token), null);
  await assert.rejects(store.authenticate('ana', 'student-secret-123', 'student'), /credenciales/i);
  await store.updateUser(admin, users[0].id, { active: true });
  const renewed = await store.authenticate('ana', 'student-secret-123', 'student');
  assert.equal(await store.getSession(session.token), null, 'reactivation must not revive sessions');
  await store.updateUser(admin, users[0].id, { password: 'changed-secret-123' });
  assert.equal(await store.getSession(renewed.token), null);
  await assert.rejects(store.authenticate('ana', 'student-secret-123', 'student'), /credenciales/i);
  const reset = await store.authenticate('ana', 'changed-secret-123', 'student');
  await store.updateUser(admin, users[0].id, { revokeSessions: true });
  assert.equal(await store.getSession(reset.token), null);
  await assert.rejects(store.createUser(admin, { ...users[1], password: 'student-secret-123' }), /existe/i);
  await assert.rejects(store.createUser(admin, { username: 'short', name: 'Short', role: 'user', password: '123', grants: [] }), /contraseña/i);
  const delegate = await store.createUser(admin, { username: 'delegate', name: 'Admin', role: 'admin', password: 'delegate-secret-123', grants: [] });
  const delegateLogin = await store.authenticate('delegate', 'delegate-secret-123', 'delegate');
  await store.updateUser(delegateLogin.user, delegate.id, { name: 'Administrador del equipo', role: 'admin', active: true, grants: [] });
  assert.equal((await store.getSession(delegateLogin.token)).name, 'Administrador del equipo', 'ordinary edits must preserve current administrator session');
  for (let i = 0; i < 8; i++) await store.authenticate('ana', 'wrong', 'attacker').catch(() => {});
  await assert.rejects(store.authenticate('ana', 'changed-secret-123', 'attacker'), /intentos/i);
});

test('folder permissions inherit, restrict nested access, and allow only navigation through ancestors', () => {
  const { can, canNavigate, pathFromId, idFromPath, hasGrantsWithin } = require('../src/lib/permissions.ts');
  const user = { role: 'user', grants: [
    { path: 'Proyecto/Trabajo', permissions: ['read', 'download', 'upload', 'rename'] },
    { path: 'Proyecto/Trabajo/Privado', permissions: [] },
    { path: 'Proyecto/Entrega', permissions: ['read'] },
  ] };
  assert.equal(can(user, 'read', 'Proyecto/Trabajo/nota.txt'), true);
  assert.equal(can(user, 'upload', 'Proyecto/Trabajo'), true);
  assert.equal(can(user, 'delete', 'Proyecto/Trabajo/nota.txt'), false);
  assert.equal(can(user, 'read', 'Proyecto/Trabajo/Privado/secreto.txt'), false);
  assert.equal(can(user, 'read', 'PROYECTO/TRABAJO/privado/secreto.txt'), false);
  assert.equal(can(user, 'read', 'Proyecto/Trabajo-ajeno/nota.txt'), false);
  assert.equal(can(user, 'download', 'Proyecto/Entrega/informe.txt'), false);
  assert.equal(canNavigate(user, ''), true);
  assert.equal(canNavigate(user, 'Proyecto'), true);
  assert.equal(can(user, 'read', 'Proyecto'), false);
  assert.equal(canNavigate(user, 'Ajeno'), false);
  assert.equal(can(null, 'read', ''), false);
  assert.equal(can({ role: 'admin', grants: [] }, 'delete', 'Proyecto'), true);
  assert.equal(hasGrantsWithin([user], 'Proyecto'), true);
  assert.equal(pathFromId(idFromPath('Proyecto/Trabajo/ñ.txt')), 'Proyecto/Trabajo/ñ.txt');
  for (const p of ['../x', 'C:/Windows', '.onedrivelist-trash/x', 'a\\b', 'a./b', 'a//b']) {
    assert.throws(() => pathFromId(Buffer.from(p).toString('base64url')));
  }
});

test('academic records require real observations, keep eight tests pending and prevent reader writes', async (t) => {
  const { createWorkspaceStore } = require('../src/services/workspace-store.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-project-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createWorkspaceStore(directory, { username: 'admin', password: 'bootstrap-secret' });
  const { user: admin } = await store.authenticate('admin', 'bootstrap-secret', 'local');
  const project = await store.getProject(admin);
  assert.equal(project.checks.length, 8);
  assert.ok(project.checks.every((c) => c.status === 'pending'));
  await assert.rejects(store.updateProject(admin, { kind: 'check', id: 'P01', status: 'passed', observed: '', evidence: '' }), /evidencia|observado/i);
  await store.updateProject(admin, { kind: 'check', id: 'P01', status: 'passed', observed: 'Cinco carpetas verificadas', evidence: 'E01.png', procedure: 'Inspección', owner: 'admin' });
  assert.equal((await store.getProject(admin)).checks[0].status, 'passed');
  const reader = await store.createUser(admin, { username: 'reader', name: 'Reader', password: 'reader-secret-123', role: 'user', grants: [{ path: '', permissions: ['read'] }] });
  await assert.rejects(store.updateProject(reader, { kind: 'task', title: 'No autorizado' }), /permiso/i);
  await store.updateProject(admin, { kind: 'task', title: 'Preparar informe', assignee: 'admin', due: '2026-11-15', status: 'pending', evidence: '' });
  assert.equal((await store.getProject(reader)).tasks[0].title, 'Preparar informe');
  await assert.rejects(store.updateProject(admin, { kind: 'task', title: 'No comprobada', status: 'completed', evidence: '' }), /evidencia/i);
});
