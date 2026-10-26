require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('personal upload destinations require both read and upload without membership elevating folder access', () => {
  const { uploadPathsFor } = require('../src/services/personal-uploads.ts');
  const user = { role: 'user', grants: [
    { path: 'Equipo', permissions: ['read', 'upload'] },
    { path: 'Equipo/Privado', permissions: [] },
    { path: 'SoloLectura', permissions: ['read'] },
  ] };
  assert.deepEqual(uploadPathsFor(user, ['Equipo/Entrega', 'Equipo/Privado', 'Otro']), ['Equipo', 'Equipo/Entrega']);
  assert.deepEqual(uploadPathsFor({ role: 'user', grants: [] }, ['Proyecto']), []);
  assert.deepEqual(uploadPathsFor({ role: 'user', grants: [{ path: '', permissions: ['read', 'upload'] }] }, ['Equipo']), ['', 'Equipo']);
});
