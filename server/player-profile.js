import {randomUUID} from 'node:crypto';
import {codeMap} from '../web/emulator/src/key.js';

export function validateProfile(section,value) {
 const bad=()=>{throw Error('Cấu hình người chơi không hợp lệ.');};
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(value)||JSON.stringify(value).length>16000)bad();
 if(section==='settings'){
  const choices={phone:['Standard','Nokia','Motorola','Siemens','SonyEricsson'],fps:['0','15','30','60'],fontSize:['0','1','2','3'],dgFormat:['444','4444','565','888','8888'],sound:['on','off'],rotate:['on','off'],forceFullscreen:['on','off'],textureDisableFilter:['on','off'],queuedPaint:['on','off']};
  for(const [k,v]of Object.entries(value))if(['width','height'].includes(k)){if(typeof v!=='string'||!/^\d{2,4}$/.test(v)||Number(v)<64||Number(v)>1280)bad();}else if(!choices[k]?.includes(v))bad();
 }else if(section==='browser'){
  for(const [k,v]of Object.entries(value)){
   if(k==='layout'){if(!['screen','split','bottom','nokia','nokia-6300','nokia-n73','nokia-2700','sony-k800i','samsung-corby'].includes(v))bad();}
   else if(k==='preferences'){if(!object(v)||Object.keys(v).some(k=>!['volume','zoom'].includes(k))||!Number.isFinite(v.volume)||v.volume<0||v.volume>1||![.5,.75,1].includes(v.zoom))bad();}
   else if(k==='keys'){if(!object(v)||Object.keys(v).length>70)bad();for(const [a,b]of Object.entries(v))if(!Object.hasOwn(codeMap,a)||!Object.hasOwn(codeMap,b))bad();}
   else if(k==='touch'){if(!object(v)||Object.keys(v).some(k=>!['scale','opacity','positions'].includes(k))||!Number.isFinite(v.scale)||v.scale<.7||v.scale>1.2||!Number.isFinite(v.opacity)||v.opacity<.3||v.opacity>1||!object(v.positions)||Object.keys(v.positions).length>30)bad();for(const [i,p]of Object.entries(v.positions))if(!/^\d{1,2}$/.test(i)||Number(i)>29||!object(p)||Object.keys(p).some(k=>!['x','y'].includes(k))||![p.x,p.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=60))bad();}
   else bad();
  }
 }else bad();
 return value;
}
export function installPlayerProfile(app,{db,member,gameFor,rate,fail}) {
 const path='/api/games/:id/player-profile';
 app.get(path,member,async(req,res)=>{await gameFor(req,req.params.id);res.json(await db.prepare('SELECT profile,revision FROM player_profiles WHERE user_id=? AND game_id=?').get(req.user.id,req.params.id)||{profile:{},revision:''});});
 app.put(path,member,rate('player-profile',120,3600000),async(req,res)=>{
  await gameFor(req,req.params.id);const {section,value,revision}=req.body||{};
  try{validateProfile(section,value);}catch(e){fail(400,e.message);}
  if(typeof revision!=='string'||revision.length>40)fail(400,'Revision không hợp lệ.');
  const result=await db.transaction(async c=>{
   await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
   const old=(await c.query('SELECT profile,revision FROM player_profiles WHERE user_id=$1 AND game_id=$2',[req.user.id,req.params.id])).rows[0];
   if((old?.revision||'')!==revision)fail(409,'Cấu hình đã thay đổi trên thiết bị khác. Mở lại game để tải bản mới.');
   if(!old){const count=(await c.query('SELECT count(*) AS n FROM player_profiles WHERE user_id=$1',[req.user.id])).rows[0];if(Number(count.n)>=500)fail(413,'Tối đa 500 cấu hình game mỗi tài khoản.');}
   const profile={...old?.profile,[section]:value},next=randomUUID();
   await c.query('INSERT INTO player_profiles(user_id,game_id,profile,revision) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,game_id) DO UPDATE SET profile=excluded.profile,revision=excluded.revision',[req.user.id,req.params.id,JSON.stringify(profile),next]);
   return {profile,revision:next};
  });res.json(result);
 });
}
