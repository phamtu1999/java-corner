import teamobi from './teamobi/index.js';
import giaitri321 from './giaitri321/index.js';
import archive from './archive/index.js';
import localFolder from './local-folder/index.js';
import {stat,realpath} from 'node:fs/promises';
import {inspectJar} from '../../server/jar-inspector.js';
export const importers={teamobi,giaitri321,archive,'local-folder':localFolder};
export async function importRecords(name,input){
 if(!Object.hasOwn(importers,name))throw Error('Unknown importer');const rows=await importers[name](input);if(rows.length>100)throw Error('Tối đa 100 JAR/lượt; chia manifest hoặc thư mục thành các lô nhỏ.');
 const result=[];
 for(const r of rows){
  for(const k of ['title','jar','sourceUrl','publisher','version'])if(typeof r[k]!=='string'||r[k].length>(k==='jar'?4096:k==='sourceUrl'?2000:100)||(k==='title'&&!r[k].trim()))throw Error('Invalid importer field: '+k);
  if(r.sourceUrl){const u=new URL(r.sourceUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid source URL');}
  if(!Array.isArray(r.images)||r.images.length>10||r.images.some(x=>typeof x!=='string'||x.length>2000||!/^https:\/\//.test(x)))throw Error('Invalid images');
  const jar=await realpath(r.jar),info=await stat(jar);if(!info.isFile()||info.size>20*1048576)throw Error('JAR exceeds 20 MB');
  const inspection=await inspectJar(jar);if(r.sha256&&inspection.sha256!==r.sha256)throw Error('Checksum mismatch');
  result.push({title:r.title.trim(),jar,sourceUrl:r.sourceUrl,publisher:r.publisher,version:r.version,images:r.images,size:info.size,sha256:inspection.sha256,inspection});
 }
 return result;
}
