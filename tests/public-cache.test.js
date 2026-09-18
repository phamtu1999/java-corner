import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {publicCache} from '../server/public-cache.js';
test('public cache coalesces, expires, invalidates and isolates private requests',async t=>{
 const app=express();let calls=0;
 app.use((req,res,next)=>{if(req.headers.authorization)req.user={id:'member'};next();});
 app.use(publicCache({ttl:500}));
 app.get('/games',async(req,res)=>{calls++;await new Promise(r=>setTimeout(r,10));res.json({calls,scope:req.query.scope||'public'});});
 app.post('/change',(req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 const get=(path='/games',options)=>fetch(base+path,options).then(r=>r.json());
 await Promise.all(Array.from({length:20},()=>get()));assert.equal(calls,1);
 await get();assert.equal(calls,1);
 await get('/games',{headers:{authorization:'test'}});assert.equal(calls,2);
 await get('/games?scope=mine');await get('/games?scope=mine');assert.equal(calls,4);
 await get('/change',{method:'POST'});await get();assert.equal(calls,5);
 await new Promise(r=>setTimeout(r,510));await get();assert.equal(calls,6);
});

test('reference data gets shared cache headers and a longer process cache',async t=>{
 const app=express();let calls=0;
 app.use(publicCache({ttl:5,referenceTtl:100}));
 app.get('/categories',(req,res)=>{calls++;res.json([{id:'games'}]);});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 let response=await fetch(base+'/categories');
 assert.match(response.headers.get('cache-control'),/s-maxage=300/);await response.json();
 await new Promise(r=>setTimeout(r,20));response=await fetch(base+'/categories');await response.json();
 assert.equal(calls,1);assert.match(response.headers.get('server-timing'),/memory-hit/);
});

test('reference errors are not publicly cached',async t=>{
 const app=express();app.use(publicCache());
 app.get('/categories',(req,res)=>res.status(503).json({error:'unavailable'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/categories');
 assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),null);
 await response.json();
});
