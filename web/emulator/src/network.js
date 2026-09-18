let control;
let enabled=true;
let refresh=()=>{};
export async function bindGameNetwork(value){control=value;await control.useRelay(location.origin);await control.setEnabled(enabled);refresh();}
export function setupNetwork(){
 const key='java-corner.network-enabled:'+(new URL(location.href).searchParams.get('app')||'default');const requested=new URL(location.href).searchParams.get('network');
 try{enabled=requested===null?localStorage.getItem(key)!=='0':requested!=='0';}catch{enabled=requested!=='0';}
 const bar=document.createElement('div');bar.className='player-network';
 const button=document.createElement('button');button.type='button';
 button.innerHTML='<svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/></svg>';
 const status=document.createElement('span');status.setAttribute('role','status');
 refresh=()=>{button.disabled=!control;button.title=enabled?'Mạng qua máy chủ đã bật — bấm để tắt':'Mạng game đã tắt — bấm để bật';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(enabled));status.textContent=button.title;};
 button.onclick=async()=>{button.disabled=true;try{await control.setEnabled(!enabled);enabled=!enabled;try{localStorage.setItem(key,enabled?'1':'0');}catch{}const url=new URL(location.href);url.searchParams.set('network',enabled?'1':'0');history.replaceState(null,'',url.href);refresh();}catch{status.textContent='Không đổi được trạng thái mạng';button.disabled=false;}};
 window.addEventListener('game-network-status',event=>{status.textContent=event.detail;button.title=event.detail+' — bấm để bật/tắt mạng game';button.setAttribute('aria-label',button.title);});
 bar.append(button,status);document.querySelector('.player-toolbar').append(bar);refresh();return {};
}
