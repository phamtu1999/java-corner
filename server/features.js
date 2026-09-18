import {deploymentConfig} from './deployment.js';
import {readFileSync,rmSync} from 'node:fs';
import {uploadGuard} from './upload-guard.js';
import multer from 'multer';
import {randomUUID} from 'node:crypto';

export function installFeatures(app, {db, member, admin, gameFor, fail, field, rate, temp}) {
  const limited = rate('community-features', 60, 60000);
  const key = g => g.visibility === 'public' ? g.family_key || g.id : g.id;
  app.get('/api/games/:id/social', async (req,res) => {
    const g = await gameFor(req,req.params.id), family = key(g);
    const reviews = await db.prepare(`SELECT r.rating,r.body,r.user_id,r.game_id,r.updated_at,u.name AS author,g.filename
      FROM reviews r JOIN users u ON u.id=r.user_id JOIN games g ON g.id=r.game_id WHERE r.family_key=? ORDER BY r.updated_at DESC LIMIT 100`).all(family);
    const stats = await db.prepare('SELECT COUNT(*) AS count,AVG(rating)::float AS average FROM reviews WHERE family_key=?').get(family);
    const favorite = req.user ? !!await db.prepare('SELECT 1 FROM favorites WHERE user_id=? AND family_key=?').get(req.user.id,family) : false;
    res.json({favorite,reviews,...stats});
  });
  app.post('/api/games/:id/favorite', member, limited, async (req,res) => {
    const g=await gameFor(req,req.params.id);
    if (typeof req.body.enabled !== 'boolean') fail(400,'Trạng thái yêu thích không hợp lệ.');
    if(req.body.enabled) await db.prepare('INSERT INTO favorites(user_id,family_key,game_id) VALUES (?,?,?) ON CONFLICT(user_id,family_key) DO UPDATE SET game_id=EXCLUDED.game_id').run(req.user.id,key(g),g.id);
    else await db.prepare('DELETE FROM favorites WHERE user_id=? AND family_key=?').run(req.user.id,key(g));
    res.json({ok:true});
  });
  app.post('/api/games/:id/review', member, limited, async (req,res) => {
    const g=await gameFor(req,req.params.id), rating=Number(req.body.rating);
    if(g.visibility!=='public') fail(400,'Chỉ đánh giá game công khai.');
    if(!Number.isInteger(rating)||rating<1||rating>5) fail(400,'Điểm từ 1 đến 5.');
    const body=field(req.body.body||'','Nhận xét',0,1500);
    if(!await db.prepare('SELECT 1 FROM history WHERE user_id=? AND game_id=?').get(req.user.id,g.id)) fail(400,'Hãy chơi phiên bản này trước khi đánh giá.');
    await db.prepare(`INSERT INTO reviews(user_id,family_key,game_id,rating,body) VALUES (?,?,?,?,?) ON CONFLICT(user_id,family_key) DO UPDATE SET game_id=EXCLUDED.game_id,rating=EXCLUDED.rating,body=EXCLUDED.body,updated_at=now()`).run(req.user.id,key(g),g.id,rating,body);
    res.json({ok:true});
  });
  app.post('/api/games/:id/report', member, rate('reports',10,3600000), async (req,res) => {
    const g=await gameFor(req,req.params.id);
    const body=field(req.body.body,'Mô tả lỗi',5,2000);
    await db.prepare('INSERT INTO game_reports(id,user_id,game_id,body) VALUES (?,?,?,?)').run(randomUUID(),req.user.id,g.id,body);
    res.json({ok:true});
  });
  app.get('/api/reports', member, admin, async (req,res) => res.json(await db.prepare(`SELECT r.*,g.title,g.filename,u.name AS author FROM game_reports r JOIN games g ON g.id=r.game_id JOIN users u ON u.id=r.user_id ORDER BY r.resolved,r.created_at DESC LIMIT 200`).all()));
  app.patch('/api/reports/:id', member, admin, async (req,res) => {
    if(typeof req.body.resolved!=='boolean') fail(400,'Trạng thái không hợp lệ.');
    const result=await db.prepare('UPDATE game_reports SET resolved=? WHERE id=?').run(req.body.resolved,req.params.id);
    if(!result.changes) fail(404,'Không tìm thấy báo lỗi.');
    res.json({ok:true});
  });
  app.get('/api/notifications', member, async (req,res) => res.json(await db.prepare(`SELECT n.*,p.title,u.name AS author FROM notifications n JOIN posts p ON p.id=n.post_id JOIN users u ON u.id=n.actor_id WHERE n.user_id=? AND p.deleted_at IS NULL AND (p.game_id IS NULL OR EXISTS(SELECT 1 FROM games g WHERE g.id=p.game_id AND g.deleted_at IS NULL)) ORDER BY n.created_at DESC LIMIT 100`).all(req.user.id)));
  app.post('/api/notifications/read', member, async (req,res) => {
    if(!Array.isArray(req.body.ids)||req.body.ids.length>100) fail(400,'Danh sách không hợp lệ.');
    await db.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND id=ANY($2::text[])',[req.user.id,req.body.ids]);res.json({ok:true});
  });
  app.post('/api/admin/bulk', member, admin, limited, async (req,res) => {
    const {ids,action,category_id,family_title,publisher}=req.body;
    if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>typeof id!=='string')) fail(400,'Chọn từ 1 đến 100 game.');
    if(!['category','hide','show','group','publisher'].includes(action)) fail(400,'Thao tác không hợp lệ.');
    if(action==='category'&&!await db.prepare('SELECT 1 FROM categories WHERE id=?').get(category_id||'')) fail(400,'Chọn thể loại hợp lệ.');
    const value=action==='group'?field(family_title,'Tên nhóm',1,100):action==='publisher'?field(publisher||'','Hãng phát hành',0,100):null;
    const changed=await db.transaction(async client=>{
      const games=(await client.query("SELECT id,family_key FROM games WHERE visibility='public' AND deleted_at IS NULL AND id=ANY($1::text[]) FOR UPDATE",[ids])).rows;
      if(games.length!==new Set(ids).size) fail(400,'Danh sách có game không còn tồn tại.');
      const families=games.map(g=>g.family_key).filter(Boolean);
      const set=action==='category'?'category_id=$3':action==='group'?'family_key=$3,family_title=$4':action==='publisher'?'publisher=$3':'hidden=$3';
      const args=[ids,families,action==='category'?category_id:action==='group'?'manual:'+randomUUID():action==='publisher'?value:action==='hide'];
      if(action==='group') args.push(value);
      const result=await client.query(`UPDATE games SET ${set} WHERE visibility='public' AND deleted_at IS NULL AND (id=ANY($1::text[]) OR family_key=ANY($2::text[])) RETURNING id`,args);
      if(action==='group') {
        const editionIds=result.rows.map(g=>g.id);
        // Keep one review/favorite per user after merging families.
        for(const table of ['favorites','reviews']) {
          await client.query(`DELETE FROM ${table} a USING ${table} b WHERE a.game_id=ANY($1::text[]) AND b.game_id=ANY($1::text[]) AND a.user_id=b.user_id AND a.family_key>b.family_key`,[editionIds]);
          await client.query(`UPDATE ${table} SET family_key=$2 WHERE game_id=ANY($1::text[])`,[editionIds,args[2]]);
        }
      }
      return result.rowCount;
    });
    res.json({ok:true,changed});
  });
  // Account-private snapshot; revision prevents another device silently overwriting it.
  const backupUpload=multer({dest:temp,limits:{fileSize:50*1048576,files:1,fields:1}}).single('file');
  app.get('/api/cloud-save',member,async(req,res)=>res.json(await db.prepare('SELECT revision,updated_at,octet_length(data) AS size FROM cloud_saves WHERE user_id=?').get(req.user.id)||null));
  app.get('/api/cloud-save/file',member,async(req,res)=>{
    const row=await db.prepare('SELECT data,revision FROM cloud_saves WHERE user_id=?').get(req.user.id);
    if(!row) fail(404,'Chưa có bản lưu trên tài khoản.');
    if(deploymentConfig().uploadLimit && row.data.length>deploymentConfig().uploadLimit) fail(413,'Bản lưu này vượt giới hạn tải của Vercel. Hãy tải từ máy chủ Docker.');
    res.set('Content-Type','application/zip');res.set('X-Save-Revision',row.revision);res.send(row.data);
  });
  app.post('/api/cloud-save',member,rate('cloud-save',10,3600000),uploadGuard({max:2}),backupUpload,async(req,res)=>{
    try {
    const data=req.file?readFileSync(req.file.path):null, revision=req.body.revision||'';
    if(!data||data.length<4||data.readUInt32LE(0)!==0x04034b50) fail(400,'Bản lưu phải là ZIP được xuất từ thư viện.');
    const next=randomUUID();
    await db.transaction(async client=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
      const old=(await client.query('SELECT * FROM cloud_saves WHERE user_id=$1 FOR UPDATE',[req.user.id])).rows[0];
      if((old?.revision||'')!==revision)fail(409,'Bản lưu đã thay đổi ở thiết bị khác. Hãy mở lại thông tin trước khi lưu.');
      if(old)await client.query('INSERT INTO cloud_save_versions(user_id,data,revision,updated_at) VALUES ($1,$2,$3,$4)',[req.user.id,old.data,old.revision,old.updated_at]);
      await client.query('INSERT INTO cloud_saves(user_id,data,revision) VALUES ($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,revision=EXCLUDED.revision,updated_at=now()',[req.user.id,data,next]);
      await client.query('DELETE FROM cloud_save_versions WHERE user_id=$1 AND revision NOT IN (SELECT revision FROM cloud_save_versions WHERE user_id=$1 ORDER BY updated_at DESC,revision LIMIT 4)',[req.user.id]);
    });
    res.json({revision:next});
    } finally {if(req.file)rmSync(req.file.path,{force:true});}
  });
}
