import {waitUntil} from '@vercel/functions';
export function operationalEvent(db,kind){
 const task=Promise.resolve().then(()=>db.prepare(`INSERT INTO operation_counts(minute,kind,hits) VALUES(date_trunc('minute',now()),?,1) ON CONFLICT(minute,kind) DO UPDATE SET hits=operation_counts.hits+1`).run(kind)).catch(()=>{});
 if(process.env.VERCEL==='1')waitUntil(task);
 return task;
}
export function installOperations(app,{db,member,admin,rate}){
 app.get('/api/admin/operations',member,admin,rate('operations',30,60000),async(req,res)=>{
  const start=performance.now();await db.query('SELECT 1');const db_ms=Math.round(performance.now()-start);
  const games=await db.prepare(`SELECT count(*) FILTER(WHERE created_at::timestamp>=now()-interval '1 minute') AS uploads_minute,coalesce(sum(size),0) AS jar_bytes,count(*) FILTER(WHERE boot_state='queued' AND deleted_at IS NULL) AS boot_queued,count(*) FILTER(WHERE boot_state='running' AND boot_started>=now()-interval '5 minutes' AND deleted_at IS NULL) AS boot_running FROM games`).get();
  const cloud=await db.prepare('SELECT coalesce(sum(octet_length(data)),0) AS bytes FROM game_cloud_saves').get();
  const events=await db.prepare("SELECT kind,sum(hits)::bigint AS hits FROM operation_counts WHERE minute>=now()-interval '1 hour' GROUP BY kind").all();
  const sockets=await db.prepare('SELECT coalesce(sum(active),0) AS active FROM relay_instances WHERE expires_at>now()').get();
  await db.prepare("DELETE FROM operation_counts WHERE minute<now()-interval '7 days'").run();
  await db.prepare('DELETE FROM relay_instances WHERE expires_at<now()').run();
  res.json({db_ms,...games,cloud_bytes:cloud.bytes,relay_sockets:sockets.active,events,at:new Date().toISOString()});
 });
}
