import {restorePlayerProfile,watchPlayerProfile} from './profile-sync.js';
import {loadJavaRuntime} from './java-runtime.js';

async function startPlayer() {
    // Fetch Java while restoring the profile. Preference modules must still wait
    // for restoration before they read localStorage during module evaluation.
    await Promise.all([loadJavaRuntime(document), restorePlayerProfile()]);
    await import('./main.js?v=20261003-player-startup');
    watchPlayerProfile();
}

startPlayer().catch(error => {
    console.error(error);
    const loading = document.getElementById('loading');
    loading.textContent = 'Không tải được bộ chạy game. Kiểm tra kết nối rồi thử lại.';
    const retry = document.createElement('button');
    retry.textContent = 'Thử lại';
    retry.onclick = () => location.reload();
    loading.append(' ', retry);
});

window.addEventListener('pageshow',event=>{if(event.persisted)watchPlayerProfile();});
