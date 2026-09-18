import {confirmAction,showMessage} from '../../ui/dialogs.js';
import {communityGameId} from './community-bridge.js';
export function addUpdateCheck(item,game){
 const id=communityGameId(game.appId);if(!id)return;
 const button=document.createElement('button');button.className='game-action';button.textContent='Bản mới';button.type='button';item.append(button);
 button.onclick=async()=>{
  button.disabled=true;
  try{
   const response=await fetch('/api/games/'+id);if(!response.ok)throw Error('Không kiểm tra được phiên bản.');const current=await response.json();
   const newer=(current.variants||[]).filter(v=>v.id!==id&&Date.parse(v.created_at)>Date.parse(current.created_at));
   const dialog=document.createElement('dialog');dialog.className='remove-game-dialog';
   const title=document.createElement('h2');title.textContent='Phiên bản trong kho';const hint=document.createElement('p');hint.textContent='Các bản được đăng sau bản đang cài; chưa khẳng định số phiên bản mới hơn. Cài riêng để giữ bản cũ và tiến trình của nó. Tiến trình không tự chuyển giữa các bản.';dialog.append(title,hint);
   if(!newer.length){const p=document.createElement('p');p.textContent='Chưa có bản được đăng sau trong cùng nhóm game.';dialog.append(p);}
   for(const version of newer){const p=document.createElement('p'),link=document.createElement('a');link.href='/library?game='+encodeURIComponent(version.id);link.textContent='Cài riêng: '+version.title+' · '+(version.screen||version.filename);p.append(link);dialog.append(p);}
   const close=document.createElement('button');close.textContent='Đóng';close.onclick=()=>dialog.close();dialog.append(close);dialog.onclose=()=>{dialog.remove();button.focus();};document.body.append(dialog);dialog.showModal();
  }catch(e){await showMessage(e.message);}finally{button.disabled=false;}
 };
}
