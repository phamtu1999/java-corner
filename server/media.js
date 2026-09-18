import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileTypeFromFile} from 'file-type';
import sharp from 'sharp';
const allowed = new Set(['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm']);
export async function inspectMedia(file) {
  const type = await fileTypeFromFile(file.path);
  if (!type || !allowed.has(type.mime)) throw Object.assign(new Error('Chỉ nhận ảnh JPG, PNG, GIF, WebP và video MP4, WebM hợp lệ.'),{status:400});
  if (type.mime.startsWith('image/') && file.size > 8*1024*1024) throw Object.assign(new Error('Ảnh tối đa 8 MB.'),{status:400});
  if(type.mime.startsWith('image/')) {
    try {
      const meta=await sharp(file.path,{limitInputPixels:20000000}).metadata();
      const height=meta.pageHeight||meta.height,frames=meta.pages||1;
      if(!meta.width||!height||meta.width>8192||height>8192||frames>100||meta.width*height*frames>20000000)throw Error('Image dimensions');
    } catch {throw Object.assign(new Error('Ảnh không hợp lệ hoặc vượt giới hạn 8192 px, 20 megapixel tổng các khung hình, 100 khung hình.'),{status:400});}
  }
  return type;
}
export function mediaStorage() {
  const origin = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'media';
  const encode = value => value.split('/').map(encodeURIComponent).join('/');
  async function request(path, options) {
    if (!origin || !key) throw Object.assign(new Error('Chưa cấu hình Supabase media.'),{status:503});
    const headers = {apikey:key,...(!key.startsWith('sb_secret_') ? {Authorization:`Bearer ${key}`} : {}),...options.headers};
    const response = await fetch(new URL('/storage/v1/'+path,origin),{...options,headers,redirect:'error',signal:AbortSignal.timeout(120000)});
    if (!response.ok) throw Object.assign(new Error('Không thể lưu media trên Supabase. Vui lòng thử lại.'),{status:502});
    await response.arrayBuffer();
  }
  return {
    async put(file,type,userId,postId) {
      const object = `posts/${userId}/${postId}/${randomUUID()}.${type.ext}`;
      await request('object/'+encode(bucket+'/'+object),{method:'POST',headers:{'Content-Type':type.mime,'x-upsert':'false'},body:await readFile(file.path)});
      return {object,url:new URL('/storage/v1/object/public/'+encode(bucket+'/'+object),origin).href,type:type.mime,size:file.size};
    },
    async remove(items) {
      if (!items.length) return;
      await request('object/'+encode(bucket),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:items.map(item=>item.object)})});
    }
  };
}
