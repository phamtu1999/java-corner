// Read-only local HTTP load test; does not simulate emulator or game sockets.
import {writeFileSync} from 'node:fs';
const users=Number(process.argv[3]||50);
if(!Number.isInteger(users)||users<1||users>1000)throw Error('Users must be 1..1000');
const paths=['/games','/library','/play','/ui/site.css','/emulator/src/main.js','/api/me','/api/games','/api/categories'];
const groups={};let errors=0,bytes=0;
const start=Date.now(),until=start+60000;
await Promise.all(Array.from({length:users},async(_,id)=>{let n=id;while(Date.now()<until){const path=paths[n++%paths.length],t=performance.now();let status='error';try{const r=await fetch('http://127.0.0.1:3000'+path,{signal:AbortSignal.timeout(15000)});status=r.status;bytes+=(await r.arrayBuffer()).byteLength;if(!r.ok)errors++;}catch{errors++;}const group=groups[path]??={times:[],statuses:{}};group.times.push(performance.now()-t);group.statuses[status]=(group.statuses[status]||0)+1;await new Promise(r=>setTimeout(r,250));}}));
const stats=times=>{times.sort((a,b)=>a-b);return {requests:times.length,p50_ms:Math.round(times[Math.floor(times.length*.5)]),p95_ms:Math.round(times[Math.floor(times.length*.95)]),max_ms:Math.round(times.at(-1))};};
const result={timestamp:new Date().toISOString(),concurrentUsers:users,duration_s:(Date.now()-start)/1000,thinkTime_ms:250,scope:'Anonymous local HTTP reads; no browser rendering, external JAR downloads or authenticated game relay',...stats(Object.values(groups).flatMap(g=>g.times)),errors,bytes,endpoints:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{...stats(v.times),statuses:v.statuses}]))};
writeFileSync(process.argv[2]||'reports/load-50-users-optimized.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
