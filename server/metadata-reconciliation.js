import {createHash} from 'node:crypto';
const fields=['title','publisher','developer','release_year','language','country','network_mode'];
const revision=g=>createHash('sha256').update(JSON.stringify([g.sha256,g.inspection,g.source_metadata,g.metadata_verified,...fields.map(k=>g[k])])).digest('hex');
function candidates(g){const m=g.inspection?.sha256===g.sha256?g.inspection.manifest||{}:{};return Object.fromEntries(fields.map(k=>[k,{current:g[k],source:g.source_metadata[k]??null,manifest:k==='title'?m['midlet-name']??null:k==='publisher'?m['midlet-vendor']??null:null,verified:g.metadata_verified[k]===g[k]}]));}
export function installMetadataReconciliation(app,{db,member,admin,gameFor,rate,fail}){
 app.get('/api/admin/games/:id/metadata',member,admin,async(req,res)=>{await gameFor(req,req.params.id);const g=await db.prepare('SELECT * FROM games WHERE id=?').get(req.params.id);res.json({revision:revision(g),fields:candidates(g)});});
 app.put('/api/admin/games/:id/metadata',member,admin,rate('metadata-review',30,60000),async(req,res)=>{
  await gameFor(req,req.params.id);const {choices,revision:expected}=req.body||{};
  if(!choices||typeof choices!=='object'||Array.isArray(choices)||Object.keys(choices).some(k=>!fields.includes(k))||!Object.keys(choices).length)fail(400,'Lựa chọn metadata không hợp lệ.');
  await db.transaction(async c=>{
   const g=(await c.query('SELECT * FROM games WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[req.params.id])).rows[0];if(!g||revision(g)!==expected)fail(409,'Metadata đã đổi. Mở lại để đối chiếu.');
   const options=candidates(g),updates={};
   for(const [k,choice]of Object.entries(choices)){
    if(!['current','source','manifest'].includes(choice))fail(400,'Chọn nguồn metadata hợp lệ.');
    const value=options[k][choice];
    if(value==null||(k==='release_year'?(!Number.isInteger(value)||value<1980||value>2100):typeof value!=='string'||value.length>100||!value.trim())||(k==='network_mode'&&!['online','offline'].includes(value)))fail(400,'Giá trị metadata không hợp lệ.');
    updates[k]=value;
   }
   // Only explicit admin choices may replace verified values. Importers never update existing rows.
   const verified={...g.metadata_verified,...updates};const entries=Object.entries(updates);
   await c.query(`UPDATE games SET ${entries.map(([k],i)=>`${k}=$${i+2}`).join(',')},metadata_verified=$${entries.length+2} WHERE id=$1`,[g.id,...entries.map(([,v])=>v),JSON.stringify(verified)]);
  });res.json({ok:true});
 });
}
