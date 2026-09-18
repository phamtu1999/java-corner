import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {WebSocket} from 'ws';
import {attachGameNetwork} from '../server/game-network.js';
import {openDatabase} from '../server/db.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const stats=a=>{a.sort((x,y)=>x-y);return {count:a.length,p50_ms:Math.round(a[Math.floor(a.length*.5)]||0),p95_ms:Math.round(a[Math.floor(a.length*.95)]||0),max_ms:Math.round(a.at(-1)||0)};};
const schema='load_'+randomUUID().replaceAll('-',''),db=await openDatabase({schema});
const tcp=net.createServer(s=>s.pipe(s)),server=http.createServer();let stop;const sockets=[];
const report={timestamp:new Date().toISOString(),scope:'100 public JAR downloads via live Docker and Supabase Storage; separate relay process using production relay code, real DB in temporary schema and local echo target. Not real game logins.'};
try{
 await db.query(`CREATE SCHEMA "${schema}"`);
 await db.query('CREATE TABLE sessions(token text primary key,user_id text,expires bigint)');
 const tokens=Array.from({length:100},()=>randomUUID());
 await db.query('INSERT INTO sessions SELECT t,u,$3 FROM unnest($1::text[],$2::text[]) AS s(t,u)',[tokens.map(hash),tokens.map((_,i)=>'load-user-'+i),Date.now()+600000]);
 tcp.listen(0,'127.0.0.1');await once(tcp,'listening');
 stop=attachGameNetwork(server,db,async()=>({address:'127.0.0.1',family:4,port:tcp.address().port}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin=process.env.SITE_ORIGIN||'http://127.0.0.1:'+server.address().port;
 const connects=[],rtts=[],failures=[];let peak=0,active=0;
 const workers=tokens.map(async(token,i)=>{let ws;try{
 const start=performance.now();ws=new WebSocket('ws://127.0.0.1:'+server.address().port+'/game-network?target=load-test',{headers:{origin,cookie:'java_session='+token},handshakeTimeout:15000});sockets.push(ws);
 ws.on('error',()=>{});
 const ready=await Promise.race([once(ws,'message'),new Promise((_,reject)=>setTimeout(()=>reject(Error('ready timeout')),20000).unref())]);
 if(ready[0].toString()!=='ready')throw Error('missing ready');connects.push(performance.now()-start);active++;peak=Math.max(peak,active);
 const until=Date.now()+60000;
 while(Date.now()<until){const body=Buffer.alloc(1024,i),t=performance.now();let total=0;
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('echo timeout')),5000);const onMessage=data=>{if(!data.equals(body.subarray(total,total+data.length)))return finish(Error('payload mismatch'));total+=data.length;if(total===body.length)finish();};const onClose=()=>finish(Error('closed early'));function finish(error){clearTimeout(timer);ws.off('message',onMessage);ws.off('close',onClose);error?reject(error):resolve();}ws.on('message',onMessage);ws.once('close',onClose);ws.send(body);});
 rtts.push(performance.now()-t);await new Promise(r=>setTimeout(r,200));}
 active--;ws.close();
 }catch(e){failures.push({user:i,error:e.message});ws?.terminate();}});
 const download=async()=>{
 const id='52191508-8efe-4581-bda8-b61f9781763f',url='http://127.0.0.1:3000/api/games/'+id+'/file';
 const baseline=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!baseline.ok)throw Error('Baseline HTTP '+baseline.status);
 const original=Buffer.from(await baseline.arrayBuffer()),expected=hash(original);if(original.readUInt32LE(0)!==0x04034b50)throw Error('Not a JAR');
 const times=[],errors=[];let bytes=0;const start=Date.now();
 await Promise.all(Array.from({length:100},async(_,i)=>{const t=performance.now();try{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());if(hash(b)!==expected)throw Error('checksum mismatch');bytes+=b.length;times.push(performance.now()-t);}catch(e){errors.push({user:i,error:e.message});}}));
 return {gameId:id,jarBytes:original.length,sha256:expected,concurrency:100,duration_s:(Date.now()-start)/1000,bytes,...stats(times),errors};
 };
 const downloads=download();await Promise.all(workers);report.downloads=await downloads;
 report.relay={clients:100,peakConcurrent:peak,holdSecondsPerClient:60,payloadBytes:1024,pauseMs:200,connection:stats(connects),roundTrip:stats(rtts),failures};
}finally{
 for(const ws of sockets)ws.terminate();stop?.();server.close();tcp.close();
 await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.close();
}
writeFileSync('reports/load-100-jar-relay.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
