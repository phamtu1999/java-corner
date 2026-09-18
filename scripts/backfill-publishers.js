import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {openDatabase} from '../server/db.js';
import {extractJarPublisher} from '../server/jar.js';
const root=resolve('downloads/giaitri321');
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
const paths=new Map(manifest.files.filter(f=>f.sha256&&f.path).map(f=>[f.sha256,f.path]));
const db=await openDatabase();
try {
  const rows=await db.prepare("SELECT id,sha256 FROM games WHERE publisher='' AND visibility='public'").all();
  let changed=0;
  for(const row of rows){
    const relative=paths.get(row.sha256);if(!relative)continue;
    const path=resolve(root,relative);if(!path.startsWith(root+sep))continue;
    const publisher=await extractJarPublisher(path);if(!publisher)continue;
    changed+=(await db.prepare("UPDATE games SET publisher=? WHERE id=? AND publisher=''").run(publisher,row.id)).changes;
  }
  console.log(`Đã bổ sung hãng phát hành từ manifest JAR cho ${changed} phiên bản.`);
}finally{await db.close();}
