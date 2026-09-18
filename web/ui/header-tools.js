import {confirmAction} from './dialogs.js';
const paths={backup:'<path d="M7 18H5a4 4 0 0 1-.5-8 7 7 0 0 1 13-2 5 5 0 0 1 .5 10h-1M12 21V11m-4 4 4-4 4 4"/>',notifications:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',collections:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2h10M3 10h18M8 14h8m-8 3h5"/>',profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'};
export function headerIcon(control,kind,label,count=0){
 control.className='header-tool';control.title=label;control.setAttribute('aria-label',count?`${label}: ${count} chưa đọc`:label);
 control.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>${count?`<span class="header-tool-badge" aria-hidden="true">${count>99?'99+':count}</span>`:''}`;
}
export function moveHeaderTools(root){
 const toolbar=root.querySelector('[data-personal-tools]'),account=document.querySelector('#account');if(!toolbar||!account)return;
 const controls=[...toolbar.children];
 controls.forEach((c,i)=>{if(i!==1)headerIcon(c,['backup','notifications','collections','profile'][i],['Bản lưu tài khoản','Thông báo','Bộ sưu tập','Hồ sơ của tôi'][i]);account.insertBefore(c,account.querySelector('.account-account'));});toolbar.remove();
}

// Header controls are created synchronously, independently of page data requests.
export function setupHeaderTools(account,user){
 if(!user||account.querySelector('[data-header-tools]'))return;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const request=async(path,body)=>{const res=await fetch('/api'+path,body?{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'JavaCommunity'},body:JSON.stringify(body)}:{});const data=await res.json();if(!res.ok)throw Error(data.error||'Không tải được dữ liệu. Hãy thử lại.');return data;};
 const show=(title)=>{const d=document.createElement('dialog');d.className='header-dialog';d.setAttribute('aria-label',title);d.innerHTML=`<button type="button" class="header-dialog-close" aria-label="Đóng">×</button><h2>${esc(title)}</h2><div class="header-dialog-body" aria-live="polite"></div>`;d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);d.showModal();return d.querySelector('.header-dialog-body');};
 const add=(kind,label,href,action)=>{const c=document.createElement(href?'a':'button');if(href)c.href=href;else c.type='button';c.dataset.headerTools=kind;headerIcon(c,kind,label);if(action)c.onclick=action;account.insertBefore(c,account.querySelector('.account-account'));return c;};
 add('backup','Bản lưu tài khoản','/library',e=>{const b=document.querySelector('.cloud-save-trigger');if(b){e.preventDefault();b.click();}});
 const bell=add('notifications','Thông báo',null,()=>{
  const body=show('Thông báo');
  const load=async()=>{body.textContent='Đang tải…';try{
   const items=await request('/notifications');
   body.innerHTML='<label>Tìm thông báo<input type="search" placeholder="Tên hoặc chủ đề"></label><label><input type="checkbox"> Chỉ chưa đọc</label><button type="button" data-read>Đánh dấu tất cả đã đọc</button><p role="status"></p><div data-items></div>';
   const search=body.querySelector('[type=search]'),unread=body.querySelector('[type=checkbox]'),list=body.querySelector('[data-items]'),status=body.querySelector('[role=status]');
   const render=()=>{list.replaceChildren();const term=search.value.toLocaleLowerCase('vi');const shown=items.filter(n=>(!unread.checked||!n.is_read)&&(n.author+' '+n.title).toLocaleLowerCase('vi').includes(term));
    for(const n of shown){const a=document.createElement('a');a.className='header-list-item '+(n.is_read?'':'unread');a.href='/post/'+encodeURIComponent(n.post_id);a.textContent=(n.is_read?'':'● ')+n.author+' đã bình luận trong '+n.title;
     a.onclick=async e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();try{await request('/notifications/read',{ids:[n.id]});location.href=a.href;}catch(error){status.textContent=error.message;}};list.append(a);}
    status.textContent=shown.length?shown.length+' thông báo':'Không có thông báo phù hợp.';headerIcon(bell,'notifications','Thông báo',items.filter(n=>!n.is_read).length);
   };
   search.oninput=render;unread.onchange=render;
   body.querySelector('[data-read]').onclick=async e=>{e.target.disabled=true;try{await request('/notifications/read',{ids:items.filter(n=>!n.is_read).map(n=>n.id)});items.forEach(n=>n.is_read=true);render();}catch(error){status.textContent=error.message;}finally{e.target.disabled=false;}};render();
  }catch(e){body.textContent=e.message;const retry=document.createElement('button');retry.textContent='Thử lại';retry.onclick=load;body.append(retry);}};load();
 });
 add('collections','Bộ sưu tập',null,()=>{
  const body=show('Bộ sưu tập của bạn');
  const load=async()=>{body.textContent='Đang tải…';try{const items=await request('/collections');body.innerHTML=items.map(c=>`<a class="header-list-item" href="/games?collection=${encodeURIComponent(c.id)}">${esc(c.title)} · ${c.public?'Công khai':'Riêng tư'}</a>`).join('')||'<p>Chưa có bộ sưu tập.</p>';const create=document.createElement('button');create.textContent='Tạo bộ sưu tập';create.onclick=()=>{body.innerHTML='<form><label>Tên<input name="title" required maxlength="100"></label><label>Giới thiệu<textarea name="description" maxlength="1000"></textarea></label><label><input type="checkbox" name="public"> Công khai để chia sẻ</label><p role="alert"></p><button>Lưu</button></form>';const f=body.querySelector('form');f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{await request('/collections',{title:f.elements.title.value,description:f.elements.description.value,public:f.elements.public.checked});await load();}catch(e){f.querySelector('[role=alert]').textContent=e.message;}finally{b.disabled=false;}};};body.append(create);}catch(e){body.textContent=e.message;const retry=document.createElement('button');retry.textContent='Thử lại';retry.onclick=load;body.append(retry);}};load();
 });
 const accountControl=account.querySelector('.account-account');
 if(accountControl){
  accountControl.removeAttribute('data-action');
  accountControl.setAttribute('aria-label','Tài khoản của '+user.name);
  accountControl.onclick=e=>{e.preventDefault();e.stopPropagation();openAccount(user);};
 }
 request('/notifications').then(items=>{if(bell.isConnected)headerIcon(bell,'notifications','Thông báo',items.filter(n=>!n.is_read).length);}).catch(()=>{});
}

export function openAccount(user){
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const request=async(path,options={})=>{const res=await fetch('/api'+path,{...options,headers:{'X-Requested-With':'JavaCommunity',...options.headers}});const data=await res.json();if(!res.ok)throw Error(data.error||'Không thực hiện được yêu cầu.');return data;};
 const dialog=document.createElement('dialog');dialog.className='header-dialog account-dialog';dialog.setAttribute('aria-label','Tài khoản của bạn');
 dialog.innerHTML='<button type="button" class="header-dialog-close" aria-label="Đóng">×</button><h2>Tài khoản của bạn</h2><div class="account-tabs" role="tablist" aria-label="Cài đặt tài khoản"></div><div class="account-panel" role="tabpanel"></div>';
 const panel=dialog.querySelector('.account-panel'),tabs=dialog.querySelector('.account-tabs');let generation=0;let dirty=false,previewURL=null;const discard=async()=>!dirty||await confirmAction('Bạn có thay đổi chưa lưu. Bỏ các thay đổi này?');const unload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);dialog.addEventListener('cancel',async e=>{e.preventDefault();if(await discard())dialog.close();});
 const render=async(index)=>{if(!await discard())return;dirty=false;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}const token=++generation;tabs.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});panel.setAttribute('aria-labelledby','account-tab-'+index);panel.textContent='Đang tải…';
  try{
   if(index===2){panel.innerHTML='<form><label>Mật khẩu hiện tại<input name="current" type="password" required autocomplete="current-password" maxlength="128"></label><label>Mật khẩu mới<input name="password" type="password" required autocomplete="new-password" minlength="10" maxlength="128"></label><label>Nhập lại mật khẩu mới<input name="repeat" type="password" required autocomplete="new-password" minlength="10" maxlength="128"></label><label class="account-check"><input type="checkbox" data-show-password> Hiện mật khẩu</label><small>Tối thiểu 10 ký tự. Đổi mật khẩu sẽ đăng xuất các phiên khác.</small><p role="status"></p><button>Lưu mật khẩu</button></form>';panel.querySelector('[data-show-password]').onchange=e=>panel.querySelectorAll('input[name]').forEach(el=>el.type=e.target.checked?'text':'password');}
   else {const p=await request('/profiles/'+encodeURIComponent(user.id));if(token!==generation)return;
    if(index===0){panel.innerHTML=`${p.avatar?.url?`<img class="account-avatar" src="${esc(p.avatar.url)}" alt="Ảnh đại diện">`:''}<h3>${esc(p.name)}</h3><p class="account-bio">${esc(p.bio||'Chưa có giới thiệu.')}</p><p>${p.profile_public?'Hồ sơ công khai':'Hồ sơ riêng tư'}</p><a href="/forum?profile=${encodeURIComponent(user.id)}">Xem trang cá nhân và bài viết</a>`;return;}
    panel.innerHTML=`<form><label>Tên hiển thị<input name="name" required minlength="2" maxlength="40" value="${esc(p.name)}"></label><label>Giới thiệu<textarea name="bio" maxlength="1000">${esc(p.bio)}</textarea></label><label>Ảnh đại diện (tối đa 8 MB)<input name="avatar" type="file" accept="image/jpeg,image/png,image/gif,image/webp"></label><label class="account-check"><input name="remove_avatar" type="checkbox" value="true"> Bỏ ảnh đại diện hiện tại</label><label class="account-check"><input name="profile_public" type="checkbox" value="true" ${p.profile_public?'checked':''}> Công khai trang cá nhân</label><p role="status"></p><button>Lưu hồ sơ</button></form>`;
   }
   const f=panel.querySelector('form');f.oninput=()=>{dirty=true;};const avatar=f.querySelector('input[name=avatar]');if(avatar){const preview=document.createElement('img');preview.className='account-avatar';preview.alt='Xem trước ảnh đại diện';preview.hidden=true;avatar.after(preview);avatar.onchange=()=>{dirty=true;if(previewURL)URL.revokeObjectURL(previewURL);const file=avatar.files[0];if(file&&file.size>8*1048576){f.querySelector('[role=status]').textContent='Ảnh tối đa 8 MB.';avatar.value='';preview.hidden=true;return;}preview.hidden=!file;if(file){previewURL=URL.createObjectURL(file);preview.src=previewURL;}};}f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button'),status=f.querySelector('[role=status]');b.disabled=true;status.textContent='Đang lưu…';try{const data=new FormData(f);if(index===2){if(data.get('password')!==data.get('repeat'))throw Error('Mật khẩu nhập lại chưa khớp.');await request('/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current:data.get('current'),password:data.get('password')})});dirty=false;f.reset();f.querySelectorAll('input[name]').forEach(el=>el.type='password');status.textContent='Đã đổi mật khẩu.';}else{if(!data.get('avatar')?.size)data.delete('avatar');await request('/profile',{method:'PATCH',body:data});dirty=false;user.name=data.get('name');const label=document.querySelector('#account .account-account .account-label');if(label)label.textContent=user.name;status.textContent='Đã lưu hồ sơ.';}}catch(error){status.textContent=error.message;}finally{b.disabled=false;}};
  }catch(error){if(token!==generation)return;panel.textContent=error.message;const retry=document.createElement('button');retry.textContent='Thử lại';retry.onclick=()=>render(index);panel.append(retry);}
 };
 ['Trang cá nhân','Chỉnh sửa hồ sơ','Đổi mật khẩu'].forEach((label,i)=>{const b=document.createElement('button');b.type='button';b.id='account-tab-'+i;b.setAttribute('role','tab');b.textContent=label;b.onclick=()=>render(i);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;tabs.children[next].focus();render(next);};tabs.append(b);});
 dialog.querySelector('.header-dialog-close').onclick=async()=>{if(await discard())dialog.close();};dialog.onclose=()=>{generation++;window.removeEventListener('beforeunload',unload);if(previewURL)URL.revokeObjectURL(previewURL);dialog.remove();};document.body.append(dialog);dialog.showModal();render(0);
}
