// W3C standard mapping: https://www.w3.org/TR/gamepad/#remapping
export const defaultButtons={0:'Enter',1:'KeyW',2:'KeyQ',3:'Digit5',4:'KeyE',5:'KeyR',8:'KeyQ',9:'Enter',12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight'};
const allowedKeys=['', 'Enter','KeyQ','KeyW','KeyE','KeyR','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Array.from({length:10},(_,i)=>'Digit'+i)];
export function normalizeProfile(value) {
 const buttons={...defaultButtons};
 for(const index of Object.keys(buttons))if(allowedKeys.includes(value?.buttons?.[index]))buttons[index]=value.buttons[index];
 const deadzone=typeof value?.deadzone==='number'&&Number.isFinite(value.deadzone)?Math.max(.15,Math.min(.85,value.deadzone)):.5;
 return {buttons,deadzone};
}
export function gamepadKeys(pad,profile=normalizeProfile(null)) {
 const keys=new Set();if(!pad||pad.mapping!=='standard')return keys;
 const map=profile.buttons;
 for(const [index,key] of Object.entries(map))if(key&&pad.buttons[index]?.pressed)keys.add(key);
 if(pad.axes[0]<-profile.deadzone)keys.add('ArrowLeft');if(pad.axes[0]>profile.deadzone)keys.add('ArrowRight');
 if(pad.axes[1]<-profile.deadzone)keys.add('ArrowUp');if(pad.axes[1]>profile.deadzone)keys.add('ArrowDown');return keys;
}
export function setupGamepad(display,post) {
 const button=document.createElement('button');button.type='button';button.title='Tay cầm và toàn màn hình';button.setAttribute('aria-label',button.title);
 button.innerHTML='<svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 6h10c3 0 5 12 3 13-2 1-4-4-5-4H9c-1 0-3 5-5 4C2 18 4 6 7 6Z M6 10h6m-3-3v6m7-3h1m1 3h1"/></svg>';
 document.querySelector('.player-toolbar').append(button);
 const storageKey='java-corner.gamepad:'+new URLSearchParams(location.search).get('app');
 let profile=normalizeProfile(null);try{profile=normalizeProfile(JSON.parse(localStorage.getItem(storageKey)));}catch{}
 let enabled=false,previous=new Set(),frame=null,status=null;
 const release=()=>{for(const key of previous)post(false,key);previous=new Set();};
 const poll=()=>{
  if(!enabled){release();frame=null;return;}
  let pads=[];try{pads=[...navigator.getGamepads()].filter(Boolean);}catch{}
  const pad=pads.find(p=>p.mapping==='standard');
  if(status)status.textContent=pad?'Đã nhận: '+pad.id:pads.length?'Tay cầm này chưa có ánh xạ chuẩn.':'Chưa thấy tay cầm. Kết nối và nhấn một nút trên tay cầm.';
  const next=!document.hidden&&document.hasFocus()&&!document.querySelector('dialog[open]')&&document.activeElement===display?gamepadKeys(pad,profile):new Set();
  for(const key of previous)if(!next.has(key))post(false,key);
  for(const key of next)if(!previous.has(key))post(true,key);
  previous=next;frame=requestAnimationFrame(poll);
 };
 window.addEventListener('blur',release);document.addEventListener('visibilitychange',release);window.addEventListener('gamepaddisconnected',release);window.addEventListener('pagehide',()=>{enabled=false;release();if(frame)cancelAnimationFrame(frame);});
 button.onclick=()=>{
  const d=document.createElement('dialog');d.className='game-support';d.setAttribute('aria-label','Điều khiển nâng cao');d.innerHTML='<h2>Điều khiển nâng cao</h2><label><input type="checkbox"> Bật tay cầm</label><p role="status"></p><p>D-pad/cần trái: di chuyển · A: OK · B: phím phải · X: phím trái · Y: số 5 · L/R: */#.</p><p>Đóng cửa sổ này và chạm màn hình game để điều khiển. Tay cầm tự nhả phím khi chuyển tab hoặc mất kết nối.</p><button type="button" data-full>Toàn màn hình</button><button type="button" data-close>Đóng</button>';
  const settings=document.createElement('fieldset');settings.style.cssText='display:grid;gap:8px;min-width:0';const legend=document.createElement('legend');legend.textContent='Nút riêng cho game này';settings.append(legend);
  const names={0:'A / ×',1:'B / ○',2:'X / □',3:'Y / △',4:'L',5:'R',8:'Select',9:'Start',12:'D-pad ↑',13:'D-pad ↓',14:'D-pad ←',15:'D-pad →'};
  const persist=()=>{release();try{localStorage.setItem(storageKey,JSON.stringify(profile));}catch{status.textContent='Không lưu được cấu hình trên trình duyệt.';}};
  for(const index of Object.keys(defaultButtons)){
   const label=document.createElement('label');label.textContent=names[index]+' ';const select=document.createElement('select');
   for(const key of allowedKeys)select.add(new Option(key||'Không dùng',key));select.value=profile.buttons[index];select.onchange=()=>{profile.buttons[index]=select.value;persist();};label.append(select);settings.append(label);
  }
  const label=document.createElement('label');label.textContent='Vùng chết cần analog ';const range=document.createElement('input');range.type='range';range.min='.15';range.max='.85';range.step='.05';range.value=profile.deadzone;const output=document.createElement('output');output.textContent=range.value;
  range.oninput=()=>{profile.deadzone=Number(range.value);output.textContent=range.value;persist();};label.append(range,output);settings.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Khôi phục nút mặc định';reset.onclick=()=>{profile=normalizeProfile(null);settings.querySelectorAll('select').forEach((select,i)=>select.value=profile.buttons[Object.keys(defaultButtons)[i]]);range.value=profile.deadzone;output.textContent=range.value;persist();};settings.append(reset);
  d.querySelector('[data-full]').before(settings);
  status=d.querySelector('[role=status]');const toggle=d.querySelector('input');toggle.checked=enabled;toggle.disabled=!navigator.getGamepads;status.textContent=navigator.getGamepads?'Bật để kiểm tra tay cầm.':'Trình duyệt không hỗ trợ tay cầm.';
  toggle.onchange=()=>{enabled=toggle.checked;release();if(enabled&&!frame)poll();};
  d.querySelector('[data-full]').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();d.close();}catch{status.textContent='Trình duyệt chưa cho phép toàn màn hình.';}};
  d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>{status=null;d.remove();display.focus();};document.body.append(d);d.showModal();
 };
}
