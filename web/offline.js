import {readLibraryPreview} from '/emulator/src/library-preview.js';
const key='java-corner.offline-metadata',status=document.querySelector('#status'),list=document.querySelector('#games');
function render(){list.replaceChildren();try{const data=JSON.parse(localStorage.getItem(key)||'null');status.textContent=data?'Metadata đã lưu: '+new Date(data.at).toLocaleString('vi-VN'):'Chưa lưu metadata offline.';for(const game of data?.games||[]){const li=document.createElement('li');li.textContent=game.name;list.append(li);}}catch{status.textContent='Không đọc được metadata đã lưu.';}}
render();
document.querySelector('#clear').onclick=()=>{localStorage.removeItem(key);render();};
document.querySelector('#refresh').onclick=async e=>{e.target.disabled=true;try{const r=await fetch('/api/me',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Không đọc được tài khoản.');const {user}=await r.json(),games=readLibraryPreview(localStorage,user);if(!games)throw Error('Mở Game trên máy online một lần để đọc thư viện trước.');localStorage.setItem(key,JSON.stringify({at:Date.now(),games:games.slice(0,500).map(({name})=>({name}))}));render();}catch(error){status.textContent=error.message;}finally{e.target.disabled=false;}};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();const b=document.querySelector('#install');b.hidden=false;b.onclick=async()=>{await event.prompt();b.hidden=true;};});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{status.textContent='Không đăng ký được chế độ offline.';});
