const app=new URLSearchParams(location.search).get('app')||'default';
const storageKey='java-corner.touch:'+app;
const keys=[...document.querySelectorAll('.key')];
let config={scale:1,opacity:1,positions:{}};
try{const value=JSON.parse(localStorage.getItem(storageKey));if(value&&Number.isFinite(value.scale)&&Number.isFinite(value.opacity))config={scale:Math.max(.7,Math.min(1.2,value.scale)),opacity:Math.max(.3,Math.min(1,value.opacity)),positions:value.positions||{}};}catch{}
function apply(){keys.forEach((key,i)=>{const position=config.positions[i];const x=Number.isFinite(position?.x)?Math.max(-60,Math.min(60,position.x)):0,y=Number.isFinite(position?.y)?Math.max(-60,Math.min(60,position.y)):0;key.style.transform=`translate(${x}px,${y}px) scale(${config.scale})`;key.style.opacity=config.opacity;});}
apply();
const button=document.createElement('button');button.type='button';button.textContent='✥';button.title='Chỉnh phím cảm ứng';button.setAttribute('aria-label',button.title);document.querySelector('.player-toolbar').append(button);
let editing=false,drag=null;
const panel=document.createElement('section');panel.className='game-text-entry';panel.hidden=true;panel.setAttribute('aria-label','Chỉnh phím cảm ứng');
panel.innerHTML='<p>Kéo nút để chỉnh vị trí (tối đa 60 px). Trong chế độ này, nút không gửi lệnh vào game.</p><label>Kích thước<input type="range" min="0.7" max="1.2" step="0.05" data-scale></label><label>Độ rõ<input type="range" min="0.3" max="1" step="0.05" data-opacity></label><button data-save>Lưu</button><button data-reset>Mặc định</button><button data-cancel>Hủy</button><p role="status"></p>';
document.querySelector('.player-toolbar').after(panel);
let original;
button.onclick=()=>{if(editing)return;original=JSON.stringify(config);editing=true;panel.hidden=false;panel.querySelector('[data-scale]').value=config.scale;panel.querySelector('[data-opacity]').value=config.opacity;panel.querySelector('[role=status]').textContent='';};
for(const name of ['scale','opacity'])panel.querySelector('[data-'+name+']').oninput=e=>{config[name]=Number(e.target.value);apply();};
const close=()=>{editing=false;drag=null;panel.hidden=true;button.focus();};
panel.querySelector('[data-save]').onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(config));close();}catch{panel.querySelector('[role=status]').textContent='Không lưu được cấu hình.';}};
panel.querySelector('[data-reset]').onclick=()=>{config={scale:1,opacity:1,positions:{}};apply();panel.querySelector('[data-scale]').value=1;panel.querySelector('[data-opacity]').value=1;};
panel.querySelector('[data-cancel]').onclick=()=>{config=JSON.parse(original);apply();close();};
for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>{
 const key=e.target.closest?.('.key');if(!editing||!key)return;e.preventDefault();e.stopImmediatePropagation();
 const i=keys.indexOf(key);if(i<0)return;
 if(type==='pointerdown'){const p=config.positions[i]||{x:0,y:0};drag={id:e.pointerId,i,x:e.clientX,y:e.clientY,ox:Number(p.x)||0,oy:Number(p.y)||0};key.setPointerCapture(e.pointerId);}
 if(type==='pointermove'&&drag?.id===e.pointerId){config.positions[drag.i]={x:Math.max(-60,Math.min(60,drag.ox+e.clientX-drag.x)),y:Math.max(-60,Math.min(60,drag.oy+e.clientY-drag.y))};apply();}
 if(type==='pointerup'||type==='pointercancel')drag=null;
},{capture:true,passive:false});
