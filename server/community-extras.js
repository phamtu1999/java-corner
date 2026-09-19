import {playerProgress} from './player-progress.js';
import {uploadGuard} from './upload-guard.js';
import {randomUUID} from 'node:crypto';
import {rmSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import multer from 'multer';
import {verifyArchive} from './verify-archive.js';
import {validateJar} from './jar.js';
import {inspectJar} from './jar-inspector.js';
import {inspectMedia} from './media.js';

export function installCommunityExtras(app,{db,member,admin,gameFor,fail,field,rate,mediaStore,temp,uploads,jarStore}){
 const limited=rate('extras',40,60000);
 const collectionFor=async(req,id,edit=false)=>{
  const c=await db.prepare('SELECT * FROM collections WHERE id=?').get(id);
  if(!c|| (edit?c.user_id!==req.user?.id:!c.public&&c.user_id!==req.user?.id))fail(404,'Không tìm thấy bộ sưu tập.');return c;
 };
 app.get('/api/collections',member,async(req,res)=>res.json(await db.prepare('SELECT * FROM collections WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));
 app.get('/api/collections/:id',async(req,res)=>{
  const c=await collectionFor(req,req.params.id);
  const games=await db.prepare(`SELECT g.id,coalesce(g.family_title,g.title) AS title FROM collection_games cg JOIN games g ON g.id=cg.game_id WHERE cg.collection_id=? AND g.visibility='public' AND NOT g.hidden AND g.deleted_at IS NULL ORDER BY title`).all(c.id);
  res.json({...c,games});
 });
 const collectionFields=body=>({title:field(body.title,'Tên bộ sưu tập',1,100),description:field(body.description||'','Giới thiệu',0,1000),public:body.public===true});
 app.post('/api/collections',member,limited,async(req,res)=>{
  if((await db.prepare('SELECT COUNT(*) AS n FROM collections WHERE user_id=?').get(req.user.id)).n>=50)fail(400,'Tối đa 50 bộ sưu tập.');
  const c=collectionFields(req.body),id=randomUUID();await db.prepare('INSERT INTO collections(id,user_id,title,description,public) VALUES (?,?,?,?,?)').run(id,req.user.id,c.title,c.description,c.public);res.status(201).json({id});
 });
 app.patch('/api/collections/:id',member,limited,async(req,res)=>{const c=await collectionFor(req,req.params.id,true),data=collectionFields(req.body);await db.prepare('UPDATE collections SET title=?,description=?,public=? WHERE id=?').run(data.title,data.description,data.public,c.id);res.json({ok:true});});
 app.delete('/api/collections/:id',member,async(req,res)=>{const c=await collectionFor(req,req.params.id,true);await db.prepare('DELETE FROM collections WHERE id=?').run(c.id);res.json({ok:true});});
 app.post('/api/collections/:id/games',member,limited,async(req,res)=>{
  const c=await collectionFor(req,req.params.id,true),g=await gameFor(req,req.body.game_id);
  if(g.visibility!=='public')fail(400,'Chỉ thêm game công khai vào bộ sưu tập.');
  await db.prepare('INSERT INTO collection_games VALUES (?,?) ON CONFLICT DO NOTHING').run(c.id,g.id);res.json({ok:true});
 });
 app.delete('/api/collections/:id/games/:game',member,async(req,res)=>{await collectionFor(req,req.params.id,true);await db.prepare('DELETE FROM collection_games WHERE collection_id=? AND game_id=?').run(req.params.id,req.params.game);res.json({ok:true});});
 app.get('/api/profiles/:id',async(req,res)=>{
  const u=await db.prepare('SELECT id,name,bio,avatar,profile_public FROM users WHERE id=?').get(req.params.id);
  if(!u)fail(404,'Không tìm thấy thành viên.');
  if(!u.profile_public&&u.id!==req.user?.id)return res.json({id:u.id,name:u.name,private:true});
  const posts=await db.prepare('SELECT id,title FROM posts WHERE user_id=? AND deleted_at IS NULL AND (game_id IS NULL OR EXISTS(SELECT 1 FROM games g WHERE g.id=posts.game_id AND g.deleted_at IS NULL)) ORDER BY created_at DESC LIMIT 50').all(u.id);
  const collections=await db.prepare('SELECT id,title FROM collections WHERE user_id=? AND public=true ORDER BY created_at DESC').all(u.id);
  res.json({...u,posts,collections,progress:await playerProgress(db,u.id,u.id===req.user?.id)});
 });
 const avatarUpload=multer({dest:temp,limits:{fileSize:8*1048576,files:1,fields:4}}).single('avatar');
 app.patch('/api/profile',member,limited,uploadGuard(),avatarUpload,async(req,res)=>{
  let stored=null,committed=false;
  try{
   const bio=field(req.body.bio||'','Giới thiệu',0,1000),name=field(req.body.name,'Tên hiển thị',2,40);
   const old=await db.prepare('SELECT avatar FROM users WHERE id=?').get(req.user.id);
   if(req.file){const type=await inspectMedia(req.file);if(!type.mime.startsWith('image/'))fail(400,'Avatar phải là ảnh.');stored=await mediaStore.put(req.file,type,req.user.id,'avatar');}
   const avatar=stored||(req.body.remove_avatar==='true'?null:old.avatar);
   await db.prepare('UPDATE users SET name=?,bio=?,profile_public=?,avatar=?::jsonb WHERE id=?').run(name,bio,req.body.profile_public==='true',JSON.stringify(avatar),req.user.id);committed=true;
   if(old.avatar&&avatar!==old.avatar)await mediaStore.remove([old.avatar]).catch(()=>{});res.json({ok:true});
  }finally{if(req.file)rmSync(req.file.path,{force:true});if(stored&&!committed)await mediaStore.remove([stored]).catch(()=>{});}
 });
 app.post('/api/games/:id/works',member,limited,async(req,res)=>{const g=await gameFor(req,req.params.id);await db.prepare("INSERT INTO game_checks(user_id,game_id,status) VALUES (?,?,'works') ON CONFLICT(user_id,game_id) DO UPDATE SET status='works',created_at=now()").run(req.user.id,g.id);res.json({ok:true});});
 app.get('/api/games/:id/compatibility',async(req,res)=>{
  const g=await gameFor(req,req.params.id);
  const counts=await db.prepare('SELECT status,COUNT(*)::int AS count FROM game_checks WHERE game_id=? GROUP BY status').all(g.id);
  const mine=req.user?await db.prepare('SELECT status,configuration FROM game_checks WHERE game_id=? AND user_id=?').get(g.id,req.user.id):null;
  const configurations=await db.prepare("SELECT status,configuration,created_at FROM game_checks WHERE game_id=? AND configuration<>'' ORDER BY created_at DESC LIMIT 10").all(g.id);
  res.json({configurations,configuration:mine?.configuration||'',counts:Object.fromEntries(counts.map(c=>[c.status,c.count])),mine:mine?.status||null});
 });
 app.post('/api/games/:id/compatibility',member,limited,async(req,res)=>{
  const g=await gameFor(req,req.params.id),status=req.body.status;
  if(!['works','graphics','network','startup'].includes(status))fail(400,'Chọn trạng thái tương thích hợp lệ.');
  const configuration=field(req.body.configuration||'','Cấu hình đã thử',0,300);
  await db.prepare('INSERT INTO game_checks(user_id,game_id,status,configuration) VALUES (?,?,?,?) ON CONFLICT(user_id,game_id) DO UPDATE SET status=excluded.status,configuration=excluded.configuration,created_at=now()').run(req.user.id,g.id,status,configuration);
  res.json({ok:true});
 });
 app.get('/api/games/:id/recommendation',async(req,res)=>{
  const g=await gameFor(req,req.params.id);
  const rows=await db.prepare(`SELECT g.id,g.filename,g.touch_supported,coalesce(g.screen,substring(lower(g.filename) from '[0-9]{2,4}x[0-9]{2,4}')) AS screen,
    EXISTS(SELECT 1 FROM game_checks c WHERE c.game_id=g.id AND c.user_id=? AND c.status='works') AS works
    FROM games g WHERE (g.id=? OR (g.family_key=? AND g.visibility='public')) AND NOT g.hidden AND g.deleted_at IS NULL`).all(req.user?.id||'',g.id,g.visibility==='public'?g.family_key:null);
  const width=Math.min(4000,Math.max(1,Number(req.query.width)||240)),height=Math.min(4000,Math.max(1,Number(req.query.height)||320));
  const score=v=>{const s=/^(\d+)x(\d+)$/.exec(v.screen||'');return (v.works?-100:0)+(req.query.touch==='1'?(v.touch_supported===true?-10:v.touch_supported===false?10:0):0)+(s?Math.abs(Math.log(Number(s[1])/width))+Math.abs(Math.log(Number(s[2])/height)):5);};
  rows.sort((a,b)=>score(a)-score(b)||a.id.localeCompare(b.id));res.json({id:rows[0]?.id,reason:rows[0]?.works?'Bạn đã xác nhận chơi tốt':req.query.touch==='1'&&rows[0]?.touch_supported?'Có hỗ trợ cảm ứng':rows[0]?.screen?'Gần kích thước màn hình đã chọn':'Chưa đủ thông tin để xác định độ tương thích',variants:rows});
 });
 app.get('/api/admin/audit',member,admin,async(req,res)=>{
  const page=Math.max(1,Math.min(10000,parseInt(req.query.page)||1));
  res.json(await db.prepare('SELECT a.*,u.name AS actor FROM admin_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 30 OFFSET ?').all((page-1)*30));
 });
 app.post('/api/admin/games/:id/verify-archive',member,admin,rate('verify-archive',5,60000),async(req,res)=>{
  const game=await gameFor(req,req.params.id);
  const row=await db.prepare('SELECT storage_object FROM games WHERE id=?').get(game.id);
  try{
   let result;
   if(row.storage_object){
    const url=await jarStore.url(row.storage_object,game.visibility);
    result=await verifyArchive(url,game.sha256,fetch,game.filename);
   }else{
    const inspection=await inspectJar(resolve(uploads,game.id+'.jar'),game.filename);
    if(inspection.sha256!==game.sha256)throw Error('SHA-256 không khớp bản đã đăng ký.');
    result={sha256:inspection.sha256,inspection,message:'SHA-256 khớp; cấu trúc Java ME hợp lệ.'};
   }
   await db.prepare('UPDATE games SET inspection=?::jsonb,inspected_at=now() WHERE id=? AND sha256=?').run(JSON.stringify(result.inspection),game.id,game.sha256);
   result.inspection.duplicates=await db.prepare("SELECT id,title FROM games WHERE sha256=? AND id<>? AND (visibility='public' OR owner_id=?) AND deleted_at IS NULL LIMIT 20").all(game.sha256,game.id,req.user.id);
   res.json(result);
  }catch(error){res.status(422).json({error:error.message});}
 });
 app.get('/api/admin/health',member,admin,rate('health',10,60000),async(req,res)=>{
  const page=Math.max(1,Math.min(10000,parseInt(req.query.page)||1));
  const rows=await db.prepare("SELECT id,title,filename,storage_object,sha256,icon_data IS NOT NULL AS has_icon,coalesce(screen,substring(lower(filename) from '[0-9]{2,4}x[0-9]{2,4}')) AS screen FROM games WHERE visibility='public' AND deleted_at IS NULL ORDER BY id LIMIT 20 OFFSET ?").all((page-1)*20);
  const items=await Promise.all(rows.map(async g=>{
   let file='Có tệp';if(g.storage_object){try{
    const object=g.storage_object.split('/').map(encodeURIComponent).join('/');
    const url=new URL('/storage/v1/object/public/'+encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET||'game')+'/'+object,process.env.SUPABASE_URL);
    const response=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(5000)});file=response.ok?'Có tệp':response.status===404?'Không tìm thấy tệp':'Chưa kiểm tra được';
   }catch{file='Chưa kiểm tra được';}}else if(!existsSync(resolve(uploads,g.id+'.jar')))file='Không tìm thấy tệp';
   let archive='Chưa kiểm tra cấu trúc JAR từ xa';
   if(!g.storage_object&&file==='Có tệp'){try{await validateJar(resolve(uploads,g.id+'.jar'));archive='Cấu trúc JAR hợp lệ';}catch{archive='JAR không hợp lệ';}}
   const duplicates=await db.prepare("SELECT id,title FROM games WHERE sha256=? AND id<>? AND visibility='public' AND deleted_at IS NULL LIMIT 20").all(g.sha256,g.id);
   return {remote:!!g.storage_object,archive,duplicates,id:g.id,title:g.title,filename:g.filename,file,has_icon:g.has_icon,screen:g.screen};
  }));res.json({items,page,hasMore:rows.length===20});
 });
}
