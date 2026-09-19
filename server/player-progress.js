export function achievements(games, seconds) {
  return [
    {id:'first-game', title:'Chơi game Java đầu tiên', unlocked:games>=1},
    {id:'ten-hours', title:'10 giờ chơi', unlocked:seconds>=36000},
    {id:'ten-games', title:'Chơi 10 game khác nhau', unlocked:games>=10},
  ];
}

export async function playerProgress(db, userId, own) {
  const rows=await db.prepare(`SELECT COUNT(DISTINCT COALESCE(g.family_key,g.id)) AS games,
    COALESCE(SUM(h.play_seconds),0)::bigint AS seconds
    FROM history h JOIN games g ON g.id=h.game_id WHERE h.user_id=? AND g.deleted_at IS NULL
    AND (? OR (g.visibility='public' AND NOT g.hidden))`).get(userId,own);
  const completed=await db.prepare(`SELECT DISTINCT COALESCE(g.family_title,g.title) AS title
    FROM history h JOIN games g ON g.id=h.game_id WHERE h.user_id=? AND h.completed_at IS NOT NULL
    AND g.deleted_at IS NULL AND (? OR (g.visibility='public' AND NOT g.hidden)) ORDER BY title`).all(userId,own);
  return {...rows, achievements:achievements(rows.games,rows.seconds), completed};
}

export function installPlayerProgress(app,{db,member,gameFor,rate,fail}) {
  app.post('/api/games/:id/playtime',member,rate('playtime',12,60000),async(req,res)=>{
    const {session,active}=req.body;
    if(typeof session!=='string'||!/^[a-f0-9-]{36}$/.test(session)||typeof active!=='boolean')fail(400,'Phiên chơi không hợp lệ.');
    const game=await gameFor(req,req.params.id);
    await db.transaction(async client=>{
      const user=(await client.query('SELECT play_session,play_game,play_heartbeat FROM users WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
      const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
      const elapsed=user.play_heartbeat?(now-new Date(user.play_heartbeat))/1000:Infinity;
      // One lease per account, across devices and serverless instances.
      if(user.play_session!==session && elapsed<30)return;
      if(user.play_session===session && user.play_game===game.id && elapsed>=0 && elapsed<=30){
        await client.query('UPDATE history SET play_seconds=play_seconds+$1 WHERE user_id=$2 AND game_id=$3',[Math.floor(elapsed),req.user.id,game.id]);
      }
      if(active){
        await client.query('INSERT INTO history(user_id,game_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[req.user.id,game.id]);
      }
      await client.query('UPDATE users SET play_session=$1,play_game=$2,play_heartbeat=$3 WHERE id=$4',[active?session:null,active?game.id:null,active?now:null,req.user.id]);
    });
    res.json({ok:true});
  });
  app.get('/api/games/:id/progress',member,async(req,res)=>{
    const game=await gameFor(req,req.params.id);
    res.json(await db.prepare('SELECT play_seconds,completed_at FROM history WHERE user_id=? AND game_id=?').get(req.user.id,game.id)||{play_seconds:0,completed_at:null});
  });
  app.put('/api/games/:id/completion',member,rate('completion',20,60000),async(req,res)=>{
    const game=await gameFor(req,req.params.id);
    if(typeof req.body.completed!=='boolean')fail(400,'Trạng thái không hợp lệ.');
    const result=await db.prepare('UPDATE history SET completed_at=CASE WHEN ? THEN COALESCE(completed_at,now()) ELSE NULL END WHERE user_id=? AND game_id=?').run(req.body.completed,req.user.id,game.id);
    if(!result.changes)fail(400,'Hãy chơi game trước khi xác nhận hoàn thành.');
    res.json({ok:true});
  });
}
