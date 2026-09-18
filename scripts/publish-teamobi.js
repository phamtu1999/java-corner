import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {openDatabase} from '../server/db.js';
import {validateJar,extractJarIcon} from '../server/jar.js';
const files=JSON.parse(readFileSync('downloads/teamobi/latest-manifest.json')).filter(f=>!f.error);
const names={'118-1':'Mobi Army 3','30-18':'Avatar Online','31-4':'Khí Phách Anh Hùng','116-14':'Khí Phách Anh Hùng','116-1':'Chú Bé Rồng','116-13':'Hải Tặc Tí Hon','116-4':'Knight Age','116-11':'Ngũ Long Tranh Bá','116-10':'Ninja School Online'};
const key=process.env.SUPABASE_SECRET_KEY,base=process.env.SUPABASE_URL,bucket=process.env.SUPABASE_STORAGE_BUCKET;
const headers={apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${key}`})};
const hash=b=>createHash('sha256').update(b).digest('hex');
const db=await openDatabase();const report=[];
try{
 const owner=await db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY created_at,id LIMIT 1").get();
 const category=await db.prepare("SELECT id FROM categories WHERE name='Game online'").get();if(!owner||!category)throw Error('Missing admin/category');
 for(const f of files){
  const bytes=readFileSync(f.path);if(hash(bytes)!==f.sha256)throw Error('Checksum mismatch');await validateJar(f.path);
  const old=await db.prepare("SELECT id FROM games WHERE visibility='public' AND sha256=? LIMIT 1").get(f.sha256);
  if(old){report.push({...f,id:old.id,status:'existing'});continue;}
  const variant=f.path.split('/').pop().replace('.jar','');const name=names[variant];if(!name)throw Error('Unknown title');
  const object=`teamobi/official/${variant}/${f.sha256}.jar`;const url=base+'/storage/v1/object/'+bucket+'/'+object;
  const uploaded=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/java-archive','x-upsert':'false'},body:bytes});
  if(!uploaded.ok&&uploaded.status!==409){const e=await uploaded.json();if(e.error!=='Duplicate'&&String(e.statusCode)!=='409')throw Error('Upload '+uploaded.status);}
  const check=await fetch(base+'/storage/v1/object/authenticated/'+bucket+'/'+object,{headers});if(!check.ok||hash(Buffer.from(await check.arrayBuffer()))!==f.sha256)throw Error('Storage verification failed');
  const family=await db.prepare("SELECT family_key,family_title FROM games WHERE visibility='public' AND family_title=? LIMIT 1").get(name);
  const id=randomUUID(),icon=await extractJarIcon(f.path);
  const title=`${name} · ${f.version} (Teamobi ${variant})`;
  const description=`Bản JAR tải từ liên kết chính thức ngày ${new Date().toISOString().slice(0,10)}. Phiên bản manifest: ${f.version}. Nguồn: ${f.page}\nTải: ${f.download}\nChưa xác minh đăng nhập/chơi trên giả lập web.`;
  await db.prepare("INSERT INTO games(id,owner_id,visibility,category_id,title,description,filename,size,sha256,storage_object,icon_data,family_key,family_title,publisher) VALUES (?,?,'public',?,?,?,?,?,?,?,?,?,?,?)").run(id,owner.id,category.id,title,description,`${variant}-${f.version}.jar`,f.bytes,f.sha256,object,icon,family?.family_key||f.page,family?.family_title||name,'TeaMobi');
  report.push({...f,id,status:'published',object});writeFileSync('downloads/teamobi/publish-report.json',JSON.stringify(report,null,2));console.log(name,f.version,id);
 }
 writeFileSync('downloads/teamobi/publish-report.json',JSON.stringify(report,null,2));console.log('Published',report.filter(r=>r.status==='published').length,'existing',report.filter(r=>r.status==='existing').length);
}finally{await db.close();}
