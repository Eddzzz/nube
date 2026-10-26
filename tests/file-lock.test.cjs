require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { withDirectoryLock } = require('../src/services/file-lock.ts');

const prelude = "require('./tests/register-ts.cjs'); const {withDirectoryLock} = require('./src/services/file-lock.ts');";
const options = { cwd: path.resolve(__dirname, '..'), windowsHide: true };
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onelist-lock-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, lock: path.join(directory, 'lock') };
}

test('a process crash releases ownership for the next writer without manual cleanup', async (t) => {
  const { lock } = await fixture(t);
  const child = spawnSync(process.execPath, ['-e', prelude + 'withDirectoryLock(process.argv[1], async () => { process.exit(23); });', lock], options);
  assert.equal(child.status, 23, String(child.stderr));
  assert.equal(await withDirectoryLock(lock, async () => 'recovered', 200), 'recovered');
});

test('an active owner is never stolen even after the competing writer times out', async (t) => {
  const { lock } = await fixture(t);
  const child = spawn(process.execPath, ['-e', prelude + "withDirectoryLock(process.argv[1], async () => { process.stdout.write('locked'); await new Promise(resolve => setTimeout(resolve, 800)); });", lock], options);
  const exited = once(child, 'exit');
  t.after(() => { if (child.exitCode === null) child.kill(); });
  await once(child.stdout, 'data');
  await assert.rejects(withDirectoryLock(lock, async () => assert.fail('active owner was stolen'), 75), /operación/);
  assert.equal((await exited)[0], 0);
  assert.equal(await withDirectoryLock(lock, async () => 'next'), 'next');
});

test('competing processes recover one crashed lock and serialize every subsequent write', async (t) => {
  const { directory, lock } = await fixture(t);
  const counter = path.join(directory, 'counter');
  await fs.writeFile(counter, '0');
  const crashed = spawnSync(process.execPath, ['-e', prelude + 'withDirectoryLock(process.argv[1], async () => { process.exit(23); });', lock], options);
  assert.equal(crashed.status, 23, String(crashed.stderr));
  const script = prelude + `
    const fs = require('node:fs/promises');
    (async () => {
      for (let i = 0; i < 5; i++) await withDirectoryLock(process.argv[1], async () => {
        const value = Number(await fs.readFile(process.argv[2], 'utf8'));
        await new Promise(resolve => setTimeout(resolve, 15));
        await fs.writeFile(process.argv[2], String(value + 1));
      }, 800);
    })().catch(error => { console.error(error); process.exitCode = 1; });`;
  const children = Array.from({ length: 3 }, () => spawn(process.execPath, ['-e', script, lock, counter], options));
  t.after(() => { for (const child of children) if (child.exitCode === null) child.kill(); });
  const exits = await Promise.all(children.map(async (child) => {
    let errors = '';
    child.stderr.on('data', (chunk) => { errors += chunk; });
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, errors);
  }));
  assert.equal(exits.length, 3);
  assert.equal(await fs.readFile(counter, 'utf8'), '15');
});

test('transient Windows directory access errors retry recovery without losing the pending write', async (t) => {
  for (const code of ['EPERM', 'EACCES']) await t.test(code, async (t) => {
    const { lock } = await fixture(t);
    const crashed = spawnSync(process.execPath, ['-e', prelude + 'withDirectoryLock(process.argv[1], async () => { process.exit(23); });', lock], options);
    assert.equal(crashed.status, 23, String(crashed.stderr));
    const readdir = fs.readdir;
    let transient = true;
    // Windows can deny scandir while another worker removes/replaces the lock directory.
    t.mock.method(fs, 'readdir', async (target, ...args) => {
      if (target === lock && transient) {
        transient = false;
        throw Object.assign(new Error('Directory replacement in progress'), { code });
      }
      return readdir(target, ...args);
    });
    assert.equal(await withDirectoryLock(lock, async () => 'written', 300), 'written');
  });
});

test('persistent access denial times out without running the operation or deleting the owner', async (t) => {
  const { lock } = await fixture(t);
  const crashed = spawnSync(process.execPath, ['-e', prelude + 'withDirectoryLock(process.argv[1], async () => { process.exit(23); });', lock], options);
  assert.equal(crashed.status, 23, String(crashed.stderr));
  const readdir = fs.readdir;
  const original = await readdir(lock);
  t.mock.method(fs, 'readdir', async (target, ...args) => {
    if (target === lock) throw Object.assign(new Error('Access denied'), { code: 'EACCES' });
    return readdir(target, ...args);
  });
  await assert.rejects(withDirectoryLock(lock, async () => assert.fail('unverified owner was stolen'), 75), (error) => error.status === 503);
  assert.deepEqual(await readdir(lock), original);
});

test('a junction or invalid owner is never accepted or removed', async (t) => {
  const { directory, lock } = await fixture(t);
  const target = path.join(directory, 'target');
  await fs.mkdir(target);
  await fs.symlink(target, lock, 'junction');
  await assert.rejects(withDirectoryLock(lock, async () => assert.fail('junction accepted'), 75));
  assert.equal((await fs.lstat(lock)).isSymbolicLink(), true);
  await fs.unlink(lock);
  await fs.mkdir(lock);
  const malformed = path.join(lock, 'owner-1-00000000-0000-0000-0000-000000000000.json');
  await fs.mkdir(malformed);
  await assert.rejects(withDirectoryLock(lock, async () => assert.fail('invalid owner accepted'), 75), (error) => error.status === 403);
  assert.equal((await fs.lstat(malformed)).isDirectory(), true);
});
