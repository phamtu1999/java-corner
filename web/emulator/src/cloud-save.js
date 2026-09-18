import {checkUpload} from '/ui/deployment.js';
import {iconButton} from './library-icons.js';
export function setupCloudSave({user,exportData,importData,reload,getGames,restoreGame}) {
  const button=document.createElement('button');button.className='btn cloud-save-trigger';button.type='button';button.textContent='☁ Bản lưu tài khoản';
  document.getElementById('export-data-btn').after(button);
  iconButton(button,'cloud','Bản lưu tài khoản');iconButton(document.getElementById('export-data-btn'),'upload','Xuất bản lưu');iconButton(document.getElementById('import-data-btn'),'download','Nhập bản lưu');
  const request=async(path,options={})=>{
    await checkUpload(options.body);
    const res=await fetch('/api/cloud-save'+path,{...options,headers:{'X-Requested-With':'JavaCommunity',...options.headers}});
    if(!res.ok){const error=new Error((await res.json().catch(()=>({}))).error||'Không kết nối được bản lưu.');error.status=res.status;throw error;}return res;
  };
  const syncKey='java-corner.cloud-revision:'+user?.id;
  const remembered=()=>{try{return localStorage.getItem(syncKey);}catch{return null;}};
  const remember=revision=>{try{localStorage.setItem(syncKey,revision);}catch{}};
  button.onclick=async()=>{
    if(!user){location.href='/login';return;}
    button.disabled=true;
    const dialog=document.createElement('dialog');dialog.className='remove-game-dialog';dialog.setAttribute('aria-labelledby','cloud-title');
    dialog.innerHTML='<h2 id="cloud-title">Bản lưu tài khoản</h2><p class="cloud-meta">Đang lấy thông tin…</p><p>Lưu toàn bộ thư viện và tiến trình trong trình duyệt này lên tài khoản (tối đa 50 MB). Đóng các tab đang chơi trước khi lưu hoặc khôi phục.</p><p>Khôi phục sẽ thay thế dữ liệu trên máy này. Hãy xuất bản lưu trước để giữ dữ liệu hiện tại.</p><label><input type="checkbox" class="cloud-confirm"> Tôi đồng ý thay thế bản lưu đích</label><p class="cloud-error" role="alert"></p><div class="remove-game-actions"><button class="cloud-close" autofocus>Đóng</button><button class="cloud-upload" disabled>Lưu lên tài khoản</button><button class="cloud-download" disabled>Khôi phục về máy</button></div>';
    document.body.append(dialog);dialog.showModal();
    const close=dialog.querySelector('.cloud-close'), upload=dialog.querySelector('.cloud-upload'),download=dialog.querySelector('.cloud-download'),check=dialog.querySelector('.cloud-confirm'),error=dialog.querySelector('.cloud-error');
    close.onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();button.disabled=false;};
    let meta=null,busy=false,ready=false;
    const versions=document.createElement('select');versions.setAttribute('aria-label','Chọn mốc bản lưu');dialog.querySelector('.cloud-meta').after(versions);
    const update=()=>{upload.disabled=!ready||busy||(!check.checked&&!!meta);download.disabled=!ready||busy||!meta||!check.checked;close.disabled=busy;check.disabled=busy;versions.disabled=busy;scope.disabled=busy;};
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});check.onchange=update;
    const refresh=async()=>{meta=await (await request('')).json();const history=await(await request('/versions')).json();versions.replaceChildren(...history.map(v=>{const o=document.createElement('option');o.value=v.revision;o.textContent=`${new Date(v.updated_at).toLocaleString('vi-VN')} · ${(v.size/1048576).toFixed(1)} MB${v.revision===meta?.revision?' · Mới nhất':''}`;return o;}));dialog.querySelector('.cloud-meta').textContent=meta?'Chọn mốc để khôi phục. Giữ tối đa 5 mốc, gồm bản mới nhất.':'Chưa có bản lưu trên tài khoản.';if(meta&&remembered()!==meta.revision)dialog.querySelector('.cloud-meta').textContent='Có bản lưu chưa đồng bộ với máy này ('+new Date(meta.updated_at).toLocaleString('vi-VN')+'). Xuất bản lưu máy này trước, rồi chọn khôi phục hoặc xác nhận lưu đè.';ready=true;check.checked=false;update();};
    const scope=document.createElement('select');scope.setAttribute('aria-label','Phạm vi khôi phục');scope.add(new Option('Khôi phục toàn bộ thư viện',''));
    for(const game of getGames())scope.add(new Option('Chỉ tiến trình: '+game.name,game.appId));
    const scopeLabel=document.createElement('label');scopeLabel.textContent='Phạm vi khôi phục';scopeLabel.append(scope);versions.after(scopeLabel);
    const hint=document.createElement('p');hint.textContent='Khôi phục riêng game chỉ thay tiến trình RMS, giữ nguyên tệp game và các game khác. Game phải có trong mốc đã chọn. Không khôi phục dữ liệu tài khoản trên máy chủ game.';scopeLabel.after(hint);
    scope.onchange=()=>{check.checked=false;update();};
    versions.onchange=()=>{check.checked=false;update();};
    const run=async fn=>{busy=true;error.textContent='';update();try{await fn();}catch(e){if(e.status===409){try{await refresh();}catch{ready=false;}error.textContent='Bản lưu đã được thay đổi từ phiên khác. Kiểm tra mốc mới và xác nhận lại; chưa ghi đè dữ liệu.';}else error.textContent=e.message;}finally{busy=false;update();}};
    upload.onclick=()=>run(async()=>{
      const bytes=await exportData();const blob=new Blob([bytes],{type:'application/zip'});
      if(blob.size>50*1048576)throw new Error('Bản lưu vượt quá 50 MB. Hãy dùng Xuất bản lưu để lưu trên máy.');
      const data=new FormData();data.set('file',blob,'backup.zip');data.set('revision',meta?.revision||'');
      const saved=await(await request('',{method:'POST',body:data})).json();remember(saved.revision);await refresh();error.textContent='Đã lưu lên tài khoản.';
    });
    download.onclick=()=>run(async()=>{
      const revision=versions.value;const response=await request('/versions/'+encodeURIComponent(revision));
      if(response.headers.get('X-Save-Revision')!==revision) {await refresh();throw new Error('Bản lưu đã thay đổi. Kiểm tra thời gian mới và xác nhận lại.');}
      const bytes=await response.arrayBuffer();
      if(scope.value)await restoreGame(bytes,scope.value);else if(!await importData(new Int8Array(bytes)))throw new Error('Không thể khôi phục thư viện.');
      await reload();if(!scope.value)remember(revision);check.checked=false;error.textContent=scope.value?'Đã khôi phục tiến trình game đã chọn.':'Đã khôi phục thư viện và tiến trình.';
    });
    try{await refresh();}catch(e){error.textContent=e.message+' Đóng và mở lại cửa sổ để thử lại.';update();}
  };
}
