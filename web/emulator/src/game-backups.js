import {confirmAction,showMessage} from '../../ui/dialogs.js';
const savedAt = id => {try{return Number(localStorage.getItem('java-emulator.backup:'+id))||0;}catch{return 0;}};
export function addGameBackup(item, game, getLibrary, refresh) {
 const button=document.createElement('button');button.type='button';button.className='game-action';button.textContent='Bản lưu';button.setAttribute('aria-label','Bản lưu: '+game.name);item.append(button);
 const hint=document.createElement('small');hint.className='game-play-hint';
 const time=savedAt(game.appId);let played=0;try{played=Number(localStorage.getItem('java-emulator.last-played:'+game.appId))||0;}catch{}
 hint.textContent=time?'Xuất bản lưu: '+new Date(time).toLocaleString('vi-VN'):'Chưa xuất bản lưu riêng';
 if(played>time)hint.textContent+=' · Đã chơi sau lần lưu, nên sao lưu';
 item.querySelector('.game-info').append(hint);
 button.onclick=async()=>{
  const dialog=document.createElement('dialog');dialog.className='remove-game-dialog';dialog.setAttribute('aria-label','Bản lưu game');
  dialog.innerHTML='<h2></h2><p>Đóng các tab đang chơi game này trước khi nhập hoặc hoàn tác. Bản lưu chỉ chứa tiến trình RMS, không chứa JAR hoặc dữ liệu trên máy chủ game.</p><button type="button" data-export>Xuất tiến trình .zip</button><label>Nhập bản lưu của game này<input type="file" accept=".zip,application/zip"></label><label><input type="checkbox"> Đồng ý thay tiến trình hiện tại</label><p>Bản dự phòng sẽ được tạo trên trình duyệt trước khi thay dữ liệu.</p><button type="button" data-import>Khôi phục tệp</button><button type="button" data-undo disabled>Hoàn tác lần khôi phục gần nhất</button><p role="status"></p><button type="button" data-close>Đóng</button>';
  dialog.querySelector('h2').textContent='Bản lưu · '+game.name;document.body.append(dialog);dialog.showModal();
  let busy=false;const status=dialog.querySelector('[role=status]');let saves;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();button.focus();};dialog.oncancel=e=>{if(busy)e.preventDefault();};
  const run=async action=>{if(busy)return;busy=true;dialog.querySelectorAll('button,input').forEach(n=>n.disabled=true);status.textContent='Đang xử lý…';try{await action();}catch(e){let message=e.message;try{message=await e.getMessage();}catch{}status.textContent=message||'Không xử lý được bản lưu.';}finally{busy=false;dialog.querySelectorAll('button,input').forEach(n=>n.disabled=false);try{dialog.querySelector('[data-undo]').disabled=!saves||!await saves.hasBackup(game.appId);}catch{dialog.querySelector('[data-undo]').disabled=true;}}};
  const history=document.createElement('select');history.setAttribute('aria-label','Mốc tiến trình trên máy');
  const restore=document.createElement('button');restore.textContent='Khôi phục mốc đã chọn';restore.type='button';
  const usage=document.createElement('p');
  const cleanup=document.createElement('button');cleanup.type='button';cleanup.textContent='Dọn các mốc tự động';
  cleanup.onclick=()=>run(async()=>{if(!await confirmAction('Xóa tất cả mốc tự động của game này? Tiến trình hiện tại và bản dự phòng khôi phục vẫn được giữ.'))return;await saves.clearCheckpoints(game.appId);history.replaceChildren(new Option('Chưa có mốc tự động',''));status.textContent='Đã dọn các mốc tự động.';await measure();});
  const measure=async()=>{const bytes=await saves.storageUsage(game.appId);usage.textContent='JAR: '+(Number(bytes[0])/1048576).toFixed(2)+' MB · RMS: '+(Number(bytes[1])/1048576).toFixed(2)+' MB · Bản dự phòng: '+(Number(bytes[2])/1048576).toFixed(2)+' MB';};
  dialog.querySelector('[data-export]').before(usage,history,restore,cleanup);
  restore.onclick=()=>run(async()=>{if(!history.value||!dialog.querySelector('[type=checkbox]').checked)throw Error('Chọn mốc và xác nhận thay tiến trình.');await saves.restoreCheckpoint(game.appId,history.value);dialog.querySelector('[type=checkbox]').checked=false;status.textContent='Đã khôi phục mốc tiến trình.';});
  await run(async()=>{saves=await getLibrary();await measure();const entries=await saves.checkpoints(game.appId);for(let i=0;i<entries.length;i++){const id=entries[i];history.add(new Option(new Date(Number(id)).toLocaleString('vi-VN'),id));}if(!entries.length)history.add(new Option('Chưa có mốc tự động',''));status.textContent='Giữ 5 mốc gần nhất khi bấm về thư viện. Chỉ lưu dữ liệu game đã ghi xuống RMS.';});
  dialog.querySelector('[data-export]').onclick=()=>run(async()=>{
   const bytes=await saves.exportSave(game.appId);const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download='java-save-'+game.appId+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   try{localStorage.setItem('java-emulator.backup:'+game.appId,String(Date.now()));}catch{}status.textContent='Đã tạo tệp tải xuống. Kiểm tra thư mục tải về.';refresh();
  });
  dialog.querySelector('[data-import]').onclick=()=>run(async()=>{
   const file=dialog.querySelector('[type=file]').files[0];if(!file||file.size>50*1048576)throw Error('Chọn bản lưu ZIP tối đa 50 MB.');if(!dialog.querySelector('[type=checkbox]').checked)throw Error('Hãy xác nhận thay tiến trình.');
   const path='/str/game-import-'+Date.now()+'.zip';cheerpOSAddStringFile(path,new Uint8Array(await file.arrayBuffer()));try{await saves.restore(path,game.appId);}finally{cheerpOSRemoveStringFile(path);}dialog.querySelector('[type=checkbox]').checked=false;status.textContent='Đã khôi phục. Có thể hoàn tác bằng bản dự phòng.';
  });
  dialog.querySelector('[data-undo]').onclick=()=>run(async()=>{if(!dialog.querySelector('[type=checkbox]').checked)throw Error('Hãy xác nhận thay tiến trình.');await saves.undoRestore(game.appId);dialog.querySelector('[type=checkbox]').checked=false;status.textContent='Đã trở về tiến trình trước lần khôi phục.';});
 };
}
