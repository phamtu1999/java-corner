import {openDatabase} from '../server/db.js';
import {gameStorage} from '../server/game-storage.js';
import {downloadVerifiedArchive} from '../server/verify-archive.js';
import {inspectJar} from '../server/jar-inspector.js';
import {readFile,stat,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {runBoot} from './boot-runner.mjs';

const db=await openDatabase();
try{
 const token=randomUUID();
 const game=await db.transaction(async client=>{
  const row=(await client.query("SELECT id,sha256,storage_object,visibility,filename FROM games WHERE deleted_at IS NULL AND (boot_state='queued' OR (boot_state='running' AND boot_started<now()-interval '5 minutes')) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
  if(row)await client.query("UPDATE games SET boot_state='running',boot_token=$1,boot_started=now() WHERE id=$2",[token,row.id]);return row;
 });
 if(game){
  const directory=await mkdtemp(join(tmpdir(),'java-boot-'));let report;
  try{
   const localPath=resolve(process.env.DATA_DIR||'data','uploads',game.id+'.jar');
   if(!game.storage_object&&(await stat(localPath)).size>50*1048576)throw Error('JAR vượt giới hạn 50 MB');
   const bytes=game.storage_object?await downloadVerifiedArchive(await gameStorage().url(game.storage_object,game.visibility),game.sha256):await readFile(localPath);
   if(bytes.length>50*1048576||createHash('sha256').update(bytes).digest('hex')!==game.sha256)throw Error('JAR vượt giới hạn hoặc sai SHA256');
   const path=join(directory,'game.jar');await writeFile(path,bytes);await inspectJar(path,game.filename);
   report=await runBoot(bytes);
  }catch(error){report={state:'error',summary:error.message.slice(0,400),screenshots:[]};}
  finally{await rm(directory,{recursive:true,force:true});}
  report.sha256=game.sha256;report.checked_at=new Date().toISOString();
  await db.prepare('UPDATE games SET boot_state=?,boot_report=?::jsonb WHERE id=? AND sha256=? AND boot_token=? AND deleted_at IS NULL').run(report.state,JSON.stringify(report),game.id,game.sha256,token);
  console.log(game.id,report.state,report.summary);
 }else console.log('Không có game chờ kiểm tra.');
}finally{await db.close();}
