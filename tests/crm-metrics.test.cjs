require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('CRM dashboard derives open, overdue, workloads and dates without counting completed/cancelled work', () => {
  const { summarizeCrm, todayLaPaz, activityDays } = require('../src/features/crm/model.ts');
  const now = new Date('2026-10-26T02:00:00Z');
  assert.equal(todayLaPaz(now), '2026-10-25');
  const data = {
    users: [{ id: 'a', active: true, role: 'admin' }, { id: 'b', active: false, role: 'user' }],
    jobs: [{ id: 'j1', status: 'active', due: '2026-10-24', assigneeId: 'a' }, { id: 'j2', status: 'cancelled', due: '2026-10-24' }, { id: 'j3', status: 'completed', due: '2026-10-24' }],
    todos: [{ id: 't1', status: 'pending', due: '2026-10-24', assigneeId: 'a' }, { id: 't2', status: 'completed', due: '2026-10-24' }, { id: 't3', status: 'progress', due: '2026-10-25', assigneeId: 'b' }, { id: 't4', status: 'pending', due: '', assigneeId: '' }],
  };
  const metrics = summarizeCrm(data, now);
  assert.equal(metrics.activeUsers, 1);
  assert.equal(metrics.openJobs, 1);
  assert.equal(metrics.openTodos, 3);
  assert.equal(metrics.overdueTodos, 1);
  assert.equal(metrics.dueToday, 1);
  assert.equal(metrics.completedTodos, 1);
  assert.equal(metrics.workload.find((u) => u.id === 'a').todos, 1);
  assert.equal(metrics.workload.find((u) => u.id === 'b').todos, 1);
  const days = activityDays([{ at: '2026-10-26T02:00:00Z' }, { at: '2026-10-20T12:00:00Z' }, { at: '2026-10-18T12:00:00Z' }], now);
  assert.equal(days.length, 7);
  assert.equal(days.at(-1).date, '2026-10-25');
  assert.equal(days.at(-1).count, 1);
  assert.equal(days.reduce((sum, d) => sum + d.count, 0), 2);
});
