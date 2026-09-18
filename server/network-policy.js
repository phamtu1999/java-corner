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
 return {...await resolvePublic(u.hostname),port};
}
