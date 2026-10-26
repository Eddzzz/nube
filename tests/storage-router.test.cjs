require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStorageRouter}=require('../src/services/storage-router.ts');
test('storage routes to the single selected backend and never falls back on cloud failure',async()=>{
 let mode='local',localCalls=0,cloudCalls=0;
 const local={getItem:async id=>{localCalls++;return{id,name:'local'};}};
 const cloud={getItem:async id=>{cloudCalls++;if(id==='offline')throw Error('offline');return{id,name:'onedrive'};}};
 const drive=createStorageRouter(local,cloud,async()=>mode);
 assert.equal((await drive.getItem('file')).name,'local');mode='onedrive';
 assert.equal((await drive.getItem('file')).name,'onedrive');
 await assert.rejects(drive.getItem('offline'),/offline/);
 assert.equal(localCalls,1);assert.equal(cloudCalls,2);
});
