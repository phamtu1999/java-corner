import {communityGameId,communityAppId} from './community-bridge.js';
import {confirmAction} from '../../ui/dialogs.js';
const fields={keys:'java-emulator.keys:',preferences:'java-emulator.preferences:',layout:'java-emulator.layout:',touch:'java-corner.touch:'};
let session;
function snapshot(app){const value={};for(const [name,prefix]of Object.entries(fields)){const raw=localStorage.getItem(prefix+app);if(raw!==null)value[name]=name==='layout'?raw:JSON.parse(raw);}return value;}
async function request(id,body){const r=await fetch('/api/games/'+id+'/player-profile',{method:body?'PUT':'GET',headers:body?{'Content-Type':'application/json','X-Requested-With':'JavaCommunity'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});const data=await r.json();if(!r.ok){const e=Error(data.error||'Không đồng bộ được cấu hình.');e.status=r.status;throw e;}return data;}
function status(text){let el=document.getElementById('profile-sync-status');if(!el){el=document.createElement('p');el.id='profile-sync-status';el.setAttribute('role','status');el.style.cssText='margin:0;padding:6px 10px;font-size:12px;text-align:center';document.querySelector('.player-toolbar').after(el);}el.textContent=text;}
export async function restorePlayerProfile(){
 const app=new URLSearchParams(location.search).get('app'),id=communityGameId(app||'');if(!id)return;
 try{
  const me=await fetch('/api/me',{signal:AbortSignal.timeout(8000)});if(!me.ok)throw Error();const {user}=await me.json();if(!user||communityAppId(id,user)!==app)return;
  let cloud=await request(id);
  const pendingSettings=localStorage.getItem('java-corner.profile-pending:'+app);
  if(pendingSettings){const useLocal=await confirmAction('Cài đặt màn hình/FPS trên máy chưa đồng bộ. Giữ và đồng bộ cài đặt trên máy? Chọn Hủy để dùng bản tài khoản.');if(useLocal)cloud=await request(id,{revision:cloud.revision,section:'settings',value:JSON.parse(pendingSettings)});localStorage.removeItem('java-corner.profile-pending:'+app);}
  const local=snapshot(app),marker='java-corner.profile-synced:'+app;
  const previous=localStorage.getItem(marker),dirty=previous!==null&&previous!==JSON.stringify(local);
  let useCloud=true;
  if(dirty&&cloud.profile.browser)useCloud=await confirmAction('Có cấu hình trên máy chưa đồng bộ. Dùng cấu hình tài khoản? Chọn Hủy để giữ cấu hình trên máy.');
  if(cloud.profile.browser&&useCloud){for(const [name,prefix]of Object.entries(fields)){const v=cloud.profile.browser[name];if(v===undefined)localStorage.removeItem(prefix+app);else localStorage.setItem(prefix+app,name==='layout'?v:JSON.stringify(v));}}
  const initial=JSON.stringify(snapshot(app));
  session={app,id,cloud,marker,last:cloud.profile.browser&&useCloud?initial:(previous||'{}'),pending:initial,busy:false,stopped:false};
  if(cloud.profile.browser&&useCloud)localStorage.setItem(marker,initial);
  status('Cấu hình tài khoản đã sẵn sàng');
 }catch{status('Chưa tải được cấu hình tài khoản; đang dùng cấu hình trên máy.');}
}
export function watchPlayerProfile(){
 if(!session)return;const s=session;
 const timer=setInterval(async()=>{
  if(s.busy||s.stopped||document.hidden||Date.now()<(s.retryAt||0))return;
  let text;try{text=JSON.stringify(snapshot(s.app));}catch{return;}
  if(text!==s.pending){s.pending=text;return;}if(text===s.last)return;
  s.busy=true;
  try{s.cloud=await request(s.id,{revision:s.cloud.revision,section:'browser',value:JSON.parse(text)});s.last=text;localStorage.setItem(s.marker,text);status('Đã đồng bộ cấu hình');}
  catch(e){s.retryAt=Date.now()+60000;status(e.message);if([401,403,404,409,400].includes(e.status)){s.stopped=true;clearInterval(timer);}}
  finally{s.busy=false;}
 },5000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
export async function applyPlayerJavaSettings(lib,app){
 const settings=session?.cloud.profile.settings;if(!settings||session.app!==app)return;
 const HashMap=await lib.java.util.HashMap;
 const maps=[];
 for(const file of ['settings','appproperties','systemproperties']){
  const values={},blob=await cjFileBlob('/files/'+app+'/config/'+file+'.conf');
  if(blob)for(const line of (await blob.text()).split('\n')){const i=line.indexOf(':');if(i>0)values[line.slice(0,i).trim()]=line.slice(i+1).trim();}
  if(file==='settings')Object.assign(values,settings);
  const map=await new HashMap();for(const [k,v]of Object.entries(values))await map.put(k,v);maps.push(map);
 }
 const util=await lib.pl.zb3.freej2me.launcher.LauncherUtil;await util.saveApp(app,...maps);
}
export async function savePlayerJavaSettings(app,settings,user){
 const id=communityGameId(app||'');if(!id||!user||communityAppId(id,user)!==app)return;
 const allowed=['phone','fps','width','height','fontSize','dgFormat','sound','rotate','forceFullscreen','textureDisableFilter','queuedPaint'];
 const value=Object.fromEntries(allowed.filter(k=>settings[k]!==undefined).map(k=>[k,String(settings[k])]));
 const pending='java-corner.profile-pending:'+app;localStorage.setItem(pending,JSON.stringify(value));
 const cloud=await request(id);await request(id,{revision:cloud.revision,section:'settings',value});localStorage.removeItem(pending);
}
