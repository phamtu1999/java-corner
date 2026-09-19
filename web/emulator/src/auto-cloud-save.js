import {confirmAction} from '../../ui/dialogs.js';

export async function setupAutoCloudSave({gameId,appId,user,saves}) {
 const key='java-corner.auto-save:'+user.id+':'+gameId;
 let revision='',lastHash='',pendingHash='',changedAt=0,lastUpload=0,busy=false,paused=false,stopped=false;
 const status=document.createElement('button');status.type='button';status.textContent='☁ Đang kiểm tra bản lưu';
 status.style.maxWidth='100%';status.style.whiteSpace='normal';status.style.overflowWrap='anywhere';
 status.setAttribute('aria-label','Bản lưu tự động và lịch sử');
 document.querySelector('a[href="/library"]')?.parentElement.append(status);
 const request=async(suffix='',options={})=>{
  const response=await fetch('/api/games/'+encodeURIComponent(gameId)+'/cloud-saves'+suffix,{signal:AbortSignal.timeout(15000),...options,headers:{'X-Requested-With':'JavaCommunity',...options.headers}});
  if(!response.ok){const error=Error((await response.json().catch(()=>({}))).error||'Không kết nối được Cloud Save');error.status=response.status;throw error;}
  return response;
 };
 const remember=()=>{try{localStorage.setItem(key,revision);}catch{}};
 try{
  const versions=await(await request()).json();const latest=versions[0];
  let known;try{known=localStorage.getItem(key);}catch{}
  revision=latest?.revision||'';lastHash=latest?.sha256||'';
  paused=!!latest&&known!==revision;
  status.textContent=paused?'☁ Có bản lưu khác — xem lịch sử':'☁ Tự lưu đang bật';
 }catch{paused=true;status.textContent='☁ Chưa kết nối — bấm thử lại';}
 const tick=async()=>{
  if(busy||paused||stopped||document.hidden)return;
  busy=true;
  try{
   const bytes=new Uint8Array(await saves.exportSave(appId));
   if(bytes.length>3*1048576){paused=true;throw Error('Tiến trình vượt 3 MB; hãy xuất bản lưu thủ công.');}
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(hash===lastHash){pendingHash='';return;}
   if(hash!==pendingHash){pendingHash=hash;changedAt=Date.now();return;}
   if(Date.now()-changedAt<10000||Date.now()-lastUpload<60000)return;
   const body=new FormData();body.set('file',new Blob([bytes],{type:'application/zip'}),'save.zip');body.set('revision',revision);
   const saved=await(await request('',{method:'POST',body})).json();
   revision=saved.revision;lastHash=hash;lastUpload=Date.now();remember();status.textContent='☁ Đã lưu '+new Date().toLocaleTimeString('vi-VN');
  }catch(error){if([401,403,409,413].includes(error.status))paused=true;status.textContent='☁ '+error.message;lastUpload=Date.now();}
  finally{busy=false;}
 };
 status.onclick=async()=>{
  if(busy)return;paused=true;
  const dialog=document.createElement('dialog');dialog.className='remove-game-dialog';
  dialog.innerHTML='<h2>Bản lưu tự động</h2><p>Giữ 5 mốc RMS gần nhất, không chứa JAR. Khôi phục sẽ tải lại game; dữ liệu hiện tại được giữ làm bản dự phòng trên máy.</p><select aria-label="Mốc lưu"></select><p role="status"></p><button data-restore>Khôi phục mốc</button><button data-resume>Tiếp tục tự lưu từ máy này</button><button data-close>Đóng</button>';
  document.body.append(dialog);dialog.showModal();
  const message=dialog.querySelector('[role=status]'),select=dialog.querySelector('select');
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
  try{
   const versions=await(await request()).json();revision=versions[0]?.revision||'';
   for(const v of versions)select.add(new Option(new Date(v.updated_at).toLocaleString('vi-VN'),v.revision));
   dialog.querySelector('[data-restore]').disabled=!versions.length;
  }catch(error){message.textContent=error.message;return;}
  const run=fn=>async()=>{dialog.querySelectorAll('button').forEach(b=>b.disabled=true);dialog.oncancel=e=>e.preventDefault();try{await fn();}catch(error){message.textContent=error.message;}finally{dialog.querySelectorAll('button').forEach(b=>b.disabled=false);dialog.oncancel=null;}};
  dialog.querySelector('[data-resume]').onclick=run(async()=>{
   if(!await confirmAction('Tạo các mốc mới từ tiến trình máy này? Các mốc cũ sẽ lần lượt được thay sau tối đa 5 lần lưu.'))return;
   paused=false;lastHash='';pendingHash='';remember();status.textContent='☁ Tự lưu đang bật';dialog.close();
  });
  dialog.querySelector('[data-restore]').onclick=run(async()=>{
   if(!await confirmAction('Thay tiến trình bằng mốc đã chọn và tải lại game?'))return;
   // Stop the running MIDlet before restoring RMS, avoiding writes during replacement.
   sessionStorage.setItem(key+':restore',select.value);location.reload();
  });
 };
 // Restore before starting the MIDlet, never while it is writing RMS.
 let restore;try{restore=sessionStorage.getItem(key+':restore');}catch{}
 if(restore){
  sessionStorage.removeItem(key+':restore');
  try{const bytes=new Uint8Array(await(await request('/'+encodeURIComponent(restore))).arrayBuffer());const path='/str/auto-restore.zip';cheerpOSAddStringFile(path,bytes);try{await saves.restore(path,appId);}finally{cheerpOSRemoveStringFile(path);}remember();paused=false;lastHash='';}
  catch(error){paused=true;status.textContent='☁ Khôi phục thất bại: '+error.message;}
 }
 const timer=setInterval(tick,10000);
 window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);},{once:true});
 return ()=>{stopped=true;clearInterval(timer);};
}
