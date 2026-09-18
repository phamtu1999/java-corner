import {readFileSync, writeFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {openDatabase} from '../server/db.js';
import {validateJar, extractJarIcon} from '../server/jar.js';

const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
const bucket=process.env.SUPABASE_STORAGE_BUCKET;
if (!base || !key || !bucket) throw Error('Missing Supabase configuration');
const headers={apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${key}`})};
const hash=b=>createHash('sha256').update(b).digest('hex');
const report=[];
const db=await openDatabase();
async function verify(object, sha256) {
  const response=await fetch(`${base}/storage/v1/object/authenticated/${bucket}/${object}`,{headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw Error(`Storage read HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(hash(bytes)!==sha256) throw Error('Storage checksum mismatch');
  return bytes;
}
try {
  const owner=await db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY created_at,id LIMIT 1").get();
  const category=await db.prepare("SELECT id FROM categories WHERE name='Ứng dụng Java'").get();
  if(!owner || !category) throw Error('Missing owner/category');
  for(const [version,build] of [['8','8.0.35626'],['7.1','7.1.32052'],['4.5','4.5.33867']]) {
    const path=`downloads/browsers/opera-mini-${version}.jar`;
    await validateJar(path);
    const bytes=readFileSync(path),sha256=hash(bytes);
    const source=`http://mini.opera.com/global/opera-mini-${build}-advanced-en.jar`;
    const old=await db.prepare("SELECT id,storage_object FROM games WHERE visibility='public' AND sha256=? LIMIT 1").get(sha256);
    if(old) {
      await verify(old.storage_object,sha256);
      report.push({version:build,path,source,sha256,id:old.id,status:'existing-verified'});
    } else {
      const object=`browsers/opera/${sha256}.jar`;
      const uploaded=await fetch(`${base}/storage/v1/object/${bucket}/${object}`,{method:'POST',headers:{...headers,'Content-Type':'application/java-archive','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});
      if(!uploaded.ok) {
        const body=await uploaded.json().catch(()=>({}));
        if(uploaded.status!==409 && body.error!=='Duplicate' && String(body.statusCode)!=='409') throw Error(`Upload HTTP ${uploaded.status}`);
      }
      await verify(object,sha256);
      const family=await db.prepare("SELECT family_key,family_title FROM games WHERE visibility='public' AND family_title='Opera Mini' LIMIT 1").get();
      const id=randomUUID();
      await db.prepare("INSERT INTO games(id,owner_id,visibility,category_id,title,description,filename,size,sha256,storage_object,icon_data,family_key,family_title,publisher) VALUES (?,?,'public',?,?,?,?,?,?,?,?,?,?,?)").run(id,owner.id,category.id,`Opera Mini ${build} · English`, `Trình duyệt Java ME. Tải từ máy chủ Opera ngày ${new Date().toISOString().slice(0,10)}. Nguồn: ${source}\nĐã kiểm tra tệp JAR và checksum trên Supabase. Chưa xác minh duyệt web trên giả lập; phụ thuộc máy chủ Opera.`, `opera-mini-${build}-advanced-en.jar`,bytes.length,sha256,object,await extractJarIcon(path),family?.family_key||'opera-mini',family?.family_title||'Opera Mini','Opera Software ASA');
      report.push({version:build,path,source,sha256,id,object,status:'published-verified'});
    }
    writeFileSync('downloads/browsers/publish-report.json',JSON.stringify(report,null,2));
    console.log(build,report.at(-1).status,report.at(-1).id);
  }
  const uc=await db.prepare("SELECT id,title,sha256,storage_object FROM games WHERE id=? AND visibility='public'").get('94e20ebf-c2f3-46e6-ae83-2ec5b794febe');
  if(uc) {
    const bytes=await verify(uc.storage_object,uc.sha256);
    const path='downloads/browsers/uc-browser-9.5.jar';
    writeFileSync(path,bytes);
    await validateJar(path);
    report.push({id:uc.id,title:uc.title,path,sha256:uc.sha256,status:'existing-verified',webBrowsing:'unverified'});
    writeFileSync('downloads/browsers/publish-report.json',JSON.stringify(report,null,2));
    console.log(uc.title,'existing-verified',uc.id);
  }
} finally {await db.close();}
