require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('web trash restores original location and refuses collisions; versions preserve both states', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-recovery-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  const folder = await drive.createFolder({ name: 'Trabajo' });
  const put = (text) => new Request('http://localhost/upload', { method: 'PUT', body: text });
  const note = await drive.upload(put('Estado inicial'), 'nota.txt', folder.id);
  const version = await drive.saveVersion(note.id);
  await drive.replaceContent(note.id, put('Estado modificado'));
  assert.equal(await drive.readText(note.id), 'Estado modificado');
  await drive.restoreVersion(note.id, version.id);
  assert.equal(await drive.readText(note.id), 'Estado inicial');
  const history = await drive.listVersions(note.id);
  assert.ok(history.length >= 3);
  await drive.deleteDriveItem(note.id);
  const [deleted] = await drive.listTrash();
  assert.equal(deleted.originalPath, 'Trabajo/nota.txt');
  await drive.upload(put('otro archivo'), 'nota.txt', folder.id);
  await assert.rejects(drive.restoreTrash(deleted.id), /existe/i);
  assert.equal(await drive.readText(note.id), 'otro archivo');
  await drive.deleteDriveItem(note.id);
  await drive.restoreTrash(deleted.id);
  assert.equal(await drive.readText(note.id), 'Estado inicial');
  assert.equal((await drive.listTrash()).length, 1);
  assert.ok(!(await drive.listChildren()).value.some((i) => i.name.startsWith('.onedrivelist-')));
  for (const id of ['../escape', '/Windows', 'fake']) {
    await assert.rejects(drive.restoreTrash(id));
    await assert.rejects(drive.restoreVersion(note.id, id));
  }
  const renamed = await drive.renameDriveItem(note.id, 'renombrado.txt');
  assert.ok((await drive.listVersions(renamed.id)).some((v) => v.id === version.id), 'renaming must preserve version history');
  const renamedFolder = await drive.renameDriveItem(folder.id, 'Equipo');
  const movedId = Buffer.from('Equipo/renombrado.txt').toString('base64url');
  assert.ok((await drive.listVersions(movedId)).some((v) => v.id === version.id), 'renaming parent must preserve version history');
  await drive.restoreVersion(movedId, version.id);
  assert.equal(await drive.readText(movedId), 'Estado inicial');
  assert.equal(renamedFolder.name, 'Equipo');
});

test('concurrent rename and recovery operations never overwrite existing content', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-races-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  await fs.writeFile(path.join(directory, 'a.txt'), 'A');
  await fs.writeFile(path.join(directory, 'b.txt'), 'B');
  const id = (p) => Buffer.from(p).toString('base64url');
  const outcomes = await Promise.allSettled(['a.txt', 'b.txt'].map((p) => drive.renameDriveItem(id(p), 'destino.txt')));
  assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
  const entries = (await drive.listChildren()).value;
  assert.equal(entries.length, 2);
  const contents = await Promise.all(entries.map((i) => drive.readText(i.id)));
  assert.deepEqual(contents.sort(), ['A', 'B']);
});

test('trash keeps its own history when a filename is reused and renamed', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-history-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  const put = (text) => new Request('http://localhost/upload', { method: 'PUT', body: text });
  const original = await drive.upload(put('Original document'), 'report.txt');
  const originalVersion = await drive.saveVersion(original.id);
  await drive.deleteDriveItem(original.id);
  const [deleted] = await drive.listTrash();
  const replacement = await drive.upload(put('Unrelated replacement'), 'report.txt');
  assert.deepEqual(await drive.listVersions(replacement.id), [], 'a reused name must not inherit deleted content');
  await assert.rejects(drive.restoreVersion(replacement.id, originalVersion.id), /versión|papelera/i);
  const replacementVersion = await drive.saveVersion(replacement.id);
  const renamed = await drive.renameDriveItem(replacement.id, 'other.txt');
  assert.deepEqual((await drive.listVersions(renamed.id)).map((v) => v.id), [replacementVersion.id]);
  await drive.restoreTrash(deleted.id);
  assert.deepEqual((await drive.listVersions(original.id)).map((v) => v.id), [originalVersion.id]);
  await drive.restoreVersion(original.id, originalVersion.id);
  assert.equal(await drive.readText(original.id), 'Original document');
  assert.equal(await drive.readText(renamed.id), 'Unrelated replacement');
});

test('deleting and restoring a folder separates every descendant version from reused paths', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-folder-history-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  const put = (text) => new Request('http://localhost/upload', { method: 'PUT', body: text });
  const folder = await drive.createFolder({ name: 'Equipo' });
  const original = await drive.upload(put('Old document'), 'report.txt', folder.id);
  const version = await drive.saveVersion(original.id);
  await drive.deleteDriveItem(folder.id);
  const [deleted] = await drive.listTrash();
  const replacementFolder = await drive.createFolder({ name: 'Equipo' });
  const replacement = await drive.upload(put('New document'), 'report.txt', replacementFolder.id);
  assert.deepEqual(await drive.listVersions(replacement.id), []);
  await drive.deleteDriveItem(replacementFolder.id);
  await drive.restoreTrash(deleted.id);
  assert.deepEqual((await drive.listVersions(original.id)).map((v) => v.id), [version.id]);
});

test('PDF and video downloads permit browser viewers while active SVG stays sandboxed', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-media-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  for (const [filename, mime] of [['file.pdf', 'application/pdf'], ['video.mp4', 'video/mp4'], ['video.webm', 'video/webm'], ['video.mov', 'video/quicktime'], ['video.ogv', 'video/ogg']]) {
    await fs.writeFile(path.join(directory, filename), 'media fixture');
    const response = await drive.download(Buffer.from(filename).toString('base64url'), new Request('http://localhost/download?inline=1'));
    assert.equal(response.headers.get('Content-Type'), mime);
    assert.doesNotMatch(response.headers.get('Content-Security-Policy') || '', /(?:^|;)\s*sandbox(?:;|$)/);
    assert.equal(await response.text(), 'media fixture');
  }
  await fs.writeFile(path.join(directory, 'active.svg'), '<svg/>');
  const response = await drive.download(Buffer.from('active.svg').toString('base64url'), new Request('http://localhost/download?inline=1'));
  assert.match(response.headers.get('Content-Security-Policy'), /sandbox/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  await response.text();
});

test('an interrupted trash move does not hide a live file history or advertise missing content', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const { randomUUID } = require('node:crypto');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-interrupted-trash-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  await fs.writeFile(path.join(directory, 'report.txt'), 'Still present');
  const id = Buffer.from('report.txt').toString('base64url');
  const version = await drive.saveVersion(id);
  const trash = path.join(directory, '.onedrivelist-trash');
  await fs.mkdir(trash, { recursive: true });
  const incomplete = await fs.mkdtemp(path.join(trash, randomUUID() + '-'));
  await fs.writeFile(path.join(incomplete, '.onedrivelist-meta.json'), JSON.stringify({
    originalPath: 'report.txt', name: 'report.txt', createdAt: new Date().toISOString(), size: 13, folder: false, versionIds: [version.id],
  }));
  assert.deepEqual(await drive.listTrash(), []);
  assert.deepEqual((await drive.listVersions(id)).map((v) => v.id), [version.id]);
});

test('legacy trash metadata without version ownership still preserves its historical versions', async (t) => {
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-legacy-trash-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const drive = createLocalDrive(directory);
  const put = (text) => new Request('http://localhost/upload', { method: 'PUT', body: text });
  const original = await drive.upload(put('Original legacy file'), 'report.txt');
  const version = await drive.saveVersion(original.id);
  await drive.deleteDriveItem(original.id);
  const [deleted] = await drive.listTrash();
  const metadata = path.join(directory, '.onedrivelist-trash', deleted.id, '.onedrivelist-meta.json');
  const entry = JSON.parse(await fs.readFile(metadata, 'utf8'));
  delete entry.versionIds;
  await fs.writeFile(metadata, JSON.stringify(entry));
  const replacement = await drive.upload(put('New file'), 'report.txt');
  assert.deepEqual(await drive.listVersions(replacement.id), []);
  await drive.renameDriveItem(replacement.id, 'new.txt');
  await drive.restoreTrash(deleted.id);
  assert.deepEqual((await drive.listVersions(original.id)).map((v) => v.id), [version.id]);
});
