import sharp from 'sharp';
export function installBootTests(app,{db,member,admin,gameFor,rate,fail}) {
 app.get('/api/admin/boot-tests',member,admin,async(req,res)=>{
  res.json(await db.prepare("SELECT id,title,boot_state,boot_started,boot_report->>'summary' AS summary FROM games WHERE deleted_at IS NULL AND visibility='public' AND boot_state IS NOT NULL ORDER BY CASE WHEN boot_state IN ('review','error') THEN 0 ELSE 1 END,boot_started DESC NULLS LAST LIMIT 100").all());
 });
 app.get('/api/admin/games/:id/boot-test',member,admin,async(req,res)=>{
  await gameFor(req,req.params.id);
  res.json(await db.prepare('SELECT boot_state,boot_started,boot_report FROM games WHERE id=?').get(req.params.id));
 });
 app.post('/api/admin/games/:id/boot-test',member,admin,rate('boot-test',10,60000),async(req,res)=>{
  await gameFor(req,req.params.id);
  const result=await db.prepare("UPDATE games SET boot_state='queued',boot_token=NULL WHERE id=? AND (boot_state IS DISTINCT FROM 'running' OR boot_started<now()-interval '5 minutes')").run(req.params.id);
  if(!result.changes)fail(409,'Worker đang kiểm tra game này.');
  res.status(202).json({state:'queued'});
 });
 app.post('/api/admin/games/:id/boot-cover',member,admin,rate('boot-cover',10,60000),async(req,res)=>{
  const game=await gameFor(req,req.params.id),index=req.body.index;
  if(!Number.isInteger(index)||index<0||index>2)fail(400,'Ảnh không hợp lệ.');
  const row=await db.prepare('SELECT boot_report FROM games WHERE id=?').get(game.id);
  const shot=row.boot_report?.screenshots?.[index];
  if(row.boot_report?.sha256!==game.sha256||!shot)fail(409,'Không có ảnh cho JAR hiện tại.');
  const png=await sharp(Buffer.from(shot.png,'base64'),{limitInputPixels:1048576}).resize({width:256,height:256,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  await db.prepare('UPDATE games SET icon_data=? WHERE id=?').run('data:image/png;base64,'+png.toString('base64'),game.id);
  res.json({ok:true});
 });
}
