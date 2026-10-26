require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createWorkspaceStore } = require('../src/services/workspace-store.ts');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-crm-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createWorkspaceStore(directory, { username: 'admin', password: 'bootstrap-secret' });
  const { user: admin } = await store.authenticate('admin', 'bootstrap-secret', 'test');
  return { directory, store, admin };
}

const jobInput = (extra = {}) => ({ kind: 'job', title: 'Preparar revisión ñ', description: 'Coordinar el trabajo', assigneeId: '', due: '2026-11-15', status: 'planned', priority: 'normal', ...extra });
const todoInput = (extra = {}) => ({ kind: 'todo', title: 'Revisar fuentes', jobId: '', assigneeId: '', due: '', status: 'pending', priority: 'normal', ...extra });

test('CRM adds empty collections to legacy storage without changing academic records or sessions', async (t) => {
  const { directory, store, admin } = await fixture(t);
  const filename = path.join(directory, 'workspace.json');
  const legacy = JSON.parse(await fs.readFile(filename, 'utf8'));
  delete legacy.jobs; delete legacy.todos;
  await fs.writeFile(filename, JSON.stringify(legacy));
  assert.deepEqual(await store.getCrm(admin), { jobs: [], todos: [] });
  await store.mutateCrm(admin, jobInput());
  const persisted = JSON.parse(await fs.readFile(filename, 'utf8'));
  assert.deepEqual(persisted.tasks, legacy.tasks);
  assert.deepEqual(persisted.checks, legacy.checks);
  assert.deepEqual(persisted.sessions, legacy.sessions);
  assert.equal(persisted.jobs.length, 1);
  assert.deepEqual(persisted.todos, []);
});

test('CRM persists jobs and todos with user references, statuses and audit without exposing secrets', async (t) => {
  const { directory, store, admin } = await fixture(t);
  const member = await store.createUser(admin, { username: 'ana', name: 'Ana', password: 'member-secret-123', role: 'user', grants: [] });
  const first = await store.mutateCrm(admin, jobInput({ assigneeId: member.id, priority: 'high' }));
  const job = first.jobs[0];
  assert.equal(job.title, 'Preparar revisión ñ');
  assert.equal(job.assigneeId, member.id);
  assert.ok(job.createdAt && job.updatedAt);
  const second = await store.mutateCrm(admin, todoInput({ jobId: job.id, assigneeId: admin.id }));
  const todo = second.todos[0];
  assert.equal(todo.jobId, job.id);
  assert.equal(todo.assigneeId, 'bootstrap');
  await store.mutateCrm(admin, todoInput({ id: todo.id, jobId: job.id, assigneeId: member.id, status: 'completed' }));
  await store.mutateCrm(admin, jobInput({ id: job.id, assigneeId: member.id, status: 'completed', description: 'Entrega revisada' }));
  const restarted = createWorkspaceStore(directory, { username: 'admin', password: 'bootstrap-secret' });
  const saved = await restarted.getCrm(admin);
  assert.equal(saved.jobs[0].status, 'completed');
  assert.equal(saved.jobs[0].createdAt, job.createdAt);
  assert.equal(saved.todos[0].status, 'completed');
  const members = await store.crmMembers(admin);
  assert.equal(members[0].id, 'bootstrap');
  assert.ok(members.some((u) => u.id === member.id));
  assert.ok(!JSON.stringify(members).includes('passwordHash'));
  assert.ok(!JSON.stringify(members).includes('member-secret-123'));
  const audit = await store.getAudit(admin);
  assert.ok(audit.some((a) => a.action === 'Trabajo creado' && a.actor === 'admin'));
  assert.ok(audit.some((a) => a.action === 'Pendiente actualizado'));
});

test('CRM denies non-admin users and invalid references, dates, states and oversized fields', async (t) => {
  const { store, admin } = await fixture(t);
  const member = await store.createUser(admin, { username: 'ana', name: 'Ana', password: 'member-secret-123', role: 'user', grants: [] });
  await assert.rejects(store.getCrm(member), /administrador/i);
  await assert.rejects(store.mutateCrm(member, jobInput()), /administrador/i);
  await assert.rejects(store.crmMembers(member), /administrador/i);
  await assert.rejects(store.getCrm({ ...admin, active: false }), /administrador/i);
  for (const invalid of [
    jobInput({ title: ' ' }), jobInput({ title: 'x'.repeat(201) }), jobInput({ description: 'x'.repeat(4001) }),
    jobInput({ status: 'invented' }), jobInput({ priority: 'urgent' }), jobInput({ due: '2026-02-30' }),
    jobInput({ due: '2026-13-01' }), jobInput({ due: '2026-2-1' }), jobInput({ assigneeId: 'missing' }),
    todoInput({ jobId: 'missing' }), jobInput({ id: '00000000-0000-4000-8000-000000000099' }),
    todoInput({ id: '00000000-0000-4000-8000-000000000099' }),
  ]) await assert.rejects(store.mutateCrm(admin, invalid));
  await store.updateUser(admin, member.id, { active: false });
  await assert.rejects(store.mutateCrm(admin, jobInput({ assigneeId: member.id })), /activo|responsable/i);
  assert.deepEqual(await store.getCrm(admin), { jobs: [], todos: [] });
});

test('concurrent CRM writes retain each task independently', async (t) => {
  const { store, admin } = await fixture(t);
  await Promise.all(Array.from({ length: 6 }, (_, i) => store.mutateCrm(admin, todoInput({ title: `Pendiente ${i}` }))));
  const result = await store.getCrm(admin);
  assert.equal(result.todos.length, 6);
  assert.equal(new Set(result.todos.map((todo) => todo.id)).size, 6);
});

test('CRM preserves historical inactive assignees on edits but refuses new inactive assignments', async (t) => {
  const { store, admin } = await fixture(t);
  const member = await store.createUser(admin, { username: 'ana', name: 'Ana', password: 'member-secret-123', role: 'user', grants: [] });
  const first = await store.mutateCrm(admin, jobInput({ assigneeId: member.id }));
  const job = first.jobs[0];
  const second = await store.mutateCrm(admin, todoInput({ assigneeId: member.id, jobId: job.id }));
  const todo = second.todos[0];
  const other = await store.mutateCrm(admin, jobInput({ title: 'Otro trabajo' }));
  const otherJob = other.jobs.find((item) => item.title === 'Otro trabajo');
  const otherTodos = await store.mutateCrm(admin, todoInput({ title: 'Otro pendiente' }));
  const otherTodo = otherTodos.todos.find((item) => item.title === 'Otro pendiente');
  await store.updateUser(admin, member.id, { active: false });
  const completedJob = await store.mutateCrm(admin, jobInput({ id: job.id, assigneeId: member.id, status: 'completed' }));
  assert.equal(completedJob.jobs.find((item) => item.id === job.id).status, 'completed');
  const completedTodo = await store.mutateCrm(admin, todoInput({ id: todo.id, assigneeId: member.id, jobId: job.id, status: 'completed' }));
  assert.equal(completedTodo.todos.find((item) => item.id === todo.id).status, 'completed');
  const reopened = await store.mutateCrm(admin, todoInput({ id: todo.id, assigneeId: member.id, jobId: job.id, status: 'pending' }));
  assert.equal(reopened.todos.find((item) => item.id === todo.id).assigneeId, member.id);
  await assert.rejects(store.mutateCrm(admin, jobInput({ assigneeId: member.id })), /activo|responsable/i);
  await assert.rejects(store.mutateCrm(admin, todoInput({ assigneeId: member.id })), /activo|responsable/i);
  await assert.rejects(store.mutateCrm(admin, jobInput({ id: otherJob.id, assigneeId: member.id })), /activo|responsable/i);
  await assert.rejects(store.mutateCrm(admin, todoInput({ id: otherTodo.id, assigneeId: member.id })), /activo|responsable/i);
});
