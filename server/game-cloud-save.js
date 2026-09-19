import multer from 'multer';
import {readFileSync,rmSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {uploadGuard} from './upload-guard.js';

export function installGameCloudSave(app,{db,member,gameFor,rate,fail,temp}) {
 const path='/api/games/:id/cloud-saves';
 app.get(path,member,async(req,res)=>{
  await gameFor(req,req.params.id);
  res.json(await db.prepare('SELECT revision,sha256,updated_at,octet_length(data) AS size FROM game_cloud_saves WHERE user_id=? AND game_id=? ORDER BY updated_at DESC,revision DESC LIMIT 5').all(req.user.id,req.params.id));
 });
 app.get(path+'/:revision',member,async(req,res)=>{
  await gameFor(req,req.params.id);
  const row=await db.prepare('SELECT data FROM game_cloud_saves WHERE user_id=? AND game_id=? AND revision=?').get(req.user.id,req.params.id,req.params.revision);
  if(!row)fail(404,'Không tìm thấy mốc lưu.');
  res.type('application/zip').send(row.data);
 });
 const upload=multer({dest:temp,limits:{fileSize:3*1048576,files:1,fields:1,fieldSize:100}}).single('file');
 app.post(path,member,rate('game-cloud-save',60,3600000),uploadGuard({max:2}),upload,async(req,res)=>{
  try {
   await gameFor(req,req.params.id);
   const data=req.file?readFileSync(req.file.path):null;
   if(!data||data.length<4||data.readUInt32LE(0)!==0x04034b50)fail(400,'Bản lưu phải là ZIP.');
   const hash=createHash('sha256').update(data).digest('hex');
   const saved=await db.transaction(async client=>{
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
    const old=(await client.query('SELECT revision,sha256 FROM game_cloud_saves WHERE user_id=$1 AND game_id=$2 ORDER BY updated_at DESC,revision DESC LIMIT 1',[req.user.id,req.params.id])).rows[0];
    if((old?.revision||'')!==(req.body.revision||''))fail(409,'Có mốc lưu từ phiên khác. Tự lưu đã dừng để tránh ghi đè.');
    if(old?.sha256===hash)return old;
    const used=(await client.query('SELECT COALESCE(SUM(octet_length(data)),0) AS size FROM game_cloud_saves WHERE user_id=$1',[req.user.id])).rows[0];
    if(Number(used.size)+data.length>100*1048576)fail(413,'Bản lưu tự động vượt tổng dung lượng 100 MB.');
    const revision=randomUUID();
    await client.query('INSERT INTO game_cloud_saves(user_id,game_id,revision,data,sha256) VALUES($1,$2,$3,$4,$5)',[req.user.id,req.params.id,revision,data,hash]);
    await client.query('DELETE FROM game_cloud_saves WHERE user_id=$1 AND game_id=$2 AND revision NOT IN (SELECT revision FROM game_cloud_saves WHERE user_id=$1 AND game_id=$2 ORDER BY updated_at DESC,revision DESC LIMIT 5)',[req.user.id,req.params.id]);
    return {revision,sha256:hash};
   });res.json(saved);
  }finally{if(req.file)rmSync(req.file.path,{force:true});}
 });
}
