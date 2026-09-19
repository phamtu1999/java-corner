import {setupCompatibility} from './compatibility.js';
export async function enhanceExtras({root,r,user,api,esc,openModal,notify,refresh}){
 root.classList.toggle('community-detail',r.view==='post'||r.query.has('profile'));
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){notify(e.message,'error');}finally{b.disabled=false;}};return b;};
 const form=(title,fields,save,multipart=false)=>{
  openModal(`<h2 id="modal-title">${esc(title)}</h2><form class="stack extras-form">${fields}<p class="form-error" role="alert"></p><button class="primary">Lưu</button></form>`);
  const f=document.querySelector('.extras-form');f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{await save(multipart?new FormData(f):Object.fromEntries(new FormData(f)));document.querySelector('#modal').close();await refresh();notify('Đã lưu.');}catch(e){f.querySelector('.form-error').textContent=e.message;}finally{b.disabled=false;}};
 };
 const collectionForm=c=>form(c?'Sửa bộ sưu tập':'Tạo bộ sưu tập',`<label>Tên<input name="title" required maxlength="100" value="${esc(c?.title)}"></label><label>Giới thiệu<textarea name="description" maxlength="1000">${esc(c?.description)}</textarea></label><label><input type="checkbox" name="public" value="true" ${c?.public?'checked':''}> Công khai để chia sẻ</label>`,data=>api('/collections'+(c?'/'+c.id:''),{method:c?'PATCH':'POST',body:{...data,public:data.public==='true'}}));
 if(r.query.has('collection')){
  const c=await api('/collections/'+encodeURIComponent(r.query.get('collection')));
  const section=document.createElement('section');section.className='panel';section.innerHTML=`<h1>${esc(c.title)}</h1><p>${esc(c.description)}</p><p>${c.public?'Bộ sưu tập công khai':'Chỉ bạn xem được bộ sưu tập này'}</p><div class="collection-games">${c.games.map(g=>`<article class="game-card"><a href="/game/${esc(g.id)}">${esc(g.title)}</a>${user?.id===c.user_id?`<button type="button" data-remove-collection-game="${esc(g.id)}">Bỏ khỏi bộ sưu tập</button>`:''}</article>`).join('')||'<p>Vào chi tiết game để thêm vào bộ sưu tập.</p>'}</div>`;
  root.replaceChildren(section);
  if(c.public)section.append(button('Sao chép liên kết',async()=>{await navigator.clipboard.writeText(location.origin+'/games?collection='+c.id);notify('Đã sao chép liên kết.');}));
  if(user?.id===c.user_id){section.append(button('Sửa bộ sưu tập',()=>collectionForm(c)));section.querySelectorAll('[data-remove-collection-game]').forEach(b=>b.onclick=async()=>{try{await api(`/collections/${c.id}/games/${b.dataset.removeCollectionGame}`,{method:'DELETE'});await refresh();}catch(e){notify(e.message,'error');}});}
  return;
 }
 if(r.query.has('profile')){
  const p=await api('/profiles/'+encodeURIComponent(r.query.get('profile'))),section=document.createElement('section');section.className='panel profile-panel';
  section.innerHTML=`<nav class="profile-back" aria-label="Điều hướng"><a href="/forum">← Về diễn đàn</a></nav><header class="profile-intro">${p.avatar?`<img class="profile-avatar" src="${esc(p.avatar.url)}" alt="Ảnh đại diện ${esc(p.name)}">`:`<span class="profile-avatar profile-initial" aria-hidden="true">${esc(p.name.slice(0,1).toUpperCase())}</span>`}<div><span class="muted">Thành viên Java Corner</span><h1>${esc(p.name)}</h1><p class="prose">${esc(p.private?'Thành viên chưa công khai hồ sơ.':p.bio||'Chưa có lời giới thiệu.')}</p>${p.private?'':`<p class="profile-stats">${p.posts.length} bài viết · ${p.collections.length} bộ sưu tập công khai</p>`}</div><div class="profile-edit"></div></header>${p.private?'':`<div class="profile-sections"><section><h2>Bài viết <span>${p.posts.length}</span></h2>${p.posts.map(x=>`<a class="notification" href="/post/${esc(x.id)}">${esc(x.title)}<span aria-hidden="true">→</span></a>`).join('')||'<p class="profile-empty">Chưa có bài viết để hiển thị.</p>'}</section><section><h2>Bộ sưu tập công khai <span>${p.collections.length}</span></h2>${p.collections.map(c=>`<a class="notification" href="/games?collection=${esc(c.id)}">${esc(c.title)}<span aria-hidden="true">→</span></a>`).join('')||'<p class="profile-empty">Các bộ sưu tập được chia sẻ sẽ xuất hiện ở đây.</p>'}</section></div>`}`;
  root.replaceChildren(section);
  if(user?.id===p.id)section.querySelector('.profile-edit').append(button('Chỉnh sửa hồ sơ',()=>form('Hồ sơ thành viên',`<label>Tên hiển thị<input name="name" required minlength="2" maxlength="40" value="${esc(p.name)}"></label><label>Giới thiệu<textarea name="bio" maxlength="1000">${esc(p.bio)}</textarea></label><label>Avatar (tối đa 8 MB)<input type="file" name="avatar" accept="image/jpeg,image/png,image/gif,image/webp"></label><label><input type="checkbox" name="remove_avatar" value="true"> Bỏ avatar hiện tại</label><label><input type="checkbox" name="profile_public" value="true" ${p.profile_public?'checked':''}> Công khai hồ sơ</label>`,async data=>{if(!data.get('avatar')?.size)data.delete('avatar');await api('/profile',{method:'PATCH',body:data});location.reload();},true)));
  return;
 }
 if(r.view==='game'){
  const controls=root.querySelector('.feature-toolbar');
  if(user)controls.append(button('Thêm vào bộ sưu tập',async()=>{const all=await api('/collections');if(!all.length){collectionForm(null);return;}form('Thêm game vào bộ sưu tập',`<label>Bộ sưu tập<select name="collection">${all.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label>`,data=>api(`/collections/${data.collection}/games`,{method:'POST',body:{game_id:r.id}}));}));
  const section=document.createElement('section');section.className='panel feature-panel';section.innerHTML='<h2>Gợi ý phiên bản</h2><label>Màn hình mong muốn<select aria-label="Màn hình gợi ý"><option>128x160</option><option>176x220</option><option selected>240x320</option><option>320x240</option><option>240x400</option><option>360x640</option><option>480x800</option></select></label><p class="recommend-result" aria-live="polite"></p><p class="muted">Gợi ý theo kích thước và bản bạn xác nhận chơi tốt. Chưa xác định được hỗ trợ cảm ứng từ thông tin hiện có.</p>';
  const select=section.querySelector('select');try{select.value=localStorage.getItem('preferred-screen')||'240x320';if(!select.value)select.value='240x320';}catch{}
  const touchLabel=document.createElement('label');touchLabel.innerHTML='<span><input type="checkbox"> Ưu tiên bản hỗ trợ cảm ứng</span>';select.parentElement.after(touchLabel);const touch=touchLabel.querySelector('input');
  section.querySelector('.muted').textContent='Ưu tiên bản đã xác nhận chơi tốt, cảm ứng và màn hình. Thông tin cảm ứng do admin xác nhận; chưa rõ không có nghĩa là không hỗ trợ.';
  const update=async()=>{try{const [width,height]=select.value.split('x');const rec=await api(`/games/${r.id}/recommendation?width=${width}&height=${height}&touch=${touch.checked?'1':'0'}`);section.querySelector('.recommend-result').innerHTML=rec.id?`<a class="button primary" href="/library?game=${esc(rec.id)}">Chơi bản gợi ý</a> ${esc(rec.reason)}`:'Chưa có phiên bản khả dụng.';try{localStorage.setItem('preferred-screen',select.value);}catch{}}catch(e){notify(e.message,'error');}};
  touch.onchange=update;
  select.onchange=update;root.querySelector('#versions').before(section);await update();
  await setupCompatibility({root,game:await api(`/games/${r.id}`),user,api,notify,update});
 }
 if(r.view==='post'){
  const p=await api(`/posts/${r.id}`),composer=root.querySelector('.comment-composer');
  if(composer){
   const label=document.createElement('label');label.textContent='Nhắc thành viên trong chủ đề';
   const select=document.createElement('select');select.add(new Option('Chọn thành viên',''));
   const people=new Map([[p.user_id,p.author],...p.comments.map(c=>[c.user_id,c.author])]);
   for(const [id,name] of people)if(id!==user?.id)select.add(new Option(name,id));
   const mentions=new Set();const hidden=document.createElement('input');hidden.type='hidden';hidden.name='mentions';hidden.value='[]';
   select.onchange=()=>{if(!select.value)return;const input=composer.querySelector('textarea');try{for(const id of JSON.parse(hidden.value))mentions.add(id);}catch{}if(mentions.size>=10){notify('Tối đa 10 thành viên trong một bình luận.');return;}mentions.add(select.value);hidden.value=JSON.stringify([...mentions]);input.value+='@'+people.get(select.value)+' ';input.dispatchEvent(new Event('input',{bubbles:true}));select.value='';input.focus();};
   label.append(select);composer.querySelector('label').after(label,hidden);
  }
  root.querySelectorAll('.comments-panel .comment').forEach((row,i)=>{
   const c=p.comments[i],author=row.querySelector('.post-head strong');if(author)author.outerHTML=`<a href="/forum?profile=${esc(c.user_id)}"><strong>${esc(c.author)}</strong></a>`;
   if(c.reply_to)row.querySelector('.prose').insertAdjacentHTML('beforebegin',`<blockquote class="reply-quote">Trả lời ${esc(c.reply_author)}: ${esc(c.reply_body?.slice(0,160))}</blockquote>`);
   if(composer)row.querySelector('.comment-content').append(button('↩ Trả lời',()=>{
    composer.querySelector('.reply-context')?.remove();const context=document.createElement('div');context.className='reply-context';context.innerHTML=`Trả lời <strong>${esc(c.author)}</strong><input type="hidden" name="reply_to" value="${esc(c.id)}">`;context.append(button('Hủy trả lời',()=>context.remove()));composer.prepend(context);composer.querySelector('textarea').focus();composer.scrollIntoView({block:'center',behavior:'smooth'});
   }));
  });
 }
 if(r.view==='admin'&&user?.role==='admin'){
  const toolbar=root.querySelector('.admin-tabs')?.nextElementSibling;if(!toolbar)return;
  const audit=async page=>{const rows=await api('/admin/audit?page='+page);openModal(`<h2 id="modal-title">Lịch sử quản trị · Trang ${page}</h2>${rows.map(x=>`<details class="review"><summary>${esc(x.actor||'Hệ thống')} · ${esc(x.action)} · ${esc(x.after_data?.title||x.before_data?.title)} · ${new Date(x.created_at).toLocaleString('vi-VN')}</summary><strong>Trước</strong><pre>${esc(JSON.stringify(x.before_data,null,2))}</pre><strong>Sau</strong><pre>${esc(JSON.stringify(x.after_data,null,2))}</pre></details>`).join('')||'<p>Chưa có thay đổi.</p>'}`);const box=document.querySelector('#modal-body');for(const g of data.items.filter(g=>g.remote)){const check=button('Kiểm tra JAR: '+g.title,async()=>{check.disabled=true;try{const result=await api('/admin/games/'+g.id+'/verify-archive',{method:'POST'});check.textContent=g.title+': '+result.message;}catch(e){check.textContent=g.title+': '+e.message;}finally{check.disabled=false;}});box.append(check);}if(page>1)box.append(button('Trang trước',()=>audit(page-1)));if(rows.length===30)box.append(button('Trang sau',()=>audit(page+1)));};
  toolbar.append(button('Lịch sử quản trị',()=>audit(1)));
  const health=async page=>{const data=await api('/admin/health?page='+page);openModal(`<h2 id="modal-title">Kiểm tra kho game · Trang ${page}</h2><p>Mỗi lượt kiểm tra 20 phiên bản. Chỉ đọc dữ liệu, không xóa game.</p>${data.items.map(g=>`<article class="review"><a href="/game/${esc(g.id)}">${esc(g.title)}</a><small>${esc(g.filename)}</small><p>${esc(g.file)} · ${esc(g.archive||'')} · ${g.has_icon?'Có ảnh':'Thiếu ảnh'} · ${esc(g.screen||'Thiếu màn hình')}</p>${(g.duplicates||[]).map(d=>`<p>Trùng tệp: <a href="/game/${esc(d.id)}">${esc(d.title)}</a></p>`).join('')}</article>`).join('')}`);const box=document.querySelector('#modal-body');for(const g of data.items.filter(g=>g.remote)){const check=button('Kiểm tra JAR: '+g.title,async()=>{check.disabled=true;try{const result=await api('/admin/games/'+g.id+'/verify-archive',{method:'POST'});check.textContent=g.title+': '+result.message;}catch(e){check.textContent=g.title+': '+e.message;}finally{check.disabled=false;}});box.append(check);}if(page>1)box.append(button('Trang trước',()=>health(page-1)));if(data.hasMore)box.append(button('Kiểm tra 20 bản tiếp',()=>health(page+1)));};toolbar.append(button('Kiểm tra game lỗi',()=>health(1)));
 }
}
