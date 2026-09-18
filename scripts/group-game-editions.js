import {readFileSync} from 'node:fs';
import {openDatabase, migrateDatabase} from '../server/db.js';
const root = new URL('../downloads/giaitri321/', import.meta.url);
const files = JSON.parse(readFileSync(new URL('manifest.json',root))).files;
const uploaded = JSON.parse(readFileSync(new URL('supabase-upload.json',root))).files;
const db = await openDatabase();
try {
  await migrateDatabase(db);
  let updated = 0;
  await db.transaction(async client => {
    for (const file of files) {
      const object = uploaded[file.path]?.object;
      if (!object || !file.page || !file.title) continue;
      const result = await client.query("UPDATE games SET family_key=$1,family_title=$2 WHERE storage_object=$3 AND visibility='public' AND family_key IS NULL",[file.page,file.title,object]);
      updated += result.rowCount;
    }
  });
  console.log(JSON.stringify({updated,...(await db.query("SELECT COUNT(*) AS editions,COUNT(DISTINCT COALESCE(family_key,id)) AS games FROM games WHERE visibility='public'")).rows[0]}));
} finally {await db.close();}
