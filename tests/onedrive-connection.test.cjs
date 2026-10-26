const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
require('./register-ts.cjs');
const {createOneDriveConnection}=require('../src/services/onedrive/connection.ts');
test('OAuth pins owner, encrypts secrets, consumes state and serializes rotated refresh', async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'onelist-oauth-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 let now=1000, refreshes=0, owner='owner';
 const request=async(url,init)=>{
  if(String(url).includes('/token')) { const body=new URLSearchParams(init.body); if(body.get('grant_type')==='refresh_token') refreshes++; return Response.json({access_token:'secret-access',refresh_token:'secret-refresh',expires_in:120}); }
  if(String(url).endsWith('/me')) return Response.json({id:owner,displayName:'Propietario'});
  if(String(url).endsWith('/me/drive')) return Response.json({id:'drive'});
  return Response.json({id:'folder',folder:{},name:'OneDriveList'});
 };
 const config={directory,clientId:'client',clientSecret:'secret',redirectUri:'http://localhost/callback',fetch:request,now:()=>now};
 const client=createOneDriveConnection(config);
 assert.equal(await client.getStorageMode(),'local');
 const start=await client.createAuthorization('session');const state=new URL(start).searchParams.get('state');
 await assert.rejects(client.completeAuthorization({state,code:'code',sessionToken:'wrong'}));
 await client.completeAuthorization({state,code:'code',sessionToken:'session'});
 await assert.rejects(client.completeAuthorization({state,code:'code',sessionToken:'session'}));
 assert.equal(await client.getStorageMode(),'onedrive');
 assert.equal((await client.connectionStatus()).accountId,'owner');
 const missingConfig=createOneDriveConnection({...config,clientSecret:undefined});
 assert.equal((await missingConfig.connectionStatus()).connected,false);
 assert.equal(await missingConfig.getStorageMode(),'onedrive');
 for(const name of await fs.readdir(directory)) {if(name.endsWith('.enc')) { const stored=await fs.readFile(path.join(directory,name),'utf8');assert.ok(!stored.includes('secret-refresh'));assert.ok(!stored.includes('secret-access')); }}
 now+=130000;
 await Promise.all([client.getOneDriveAccessToken(),createOneDriveConnection(config).getOneDriveAccessToken()]);
 assert.equal(refreshes,1);
 await client.disconnect();assert.equal(await client.getStorageMode(),'onedrive');await assert.rejects(client.getOneDriveAccessToken());
 owner='other';const next=await client.createAuthorization('session');await assert.rejects(client.completeAuthorization({state:new URL(next).searchParams.get('state'),code:'code',sessionToken:'session'}));
 assert.equal((await client.connectionStatus()).connected,false);
});
test('configuration rejects unsafe redirects; expired state and invalid grants fail closed', async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'onelist-oauth-security-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const invalid=createOneDriveConnection({directory,clientId:'a',clientSecret:'b',redirectUri:'http://remote.test/callback'});
 assert.equal((await invalid.connectionStatus()).configured,false);assert.equal(await invalid.getStorageMode(),'local');
 let now=1000, revoke=false;
 const client=createOneDriveConnection({directory,clientId:'a',clientSecret:'b',redirectUri:'https://example.test/callback',now:()=>now,fetch:async(url)=>{
  if(String(url).includes('/token')) return revoke ? Response.json({error:'invalid_grant'},{status:400}) : Response.json({access_token:'access',refresh_token:'refresh',expires_in:60});
  if(String(url).endsWith('/me'))return Response.json({id:'owner'});
  if(String(url).endsWith('/me/drive'))return Response.json({id:'drive'});
  return Response.json({id:'folder',folder:{},name:'OneDriveList'});
 }});
 const expired=new URL(await client.createAuthorization('session')).searchParams.get('state');now+=600001;
 await assert.rejects(client.completeAuthorization({state:expired,code:'code',sessionToken:'session'}));
 const state=new URL(await client.createAuthorization('session')).searchParams.get('state');await client.completeAuthorization({state,code:'code',sessionToken:'session'});
 now+=61000;revoke=true;await assert.rejects(client.getOneDriveAccessToken());
 assert.equal((await client.connectionStatus()).connected,false);assert.equal(await client.getStorageMode(),'onedrive');
});

