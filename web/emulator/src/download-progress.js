export async function downloadGame(url,onProgress){
 const response=await fetch(url);
 if(!response.ok)throw Error('Không tải được game. Hãy đăng nhập và thử lại.');
 const total=Number(response.headers.get('content-length'))||0;
 if(!response.body){const data=await response.arrayBuffer();onProgress(data.byteLength,total);return data;}
 const reader=response.body.getReader(),chunks=[];let received=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;onProgress(received,total);}}finally{reader.releaseLock();}
 const data=new Uint8Array(received);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data.buffer;
}
