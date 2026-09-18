import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, migrateDatabase } from '../server/db.js';
import { validateJar, extractJarIcon } from '../server/jar.js';
const root = fileURLToPath(new URL('../downloads/giaitri321/', import.meta.url));
const inventory = JSON.parse(readFileSync(resolve(root, 'manifest.json'))).files;
const upload = JSON.parse(readFileSync(resolve(root, 'supabase-upload.json')));
if (upload.running || upload.origin !== new URL(process.env.SUPABASE_URL).origin || upload.bucket !== process.env.SUPABASE_STORAGE_BUCKET) throw new Error('Storage report does not match configuration');
const candidates = [], skipped = [];
const names = {'game-offline/game-hay':'Game offline', 'game-offline/gameloft':'Gameloft', 'game-online':'Game online', 'game-hack-mod':'Game mod', 'ung-dung':'Ứng dụng Java'};
for (const item of inventory) {
  if (item.status !== 'downloaded') continue;
  const stored = upload.files[item.path];
  if (stored?.status !== 'verified' || stored.sha256 !== item.sha256) throw new Error('Unverified file: ' + item.path);
  const path = resolve(root, item.path);
  if (!path.startsWith(root) || !path.endsWith('.jar')) throw new Error('Invalid path');
  if (createHash('sha256').update(readFileSync(path)).digest('hex') !== item.sha256) throw new Error('Local checksum mismatch');
  try { await validateJar(path); } catch { skipped.push({path:item.path,reason:'Không đạt kiểm tra JAR Java ME của ứng dụng'}); continue; }
  const parts = item.path.split('/');
  candidates.push({...item, icon:await extractJarIcon(path), object:stored.object, category:names[parts.slice(0,2).join('/')] || names[parts[0]] || 'Game Java'});
}
const report = {eligible:candidates.length,skipped,inserted:0,existing:0,categories:{}};
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({eligible:candidates.length,skipped:skipped.length,bytes:candidates.reduce((n,f)=>n+f.bytes,0)}));
  writeFileSync(resolve(root,'publish-preview.json'),JSON.stringify(report,null,2));
} else {
  const db = await openDatabase();
  try {
    await migrateDatabase(db);
    await db.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(74810322)');
      const owner = (await client.query("SELECT id FROM users WHERE role='admin' ORDER BY CASE WHEN name='phamthanhtu' THEN 0 ELSE 1 END,created_at,id LIMIT 1")).rows[0];
      if (!owner) throw new Error('Admin account required');
      for (const name of [...new Set(candidates.map(f=>f.category))]) {
        const category=(await client.query('INSERT INTO categories(id,name) VALUES ($1,$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[randomUUID(),name])).rows[0];report.categories[name]=category.id;
      }
      for (const file of candidates) {
        const variant = file.filename.replace(/\.jar$/i,'');
        const title = (file.title + (variant.toLowerCase() === file.title.toLowerCase() ? '' : ' · ' + variant)).slice(0,100);
        const result=await client.query("INSERT INTO games(id,owner_id,visibility,category_id,title,description,filename,size,sha256,storage_object,icon_data,family_key,family_title) VALUES ($1,$2,'public',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(storage_object) WHERE storage_object IS NOT NULL DO NOTHING",[randomUUID(),owner.id,report.categories[file.category],title,'',file.filename,file.bytes,file.sha256,file.object,file.icon,file.page,file.title]);
        if(result.rowCount)report.inserted++;else report.existing++;
      }
    });
    writeFileSync(resolve(root,'published-games.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({eligible:report.eligible,inserted:report.inserted,existing:report.existing,skipped:skipped.length,categories:Object.keys(report.categories)}));
  } finally {await db.close();}
}
