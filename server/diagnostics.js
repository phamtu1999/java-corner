import {createHash} from 'node:crypto';
export function installDiagnostics(app,{db,member,admin,gameFor,rate,fail}){
 app.post('/api/games/:id/telemetry',member,rate('telemetry',20,3600000),async(req,res)=>{
  const game=await gameFor(req,req.params.id),b=req.body||{};
  if(Object.keys(b).some(k=>!['sha256','runtime','exception','signature','screen','network'].includes(k))||b.sha256!==game.sha256||b.runtime!=='freej2me-relay-v3-cheerpj-20260317'||!['Error','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError','JavaException'].includes(b.exception)||! /^[a-f0-9]{64}$/.test(b.signature||'')||! /^\d{2,4}x\d{2,4}$/.test(b.screen||'')||typeof b.network!=='boolean')fail(400,'Metadata lỗi không hợp lệ.');
  const key=createHash('sha256').update(JSON.stringify([game.id,b.sha256,b.runtime,b.exception,b.signature,b.screen,b.network])).digest('hex');
  await db.prepare(`INSERT INTO emulator_crashes(key,game_id,sha256,runtime,exception,signature,screen,network) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET occurrences=emulator_crashes.occurrences+1,last_seen=now()`).run(key,game.id,b.sha256,b.runtime,b.exception,b.signature,b.screen,b.network);
  await db.prepare("DELETE FROM emulator_crashes WHERE last_seen<now()-interval '30 days'").run();res.json({ok:true});
 });
 app.get('/api/admin/telemetry',member,admin,async(req,res)=>res.json(await db.prepare(`SELECT exception,signature,runtime,sum(occurrences)::bigint AS occurrences,count(DISTINCT sha256) AS versions,max(last_seen) AS last_seen FROM emulator_crashes WHERE last_seen>=now()-interval '30 days' GROUP BY exception,signature,runtime ORDER BY max(last_seen) DESC LIMIT 100`).all()));
}
