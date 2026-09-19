import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateJar} from './jar.js';
import {inspectJar} from './jar-inspector.js';

// Only call with a server-constructed Storage URL; redirects are never followed.
export async function downloadVerifiedArchive(url,expectedHash,fetcher=fetch) {
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Không tải được tệp để kiểm tra.');
 const limit=50*1048576;let size=0;const chunks=[];
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('Tệp vượt giới hạn kiểm tra 50 MB.');}
 const reader=response.body.getReader();
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Tệp vượt giới hạn kiểm tra 50 MB.');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=Buffer.concat(chunks);const sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==expectedHash)throw Error('SHA-256 không khớp bản đã đăng ký.');
 return bytes;
}
export async function verifyArchive(url,expectedHash,fetcher=fetch,filename=null) {
 const bytes=await downloadVerifiedArchive(url,expectedHash,fetcher),size=bytes.length,sha256=expectedHash;
 const directory=await mkdtemp(join(tmpdir(),'jar-check-'));
 try{const path=join(directory,'app.jar');await writeFile(path,bytes);const inspection=filename===null?null:await inspectJar(path,filename);if(!inspection)await validateJar(path);return {size,sha256,message:'SHA-256 khớp; cấu trúc Java ME hợp lệ.',...(inspection?{inspection}:{})};}
 finally{await rm(directory,{recursive:true,force:true});}
}
