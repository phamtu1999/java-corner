export const classifications=['UNKNOWN','ORIGINAL','MOD','VIETNAMESE PATCH','TOUCH MOD','FULLSCREEN MOD'];
export function preservationScore(game,report,meta) {
 const checks={sha256:!!game.sha256,manifest:!!report,icon:game.has_icon,version:!!report?.manifest?.['midlet-version'],publisher:!!game.publisher,year:!!game.release_year,source:!!meta.source,evidence:!!meta.evidence,classification:!!meta.classification&&meta.classification!=='UNKNOWN'};
 return {percent:Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100),checks};
}
export function jarDiff(a,b) {
 if(!a?.entries||!b?.entries)throw Error('Cần chạy lại Inspector cho cả hai phiên bản.');
 const left=new Map(a.entries.map(e=>[e.name,e])),right=new Map(b.entries.map(e=>[e.name,e]));
 return {added:[...right.keys()].filter(k=>!left.has(k)),removed:[...left.keys()].filter(k=>!right.has(k)),changed:[...right.keys()].filter(k=>left.has(k)&&(left.get(k).crc!==right.get(k).crc||left.get(k).size!==right.get(k).size)),endpointsAdded:b.endpoints.filter(x=>!a.endpoints.includes(x)),endpointsRemoved:a.endpoints.filter(x=>!b.endpoints.includes(x)),partial:!!(a.scanLimited||b.scanLimited)};
}
export function installPreservation(app,{db,member,admin,gameFor,fail,rate}) {
 const row=id=>db.prepare('SELECT inspection,inspected_at,preservation FROM games WHERE id=?').get(id);
 app.get('/api/games/:id/preservation',async(req,res)=>{
  const game=await gameFor(req,req.params.id),data=await row(game.id);
  const report=data.inspection?.sha256===game.sha256?data.inspection:null;
  let parent=null;
  if(data.preservation.parent_id){try{const p=await gameFor(req,data.preservation.parent_id);parent={id:p.id,title:p.title};}catch{}}
  const {parent_id,...metadata}=data.preservation;
  const uploader=await db.prepare('SELECT name FROM users WHERE id=?').get(game.owner_id);
  res.json({metadata,parent,uploader:uploader?.name,sha256:game.sha256,inspected_at:report?data.inspected_at:null,inspection:req.user?.role==='admin'?report:null,score:preservationScore(game,report,metadata)});
 });
 app.put('/api/games/:id/preservation',member,admin,rate('preservation',30,60000),async(req,res)=>{
  const game=await gameFor(req,req.params.id),body=req.body;
  if(!classifications.includes(body.classification))fail(400,'Nhãn phiên bản không hợp lệ.');
  const metadata={classification:body.classification};
  for(const field of ['source','evidence','notes']){if(typeof body[field]!=='string'||body[field].length>2000)fail(400,'Thông tin nguồn tối đa 2000 ký tự.');metadata[field]=body[field].trim();}
  metadata.archived_year=body.archived_year?Number(body.archived_year):null;
  if(metadata.archived_year!==null&&(!Number.isInteger(metadata.archived_year)||metadata.archived_year<1980||metadata.archived_year>new Date().getFullYear()))fail(400,'Năm lưu trữ không hợp lệ.');
  if(!['unverified','verified'].includes(body.status))fail(400,'Trạng thái không hợp lệ.');
  metadata.status=body.status;
  if(metadata.status==='verified'&&(!metadata.source||!metadata.evidence))fail(400,'Verified cần nguồn và bằng chứng.');
  if(body.parent_id){const parent=await gameFor(req,body.parent_id);if(parent.id===game.id||parent.visibility!=='public')fail(400,'Phiên bản gốc phải là game công khai khác.');metadata.parent_id=parent.id;}
  metadata.updated_at=new Date().toISOString();metadata.reviewed_by=req.user.id;
  await db.prepare('UPDATE games SET preservation=?::jsonb WHERE id=?').run(JSON.stringify(metadata),game.id);
  res.json({ok:true});
 });
 app.get('/api/admin/games/:id/diff/:other',member,admin,async(req,res)=>{
  const a=await gameFor(req,req.params.id),b=await gameFor(req,req.params.other),ar=await row(a.id),br=await row(b.id);
  if(ar.inspection?.sha256!==a.sha256||br.inspection?.sha256!==b.sha256)fail(409,'Chạy Inspector cho cả hai phiên bản trước.');
  try{res.json({from:a.title,to:b.title,sizeDelta:b.size-a.size,...jarDiff(ar.inspection,br.inspection)});}catch(error){fail(409,error.message);}
 });
}
