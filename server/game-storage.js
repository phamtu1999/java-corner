import {readFile} from 'node:fs/promises';

// New uploads use separate public/private buckets. Existing imported catalog
// objects keep their paths; authorization is always checked by the API first.
export function gameStorage({env = process.env, request = fetch} = {}) {
  const encode = value => value.split('/').map(encodeURIComponent).join('/');
  function config(visibility, authenticated = false) {
    const bucket = visibility === 'public' ? env.SUPABASE_STORAGE_BUCKET : env.SUPABASE_PRIVATE_STORAGE_BUCKET;
    const key = env.SUPABASE_SECRET_KEY;
    if (!env.SUPABASE_URL || !bucket || (authenticated && !key)) throw Object.assign(new Error('Kho JAR trên Supabase chưa được cấu hình.'), {status:503});
    const origin = new URL(env.SUPABASE_URL);
    if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('SUPABASE_URL phải dùng HTTPS.');
    if (visibility !== 'public' && bucket === env.SUPABASE_STORAGE_BUCKET) throw new Error('Bucket JAR riêng phải khác bucket công khai.');
    return {origin, bucket, headers:{apikey:key, ...(!key?.startsWith('sb_secret_') && key ? {Authorization:'Bearer '+key} : {})}};
  }
  async function call(visibility, path, options) {
    const {origin, headers} = config(visibility, true);
    const response = await request(new URL('/storage/v1/'+path, origin), {...options, headers:{...headers,...options.headers}, redirect:'error', signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw Object.assign(new Error('Không truy cập được kho JAR trên Supabase.'), {status:503});
    return response;
  }
  return {
    async put(file, visibility, owner, id) {
      const {bucket} = config(visibility, true);
      // Refuse private writes if the operator accidentally made this bucket public.
      if (visibility !== 'public') {
        const metadata = await (await call(visibility, 'bucket/'+encodeURIComponent(bucket), {})).json();
        if (metadata.public !== false) throw Object.assign(new Error('Bucket JAR riêng phải tắt Public.'), {status:503});
      }
      const object = `uploads/${owner}/${id}.jar`;
      await (await call(visibility, 'object/'+encode(bucket+'/'+object), {method:'POST', headers:{'Content-Type':'application/java-archive','x-upsert':'false'}, body:await readFile(file.path)})).arrayBuffer();
      return object;
    },
    async url(object, visibility) {
      const {origin, bucket} = config(visibility, visibility !== 'public');
      const path = encode(bucket+'/'+object);
      if (visibility === 'public') return new URL('/storage/v1/object/public/'+path, origin).href;
      const data = await (await call(visibility, 'object/sign/'+path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})})).json();
      if (typeof data.signedURL !== 'string') throw new Error('Supabase không trả về URL tải JAR.');
      const url = new URL(data.signedURL, new URL('/storage/v1/', origin));
      // Supabase returns /object/sign/... relative to its Storage API.
      if (data.signedURL.startsWith('/object/')) url.pathname = '/storage/v1'+url.pathname;
      if (url.origin !== origin.origin) throw new Error('URL tải JAR không hợp lệ.');
      return url.href;
    },
    async remove(object, visibility) {
      const {bucket} = config(visibility, true);
      await (await call(visibility, 'object/'+encodeURIComponent(bucket), {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[object]})})).arrayBuffer();
    }
  };
}
