import {readFile} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
export function giaitriRecord(f,root){const jar=resolve(root,f.path);if(!jar.startsWith(resolve(root)+sep))throw Error('JAR outside import directory');return {title:f.title,jar,sourceUrl:f.page,publisher:f.publisher||'',version:f.version||'',images:[],sha256:f.sha256};}
export default async function(input){return JSON.parse(await readFile(input,'utf8')).files.filter(f=>f.status==='downloaded').map(f=>giaitriRecord(f,dirname(resolve(input))));}
