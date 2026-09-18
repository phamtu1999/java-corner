import {resolveTarget,resolvePublic} from './network-policy.js';
import http from 'node:http';
import https from 'node:https';
import {WebSocketServer, WebSocket} from 'ws';
import net from 'node:net';
import {createHash} from 'node:crypto';

export function attachGameNetwork(server, db, resolveEndpoint=resolveTarget) {
 const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
 const active=new Map();
 server.on('upgrade',async(req,socket,head)=>{
  const reject=code=>{socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\n\r\n`);};
  try {
   const url=new URL(req.url,'http://localhost');
   const origin=process.env.SITE_ORIGIN||`http://${req.headers.host}`;
   if(url.pathname!=='/game-network'||req.headers.origin!==origin)return reject(403);
   const target=url.searchParams.get('target');
   const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('java_session='))?.slice(13);
   if(!token)return reject(401);
   const user=await db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(createHash('sha256').update(token).digest('hex'),Date.now());
   if(!user)return reject(401);
   if((active.get(user.user_id)||0)>=4)return reject(429);
   let endpoint;try{endpoint=await resolveEndpoint(target);}catch{return reject(403);}
   if((active.get(user.user_id)||0)>=4)return reject(429);
   active.set(user.user_id,(active.get(user.user_id)||0)+1);
   wss.handleUpgrade(req,socket,head,ws=>{
    const tcp=net.connect({host:endpoint.address,port:endpoint.port,family:endpoint.family});
    let ready=false;
    const timer=setTimeout(()=>ws.close(1011,'Connect timeout'),15000);
    tcp.setTimeout(120000,()=>ws.close(1000,'Idle timeout'));
    tcp.on('connect',()=>{ready=true;clearTimeout(timer);ws.send('ready');});
    tcp.on('data',data=>{if(ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>1048576){ws.close(1009,'Slow receiver');return;}ws.send(data);});
    tcp.on('error',()=>ws.close(1011,'Game server unavailable'));
    tcp.on('end',()=>ws.close(1000,'Game server closed'));
    ws.on('message',(data,binary)=>{if(!ready||!binary){ws.close(1008,'Invalid frame');return;}if(tcp.writableLength>1048576){ws.close(1009,'Slow game server');return;}tcp.write(data);});
    ws.on('error',()=>tcp.destroy());
    ws.on('close',()=>{clearTimeout(timer);tcp.destroy();const count=(active.get(user.user_id)||1)-1;if(count)active.set(user.user_id,count);else active.delete(user.user_id);});
   });
  } catch {reject(500);}
 });
 return ()=>{for(const ws of wss.clients)ws.terminate();wss.close();};
}
export async function requestPublic(url,method='GET',headers={},body=Buffer.alloc(0)) {
 const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid URL');
 const endpoint=await resolvePublic(u.hostname);
 const safe={};for(const [key,value] of Object.entries(headers)){if(/^(accept|accept-language|content-type|user-agent|authorization|cookie|range|if-modified-since|x-[a-z0-9-]+)$/i.test(key)&&typeof value==='string'&&!/[\r\n]/.test(value))safe[key]=value;}
 return new Promise((resolve,reject)=>{
  const req=(u.protocol==='https:'?https:http).request(u,{method,headers:safe,lookup:(host,options,cb)=>options.all?cb(null,[endpoint]):cb(null,endpoint.address,endpoint.family)},res=>{
   const chunks=[];let size=0;res.on('data',data=>{size+=data.length;if(size>4*1024*1024){res.destroy(Error('Response too large'));return;}chunks.push(data);});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,message:res.statusMessage,headers:res.headers,body:Buffer.concat(chunks).toString('base64')}));
  });const timer=setTimeout(()=>req.destroy(Error('Timeout')),15000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end(body);
 });
}
export function installGameHttp(app,member,limit) {
 app.get('/api/game-network/http',member,limit,async(req,res)=>{try{const r=await requestPublic(req.query.url);res.status(r.status).type('application/octet-stream').send(Buffer.from(r.body,'base64'));}catch{res.status(502).send('Network destination unavailable or blocked');}});
 app.post('/api/game-network/request',member,limit,async(req,res)=>{
  try{const {url,method='GET',headers={},body=''}=req.body||{};
   if(typeof url!=='string'||!['GET','POST','HEAD','PUT','DELETE','PATCH','OPTIONS'].includes(method)||typeof body!=='string'||body.length>32000||!headers||Array.isArray(headers)||typeof headers!=='object')return res.sendStatus(400);
   res.json(await requestPublic(url,method,headers,Buffer.from(body,'base64')));
  }catch{res.status(502).json({error:'Network destination unavailable or blocked'});}
 });
}
