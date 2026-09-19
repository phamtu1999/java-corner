import {currentReplay} from './diagnostics.js';
import {confirmAction,showMessage} from '../../ui/dialogs.js';
// Keep diagnostics limited to connection status; never capture typed text or credentials.
const events = [];
window.addEventListener('game-network-status', e => {
    events.push(`${new Date().toISOString()} ${String(e.detail).slice(0, 200)}`);
    if (events.length > 8) events.shift();
});
let phase='Đang tải môi trường Java';
window.addEventListener('game-startup-status',e=>{phase=String(e.detail).slice(0,100);});
const toolbar = document.querySelector('.player-toolbar');
const button = document.createElement('button');
button.type = 'button';
button.setAttribute('aria-label', 'Kiểm tra kết nối và báo lỗi');
button.title = 'Kiểm tra kết nối và báo lỗi';
button.innerHTML = '<svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/></svg>';
toolbar.append(button);
button.onclick = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'game-support';dialog.setAttribute('aria-labelledby','support-title');
    dialog.innerHTML = '<h2 id="support-title">Hỗ trợ game</h2><p role="status">Đang kiểm tra…</p><button type="button" data-check>Kiểm tra lại</button><button type="button" data-restart>Khởi động lại game</button><form><label>Mô tả lỗi<textarea required minlength="5" maxlength="900" rows="3"></textarea></label><label>Thông tin sẽ gửi<textarea data-details rows="7" readonly></textarea></label><p data-result role="status"></p><button type="submit">Gửi báo lỗi</button></form><button type="button" data-close>Đóng</button>';
    document.body.append(dialog);dialog.showModal();
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.onclose = () => {dialog.remove();button.focus();};
    dialog.querySelector('[data-restart]').onclick = async () => {
        if (await confirmAction('Khởi động lại game? Tiến trình chưa lưu trong game có thể mất.')) location.reload();
    };
    const app = new URLSearchParams(location.search).get('app') || '';
    const match = /^community_([a-f0-9]{32})_/.exec(app);
    const id = match?.[1].replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    const details = dialog.querySelector('[data-details]');
    details.value = ['Ứng dụng: '+document.title, 'Khởi động: '+phase, 'Phiên bản: '+(id||app), 'Bố cục: '+document.body.dataset.layout, ...Array.from(toolbar.querySelectorAll('select'), s=>(s.getAttribute('aria-label')||s.id)+': '+s.value), ...events].join('\n');
    const advice=document.createElement('p');advice.textContent='Nếu game tự thoát: thử tắt mạng với game offline, kiểm tra kích thước màn hình trong Cài đặt game và thử lại. Nếu nhiều game cùng lỗi, kiểm tra tải môi trường Java. Không xóa bản lưu để thử lỗi.';details.after(advice);
    const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='Tải báo cáo .txt';
    exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([details.value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='java-corner-diagnostic.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};details.after(exportButton);
    const check = async () => {
        const status = dialog.querySelector('[role=status]');
        status.textContent = 'Đang kiểm tra…';
        try {
            if (!navigator.onLine) throw Error('Máy tính đang ngoại tuyến.');
            const response = await fetch('/api/me', {signal:AbortSignal.timeout(8000)});
            if (!response.ok) throw Error('Website chưa phản hồi bình thường.');
            const {user} = await response.json();
            status.textContent = user ? 'Đã đăng nhập và kết nối được website. '+(events.at(-1)||'Chưa có kết quả kết nối máy chủ game.') : 'Chưa đăng nhập website. Đăng nhập để dùng mạng trong game.';
        } catch(e) { status.textContent = e.message || 'Không kết nối được website.'; }
    };
    dialog.querySelector('[data-check]').onclick = check;
    const form = dialog.querySelector('form');
    const replayLabel=document.createElement('label');replayLabel.innerHTML='<input type="checkbox"> Đính kèm replay điều khiển đã ghi';form.querySelector('[data-result]').before(replayLabel);
    const attachReplay=replayLabel.querySelector('input');attachReplay.disabled=!currentReplay();
    form.querySelector('[type=submit]').disabled = !id;
    if(!id)form.querySelector('[data-result]').textContent='Game từ máy chưa có trang cộng đồng để gửi báo lỗi.';
    form.onsubmit = async e => {
        e.preventDefault();const submit=form.querySelector('[type=submit]'), result=form.querySelector('[data-result]');submit.disabled=true;
        try {
            const response=await fetch('/api/games/'+id+'/report',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'JavaCommunity'},body:JSON.stringify({body:(form.querySelector('textarea').value+'\n\n'+details.value).slice(0,2000),replay:attachReplay.checked?currentReplay():null})});
            if(!response.ok)throw Error((await response.json()).error||'Không gửi được báo lỗi.');
            result.textContent='Đã gửi báo lỗi.';form.querySelector('textarea').value='';
        }catch(error){result.textContent=error.message;}finally{submit.disabled=false;}
    };
    check();
};
