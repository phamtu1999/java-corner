import {replayCodes,validateReplay} from './replay-format.js';
let replay=null;
export const currentReplay=()=>replay?.events.length?replay:null;
export function setupDiagnostics(queue,context){
 if(!context?.user)return ()=>{};
 const {game,user}=context,bar=document.querySelector('.player-toolbar');
 let recording=false,start=0,playing=false,timers=[],held=new Set(),textMode=false,lastSent=0,recordTimer;
 const button=document.createElement('button');button.type='button';button.textContent='◉';button.title='Replay và chẩn đoán';button.setAttribute('aria-label',button.title);bar.append(button);
 let note;
 const stop=()=>{button.setAttribute('aria-pressed','false');button.title='Replay và chẩn đoán';recording=false;playing=false;clearTimeout(recordTimer);timers.forEach(clearTimeout);timers=[];for(const code of held)queue.queueEvent({kind:'keyup',args:[code,'\0',false,false]});held.clear();if(note)note.textContent='Đã dừng. Replay chỉ chứa phím điều hướng/fire/softkey, không phải save state.';};
 queue.observe=evt=>{
  if(evt.kind==='textinput'){stop();return;}
  if(!recording||playing||textMode||!['keydown','keyup'].includes(evt.kind)||!replayCodes.includes(evt.args?.[0]))return;
  const ms=Math.round(performance.now()-start);if(ms>60000||replay.events.length>=500){stop();return;}
  replay.events.push({ms,code:evt.args[0],down:evt.kind==='keydown'});
 };
 queue.textModeChanged=enabled=>{textMode=enabled;if(textMode)stop();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
 button.onclick=()=>{
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','Replay và chẩn đoán');
  dialog.innerHTML='<h2>Replay và chẩn đoán</h2><p>Ghi tối đa 60 giây / 500 sự kiện. Không ghi chữ, số, tọa độ chạm hoặc chat. Bật khi đã vào màn chơi; replay không khôi phục trạng thái ban đầu.</p><button data-record>Bắt đầu ghi</button><button data-stop>Dừng</button><button data-export>Tải replay JSON</button><label><input type="checkbox" data-telemetry> Gửi metadata lỗi kỹ thuật (không gửi nội dung lỗi hoặc stack thô)</label><p role="status"></p><button data-close>Đóng</button>';
  document.body.append(dialog);dialog.showModal();note=dialog.querySelector('[role=status]');
  const check=dialog.querySelector('[data-telemetry]');check.checked=localStorage.getItem('java-corner.telemetry')==='1';check.onchange=()=>localStorage.setItem('java-corner.telemetry',check.checked?'1':'0');
  dialog.querySelector('[data-record]').onclick=()=>{stop();if(textMode){note.textContent='Tắt chế độ nhập chữ trước.';return;}replay={version:1,sha256:game.sha256,events:[]};start=performance.now();recording=true;recordTimer=setTimeout(stop,60000);dialog.close();button.setAttribute('aria-pressed','true');button.title='Đang ghi replay (tối đa 60 giây)';};
  dialog.querySelector('[data-stop]').onclick=stop;
  dialog.querySelector('[data-export]').onclick=()=>{if(!currentReplay()){note.textContent='Chưa có replay.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(replay)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='java-corner-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  if(user.role==='admin'){
   const label=document.createElement('label');label.textContent='Admin: chạy replay JSON trên màn chơi hiện tại ';const input=document.createElement('input');input.type='file';input.accept='.json';label.append(input);note.before(label);
   input.onchange=async()=>{stop();try{const file=input.files[0];if(!file||file.size>40000)throw Error('Replay tối đa 40 KB.');const data=validateReplay(JSON.parse(await file.text()),game.sha256);if(textMode)throw Error('Tắt chế độ nhập chữ trước.');playing=true;for(const e of data.events)timers.push(setTimeout(()=>{if(!playing)return;if(e.down)held.add(e.code);else held.delete(e.code);queue.queueEvent({kind:e.down?'keydown':'keyup',args:[e.code,'\0',false,false]});},e.ms));timers.push(setTimeout(stop,(data.events.at(-1)?.ms||0)+50));note.textContent='Đang replay. Kết quả phụ thuộc trạng thái game ban đầu; có thể dừng bất cứ lúc nào.';}catch(e){note.textContent=e.message;}};
  }
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();button.focus();};
 };
 const send=async error=>{
  if(localStorage.getItem('java-corner.telemetry')!=='1'||Date.now()-lastSent<60000)return;lastSent=Date.now();
  const exception=['TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError'].includes(error?.name)?error.name:'Error';
  // Only a digest leaves the browser. Drop the message and URLs' query strings first.
  const stack=String(error?.stack||'').split('\n').slice(1,12).join('\n').replace(/\?[^\s)]*/g,'');
  const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stack||exception))),n=>n.toString(16).padStart(2,'0')).join('');
  const canvas=document.querySelector('#display');const network=document.querySelector('.player-network button')?.getAttribute('aria-pressed')==='true';
  await fetch('/api/games/'+game.id+'/telemetry',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'JavaCommunity'},body:JSON.stringify({sha256:game.sha256,runtime:'freej2me-relay-v3-cheerpj-20260317',exception,signature,screen:`${canvas?.width||240}x${canvas?.height||320}`,network}),signal:AbortSignal.timeout(8000)});
 };
 const report=error=>{send(error).catch(()=>{});};
 window.addEventListener('error',e=>report(e.error));window.addEventListener('unhandledrejection',e=>report(e.reason));
 return report;
}
