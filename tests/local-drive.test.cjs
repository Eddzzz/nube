const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

// Compile the isolated disk adapter with the project's existing TypeScript dependency.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};

test('local drive confines paths, preserves content and supports shared-folder operations', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'onedrivelist-test-'));
  t.after(() => fsp.rm(workspace, { recursive: true, force: true }));
  const root = path.join(workspace, 'shared');
  await fsp.mkdir(root);
  const drive = createLocalDrive(root);
  const folder = await drive.createFolder({ name: 'Música ñ' });
  assert.ok(folder.folder);
  const item = await drive.upload(new Request('http://localhost/upload', { method: 'PUT', body: 'hola mundo' }), 'saludo.txt', folder.id);
  assert.equal((await drive.listChildren(folder.id)).value[0].name, 'saludo.txt');
  assert.equal(await drive.readText(item.id), 'hola mundo');
  assert.equal((await drive.searchItems('SALUDO')).value[0].id, item.id);
  const renamed = await drive.renameDriveItem(item.id, 'otro.txt');
  assert.equal(await drive.readText(renamed.id), 'hola mundo');
  const duplicate = await drive.upload(new Request('http://localhost/upload', { method: 'PUT', body: 'nuevo' }), 'otro.txt', folder.id);
  assert.notEqual(duplicate.name, renamed.name);
  assert.equal(await drive.readText(renamed.id), 'hola mundo');
  const empty = await drive.upload(new Request('http://localhost/upload', { method: 'PUT', body: '' }), 'vacio.txt');
  assert.equal(empty.size, 0);

  const download = await drive.download(renamed.id, new Request('http://localhost/download', { headers: { range: 'bytes=1-3' } }));
  assert.equal(download.status, 206);
  assert.equal(download.headers.get('content-range'), 'bytes 1-3/10');
  assert.equal(await download.text(), 'ola');
  const suffix = await drive.download(renamed.id, new Request('http://localhost/download', { headers: { range: 'bytes=-5' } }));
  assert.equal(await suffix.text(), 'mundo');
  assert.equal((await drive.download(renamed.id, new Request('http://localhost/download', { headers: { range: 'bytes=99-' } }))).status, 416);

  for (const value of ['../outside', 'C:\\Windows', '/etc/passwd', 'folder/../../outside', '.onedrivelist-trash/secret']) {
    const id = Buffer.from(value).toString('base64url');
    await assert.rejects(drive.getItem(id));
    await assert.rejects(drive.deleteDriveItem(id));
  }
  for (const name of ['../escape', 'NUL.txt', 'CON', 'a:b', 'bad.', 'bad ', '.onedrivelist-trash']) {
    await assert.rejects(drive.createFolder({ name }));
    await assert.rejects(drive.renameDriveItem(renamed.id, name));
  }
  const outside = path.join(workspace, 'outside');
  await fsp.mkdir(outside);
  await fsp.writeFile(path.join(outside, 'secret.txt'), 'secret');
  await fsp.symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const escapeId = Buffer.from('escape').toString('base64url');
  await assert.rejects(drive.listChildren(escapeId));
  await assert.rejects(drive.createFolder({ name: 'bad', parentId: escapeId }));
  assert.ok(!(await drive.listChildren()).value.some((entry) => entry.name === 'escape'));

  await drive.deleteDriveItem(renamed.id);
  assert.ok(!(await drive.listChildren(folder.id)).value.some((entry) => entry.id === renamed.id));
  const longName = `${'x'.repeat(220)}.txt`;
  const longItem = await drive.upload(new Request('http://localhost/upload', { method: 'PUT', body: 'long name' }), longName);
  await drive.deleteDriveItem(longItem.id);
  const trash = await fsp.readdir(path.join(root, '.onedrivelist-trash'));
  assert.equal(trash.length, 2);
  const recovered = [];
  for (const directory of trash) {
    const names = await fsp.readdir(path.join(root, '.onedrivelist-trash', directory));
    recovered.push(...names);
  }
  assert.ok(recovered.includes('otro.txt'));
  assert.ok(recovered.includes(longName));
  assert.ok(!(await drive.listChildren()).value.some((entry) => entry.name.startsWith('.onedrivelist-')));
  await assert.rejects(drive.renameDriveItem('', 'root-moved'));
  assert.ok((await fsp.stat(root)).isDirectory());
});
