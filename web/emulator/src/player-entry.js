import {restorePlayerProfile,watchPlayerProfile} from './profile-sync.js';
// Restore before preference modules read localStorage during module evaluation.
await restorePlayerProfile();
await import('./main.js?v=20260919-profile-sync');
watchPlayerProfile();

window.addEventListener('pageshow',event=>{if(event.persisted)watchPlayerProfile();});
