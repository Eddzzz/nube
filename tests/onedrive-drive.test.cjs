const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const options=(fetch)=>({getConnection:async()=>({driveId:'drive',rootId:'root',accountId:'account',rootName:'OneDriveList'}),getAccessToken:async()=>'secret',fetch});
test('public identifiers reject traversal and private paths before Graph requests',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');
 const drive=createOneDriveDrive(options(async()=>{throw Error('must not fetch')}));
 for(const value of ['../outside','.onedrivelist-trash/entry']) await assert.rejects(drive.getItem(Buffer.from(value).toString('base64url')));
});
test('pagination cannot send credentials outside the anchored Graph collection',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');
 let calls=0;
 const drive=createOneDriveDrive(options(async(url)=>{calls++;return Response.json(String(url).endsWith('/children')?{value:[],'@odata.nextLink':'https://evil.example/steal'}:{id:'root',eTag:'v1',name:'OneDriveList',folder:{}})}));
 await assert.rejects(drive.listChildren());assert.equal(calls,2);
});
test('remote shortcuts cannot escape the shared root',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');
 const drive=createOneDriveDrive(options(async()=>Response.json({id:'foreign',name:'shortcut',remoteItem:{id:'outside'},folder:{}})));
 await assert.rejects(drive.getItem(Buffer.from('shortcut').toString('base64url')));
});
function cloud(){
 let sequence=0;const nodes=new Map([['',{id:'root',eTag:'v1',name:'OneDriveList',folder:{}}]]);let leak=false;
 const fetch=async(input,init={})=>{
  const url=new URL(input);const headers=new Headers(init.headers);
  if(url.hostname==='files.1drv.com'){if(headers.has('authorization'))leak=true;const node=nodes.get(url.searchParams.get('path'));const data=node.content||Buffer.alloc(0);const range=headers.get('range');if(range){const [,a,b]=/bytes=(\d+)-(\d+)/.exec(range);return new Response(data.subarray(+a,+b+1),{status:206});}return new Response(data);}
  assert.equal(headers.get('authorization'),'Bearer secret');
  let requestedPath=url.pathname;const immutable=/\/items\/(id\d+)(\/content)?$/.exec(requestedPath);if(immutable){const found=[...nodes].find(([,n])=>n.id===immutable[1]);if(!found)return new Response(null,{status:404});requestedPath='/v1.0/drives/drive/items/root:/'+found[0]+':'+(immutable[2]||'');}
  const match=/\/items\/root(?::\/(.*?)(?::(?=\/)|:?(?=$)))?(\/children|\/content)?$/.exec(decodeURIComponent(requestedPath));if(!match)return Response.json({quota:{remaining:999}});
  const relative=match[1]||'',action=match[2]||'',method=init.method||'GET';const node=nodes.get(relative);if(headers.has('if-match')&&headers.get('if-match')!==node?.eTag)return new Response(null,{status:412});
  if(method==='GET'&&action==='/children'){if(!node)return new Response(null,{status:404});return Response.json({value:[...nodes].filter(([p])=>p&&p.split('/').slice(0,-1).join('/')===relative).map(([,v])=>v)});}
  if(method==='GET'&&action==='/content')return node?new Response(null,{status:302,headers:{location:'https://files.1drv.com/content?path='+encodeURIComponent(relative)}}):new Response(null,{status:404});
  if(method==='GET')return node?Response.json(node):new Response(null,{status:404});
  if(method==='POST'){const value=JSON.parse(init.body),target=relative?relative+'/'+value.name:value.name;if(nodes.has(target))return new Response(null,{status:409});const entry={id:'id'+(++sequence),eTag:'v1',name:value.name,folder:{}};nodes.set(target,entry);return Response.json(entry);}
  if(method==='PUT'){if(node&&headers.has('if-none-match'))return new Response(null,{status:412});const data=typeof init.body==='string'?Buffer.from(init.body):Buffer.from(await new Response(init.body).arrayBuffer());const entry={id:node?.id||'id'+(++sequence),eTag:'v'+(++sequence),name:relative.split('/').at(-1),size:data.length,file:{mimeType:'text/plain'},content:data};nodes.set(relative,entry);return Response.json(entry);}
  if(method==='PATCH'){if(!node)return new Response(null,{status:404});const value=JSON.parse(init.body);const parent=value.parentReference?[...nodes].find(([,v])=>v.id===value.parentReference.id)[0]:relative.split('/').slice(0,-1).join('/');const target=parent?parent+'/'+value.name:value.name;if(nodes.has(target)&&target!==relative)return new Response(null,{status:409});for(const [key,entry] of [...nodes])if(key===relative||key.startsWith(relative+'/')){nodes.delete(key);nodes.set(target+key.slice(relative.length),key===relative?{...entry,eTag:'v'+(++sequence),name:value.name}:entry);}return Response.json(nodes.get(target));}
  if(method==='DELETE'){for(const key of [...nodes.keys()])if(key===relative||key.startsWith(relative+'/'))nodes.delete(key);return new Response(null,{status:204});}
  throw Error('unexpected '+method+' '+url);
 };return {fetch,nodes,leaked:()=>leak};
}
test('cloud upload preserves duplicates, proxies ranges and supports versions/trash after path reuse',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');const fake=cloud();const drive=createOneDriveDrive(options(fake.fetch));
 const upload=(text,name)=>drive.upload(new Request('http://local',{method:'PUT',body:text}),name);
 const a=await upload('first','hello.txt');const b=await upload('second','hello.txt');assert.equal(b.name,'hello (1).txt');
 const version=await drive.saveVersion(a.id);await drive.replaceContent(a.id,new Request('http://local',{method:'PUT',body:'changed'}));
 assert.equal(await drive.readText(a.id),'changed');await drive.restoreVersion(a.id,version.id);assert.equal(await drive.readText(a.id),'first');
 const response=await drive.download(a.id,new Request('http://local',{headers:{range:'bytes=1-3'}}));assert.equal(response.status,206);assert.equal(await response.text(),'irs');assert.equal(response.headers.get('location'),null);assert.equal(fake.leaked(),false);
 await drive.deleteDriveItem(a.id);const replacement=await upload('replacement','hello.txt');assert.equal((await drive.listVersions(replacement.id)).length,0);const trash=await drive.listTrash();assert.equal(trash.length,1);await assert.rejects(drive.restoreTrash(trash[0].id));await drive.renameDriveItem(replacement.id,'new.txt');await drive.restoreTrash(trash[0].id);assert.equal(await drive.readText(a.id),'first');assert.ok((await drive.listVersions(a.id)).length>0);
 assert.ok((await drive.listChildren()).value.every(x=>!x.name.startsWith('.onedrivelist-')));
 await assert.rejects(drive.renameDriveItem(a.id,'new.txt'));
});
test('upload checks declared and actual streamed size before publishing content',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');const fake=cloud();const drive=createOneDriveDrive(options(fake.fetch));
 await assert.rejects(drive.upload(new Request('http://local',{method:'PUT',headers:{'content-length':String(201*1024*1024)},body:'x'}),'huge.bin'));
 const stream=new ReadableStream({start(controller){for(let i=0;i<201;i++)controller.enqueue(new Uint8Array(1024*1024));controller.close();}});
 await assert.rejects(drive.upload(new Request('http://local',{method:'PUT',body:stream,duplex:'half'}),'huge.bin'));assert.equal(fake.nodes.has('huge.bin'),false);
});
test('external rename and path reuse cannot redirect an in-flight replacement',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');const fake=cloud();let trigger=false;
 const fetch=async(url,init)=>{if(trigger&&init.method==='PUT'&&String(url).includes('/content')&&!String(url).includes('.onedrivelist-')){const source=fake.nodes.get('owned.txt');if(String(url).includes('/items/'+source.id+'/content')){trigger=false;fake.nodes.delete('owned.txt');fake.nodes.set('moved.txt',{...source,name:'moved.txt',eTag:'external-change'});fake.nodes.set('owned.txt',{id:'external',eTag:'new',name:'owned.txt',file:{mimeType:'text/plain'},size:6,content:Buffer.from('keep B')});}}return fake.fetch(url,init);};
 const drive=createOneDriveDrive(options(fetch));const item=await drive.upload(new Request('http://local',{method:'PUT',body:'old A'}),'owned.txt');trigger=true;
 await assert.rejects(drive.replaceContent(item.id,new Request('http://local',{method:'PUT',body:'replace'})),error=>error.status===409);
 assert.equal(fake.nodes.get('owned.txt').content.toString(),'keep B');assert.equal(fake.nodes.get('moved.txt').content.toString(),'old A');
});
test('private recovery metadata cannot redirect content reads through a shortcut',async()=>{
 const {createOneDriveDrive}=require('../src/services/onedrive/graph-drive.ts');const fake=cloud();const drive=createOneDriveDrive(options(fake.fetch));const item=await drive.upload(new Request('http://local',{method:'PUT',body:'original'}),'file.txt');const entry=await drive.saveVersion(item.id);const key='.onedrivelist-versions/'+entry.id+'/metadata.json';fake.nodes.set(key,{...fake.nodes.get(key),remoteItem:{id:'foreign'}});
 await assert.rejects(drive.listVersions(item.id),error=>error.status===403);
});
