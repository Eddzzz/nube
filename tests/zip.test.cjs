require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('ZIP downloads preserve Unicode names, empty files, folders and CRC without duplicate entries', async (t) => {
  const { prepareZip, createZipStream } = require('../src/services/zip.ts');
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-zip-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'Equipo'));
  await fs.mkdir(path.join(directory, 'Equipo', 'Vacía'));
  await fs.writeFile(path.join(directory, 'Equipo', 'año ñ.txt'), 'Contenido académico');
  await fs.writeFile(path.join(directory, 'Equipo', 'vacio.txt'), '');
  await fs.writeFile(path.join(directory, 'fuente.bin'), Buffer.from([0, 255, 3, 4]));
  const drive = createLocalDrive(directory);
  const id = (relative) => Buffer.from(relative).toString('base64url');
  const user = { role: 'user', grants: [{ path: '', permissions: ['read', 'download'] }] };
  const plan = await prepareZip(drive, user, [id('Equipo'), id('Equipo/año ñ.txt'), id('fuente.bin')]);
  const bytes = Buffer.from(await new Response(createZipStream(drive, plan, new Request('http://localhost/archive'))).arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  const result = spawnSync('python', ['-X', 'utf8', '-c',
    'import sys,io,base64,zipfile,json; z=zipfile.ZipFile(io.BytesIO(base64.b64decode(sys.stdin.read()))); assert z.testzip() is None; print(json.dumps({i.filename:base64.b64encode(z.read(i)).decode() for i in z.infolist()},ensure_ascii=False))'],
    { input: bytes.toString('base64'), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const contents = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(contents).sort(), ['Equipo/', 'Equipo/Vacía/', 'Equipo/año ñ.txt', 'Equipo/vacio.txt', 'fuente.bin'].sort());
  assert.equal(Buffer.from(contents['Equipo/año ñ.txt'], 'base64').toString(), 'Contenido académico');
  assert.equal(contents['Equipo/vacio.txt'], '');
  assert.deepEqual(Buffer.from(contents['fuente.bin'], 'base64'), Buffer.from([0, 255, 3, 4]));
});

test('ZIP preflight enforces every descendant permission, canonical paths and bounded selections', async (t) => {
  const { prepareZip, MAX_ZIP_BYTES, MAX_ZIP_ENTRIES } = require('../src/services/zip.ts');
  const { createLocalDrive } = require('../src/services/local-drive.ts');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-zip-permissions-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'Equipo'));
  await fs.mkdir(path.join(directory, 'Equipo', 'Privado'));
  await fs.writeFile(path.join(directory, 'Equipo', 'Privado', 'secreto.txt'), 'NO FILTRAR');
  const drive = createLocalDrive(directory);
  const id = (relative) => Buffer.from(relative).toString('base64url');
  const restricted = { role: 'user', grants: [{ path: 'Equipo', permissions: ['read', 'download'] }, { path: 'Equipo/Privado', permissions: [] }] };
  await assert.rejects(prepareZip(drive, restricted, [id('Equipo')]), /permiso/i);
  await assert.rejects(prepareZip(drive, { role: 'user', grants: [{ path: '', permissions: ['read'] }] }, [id('Equipo')]), /permiso/i);
  const admin = { role: 'admin', grants: [] };
  for (const value of [[], [''], [id('../escape')], Array(101).fill(id('Equipo'))]) await assert.rejects(prepareZip(drive, admin, value));
  const oversized = { getItem: async () => ({ id: id('big.bin'), name: 'big.bin', size: MAX_ZIP_BYTES + 1, file: {}, lastModifiedDateTime: new Date().toISOString() }) };
  await assert.rejects(prepareZip(oversized, admin, [id('big.bin')]), /200 MB/i);
  const folder = { id: id('Equipo'), name: 'Equipo', size: 0, folder: {}, lastModifiedDateTime: new Date().toISOString() };
  const many = { getItem: async () => folder, listChildren: async () => ({ value: Array.from({ length: MAX_ZIP_ENTRIES }, (_, i) => ({ id: id('Equipo/' + i + '.txt'), name: i + '.txt', size: 0, file: {}, lastModifiedDateTime: folder.lastModifiedDateTime })) }) };
  await assert.rejects(prepareZip(many, admin, [folder.id]), /1.000/i);
});

test('cancelling a ZIP stream closes its current source reader', async () => {
  const { createZipStream } = require('../src/services/zip.ts');
  let canceled = false;
  const source = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); }, cancel() { canceled = true; } });
  const drive = { download: async () => new Response(source) };
  const entries = [{ id: Buffer.from('data.bin').toString('base64url'), path: 'data.bin', size: 30, folder: false, modified: new Date().toISOString() }];
  const reader = createZipStream(drive, entries, new Request('http://localhost/archive')).getReader();
  await reader.read(); // Local header.
  await reader.read(); // First content chunk.
  await reader.cancel();
  assert.equal(canceled, true);
});
