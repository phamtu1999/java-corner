import {randomUUID} from 'node:crypto';
import {rmSync} from 'node:fs';
import {resolve} from 'node:path';
export function installSafetyFeatures(app,{db,member,admin,gameFor,fail,field,rate,mediaStore,uploads}){
 const limit=rate('safety-features',30,60000);
 app.get('/api/games/:id/guide',async(req,res)=>{const game=await gameFor(req,req.params.id);res.json(await db.prepare('SELECT * FROM game_guides WHERE game_id=?').get(game.id)||{body:''});});
 app.put('/api/games/:id/guide',member,admin,limit,async(req,res)=>{const g=await gameFor(req,req.params.id),body=field(req.body.body||'','Hướng dẫn',0,15000);await db.prepare('INSERT INTO game_guides(game_id,body) VALUES (?,?) ON CONFLICT(game_id) DO UPDATE SET body=EXCLUDED.body,updated_at=now()').run(g.id,body);res.json({ok:true});});
 const postFor=async id=>{const post=await db.prepare(`SELECT p.* FROM posts p WHERE p.id=? AND p.deleted_at IS NULL AND (p.game_id IS NULL OR EXISTS(SELECT 1 FROM games g WHERE g.id=p.game_id AND g.deleted_at IS NULL))`).get(id);if(!post)fail(404,'Bài viết không còn tồn tại.');return post;};
 app.patch('/api/posts/:id/topic',member,limit,async(req,res)=>{
  const p=await postFor(req.params.id);if(p.user_id!==req.user.id&&req.user.role!=='admin')fail(403,'Bạn không có quyền sửa chủ đề.');
  const tag=req.body.tag??p.tag;if(!['guide','question','share'].includes(tag))fail(400,'Thẻ bài viết không hợp lệ.');
  const accepted=req.body.accepted_comment_id===undefined?p.accepted_comment_id:req.body.accepted_comment_id||null;
  if(accepted&&!await db.prepare('SELECT 1 FROM comments WHERE id=? AND post_id=?').get(accepted,p.id))fail(400,'Câu trả lời không thuộc bài viết.');
  await db.prepare('UPDATE posts SET tag=?,accepted_comment_id=? WHERE id=?').run(tag,accepted,p.id);res.json({ok:true});
 });
 app.post('/api/posts/:id/report',member,rate('content-reports',10,3600000),async(req,res)=>{
  const p=await postFor(req.params.id),comment=req.body.comment_id||null,reason=field(req.body.reason,'Lý do',5,2000);
  if(comment&&!await db.prepare('SELECT 1 FROM comments WHERE id=? AND post_id=?').get(comment,p.id))fail(400,'Bình luận không thuộc bài viết.');
  await db.prepare('INSERT INTO content_reports(id,user_id,post_id,comment_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),req.user.id,p.id,comment,reason);res.status(201).json({ok:true});
 });
 app.get('/api/admin/content-reports',member,admin,async(req,res)=>res.json(await db.prepare('SELECT r.*,p.title,c.body AS comment_body,u.name AS author FROM content_reports r JOIN posts p ON p.id=r.post_id LEFT JOIN comments c ON c.id=r.comment_id JOIN users u ON u.id=r.user_id ORDER BY r.resolved,r.created_at DESC LIMIT 100').all()));
 app.patch('/api/admin/content-reports/:id',member,admin,async(req,res)=>{if(typeof req.body.resolved!=='boolean')fail(400,'Trạng thái không hợp lệ.');const result=await db.prepare('UPDATE content_reports SET resolved=? WHERE id=?').run(req.body.resolved,req.params.id);if(!result.changes)fail(404,'Không tìm thấy báo cáo.');res.json({ok:true});});
 app.get('/api/admin/trash',member,admin,async(req,res)=>res.json(await db.prepare(`SELECT 'game' AS kind,id,title,deleted_at FROM games WHERE deleted_at IS NOT NULL UNION ALL SELECT 'post',id,title,deleted_at FROM posts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`).all()));
 const trashItem=async req=>{
  const table={game:'games',post:'posts'}[req.params.kind];if(!table)fail(400,'Loại nội dung không hợp lệ.');
  const row=await db.prepare(`SELECT * FROM ${table} WHERE id=? AND deleted_at IS NOT NULL`).get(req.params.id);if(!row)fail(404,'Không có trong thùng rác.');return {table,row};
 };
 app.post('/api/admin/trash/:kind/:id/restore',member,admin,limit,async(req,res)=>{
  const {table,row}=await trashItem(req);
  if(table==='posts'&&row.game_id&&await db.prepare('SELECT 1 FROM games WHERE id=? AND deleted_at IS NOT NULL').get(row.game_id))fail(409,'Khôi phục game liên quan trước.');
  await db.prepare(`UPDATE ${table} SET deleted_at=NULL WHERE id=?`).run(row.id);res.json({ok:true});
 });
 app.delete('/api/admin/trash/:kind/:id',member,admin,limit,async(req,res)=>{
  const {table,row}=await trashItem(req);if(req.body.confirm!==row.id)fail(400,'Cần xác nhận xóa vĩnh viễn.');
  const media=table==='posts'?row.media||[]:(await db.prepare('SELECT media FROM posts WHERE game_id=?').all(row.id)).flatMap(p=>p.media||[]);
  await mediaStore.remove(media);await db.prepare(`DELETE FROM ${table} WHERE id=? AND deleted_at IS NOT NULL`).run(row.id);
  if(table==='games')rmSync(resolve(uploads,row.id+'.jar'),{force:true});res.json({ok:true});
 });
 app.get('/api/cloud-save/versions',member,async(req,res)=>res.json(await db.prepare(`SELECT revision,updated_at,octet_length(data) AS size FROM cloud_saves WHERE user_id=? UNION ALL SELECT revision,updated_at,octet_length(data) AS size FROM cloud_save_versions WHERE user_id=? ORDER BY updated_at DESC`).all(req.user.id,req.user.id)));
 app.get('/api/cloud-save/versions/:revision',member,async(req,res)=>{
  const row=await db.prepare('SELECT data,revision FROM cloud_save_versions WHERE user_id=? AND revision=? UNION ALL SELECT data,revision FROM cloud_saves WHERE user_id=? AND revision=?').get(req.user.id,req.params.revision,req.user.id,req.params.revision);if(!row)fail(404,'Mốc lưu không còn tồn tại.');res.set('X-Save-Revision',row.revision);res.type('application/zip').send(row.data);
 });
}
