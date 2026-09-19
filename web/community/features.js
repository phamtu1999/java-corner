import {setupArchiveTools} from './archive-tools.js';
import {setupPreservation} from './preservation.js?v=20260919-archive';
import {setupBootTests} from './boot-tests.js';
export async function enhanceFeatures({root,r,user,api,esc,openModal,notify,refresh,categories}) {
  setupArchiveTools({root,r,user,api,esc,openModal,notify,refresh});
  await setupPreservation({root,r,user,api,esc,openModal,notify,refresh});
  await setupBootTests({root,r,user,api,esc,openModal,notify});
  const control=(label,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn(b);}catch(e){notify(e.message,'error');}finally{b.disabled=false;}};return b;};
  const panel=(title)=>{const el=document.createElement('section');el.className='panel feature-panel';el.innerHTML=`<h2>${esc(title)}</h2>`;return el;};
  const formModal=(title,fields,save)=>{
    openModal(`<h2 id="modal-title">${esc(title)}</h2><form class="stack feature-form">${fields}<p class="form-error" role="alert"></p><button class="primary">Lưu</button></form>`);
    const form=document.querySelector('.feature-form');form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await save(Object.fromEntries(new FormData(form)));document.querySelector('#modal').close();notify('Đã lưu.');await refresh();}catch(error){form.querySelector('.form-error').textContent=error.message;}finally{b.disabled=false;}};
  };
  if(r.view==='game'){
    const [g,social]=await Promise.all([api(`/games/${r.id}`),api(`/games/${r.id}/social`)]);
    const tools=document.createElement('div');tools.className='feature-toolbar';
    if(user) tools.append(control(social.favorite?'♥ Đã yêu thích':'♡ Yêu thích',async b=>{await api(`/games/${r.id}/favorite`,{method:'POST',body:{enabled:!social.favorite}});social.favorite=!social.favorite;b.textContent=social.favorite?'♥ Đã yêu thích':'♡ Yêu thích';b.setAttribute('aria-pressed',String(social.favorite));}));
    tools.querySelector('button')?.setAttribute('aria-pressed',String(social.favorite));root.querySelector('.game-detail-hero').after(tools);
    root.querySelector('.game-detail-rating').textContent=social.count ? `★ ${Number(social.average).toFixed(1)} / 5 · ${social.count} đánh giá` : 'Chưa có đánh giá';
    root.querySelectorAll('#versions .game-card').forEach((row,i)=>{
      if(user) row.querySelector('.card-bottom').append(control('⚑ Báo lỗi',()=>formModal('Báo lỗi phiên bản',`<p>${esc(g.variants[i].filename)}</p><label>Mô tả lỗi<textarea name="body" required minlength="5" maxlength="2000" placeholder="Ví dụ: màn hình đen sau khi mở game"></textarea></label>`,body=>api(`/games/${g.variants[i].id}/report`,{method:'POST',body})),'small'));
    });
    if(user){
      const progress=await api(`/games/${r.id}/progress`);
      const completion=control(progress.completed_at?'Bỏ xác nhận hoàn thành':'Tôi đã hoàn thành',async b=>{
        const completed=!progress.completed_at;
        await api(`/games/${r.id}/completion`,{method:'PUT',body:{completed}});
        progress.completed_at=completed?true:null;
        b.textContent=completed?'Bỏ xác nhận hoàn thành':'Tôi đã hoàn thành';
        b.setAttribute('aria-pressed',String(completed));
      });
      completion.title='Người chơi tự xác nhận, không phải thành tích được game chứng thực';
      completion.setAttribute('aria-pressed',String(!!progress.completed_at));
      tools.append(completion);
      const note=document.createElement('span');note.className='muted';note.textContent=`${Math.floor(progress.play_seconds/60)} phút chơi · Hoàn thành do bạn tự xác nhận`;tools.append(note);
    }
    if(g.visibility==='public'){
      const section=panel(`Đánh giá · ${social.count?Number(social.average).toFixed(1)+' / 5 ('+social.count+')':'Chưa có đánh giá'}`);
      if(user) section.append(control('☆ Viết / sửa đánh giá',()=>{
        const own=social.reviews.find(x=>x.user_id===user.id);
        formModal('Đánh giá game',`<label>Phiên bản đã chơi<select name="game_id">${g.variants.map(v=>`<option value="${esc(v.id)}" ${v.id===(own?.game_id||g.last_played_id)?'selected':''}>${esc(v.filename)}</option>`).join('')}</select></label><label>Điểm<select name="rating">${[5,4,3,2,1].map(n=>`<option ${n===own?.rating?'selected':''}>${n}</option>`).join('')}</select></label><label>Nhận xét<textarea name="body" maxlength="1500">${esc(own?.body)}</textarea></label><p class="hint">Mỗi tài khoản có một đánh giá cho game. Cần chơi phiên bản được chọn trước khi đánh giá.</p>`,body=>api(`/games/${body.game_id}/review`,{method:'POST',body}));
      }));
      section.insertAdjacentHTML('beforeend',social.reviews.map(v=>`<article class="review"><strong>${esc(v.author)} · ${v.rating}/5 ★</strong><small>${esc(v.filename)}</small><p>${esc(v.body)}</p></article>`).join(''));root.querySelector('#versions').after(section);
    }
  }
  if(r.view==='admin'&&user?.role==='admin'){
    const toolbar=document.createElement('div');toolbar.className='feature-toolbar';root.querySelector('.admin-tabs').after(toolbar);
    toolbar.append(control('⚑ Báo lỗi game',async()=>{
      const reports=await api('/reports');openModal(`<h2 id="modal-title">Báo lỗi phiên bản</h2><div class="reports-list">${reports.map(v=>`<article class="review"><strong>${esc(v.title)}</strong><small>${esc(v.filename)} · ${esc(v.author)}</small><p>${esc(v.body)}</p>${v.replay?`<button type="button" data-replay="${esc(v.id)}">Tải replay JSON</button>`:''}<button type="button" data-report="${esc(v.id)}" data-resolved="${v.resolved}">${v.resolved?'Mở lại':'Đánh dấu đã xử lý'}</button></article>`).join('')||'<p>Chưa có báo lỗi.</p>'}</div>`);
      document.querySelectorAll('[data-replay]').forEach(b=>b.onclick=()=>{const value=reports.find(r=>r.id===b.dataset.replay)?.replay;if(!value)return;const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='java-corner-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
      document.querySelectorAll('[data-report]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const resolved=b.dataset.resolved!=='true';await api(`/reports/${b.dataset.report}`,{method:'PATCH',body:{resolved}});b.dataset.resolved=String(resolved);b.textContent=resolved?'Mở lại':'Đánh dấu đã xử lý';}catch(e){notify(e.message,'error');}finally{b.disabled=false;}});
    }));
    if(!root.querySelector('.admin-catalog')) return;
    const query=new URLSearchParams(r.query);query.set('include_hidden',query.get('include_hidden')==='1'?'0':'1');
    toolbar.insertAdjacentHTML('beforeend',`<a class="button" href="/admin?${esc(query.toString())}">${r.query.get('include_hidden')==='1'?'Chỉ game đang hiện':'Hiện cả game đã ẩn'}</a>`);
    if(r.query.get('include_hidden')==='1'){const input=document.createElement('input');input.type='hidden';input.name='include_hidden';input.value='1';root.querySelector('.admin-filters').append(input);}
    if(r.query.get('include_hidden')==='1'){
      const data=await api(`/games?${r.query}`);
      for(const g of data.items.filter(g=>g.hidden)){
        const info=[...root.querySelectorAll('.admin-game-info')].find(el=>el.querySelector('a').pathname==='/game/'+g.id);
        if(info) info.insertAdjacentHTML('beforeend','<small class="danger">Đang ẩn khỏi kho công khai</small>');
      }
    }
    const boxes=[];root.querySelectorAll('.admin-game').forEach(row=>{const a=row.querySelector('.admin-game-info>a');const box=document.createElement('input');box.type='checkbox';box.value=a.pathname.split('/').pop();box.setAttribute('aria-label',`Chọn ${a.textContent}`);row.prepend(box);row.classList.add('bulk-row');boxes.push(box);});
    const selection=document.createElement('span');selection.textContent='Chưa chọn game';toolbar.append(selection);
    const update=()=>selection.textContent=`Đã chọn ${boxes.filter(b=>b.checked).length} game`;
    boxes.forEach(b=>b.onchange=update);toolbar.append(control('Chọn cả trang',()=>{const checked=boxes.some(b=>!b.checked);boxes.forEach(b=>b.checked=checked);update();}));
    toolbar.append(control('Chỉnh sửa đã chọn',()=>{
      const ids=boxes.filter(b=>b.checked).map(b=>b.value);if(!ids.length) throw new Error('Hãy chọn game trước.');
      const names=boxes.filter(b=>b.checked).map(b=>b.getAttribute('aria-label').slice(5));
      formModal('Chỉnh sửa hàng loạt',`<p>Áp dụng cho toàn bộ phiên bản của ${ids.length} game:</p><ul class="bulk-selection">${names.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><label>Thao tác<select name="action"><option value="category">Đổi thể loại</option><option value="publisher">Đổi hãng phát hành</option><option value="group">Gộp thành một game</option><option value="hide">Ẩn khỏi kho công khai</option><option value="show">Hiện lại</option></select></label><label data-bulk-field="category">Thể loại<select name="category_id">${categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label data-bulk-field="group" hidden>Tên game chung<input name="family_title" maxlength="100"></label><label data-bulk-field="publisher" hidden>Hãng phát hành<input name="publisher" maxlength="100"></label><p class="hint">Gộp nhóm sẽ giữ nguyên tệp game; các phiên bản xuất hiện chung trong trang chi tiết.</p>`,body=>api('/admin/bulk',{method:'POST',body:{...body,ids}}));
      document.querySelector('.feature-form [name=action]').onchange=e=>document.querySelectorAll('[data-bulk-field]').forEach(el=>el.hidden=el.dataset.bulkField!==e.target.value);
    }));
  }
}
