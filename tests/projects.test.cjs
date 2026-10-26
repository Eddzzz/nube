require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createWorkspaceStore } = require('../src/services/workspace-store.ts');

const projectInput = (extra = {}) => ({ kind: 'project', name: 'Proyecto académico ñ', description: 'Entregas del equipo', memberIds: [], folderPath: 'Equipo', status: 'active', ...extra });
const jobInput = (extra = {}) => ({ kind: 'job', title: 'Informe', description: 'Contenido del informe', assigneeId: '', projectId: '', due: '', status: 'planned', priority: 'normal', ...extra });
const todoInput = (extra = {}) => ({ kind: 'todo', title: 'Revisar informe', jobId: '', assigneeId: '', projectId: '', due: '', status: 'pending', priority: 'normal', ...extra });
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-project-members-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createWorkspaceStore(directory, { username: 'admin', password: 'bootstrap-secret' });
  const { user: admin } = await store.authenticate('admin', 'bootstrap-secret', 'test');
  const ana = await store.createUser(admin, { username: 'ana', name: 'Ana', password: 'member-secret-123', role: 'user', grants: [] });
  const luis = await store.createUser(admin, { username: 'luis', name: 'Luis', password: 'member-secret-123', role: 'user', grants: [] });
  return { directory, store, admin, ana, luis };
}

test('projects migrate legacy records and preserve all existing collections and shares', async (t) => {
  const { directory, store, admin, ana } = await fixture(t);
  await store.mutateCrm(admin, jobInput({ assigneeId: ana.id }));
  const filename = path.join(directory, 'workspace.json');
  const old = JSON.parse(await fs.readFile(filename, 'utf8'));
  delete old.projects;
  for (const record of old.jobs) delete record.projectId;
  old.shareLinks = [{ id: 'fixture-share', itemName: 'Original' }];
  await fs.writeFile(filename, JSON.stringify(old));
  assert.deepEqual(await store.listProjects(admin), []);
  assert.equal((await store.getCrm(admin)).jobs[0].projectId, '');
  await store.mutateCrm(admin, projectInput({ memberIds: [ana.id] }));
  const saved = JSON.parse(await fs.readFile(filename, 'utf8'));
  assert.deepEqual(saved.tasks, old.tasks);
  assert.deepEqual(saved.checks, old.checks);
  assert.deepEqual(saved.sessions, old.sessions);
  assert.deepEqual(saved.shareLinks, old.shareLinks);
  assert.equal(saved.jobs[0].projectId, '');
  assert.equal(saved.projects.length, 1);
});

test('member portal returns only own assignments and updates only permitted status fields', async (t) => {
  const { store, admin, ana, luis } = await fixture(t);
  const project = (await store.mutateCrm(admin, projectInput({ memberIds: [ana.id, luis.id] }))).projects[0];
  const job = (await store.mutateCrm(admin, jobInput({ projectId: project.id, assigneeId: ana.id }))).jobs[0];
  const luisJob = (await store.mutateCrm(admin, jobInput({ title: 'Trabajo de Luis', projectId: project.id, assigneeId: luis.id }))).jobs[0];
  const todo = (await store.mutateCrm(admin, todoInput({ projectId: project.id, assigneeId: ana.id, jobId: job.id }))).todos[0];
  await store.mutateCrm(admin, todoInput({ title: 'Pendiente de Luis', projectId: project.id, assigneeId: luis.id, jobId: job.id }));
  const mine = await store.getMyWork(ana);
  assert.equal(mine.projects.length, 1);
  assert.ok(!('memberIds' in mine.projects[0]));
  assert.deepEqual(mine.jobs.map((item) => item.id), [job.id]);
  assert.deepEqual(mine.todos.map((item) => item.id), [todo.id]);
  assert.ok(!JSON.stringify(mine).includes('Trabajo de Luis'));
  assert.ok(!('audit' in mine) && !('users' in mine) && !('sessions' in mine));
  await store.updateMyWork(ana, { kind: 'job', id: job.id, status: 'active' });
  await store.updateMyWork(ana, { kind: 'todo', id: todo.id, status: 'completed' });
  assert.equal((await store.getMyWork(ana)).jobs[0].status, 'active');
  assert.equal((await store.getMyWork(ana)).todos[0].status, 'completed');
  for (const input of [
    { kind: 'job', id: job.id, status: 'cancelled' },
    { kind: 'job', id: job.id, status: 'active', assigneeId: luis.id },
    { kind: 'todo', id: todo.id, status: 'pending', title: 'Alterado' },
    { kind: 'job', id: luisJob.id, status: 'completed' },
  ]) await assert.rejects(store.updateMyWork(ana, input));
  assert.ok((await store.getAudit(admin)).some((event) => event.actor === 'ana' && event.action.includes('Estado')));
});

test('project membership removal and archival immediately restrict assigned work without deleting it', async (t) => {
  const { store, admin, ana, luis } = await fixture(t);
  const project = (await store.mutateCrm(admin, projectInput({ memberIds: [ana.id, luis.id] }))).projects[0];
  const job = (await store.mutateCrm(admin, jobInput({ projectId: project.id, assigneeId: ana.id }))).jobs[0];
  await store.mutateCrm(admin, projectInput({ id: project.id, memberIds: [ana.id], status: 'archived' }));
  assert.equal((await store.getMyWork(ana)).jobs.length, 1);
  await assert.rejects(store.updateMyWork(ana, { kind: 'job', id: job.id, status: 'active' }), /archivado/i);
  await store.mutateCrm(admin, projectInput({ id: project.id, memberIds: [luis.id], status: 'active' }));
  assert.equal((await store.getMyWork(ana)).projects.length, 0);
  assert.equal((await store.getMyWork(ana)).jobs.length, 0);
  await assert.rejects(store.updateMyWork(ana, { kind: 'job', id: job.id, status: 'completed' }), /permiso|asignado/i);
  assert.equal((await store.getCrm(admin)).jobs.length, 1);
});

test('project validation prevents invalid members, unsafe paths and cross-project work links', async (t) => {
  const { store, admin, ana, luis } = await fixture(t);
  for (const input of [projectInput({ memberIds: ['missing'] }), projectInput({ folderPath: '../secret' }), projectInput({ folderPath: '.onedrivelist-trash' }), projectInput({ name: '' })]) await assert.rejects(store.mutateCrm(admin, input));
  await assert.rejects(store.mutateCrm(ana, projectInput()), /administrador/i);
  await assert.rejects(store.listProjects(ana), /administrador/i);
  const one = (await store.mutateCrm(admin, projectInput({ memberIds: [ana.id] }))).projects[0];
  const two = (await store.mutateCrm(admin, projectInput({ name: 'Segundo', memberIds: [ana.id] }))).projects[0];
  await assert.rejects(store.mutateCrm(admin, jobInput({ projectId: one.id, assigneeId: luis.id })), /miembro|integrante/i);
  const job = (await store.mutateCrm(admin, jobInput({ projectId: one.id, assigneeId: ana.id }))).jobs[0];
  const { projectId, ...derivedInput } = todoInput({ jobId: job.id, assigneeId: ana.id });
  const todo = (await store.mutateCrm(admin, derivedInput)).todos[0];
  assert.equal(todo.projectId, one.id);
  await assert.rejects(store.mutateCrm(admin, todoInput({ projectId: two.id, assigneeId: ana.id, jobId: job.id })), /proyecto/i);
  await store.updateUser(admin, ana.id, { active: false });
  await assert.rejects(store.getMyWork(ana), /activo|sesión/i);
});

test('a member cannot reopen a cancelled job until the administrator reopens it', async (t) => {
  const { store, admin, ana } = await fixture(t);
  const job = (await store.mutateCrm(admin, jobInput({ assigneeId: ana.id, status: 'cancelled' }))).jobs[0];
  await assert.rejects(store.updateMyWork(ana, { kind: 'job', id: job.id, status: 'active' }), /cancelado/i);
  assert.equal((await store.getMyWork(ana)).jobs[0].status, 'cancelled');
  await store.mutateCrm(admin, jobInput({ id: job.id, assigneeId: ana.id, status: 'planned' }));
  await store.updateMyWork(ana, { kind: 'job', id: job.id, status: 'active' });
  assert.equal((await store.getMyWork(ana)).jobs[0].status, 'active');
});
