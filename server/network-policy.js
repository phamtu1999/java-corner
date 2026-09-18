import {lookup} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
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
