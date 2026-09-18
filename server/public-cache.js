// Per-process cache. Authenticated requests bypass it to preserve actor isolation.
export function publicCache({ttl=10000,referenceTtl=300000,maxEntries=100}={}) {
 const entries=new Map();
 return async(req,res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
   // Clear even on failure: a multi-step mutation may have partially succeeded.
   res.once('finish',()=>entries.clear());
   return next();
  }
  if(req.method!=='GET'||req.user)return next();
  if(!['/games','/categories','/publishers','/game-screens'].includes(req.path))return next();
  if(req.path==='/games'&&((req.query.scope&&req.query.scope!=='public')||req.query.include_hidden))return next();
  const reference=['/categories','/publishers','/game-screens'].includes(req.path);
  const cacheHeaders=()=>{if(reference)res.set('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=600');};
  const key=req.originalUrl;
  if(key.length>2048)return next();
  const existing=entries.get(key);
  if(existing&&(existing.pending||existing.until>Date.now())) {
   const data=await existing.promise;
   if(data!==null&&entries.get(key)===existing){cacheHeaders();res.set('Server-Timing','cache;desc="memory-hit"');return res.json(data);}
   return next();
  }
  if(entries.size>=maxEntries)entries.delete(entries.keys().next().value);
  let resolve;const entry={pending:true,until:0,promise:new Promise(r=>resolve=r)};
  entries.set(key,entry);
  let data=null;
  const json=res.json;
  res.json=function(body){if(res.statusCode===200){data=body;cacheHeaders();}return json.call(this,body);};
  let done=false;
  const finish=()=>{
   if(done)return;done=true;entry.pending=false;entry.until=Date.now()+(reference?referenceTtl:ttl);
   if(!res.writableFinished||res.statusCode!==200)data=null;
   if(data===null&&entries.get(key)===entry)entries.delete(key);
   resolve(data);
  };
  res.once('finish',finish);res.once('close',finish);
  next();
 };
}
