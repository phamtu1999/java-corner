import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {attachGameNetwork,revokeRelay} from '../server/game-network.js';
test('relay rejects unauthenticated and forbidden targets, forwards binary TCP',async()=>{
 const tcp=net.createServer(s=>s.pipe(s));tcp.listen(0,'127.0.0.1');await once(tcp,'listening');
 const target='127.0.0.1:'+tcp.address().port;
 const db={prepare:()=>({get:async()=>({user_id:'test'})})};
 const server=http.createServer();const stop=attachGameNetwork(server,db,async value=>{if(value!==target)throw Error('blocked');return {address:'127.0.0.1',family:4,port:tcp.address().port};});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin=process.env.SITE_ORIGIN||'http://127.0.0.1:'+server.address().port;
 const base='ws://127.0.0.1:'+server.address().port+'/game-network?target=';
 try{
  for(const [dest,headers,status] of [[target,{origin},401],['127.0.0.1:22',{origin,cookie:'java_session=test'},403],[target,{origin:'http://evil.invalid',cookie:'java_session=test'},403]]){
   const ws=new WebSocket(base+dest,{headers});const response=await new Promise((resolve,reject)=>{ws.on('unexpected-response',(req,res)=>{res.resume();resolve(res.statusCode);req.destroy();});ws.on('error',()=>{});setTimeout(()=>reject(Error('timeout')),2000).unref();});assert.equal(response,status);
  }
  // Invalid handshakes must not consume the user's four live slots.
  for(let i=0;i<5;i++)await new Promise((resolve,reject)=>{
   const req=http.request('http://127.0.0.1:'+server.address().port+'/game-network?target='+target,{headers:{origin,cookie:'java_session=test',Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'99','Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ=='}},res=>{res.resume();res.on('end',()=>{try{assert.equal(res.statusCode,400);resolve();}catch(e){reject(e);}});});req.on('error',reject);req.end();
  });
  const ws=new WebSocket(base+target,{headers:{origin,cookie:'java_session=test'}});
  const [ready]=await once(ws,'message');assert.equal(ready.toString(),'ready');
  const reply=once(ws,'message');ws.send(Buffer.from([0,128,255,42]));assert.deepEqual((await reply)[0],Buffer.from([0,128,255,42]));const closed=once(ws,'close');revokeRelay(db,{userId:'test'});await closed;
 }finally{stop();server.close();tcp.close();}
});

import {publicAddress,resolvePublic} from '../server/network-policy.js';
test('network policy blocks internal, mapped, multicast and reserved addresses',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('1.1.1.1'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
 await assert.rejects(resolvePublic('localhost'));
});

import {checkDestination} from '../server/network-policy.js';
test('relay blocks infrastructure ports and honors explicit host allowlist',()=>{
 for(const port of [22,25,5432,6379])assert.throws(()=>checkDestination('example.com',port));
 const old=process.env.GAME_ALLOWED_HOSTS;
 try{process.env.GAME_ALLOWED_HOSTS='game.example';assert.throws(()=>checkDestination('other.example',443));checkDestination('game.example',443);}
 finally{if(old===undefined)delete process.env.GAME_ALLOWED_HOSTS;else process.env.GAME_ALLOWED_HOSTS=old;}
});
