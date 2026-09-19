import {parseArgs} from 'node:util';
import {randomUUID} from 'node:crypto';
import {basename} from 'node:path';
import {importRecords} from './importers/index.js';
import {openDatabase} from '../server/db.js';
import {gameStorage} from '../server/game-storage.js';
import {extractJarIcon} from '../server/jar.js';
const {values}=parseArgs({options:{importer:{type:'string'},input:{type:'string'},apply:{type:'boolean',default:false},owner:{type:'string'},category:{type:'string'}}});
if(!values.importer||!values.input)throw Error('Use --importer teamobi|giaitri321|archive|local-folder --input PATH [--apply --owner ADMIN_ID --category CATEGORY_ID]');
const records=await importRecords(values.importer,values.input);
if(!values.apply)console.log(JSON.stringify(records.map(({inspection,...r})=>({...r,manifest:inspection.manifest})),null,2));
else {
 const db=await openDatabase(),store=gameStorage();
 try{
  if(!await db.prepare("SELECT 1 FROM users WHERE id=? AND role='admin'").get(values.owner||'')||!await db.prepare('SELECT 1 FROM categories WHERE id=?').get(values.category||''))throw Error('Explicit admin owner and category required');
  for(const r of records){
   if(await db.prepare("SELECT id FROM games WHERE sha256=? AND visibility='public' LIMIT 1").get(r.sha256)){console.log('existing',r.sha256);continue;}
   const id=randomUUID();let object,committed=false;
   try{
    object=await store.put({path:r.jar},'public',values.owner,id);
    const source={title:r.title,publisher:r.publisher,version:r.version,sourceUrl:r.sourceUrl,images:r.images};
    const icon=await extractJarIcon(r.jar);
    committed=await db.transaction(async c=>{
     await c.query('SELECT pg_advisory_xact_lock(74810322)');
     if((await c.query("SELECT id FROM games WHERE sha256=$1 AND visibility='public' LIMIT 1",[r.sha256])).rows.length)return false;
     await c.query(`INSERT INTO games(id,owner_id,category_id,visibility,hidden,title,publisher,filename,size,sha256,storage_object,icon_data,inspection,inspected_at,source_metadata,boot_state) VALUES($1,$2,$3,'public',true,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,'queued')`,[id,values.owner,values.category,r.title,r.publisher,basename(r.jar),r.size,r.sha256,object,icon,JSON.stringify(r.inspection),JSON.stringify(source)]);
     return true;
    });
    console.log(committed?'pending review':'existing',id);
   }finally{if(object&&!committed)await store.remove(object,'public');}
  }
 }finally{await db.close();}
}
