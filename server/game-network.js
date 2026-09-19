import {operationalEvent} from './operations.js';
import {consumeRate} from './rate-limit.js';
import {resolveTarget,resolvePublic,checkDestination,authorizeGameEndpoint} from './network-policy.js';
import http from 'node:http';
import https from 'node:https';
import {WebSocketServer, WebSocket} from 'ws';
import net from 'node:net';
import {createHash,randomUUID} from 'node:crypto';

const relays=new WeakMap();
export function revokeRelay(db,{token,userId}) {
 for(const ws of relays.get(db)||[])if((token&&ws.sessionHash===token)||(userId&&ws.userId===userId))ws.terminate();
}
export function attachGameNetwork(server, db, resolveEndpoint=resolveTarget) {
 const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
 const active=new Map(),instance=randomUUID();
 const gauge=()=>db.prepare("INSERT INTO relay_instances(id,active,expires_at) VALUES(?,?,now()+interval '90 seconds') ON CONFLICT(id) DO UPDATE SET active=excluded.active,expires_at=excluded.expires_at").run(instance,wss.clients.size).catch(()=>{});
 relays.set(db,wss.clients);
 const validate=setInterval(async()=>{
  await gauge();
  for(const ws of wss.clients){if(ws.checking)continue;ws.checking=true;
   try{const user=await db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(ws.sessionHash,Date.now());if(!user)ws.terminate();}catch{ws.terminate();}finally{ws.checking=false;}
  }
 },30000);validate.unref();
 server.on('upgrade',async(req,socket,head)=>{
  const reject=code=>{if(code===429)operationalEvent(db,'rate_limited');socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\n\r\n`);};
  try {
   const url=new URL(req.url,'http://localhost');
   const origin=process.env.SITE_ORIGIN||`http://${req.headers.host}`;
   if(url.pathname!=='/game-network'||req.headers.origin!==origin)return reject(403);
   const target=url.searchParams.get('target');
   const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('java_session='))?.slice(13);
   if(!token)return reject(401);
   const user=await db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(createHash('sha256').update(token).digest('hex'),Date.now());
   if(!user)return reject(401);
   if(!(await consumeRate(db,'game-socket',user.user_id,60,60000)).allowed||wss.clients.size>=1000)return reject(429);
   if((active.get(user.user_id)||0)>=4)return reject(429);
   let endpoint;try{await authorizeGameEndpoint(db,user.user_id,url.searchParams.get('game_id'),'tcp://'+target);endpoint=await resolveEndpoint(target);}catch{operationalEvent(db,'relay_rejected');return reject(403);}
   if(socket.destroyed)return;
   if(wss.clients.size>=1000||(active.get(user.user_id)||0)>=4)return reject(429);
   active.set(user.user_id,(active.get(user.user_id)||0)+1);
   let released=false;
   const release=()=>{if(released)return;released=true;const n=(active.get(user.user_id)||1)-1;if(n)active.set(user.user_id,n);else active.delete(user.user_id);};
   socket.once('close',release);
   wss.handleUpgrade(req,socket,head,ws=>{
    ws.userId=user.user_id;ws.sessionHash=createHash('sha256').update(token).digest('hex');
    let windowStart=Date.now(),used=0;
    const allow=bytes=>{if(Date.now()-windowStart>=60000){windowStart=Date.now();used=0;}used+=bytes;if(used>16*1048576){ws.close(1008,'Bandwidth limit');return false;}return true;};
    const tcp=net.connect({host:endpoint.address,port:endpoint.port,family:endpoint.family});
    let ready=false;
    const timer=setTimeout(()=>ws.close(1011,'Connect timeout'),15000);
    tcp.setTimeout(120000,()=>ws.close(1000,'Idle timeout'));
    tcp.on('connect',()=>{ready=true;clearTimeout(timer);ws.send('ready');});
    tcp.on('data',data=>{if(!allow(data.length))return;if(ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>1048576){ws.close(1009,'Slow receiver');return;}ws.send(data);});
    tcp.on('error',()=>ws.close(1011,'Game server unavailable'));
    tcp.on('end',()=>ws.close(1000,'Game server closed'));
    ws.on('message',(data,binary)=>{if(!allow(data.length))return;if(!ready||!binary){ws.close(1008,'Invalid frame');return;}if(tcp.writableLength>1048576){ws.close(1009,'Slow game server');return;}tcp.write(data);});
    ws.on('error',()=>tcp.destroy());
    ws.on('close',()=>{clearTimeout(timer);tcp.destroy();release();gauge();});
    gauge();
   });
  } catch {reject(500);}
 });
 return ()=>{clearInterval(validate);relays.delete(db);for(const ws of wss.clients)ws.terminate();wss.close();db.prepare('DELETE FROM relay_instances WHERE id=?').run(instance).catch(()=>{});};
}
export async function requestPublic(url,method='GET',headers={},body=Buffer.alloc(0)) {
 const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid URL');
 checkDestination(u.hostname,Number(u.port||(u.protocol==='https:'?443:80)));
 const endpoint=await resolvePublic(u.hostname);
 const safe={};for(const [key,value] of Object.entries(headers)){if(/^(accept|accept-language|content-type|user-agent|authorization|cookie|range|if-modified-since|x-[a-z0-9-]+)$/i.test(key)&&typeof value==='string'&&!/[\r\n]/.test(value))safe[key]=value;}
 return new Promise((resolve,reject)=>{
  const req=(u.protocol==='https:'?https:http).request(u,{method,headers:safe,lookup:(host,options,cb)=>options.all?cb(null,[endpoint]):cb(null,endpoint.address,endpoint.family)},res=>{
   const chunks=[];let size=0;res.on('data',data=>{size+=data.length;if(size>4*1024*1024){res.destroy(Error('Response too large'));return;}chunks.push(data);});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,message:res.statusMessage,headers:res.headers,body:Buffer.concat(chunks).toString('base64')}));
  });const timer=setTimeout(()=>req.destroy(Error('Timeout')),15000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(body);
 });
}
export function installGameHttp(app,member,limit,db) {
 app.get('/api/game-network/http',member,limit,async(req,res)=>{try{await authorizeGameEndpoint(db,req.user.id,req.query.game_id,req.query.url);}catch{operationalEvent(db,'relay_rejected');return res.sendStatus(403);}try{const r=await requestPublic(req.query.url);res.status(r.status).type('application/octet-stream').send(Buffer.from(r.body,'base64'));}catch{res.status(502).send('Network destination unavailable or blocked');}});
 app.post('/api/game-network/request',member,limit,async(req,res)=>{
  try{const {url,method='GET',headers={},body=''}=req.body||{};
   if(typeof url!=='string'||!['GET','POST','HEAD','PUT','DELETE','PATCH','OPTIONS'].includes(method)||typeof body!=='string'||body.length>32000||!headers||Array.isArray(headers)||typeof headers!=='object')return res.sendStatus(400);
   try{await authorizeGameEndpoint(db,req.user.id,req.body.game_id,url);}catch{operationalEvent(db,'relay_rejected');return res.sendStatus(403);}
   res.json(await requestPublic(url,method,headers,Buffer.from(body,'base64')));
  }catch{res.status(502).json({error:'Network destination unavailable or blocked'});}
 });
}
