export async function setupBootTests({root,r,user,api,esc,notify,openModal}) {
 if(user?.role!=='admin')return;
 if(r.view==='admin'){
  const toolbar=root.querySelector('.admin-tabs')?.nextElementSibling;if(!toolbar)return;
  const b=document.createElement('button');b.textContent='Boot Test · Game cần xem lại';b.type='button';toolbar.append(b);
  b.onclick=async()=>{b.disabled=true;try{const rows=await api('/admin/boot-tests');openModal(`<h2 id="modal-title">Hàng đợi Boot Test</h2><p>Ưu tiên lỗi/cần xem lại. Tối đa 100 game công khai; queued cần worker đang chạy.</p>${rows.map(g=>`<article class="review"><a href="/game/${esc(g.id)}">${esc(g.title)}</a><p>${esc(g.boot_state)} · ${esc(g.summary||'Chờ worker')}</p></article>`).join('')||'<p>Chưa có tác vụ.</p>'}`);}catch(e){notify(e.message,'error');}finally{b.disabled=false;}};
 }
 if(r.view!=='game')return;
 const panel=document.createElement('section');panel.className='panel';root.append(panel);
 const refresh=async()=>{
  const data=await api(`/admin/games/${r.id}/boot-test`),report=data.boot_report;
  panel.innerHTML=`<h2>Boot Test & ảnh tự động</h2><p>${esc(data.boot_state||'Chưa kiểm tra')} · ${esc(report?.summary||'Worker riêng kiểm tra khi có tác vụ. Không chạy trong API Vercel.')}</p><p>Quan sát khi tắt mạng game; không chứng nhận gameplay hay tương thích hoàn toàn.</p><button data-queue>Đưa vào hàng đợi</button> <button data-refresh>Làm mới</button><div class="boot-shots">${(report?.screenshots||[]).map((s,i)=>`<figure><img width="240" style="max-width:100%;height:auto" alt="Màn hình tại ${s.seconds} giây" src="data:image/png;base64,${esc(s.png)}"><figcaption>${s.seconds} giây · <button data-cover="${i}">Dùng làm ảnh game</button></figcaption></figure>`).join('')}</div>${report?.errors?.length?`<details><summary>Lỗi trình duyệt</summary><pre>${esc(report.errors.join('\n'))}</pre></details>`:''}`;
  panel.querySelector('[data-refresh]').onclick=()=>refresh().catch(e=>notify(e.message,'error'));
  panel.querySelector('[data-queue]').onclick=async e=>{e.target.disabled=true;try{await api(`/admin/games/${r.id}/boot-test`,{method:'POST'});await refresh();}catch(error){notify(error.message,'error');e.target.disabled=false;}};
  panel.querySelectorAll('[data-cover]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`/admin/games/${r.id}/boot-cover`,{method:'POST',body:{index:Number(b.dataset.cover)}});notify('Đã cập nhật ảnh game.');}catch(e){notify(e.message,'error');}finally{b.disabled=false;}});
 };await refresh();
}
