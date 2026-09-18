const app=new URLSearchParams(location.search).get('app')||'default';
const key='java-emulator.preferences:'+app;
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
export const preferences={volume:Math.max(0,Math.min(1,Number.isFinite(saved.volume)?saved.volume:1)),zoom:[0.5,0.75,1].includes(saved.zoom)?saved.zoom:1};
const players=new Map();
export function registerPlayer(player){if(!players.has(player))players.set(player,player.volume??1);player.volume=players.get(player)*preferences.volume;return player;}
export function playerVolume(player,value){if(value!==undefined){players.set(player,value);player.volume=value*preferences.volume;}return players.get(player)??player.volume;}
export function forgetPlayer(player){players.delete(player);}
export function setupPreferences(onChange){
 const toolbar=document.querySelector('.player-toolbar');
 for(const [name,label,options] of [['volume','Âm lượng',[[0,'Tắt'],[0.25,'25%'],[0.5,'50%'],[0.75,'75%'],[1,'100%']]],['zoom','Kích thước',[[0.5,'50%'],[0.75,'75%'],[1,'Vừa màn hình']]]]){
  const wrap=document.createElement('label');wrap.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);select.innerHTML=options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');select.value=String(preferences[name]);wrap.append(select);toolbar.append(wrap);
  select.onchange=()=>{preferences[name]=Number(select.value);for(const [p,v]of players)p.volume=v*preferences.volume;try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}onChange();};
 }
}
