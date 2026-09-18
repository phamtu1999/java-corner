import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import express from 'express';
import {allowedGameEndpoint,authorizeGameEndpoint} from '../server/network-policy.js';
import {installGameHttp} from '../server/game-network.js';
import {inspectMedia} from '../server/media.js';
import {rateLimiter,clientAddress} from '../server/rate-limit.js';

test('endpoint policy denies by default and binds protocol, host, port and game',async()=>{
 const policy=JSON.stringify({abc:['tcp://game.example:14444','https://game.example:443']});
 allowedGameEndpoint('abc','tcp://game.example:14444',policy);
 allowedGameEndpoint('abc','https://game.example/path',policy);
 for(const [game,url] of [['other','https://game.example'],['abc','https://game.example.evil/'],['abc','http://game.example'],['abc','tcp://game.example:14445'],['abc','https://game.example@evil.example'],['abc','https://game.example:22']])assert.throws(()=>allowedGameEndpoint(game,url,policy));
 assert.throws(()=>allowedGameEndpoint('abc','https://game.example','{}'));
 assert.throws(()=>allowedGameEndpoint('abc','https://game.example','broken-json'));
 await assert.rejects(authorizeGameEndpoint({prepare:()=>({get:async()=>null})},'user','private-game','https://game.example'));
});

test('both HTTP relay entry points reject unapproved targets before network access',async t=>{
 const app=express();app.use(express.json());
 installGameHttp(app,(req,res,next)=>{req.user={id:'member'};next();},(req,res,next)=>next(),{prepare:()=>({get:async()=>({sha256:'unapproved'})})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/game-network/http?game_id=game&url=https://example.com')).status,403);
 assert.equal((await fetch(base+'/api/game-network/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game_id:'game',url:'https://example.com'})})).status,403);
});

test('rate limiter fails closed when shared store is unavailable; direct headers are untrusted',async()=>{
 const old=process.env.VERCEL;delete process.env.VERCEL;
 try {assert.equal(clientAddress({headers:{'x-forwarded-for':'8.8.8.8'},ip:'127.0.0.1'}),'127.0.0.1');}
 finally{if(old!==undefined)process.env.VERCEL=old;}
 let status,called=false;
 await rateLimiter({prepare(){throw Error('offline');}})('auth',2,1000)({headers:{},ip:'127.0.0.1'},{status(n){status=n;return this;},json(){}},()=>called=true);
 assert.equal(status,503);assert.equal(called,false);
});

test('image uploads validate headers and reject excessive dimensions and total pixels',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'java-image-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=async(name,bytes)=>{const path=join(dir,name);await writeFile(path,bytes);return {path,size:(await stat(path)).size};};
 for(const format of ['png','jpeg','webp','gif']) {
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).toFormat(format).toBuffer();
  assert.equal((await inspectMedia(await file('valid.'+format,bytes))).mime,'image/'+format);
 }
 const wide=await sharp({create:{width:8193,height:1,channels:3,background:'red'}}).png().toBuffer();
 await assert.rejects(inspectMedia(await file('wide.png',wide)),{status:400});
 const bomb=await sharp({create:{width:4500,height:4500,channels:3,background:'red'}}).png().toBuffer();
 await assert.rejects(inspectMedia(await file('pixels.png',bomb)),{status:400});
 await assert.rejects(inspectMedia(await file('fake.png',Buffer.from('<svg/>'))),{status:400});
 const png=await sharp({create:{width:1,height:1,channels:3,background:'red'}}).png().toBuffer();
 const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8);chunk.write('acTL',4);chunk.writeUInt32BE(101,8);
 await assert.rejects(inspectMedia(await file('animation.png',Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]))),{status:400});

});
