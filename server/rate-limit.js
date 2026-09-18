import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

export function clientAddress(req) {
  // Vercel overwrites this header. Never trust it on a directly exposed server.
  const forwarded=process.env.VERCEL==='1' ? req.headers['x-forwarded-for'] : null;
  const address=typeof forwarded==='string' ? forwarded.split(',')[0].trim() : req.ip||req.socket?.remoteAddress;
  return isIP(address||'') ? address : 'unknown';
}

export async function consumeRate(db,bucket,identity,max,windowMs) {
  const key=createHash('sha256').update(bucket+':'+identity).digest('hex');
  const row=await db.prepare(`WITH expired AS (DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at < clock_timestamp()-interval '1 day' AND key<>? ORDER BY expires_at LIMIT 100))
    INSERT INTO rate_limits(key,hits,expires_at) VALUES (?,1,clock_timestamp()+(? * interval '1 millisecond'))
    ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN rate_limits.expires_at<=clock_timestamp() THEN 1 ELSE LEAST(rate_limits.hits+1,2147483647) END,
      expires_at=CASE WHEN rate_limits.expires_at<=clock_timestamp() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END
    RETURNING hits, GREATEST(1,ceil(extract(epoch FROM expires_at-clock_timestamp()))) AS retry`).get(key,key,windowMs);
  return {allowed:row.hits<=max,retry:Number(row.retry)};
}

export function rateLimiter(db) {
  return (bucket,max,windowMs)=>async(req,res,next)=>{
    try {
      // Auth remains IP-limited even when a session cookie is present.
      const identity=bucket==='auth' ? clientAddress(req) : req.user?.id||clientAddress(req);
      const result=await consumeRate(db,bucket,identity,max,windowMs);
      if(!result.allowed)return res.set('Retry-After',String(result.retry)).status(429).json({error:'Thao tác quá nhiều lần. Vui lòng thử lại sau.'});
      next();
    } catch {res.status(503).json({error:'Tạm thời không thể kiểm tra giới hạn yêu cầu. Vui lòng thử lại.'});}
  };
}
