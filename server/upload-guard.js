// Bound in-flight uploads before multipart buffering or disk writes.
export function uploadGuard({max=4}={}) {
 const users=new Set();let active=0;
 return(req,res,next)=>{
  const id=req.user.id;
  if(active>=max||users.has(id))return res.status(429).json({error:'Đang có tải lên, hãy thử lại sau.'});
  users.add(id);active++;let released=false;
  const release=()=>{if(released)return;released=true;users.delete(id);active--;};
  const end=res.end;
  res.end=function(...args){try{return end.apply(this,args);}finally{release();}};
  res.once('finish',release);
  res.once('close',()=>{if(req.aborted)release();});
  next();
 };
}
export function mediaQuota(db){
 return async(req,res,next)=>{
  // Reserve the maximum accepted payload, including concurrent requests via the guard.
  const row=await db.prepare(`SELECT COALESCE(SUM((m->>'size')::bigint),0) AS bytes FROM posts p CROSS JOIN LATERAL jsonb_array_elements(p.media) m WHERE p.user_id=?`).get(req.user.id);
  if(Number(row.bytes)+40*1048576>200*1048576)return res.status(413).json({error:'Kho media tối đa 200 MB. Hãy xóa vĩnh viễn media cũ trước khi tải thêm.'});
  next();
 };
}
