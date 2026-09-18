import {lookup} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export function allowedGameEndpoint(sha256,target,policy=process.env.GAME_NETWORK_ENDPOINTS||'{}') {
 const rules=JSON.parse(policy);
 const u=new URL(target);
 if(!['tcp:','http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid endpoint');
 const port=Number(u.port||(u.protocol==='https:'?443:u.protocol==='http:'?80:0));
 checkDestination(u.hostname,port);
 const endpoints=Object.hasOwn(rules,sha256)?rules[sha256]:null;
 if(!Array.isArray(endpoints)||!endpoints.some(value=>{
  try{const allowed=new URL(value);return !allowed.username&&!allowed.password&&allowed.protocol===u.protocol&&allowed.hostname===u.hostname&&Number(allowed.port||(allowed.protocol==='https:'?443:allowed.protocol==='http:'?80:0))===port;}catch{return false;}
 }))throw Error('Game endpoint not allowed');
}

export async function authorizeGameEndpoint(db,userId,gameId,target) {
 if(typeof gameId!=='string'||!gameId||gameId.length>64)throw Error('Game required');
 const game=await db.prepare("SELECT sha256 FROM games WHERE id=? AND deleted_at IS NULL AND NOT hidden AND (visibility='public' OR owner_id=?)").get(gameId,userId);
 if(!game)throw Error('Game unavailable');
 allowedGameEndpoint(game.sha256,target);
}
export function publicAddress(address){try{return ipaddr.process(address).range()==='unicast';}catch{return false;}}
export async function resolvePublic(host){
 host=host.replace(/^\[|\]$/g,'');
 const records=await lookup(host,{all:true});
 if(!records.length||records.some(r=>!publicAddress(r.address)))throw new Error('Private or reserved address');
 return records[0];
}
export async function resolveTarget(target){
 const u=new URL('tcp://'+target);
 if(u.username||u.password||u.pathname||!u.port)throw new Error('Invalid target');
 const port=Number(u.port);if(port<1||port>65535)throw new Error('Invalid port');
 checkDestination(u.hostname,port);
 return {...await resolvePublic(u.hostname),port};
}

export function checkDestination(host,port){
 // Block infrastructure/mail services; optional allowlist for a curated deployment.
 const blocked=new Set([21,22,23,25,53,110,135,139,143,389,445,465,587,636,993,995,1433,2375,2376,3306,3389,5432,6379,9200,11211,27017]);
 if(blocked.has(port))throw new Error('Restricted service port');
 const hosts=(process.env.GAME_ALLOWED_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(hosts.length&&!hosts.includes(host.toLowerCase()))throw new Error('Destination not allowed');
}
