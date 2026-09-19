import {readFile} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
export default async function(input){const root=dirname(resolve(input)),rows=JSON.parse(await readFile(input,'utf8'));if(!Array.isArray(rows)||rows.length>10000)throw Error('Archive must be an array with at most 10000 records');return rows.map(r=>{const jar=resolve(root,r.jar);if(!jar.startsWith(root+sep))throw Error('JAR outside archive directory');return {...r,jar};});}
