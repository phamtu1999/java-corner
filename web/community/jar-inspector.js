export function setupJarInspector(form,api,esc) {
  const input=form.querySelector('input[type=file]');
  const section=document.createElement('section');section.className='panel';section.setAttribute('aria-live','polite');
  section.style.overflowWrap='anywhere';
  section.textContent='JAR Inspector · Chọn JAR để phân tích trước khi đăng.';
  input.closest('label').after(section);
  let revision=0;
  input.addEventListener('change',async()=>{
    const current=++revision,file=input.files[0];if(!file){section.textContent='Chưa chọn JAR.';return;}
    section.textContent='Đang phân tích JAR…';
    try {
      const body=new FormData();body.set('file',file);
      const r=await api('/admin/jar-inspect',{method:'POST',body});if(current!==revision)return;
      section.innerHTML=renderJarInspection(r,esc);
    } catch(error){if(current===revision)section.textContent=`Inspector: ${error.message}`;}
  });
}

export function renderJarInspection(r,esc) {
      const list=values=>values.length?`<ul>${values.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>Không tìm thấy trong phần đã quét.</p>';
      return `<h3>JAR Inspector</h3><dl><dt>SHA256</dt><dd>${esc(r.sha256)}</dd>${['midlet-name','midlet-vendor','midlet-version','microedition-profile','microedition-configuration'].map(k=>`<dt>${esc(k)}</dt><dd>${esc(r.manifest[k]||'Không khai báo')}</dd>`).join('')}</dl><details><summary>Classes: ${r.classes} · Resources: ${r.resources}</summary><p>Tối đa 100 tên mỗi loại.</p>${list(r.classSamples)}${list(r.resourceSamples)}</details><h4>Resolution hints</h4>${list(r.resolutionHints)}<h4>Network endpoints — chuỗi tĩnh, chưa xác minh</h4>${list(r.endpoints)}<p>Không tự thêm vào allowlist; có thể thiếu địa chỉ ghép hoặc mã hóa khi chạy.</p><h4>Quyền cần xem xét</h4>${list(r.permissions.map(p=>p.name+(p.optional?' (tùy chọn)':' (yêu cầu)')))}<p>Quyền mạng, SMS, tệp hay dữ liệu cá nhân cần được xem xét; không có khai báo không có nghĩa JAR an toàn.</p><h4>Duplicate status</h4>${r.duplicates.length?list(r.duplicates.map(g=>g.title+(g.deleted_at?' — trong thùng rác':''))):'<p>Không trùng SHA256 trong game công khai và kho của bạn.</p>'}<h4>Emulator compatibility</h4><p>${esc(r.compatibility)}</p>${r.scanLimited?'<p>Quét giới hạn: bỏ qua entry trên 2 MB hoặc khi tổng dữ liệu quét vượt 32 MB.</p>':''}`;
}
