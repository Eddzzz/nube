require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {resolvePrivateDirectory}=require('../src/lib/private-data.ts');

test('private store works without a local document root and rejects exposure inside a configured root',async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'onelist-private-'));
 try {
  const root=path.join(temporary,'drive');await fs.mkdir(root);
  assert.equal(await resolvePrivateDirectory(path.join(temporary,'accounts')),path.join(temporary,'accounts'));
  await assert.rejects(resolvePrivateDirectory(path.join(root,'private'),root),/fuera/);
  await assert.rejects(resolvePrivateDirectory(path.join(root,'missing','private'),root),/fuera/);
  assert.equal(await resolvePrivateDirectory(path.join(temporary,'accounts'),path.join(temporary,'missingdrive')),path.join(temporary,'accounts'));
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
});
