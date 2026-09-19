// Only directional/soft/fire controls. Never store characters, digits or pointer input.
export const replayCodes=[13,37,38,39,40,112,113];
export function validateReplay(value,sha) {
 if(!value||value.version!==1||value.sha256!==sha||!Array.isArray(value.events)||value.events.length>500||Object.keys(value).some(k=>!['version','sha256','events'].includes(k)))throw Error('Replay không hợp lệ hoặc khác phiên bản JAR.');
 let previous=-1;
 for(const e of value.events){if(!e||Object.keys(e).some(k=>!['ms','code','down'].includes(k))||!Number.isInteger(e.ms)||e.ms<previous||e.ms>60000||!replayCodes.includes(e.code)||typeof e.down!=='boolean')throw Error('Sự kiện replay không hợp lệ.');previous=e.ms;}
 return value;
}
