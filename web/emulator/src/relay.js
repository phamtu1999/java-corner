import {communityGameId} from './community-bridge.js';
const gameId=()=>communityGameId(new URLSearchParams(location.search).get('app')||'');
const sockets=new Map();let nextId=1;
function message(text){window.dispatchEvent(new CustomEvent('game-network-status',{detail:text}));}
export default {
 async Java_javax_microedition_io_RelayHttp_exchange(lib,url,method,lines,body){
  try{const headers={};for(const line of lines.split('\n')){const i=line.indexOf(':');if(i>0)headers[line.slice(0,i)]=line.slice(i+1);}
   const res=await fetch('/api/game-network/request',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'JavaCommunity'},body:JSON.stringify({url,method,headers,body,game_id:gameId()}),signal:AbortSignal.timeout(20000)});
   if(!res.ok){message(res.status===401?'Cần đăng nhập website để dùng mạng game':res.status===403?'Địa chỉ mạng bị chặn bởi chính sách bảo vệ':res.status===429?'Quá nhiều yêu cầu mạng; chờ một chút rồi thử lại':'Máy chủ chuyển tiếp chưa kết nối được máy chủ game');return null;}const r=await res.json();message('Máy chủ HTTP đã phản hồi: '+r.status);return [r.status,r.message,r.body,...Object.entries(r.headers).map(([k,v])=>k+':'+(Array.isArray(v)?v.join('; '):v))].join('\n');
  }catch{message(navigator.onLine?'Yêu cầu HTTP hết thời gian hoặc không tới được máy chủ chuyển tiếp':'Máy tính đang ngoại tuyến');return null;}
 },
 async Java_javax_microedition_io_RelaySocket_connect(lib,target){
  const url=new URL('/game-network',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('target',target);url.searchParams.set('game_id',gameId()||'');
  return new Promise(resolve=>{
   const ws=new WebSocket(url);ws.binaryType='arraybuffer';const id=nextId++;
   const state={ws,queue:[],bytes:0,waiter:null,closed:false};sockets.set(id,state);let ready=false,settled=false;
   const timer=setTimeout(()=>{message('Máy chủ game không phản hồi');ws.close();if(!settled){settled=true;resolve(-1);}},15000);
   const end=()=>{clearTimeout(timer);state.closed=true;state.waiter?.();if(!settled){settled=true;resolve(-1);}if(!ready)sockets.delete(id);};
   ws.onmessage=event=>{
    if(typeof event.data==='string'){if(event.data==='ready'&&!settled){ready=true;settled=true;clearTimeout(timer);message('Đã kết nối máy chủ game');resolve(id);}return;}
    state.queue.push(new Uint8Array(event.data));state.bytes+=event.data.byteLength;
    if(state.bytes>1048576){ws.close();end();return;}state.waiter?.();
   };
   ws.onerror=async()=>{end();if(!navigator.onLine){message('Máy tính đang ngoại tuyến');return;}try{const res=await fetch('/api/me',{signal:AbortSignal.timeout(5000)});const data=await res.json();message(data.user?'Không nối được máy chủ game; thử lại trong game hoặc kiểm tra máy chủ':'Cần đăng nhập website để dùng mạng game');}catch{message('Không tới được website hoặc máy chủ chuyển tiếp');}};
   ws.onclose=()=>{if(ready)message('Kết nối máy chủ game đã đóng');end();};
  });
 },
 async Java_javax_microedition_io_RelaySocket_receive(lib,id){
  const state=sockets.get(id);if(!state)return null;
  while(!state.queue.length&&!state.closed)await new Promise(resolve=>state.waiter=resolve);
  state.waiter=null;const bytes=state.queue.shift();if(!bytes){sockets.delete(id);return null;}state.bytes-=bytes.length;
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);
 },
 async Java_javax_microedition_io_RelaySocket_send(lib,id,encoded){const state=sockets.get(id);if(!state||state.closed||state.ws.readyState!==1)return false;if(state.ws.bufferedAmount>1048576){state.ws.close();return false;}state.ws.send(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));return true;},
 async Java_javax_microedition_io_RelaySocket_disconnect(lib,id){const state=sockets.get(id);if(state){state.closed=true;state.ws.close();state.waiter?.();sockets.delete(id);}}
};
