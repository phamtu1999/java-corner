import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameStorage} from '../server/game-storage.js';
import {deploymentConfig} from '../server/deployment.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_STORAGE_BUCKET:'games',SUPABASE_PRIVATE_STORAGE_BUCKET:'private'};
test('private archive links use signed storage URLs and public links need no request',async()=>{
 const calls=[];
 const store=gameStorage({env,request:async(url,options)=>{calls.push({url,options});return Response.json({signedURL:'/object/sign/private/a.jar?token=example'});}});
 assert.equal(await store.url('folder/a b.jar','public'),'https://example.supabase.co/storage/v1/object/public/games/folder/a%20b.jar');
 assert.equal(calls.length,0);
 assert.equal(await store.url('a.jar','private'),'https://example.supabase.co/storage/v1/object/sign/private/a.jar?token=example');
 assert.equal(JSON.parse(calls[0].options.body).expiresIn,60);
 assert.equal(calls[0].options.headers.apikey,'sb_secret_test');
 assert.equal(calls[0].options.headers.Authorization,undefined);
});
test('private writes refuse public buckets and signing refuses foreign origins',async()=>{
 const store=gameStorage({env,request:async()=>Response.json({public:true})});
 await assert.rejects(store.put({path:'unused'},'private','owner','id'),/tắt Public/);
 const foreign=gameStorage({env,request:async()=>Response.json({signedURL:'https://untrusted.example/file'})});
 await assert.rejects(foreign.url('a.jar','private'),/không hợp lệ/);
 const same=gameStorage({env:{...env,SUPABASE_PRIVATE_STORAGE_BUCKET:'games'}});
 await assert.rejects(same.url('a.jar','private'),/khác bucket/);
});
test('Vercel always uses temporary disk and durable archives',()=>{
 const config=deploymentConfig({VERCEL:'1',DATA_DIR:'/readonly',GAME_STORAGE:'local'});
 assert.notEqual(config.dataDir,'/readonly');assert.equal(config.remoteJars,true);assert.equal(config.uploadLimit,4194304);
 assert.equal(deploymentConfig({}).remoteJars,false);
});
