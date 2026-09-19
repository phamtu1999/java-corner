import {advancedFilters,smartCollections,metadataEditor} from './catalog-tools.js';
import {setupJarInspector} from './jar-inspector.js?v=20260919-stock';
import {checkUpload} from '/ui/deployment.js';
import {setupDraft, clearDraft, setupTopicSearch} from './writing.js';
import { decorateAccount } from '../ui/site.js?v=20260918-1';
import {enhanceFeatures} from './features.js?v=20260919-progress';
import {enhanceExtras} from './extras.js?v=20260919-inspector-stock';
import {setupHeaderTools,openAccount} from '../ui/header-tools.js?v=20260917-6';
import {enhanceSafety} from './safety-features.js';
import {enhanceDiscovery} from './discovery-features.js';
const $ = s => document.querySelector(s);
const content = $('#content'), modal = $('#modal');
const state = { user: null, categories: [], request: 0, initialListing: null };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const date = value => new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN', { day:'numeric', month:'short', year:'numeric' });
const size = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
const play = id => `/library?game=${encodeURIComponent(id)}`;
const button = (action, text, id = '', css = '') => `<button type="button" data-action="${action}" data-id="${esc(id)}" class="${css}">${text}</button>`;
const empty = (title, text, extra = '') => `<div class="empty"><strong>${title}</strong>${text}${extra}</div>`;
const heading = (title, subtitle, actions = '') => `<div class="heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="actions">${actions}</div></div>`;
const categoryOptions = selected => `<option value="">Tất cả thể loại</option>${state.categories.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;
const referenceOptions = (items, field, selected, emptyLabel, label = value => value) => `<option value="">${emptyLabel}</option>${items.map(item => `<option value="${esc(item[field])}" ${item[field] === selected ? 'selected' : ''}>${esc(label(item[field]))}</option>`).join('')}`;
const iconPaths = {
  game: '<rect x="3" y="7" width="18" height="12" rx="4"/><path d="M7 10v6m-3-3h6m5-2h.01M18 15h.01M10 7V4h4"/>',
  chat: '<path d="M4 3h16v14H9l-5 4Z"/><path d="M8 8h8m-8 4h5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l3 2"/>',
  folder: '<path d="M3 5h7l2 3h9v12H3Z"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
  add: '<path d="M12 4v16M4 12h16"/>',
  edit: '<path d="m15 4 5 5M4 20l1-6L16 3l5 5L10 19Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  play: '<path d="m7 3 14 9-14 9Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7" cy="7" r="1"/>',
  send: '<path d="m2 3 20 9-20 9 4-9Zm4 9h16"/>',
  save: '<path d="M3 3h15l3 3v15H3Zm4 0v6h10V3M7 21v-8h10v8"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  retry: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>'
};
function addIcon(element, name) {
  if (!element || !iconPaths[name] || element.querySelector('.content-icon')) return;
  element.insertAdjacentHTML('afterbegin', `<svg class="content-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`);
}
function decorateContent(root, view = route().view) {
  const actions = {'edit-post':'edit','manage-versions':'game','delete-family':'trash','choose-game':'play',upload:'upload',publish:'add','new-post':'edit','edit-game':'edit','edit-category':'edit','delete-game':'trash','delete-category':'trash','delete-post':'trash','delete-comment':'trash',retry:'retry',login:'user',register:'user'};
  root.querySelectorAll('[data-action]').forEach(el => addIcon(el, actions[el.dataset.action]));
  const forms = {'edit-post':'save',filter:'search',category:'add','edit-category':'save',post:'send',comment:'send',upload:'upload','edit-game':'save',password:'lock',login:'user',register:'user'};
  root.querySelectorAll('form[data-form]').forEach(form => addIcon(form.querySelector('button:not([type="button"])'), forms[form.dataset.form]));
  addIcon(root.querySelector('.heading h1'), {games:'game',history:'history',mine:'folder',forum:'chat',admin:'shield',game:'game'}[view]);
  root.querySelectorAll('.card-bottom a, .heading a.button').forEach(el => addIcon(el, el.getAttribute('href').startsWith('/library?game=') ? 'play' : 'info'));
  root.querySelectorAll('.topic-title,.board-header>span:first-child').forEach(el => addIcon(el,'chat'));
  if (view === 'admin') {
    const titles = root.querySelectorAll('.panel>h2');addIcon(titles[0],'tag');addIcon(titles[1],'game');
  } else if (view === 'post') {
    addIcon(root.querySelector('.panel>h1'),'chat');addIcon(root.querySelector('.panel>h2'),'chat');
  } else if (view === 'game') {
    addIcon(root.querySelector('.panel>h2'),'info');addIcon(root.querySelector('.heading h2'),'chat');
  }
  if (root.id === 'modal-body') {
    const form = root.querySelector('form');addIcon(root.querySelector('#modal-title'), forms[form?.dataset.form]);
  }
}
function route() { const [path, query] = ((location.pathname.slice(1) || 'games') + location.search).split('?'); const [view, id] = path.split('/'); return { view, id, query: new URLSearchParams(query) }; }
function listingQuery(r) {
  const query = new URLSearchParams(r.query);
  query.set('scope', r.view === 'games' ? (r.query.get('favorite') === '1' ? 'favorites' : 'public') : r.view);
  return query;
}
async function loadListing(r, includeHistory = true) {
  const historyRequest = includeHistory && r.view === 'games' && state.user && !r.query.size
    ? api('/games?scope=history')
    : Promise.resolve({items:[]});
  const [categories, data, screens, publishers, recent] = await Promise.all([
    api('/categories'),
    api(`/games?${listingQuery(r)}`),
    api('/game-screens').catch(() => []),
    api('/publishers').catch(() => []),
    historyRequest.catch(() => ({items:[]}))
  ]);
  return {categories, data, screens, publishers, recent};
}
function continuePanel(items = []) {
  if (!items.length) return '';
  return `<section class="panel feature-panel"><h2>Tiếp tục chơi</h2><div class="continue-games">${items.slice(0,4).map(g => `<a class="button" href="/library?game=${encodeURIComponent(g.id)}">▶ ${esc(g.title)}</a>`).join('')}</div></section>`;
}
async function api(path, options = {}) {
  const headers = { 'X-Requested-With': 'JavaCommunity', ...options.headers };
  if (options.body && !(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(options.body); }
  await checkUpload(options.body);
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({ error: 'Máy chủ chưa sẵn sàng. Hãy chạy npm start với phiên bản mới.' }));
  if (!res.ok) { const error=new Error(data.error || 'Không thực hiện được yêu cầu.');error.duplicate=data.duplicate;throw error; }
  return data;
}
let noticeTimer;
function notify(message, type = 'success') {
  clearTimeout(noticeTimer);
  const notice = $('#notice');
  notice.className = 'notice notice-' + type;
  notice.setAttribute('role', type === 'error' ? 'alert' : 'status');
  notice.replaceChildren();
  const symbol = document.createElement('span'); symbol.className='notice-symbol'; symbol.textContent=type==='error'?'!':'✓'; symbol.setAttribute('aria-hidden','true');
  const text = document.createElement('span'); text.textContent=message;
  const close = document.createElement('button'); close.type='button'; close.textContent='×';close.setAttribute('aria-label','Đóng thông báo');close.onclick=()=>{clearTimeout(noticeTimer);notice.hidden=true;};
  notice.append(symbol,text,close);notice.hidden=false;
  noticeTimer=setTimeout(()=>notice.hidden=true,type==='error'?10000:5000);
}
function confirmDelete(message, title, recoverable = false) {
  return new Promise(resolve => {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className='confirmation-dialog';
    dialog.setAttribute('aria-labelledby','confirmation-title');dialog.setAttribute('aria-describedby','confirmation-message');
    dialog.innerHTML='<form method="dialog"><div class="confirmation-symbol" aria-hidden="true">!</div><h2 id="confirmation-title"></h2><p id="confirmation-message"></p><p class="confirmation-warning">Thao tác này không thể hoàn tác.</p><div class="confirmation-actions"><button value="cancel" autofocus>Hủy</button><button value="delete" class="confirm-danger">Xóa</button></div></form>';
    dialog.querySelector('h2').textContent=title;
    if(recoverable) dialog.querySelector('.confirmation-warning').textContent='Quản trị viên có thể khôi phục từ thùng rác.';
    dialog.querySelector('#confirmation-message').textContent=message;
    dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='delete';dialog.remove();previous?.focus();resolve(accepted);},{once:true});
    document.body.append(dialog);dialog.showModal();
  });
}
function account() {
  $('#account').innerHTML = state.user ? `${button('account', esc(state.user.name), '', 'quiet')}${button('logout', 'Đăng xuất', '', 'small')}` : `${button('login', 'Đăng nhập', '', 'quiet')}${button('register', 'Đăng ký', '', 'primary')}`;
  decorateAccount($('#account'));
  setupHeaderTools($('#account'),state.user);
  $('#admin-nav').hidden = state.user?.role !== 'admin';
}
function openModal(html) {
  $('#modal-body').innerHTML = html;
  $('#modal-body').querySelectorAll('input[type="password"]').forEach((input, index) => {
    const label = input.closest('label');
    const field = document.createElement('div');
    field.className = 'password-field';
    const row = document.createElement('div');
    row.className = 'password-input';
    input.id = `modal-password-${index}`;
    label.htmlFor = input.id;
    label.replaceWith(field);
    field.append(label, row);
    row.append(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-controls', input.id);
    const update = () => {
      const visible = input.type === 'text';
      const action = visible ? 'Ẩn' : 'Hiện';
      toggle.setAttribute('aria-label', `${action} ${label.textContent.trim().toLowerCase()}`);
      toggle.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '<path d="m3 3 18 18"/>' : ''}</svg><span>${action}</span>`;
    };
    toggle.onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; update(); };
    update();
    row.append(toggle);
  });
  decorateContent($('#modal-body'));
  if (!modal.open) modal.showModal();
}
$('#close-modal').onclick = () => modal.close();
modal.addEventListener('click', e => { if (e.target === modal && (e.clientX < modal.getBoundingClientRect().left || e.clientX > modal.getBoundingClientRect().right || e.clientY < modal.getBoundingClientRect().top || e.clientY > modal.getBoundingClientRect().bottom)) modal.close(); });
function auth(mode) {
  const register = mode === 'register';
  openModal(`<h2 id="modal-title">${register ? 'Tham gia Java Corner' : 'Chào mừng trở lại'}</h2><p class="modal-intro">Lưu danh sách đã chơi và cùng trò chuyện về game.</p><form data-form="${mode}" class="stack">
    ${register ? '<label>Tên hiển thị<input name="name" autocomplete="nickname" required minlength="2" maxlength="40"></label>' : ''}
    <label>Email<input type="email" name="email" autocomplete="email" required maxlength="254"></label>
    <label>Mật khẩu<input type="password" name="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="${register ? 10 : 1}" maxlength="128"></label>
    ${register ? '<p class="hint">Mật khẩu ít nhất 10 ký tự. Tài khoản mới có quyền thành viên.</p>' : ''}
    <p class="form-error" role="alert"></p><button class="primary">${register ? 'Tạo tài khoản' : 'Đăng nhập'}</button></form>
    <div class="auth-switch">${register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} ${button(register ? 'login' : 'register', register ? 'Đăng nhập' : 'Đăng ký', '', 'quiet')}</div>`);
}
function requireUser() { if (state.user) return true; auth('login'); return false; }
function pager(data, r) {
  if (data.pages <= 1) return '';
  const href = page => { const q = new URLSearchParams(r.query); q.set('page', page); return `/${r.view}${r.id ? '/' + r.id : ''}?${q}`; };
  const current = Number(data.page), total = Number(data.pages);
  const link = (page, label, disabled = false) => disabled
    ? `<span class="page-link is-disabled" aria-disabled="true">${label}</span>`
    : `<a class="page-link" href="${esc(href(page))}">${label}</a>`;
  const pages = [];
  for (let page = 1; page <= total; page++) {
    if (total <= 8 || page === 1 || page === total || Math.abs(page - current) <= 1) pages.push(page);
  }
  const numbers = pages.map((page, index) => {
    const gap = index && page - pages[index - 1] > 1 ? '<span class="page-gap" aria-hidden="true">…</span>' : '';
    return gap + (page === current
      ? `<span class="page-link is-current" aria-current="page" aria-label="Trang ${page}">${page}</span>`
      : `<a class="page-link" href="${esc(href(page))}" aria-label="Trang ${page}">${page}</a>`);
  }).join('');
  return `<nav class="pagination" aria-label="Phân trang">
    <div class="page-controls">${link(1, '« Trang đầu', current === 1)}${link(current - 1, '‹ Trước', current === 1)}</div>
    <div class="page-numbers">${numbers}</div>
    <div class="page-controls">${link(current + 1, 'Sau ›', current === total)}${link(total, 'Trang cuối »', current === total)}</div>
    <span class="page-summary">Trang ${current} / ${total}</span>
  </nav>`;
}
function gameThumbnail(g) {
  return `<span class="game-thumbnail">${g.has_icon ? `<img src="/api/games/${encodeURIComponent(g.id)}/icon" alt="" width="44" height="44" loading="lazy" decoding="async">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${iconPaths.game}</svg>`}</span>`;
}
function gameCards(items) {
  return `<div class="game-grid">${items.map(g => `<article class="game-card">${gameThumbnail(g)}<div class="game-main"><h3><a href="/game/${g.id}">${esc(g.title)}</a></h3><div class="card-meta"><span class="game-tag">${esc(g.category || 'Game cá nhân')}</span> · ${g.variant_count > 1 ? `${g.variant_count} phiên bản` : size(g.size)}${g.last_played ? ` · Đã chơi ${date(g.last_played)}` : ''}</div>${g.description ? `<p>${esc(g.description)}</p>` : ''}</div><div class="card-bottom">${g.last_played ? `<a class="button primary small" href="${play(g.id)}">Chơi tiếp</a>` : g.variant_count > 1 ? button('choose-game','Chơi game',g.id,'primary small') : `<a class="button primary small" href="${play(g.id)}">Chơi game</a>`}<a class="button small quiet" href="/game/${g.id}">Chi tiết</a></div></article>`).join('')}</div>`;
}
function postMedia(items = []) {
  if (!items.length) return '';
  return `<section class="post-gallery" aria-label="Ảnh và video bài viết" tabindex="0"><div class="gallery-stage">${items.map((m,i) => `<div class="gallery-slide" ${i ? 'hidden' : ''}>${m.type.startsWith('video/')
    ? `<video controls preload="none" playsinline src="${esc(m.url)}"></video>`
    : `<a href="${esc(m.url)}" target="_blank" rel="noopener" aria-label="Mở ảnh ${i+1} đầy đủ"><img src="${esc(m.url)}" alt="Ảnh ${i+1} trong bài viết" loading="lazy"></a>`}</div>`).join('')}</div>${items.length > 1 ? `<div class="gallery-controls"><button type="button" data-gallery-step="-1" aria-label="Ảnh hoặc video trước">←</button><span class="gallery-count" aria-live="polite">1 / ${items.length}</span><button type="button" data-gallery-step="1" aria-label="Ảnh hoặc video tiếp theo">→</button></div>` : ''}</section>`;
}
function stepGallery(gallery, direction) {
  const slides = [...gallery.querySelectorAll('.gallery-slide')];
  if (slides.length < 2) return;
  const index = slides.findIndex(slide => !slide.hidden);
  slides[index].querySelector('video')?.pause();
  slides[index].hidden = true;
  const next = (index + direction + slides.length) % slides.length;
  slides[next].hidden = false;
  gallery.querySelector('.gallery-count').textContent = `${next+1} / ${slides.length}`;
}
document.addEventListener('click', e => {
  const button = e.target.closest('[data-gallery-step]');
  if (button) stepGallery(button.closest('.post-gallery'), Number(button.dataset.galleryStep));
});
document.addEventListener('keydown', e => {
  const gallery = e.target.closest('.post-gallery');
  if (!gallery || e.target.closest('video') || !['ArrowLeft','ArrowRight'].includes(e.key)) return;
  e.preventDefault(); stepGallery(gallery, e.key === 'ArrowLeft' ? -1 : 1);
});
let previewUrls = [];
function clearMediaPreview() { previewUrls.forEach(url=>URL.revokeObjectURL(url)); previewUrls=[]; }
modal.addEventListener('close',clearMediaPreview);
document.addEventListener('change', e => {
  if (!e.target.matches('[data-post-media]')) return;
  clearMediaPreview();
  const files = [...e.target.files], box = document.querySelector('#media-preview');
  box.replaceChildren();
  if (files.length>4 || files.reduce((n,f)=>n+f.size,0)>40*1024*1024 || files.some(f=>f.size>(f.type.startsWith('image/')?8:20)*1024*1024)) {
    e.target.value=''; box.textContent='Chọn tối đa 4 tệp: ảnh 8 MB, video 20 MB; tổng tối đa 40 MB.'; return;
  }
  for (const file of files) {
    const url=URL.createObjectURL(file); previewUrls.push(url);
    const figure=document.createElement('figure');
    const media=document.createElement(file.type.startsWith('video/')?'video':'img');
    media.src=url; if (media.tagName==='VIDEO') {media.controls=true;media.preload='metadata';} else media.alt=file.name;
    const caption=document.createElement('figcaption');caption.textContent=file.name;
    figure.append(media,caption);box.append(figure);
  }
});
function topics(items) {
  if (!items.length) return empty('Chưa có bài viết', 'Chọn Viết bài để bắt đầu thảo luận.');
  return `<div class="board"><div class="board-header"><span>Chủ đề</span><span>Trả lời</span></div>${items.map(p => `<article class="topic"><div class="topic-main"><a class="topic-title" href="/post/${p.id}">${esc(p.title)}</a><div class="topic-meta">${esc(p.author)} · ${date(p.created_at)} · ${p.game_id ? `<a href="/game/${p.game_id}">${esc(p.game_title)}</a>` : 'Chuyện chung'}</div></div><div class="topic-count">${p.replies}<small>bình luận</small></div></article>`).join('')}</div>`;
}
async function render() {
  const request = ++state.request, r = route();
  if (['login','register','account'].includes(r.view)) {
    const action = r.view;
    history.replaceState(null, '', '/games');
    await render();
    if (action === 'account' && state.user) openAccount(state.user);
    else auth(action === 'register' ? 'register' : 'login');
    return;
  }
  account();
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === r.view || (r.view === 'game' && a.dataset.nav === 'games') || (r.view === 'post' && a.dataset.nav === 'forum')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const listing = ['games','history','mine'].includes(r.view) && (state.user || (r.view === 'games' && r.query.get('favorite') !== '1'));
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = listing && window.javaListingSkeleton
    ? window.javaListingSkeleton()
    : '<p class="muted" role="status">Đang tải…</p>';
  try {
    if (!listing) state.categories = await api('/categories');
    let html;
    if (['games','history','mine'].includes(r.view)) {
      const config = { games:['Kho game','Game công khai, phân loại theo thể loại.'], history:['Đã chơi','Chọn một game để quay lại. Tiến trình game vẫn lưu trên trình duyệt.'], mine:['Game của tôi','Kho riêng của bạn. Người khác không thể xem hoặc tải game tại đây.'] }[r.view];
      if ((r.view !== 'games' || r.query.get('favorite')==='1') && !state.user) html = heading(...config) + empty('Đăng nhập để mở thư viện', 'Danh sách game và lịch sử chơi được gắn với tài khoản của bạn.', button('login','Đăng nhập','','primary'));
      else {
        let listingData = state.initialListing;
        state.initialListing = null;
        if (!listingData) listingData = await loadListing(r);
        else if (state.user && !r.query.size) listingData.recent = await api('/games?scope=history').catch(() => ({items:[]}));
        const {categories, data, screens, publishers, recent} = listingData;
        state.categories = categories;
        const favorite = r.query.get('favorite') === '1';
        if (favorite) config[0] = 'Game yêu thích';
        const filters = `<form data-form="filter" class="filters"><input name="q" type="search" placeholder="Tìm tên game…" aria-label="Tìm game" value="${esc(r.query.get('q'))}"><select name="category" aria-label="Thể loại">${categoryOptions(r.query.get('category'))}</select><select name="screen" aria-label="Màn hình">${referenceOptions(screens,'screen',r.query.get('screen'),'Tất cả màn hình',value => value === 'unknown' ? 'Chưa rõ màn hình' : value)}</select><select name="publisher" aria-label="Hãng phát hành">${referenceOptions(publishers,'publisher',r.query.get('publisher'),'Tất cả hãng phát hành')}</select>${favorite ? '<input type="hidden" name="favorite" value="1">' : ''}<button>Tìm game</button>${advancedFilters(r.query,esc)}</form>`;
        html = heading(...config, button('upload','Tải game riêng','','primary')) + (r.view==='games'?smartCollections(esc,r.query.get('smart')):'') + continuePanel(recent.items) + filters + `<div class="section-label"><span>${data.total} game${r.view === 'mine' ? ' · Chỉ mình bạn' : ''}</span><a href="/library">Game trên máy</a></div>` + (data.items.length ? gameCards(data.items) : empty(['q','category','screen','publisher'].some(name => r.query.get(name)) ? 'Không tìm thấy game' : 'Chưa có game', r.view === 'games' ? 'Admin có thể thêm game theo thể loại. Bạn cũng có thể tải game riêng để chơi.' : r.view === 'history' ? 'Game sẽ xuất hiện ở đây sau khi mở màn hình chơi.' : 'Chọn game .jar từ máy, lưu vào kho riêng rồi chơi.')) + pager(data, r);
      }
    } else if (r.view === 'game') {
      const g = await api(`/games/${r.id}`), discussions = g.visibility === 'public' ? await api(`/posts?game=${g.id}&page=${r.query.get('page') || 1}`) : null;
      const canEdit = g.visibility === 'public' ? state.user?.role === 'admin' : state.user?.id === g.owner_id;
      const sharedPosts = discussions ? await Promise.all(discussions.items.slice(0,4).map(post=>api(`/posts/${post.id}`).catch(()=>null))) : [];
      const sharedMedia = sharedPosts.flatMap(post=>post?.media||[]);
      const screenshots = sharedMedia.filter(m=>m.type.startsWith('image/'));
      const videos = sharedMedia.filter(m=>m.type.startsWith('video/'));
      html = `<a class="breadcrumb" href="/${g.visibility === 'private' ? 'mine' : 'games'}">← Trở về thư viện</a><section class="game-detail-hero panel"><div class="game-detail-cover">${gameThumbnail(g)}</div><div class="game-detail-info"><p class="game-detail-publisher">${esc(g.publisher || 'Chưa rõ hãng phát hành')}</p><h1>${esc(g.family_title || g.title)}</h1><div class="game-detail-rating">Đang tải đánh giá…</div><div class="game-detail-tags"><span>${esc(g.screen && g.screen !== 'unknown' ? g.screen : 'Chưa rõ màn hình')}</span><span>${g.visibility === 'public' ? 'Công khai' : 'Riêng tư'}</span><span>Java ME</span></div><a class="button primary game-detail-play" href="${g.variants?.length > 1 ? '#versions' : play(g.id)}">${g.variants?.length > 1 ? 'CHỌN PHIÊN BẢN' : 'CHƠI NGAY'}</a></div></section><nav class="game-detail-tabs" aria-label="Nội dung game"><a href="#media">Ảnh màn hình</a><a href="#video">Video</a><a href="#description">Mô tả</a><a href="#versions">Phiên bản</a><a href="#guide">Hướng dẫn</a>${discussions ? '<a href="#comments">Bình luận</a>' : ''}<a href="#compatibility">Compatibility</a></nav><div class="detail-grid"><section class="panel" id="description"><h2>Mô tả</h2><div class="prose">${esc(g.description || 'Chưa có mô tả cho game này.')}</div>${canEdit ? `<div class="actions">${button('edit-game','Sửa thông tin',g.id,'small')}${button('delete-game','Xóa phiên bản',g.id,'small danger')}</div>` : ''}</section><aside class="panel" id="media"><h2>Ảnh màn hình từ cộng đồng</h2>${screenshots.length ? postMedia(screenshots) : '<p class="muted">Chưa có ảnh màn hình trong các bài thảo luận trên trang này.</p>'}</aside><section class="panel" id="video"><h2>Video từ cộng đồng</h2>${videos.length ? postMedia(videos) : '<p class="muted">Chưa có video trong các bài thảo luận trên trang này.</p>'}</section></div>`;
      html += `<section class="panel" id="versions"><h2>Phiên bản và màn hình (${g.variants.length})</h2><div class="game-grid">${g.variants.map(v => {
        const screen = (v.screen || v.filename).match(/(\d{2,4})[xX×](\d{2,4})/);
        return `<article class="game-card">${gameThumbnail(v)}<div class="game-main"><h3>${screen ? `${screen[1]} × ${screen[2]}` : esc(v.filename.replace(/\.jar$/i, ''))}</h3><div class="card-meta">${esc(v.filename)} · ${size(v.size)}</div></div><div class="card-bottom"><a class="button primary small" href="${play(v.id)}">Chơi ngay</a></div></article>`;
      }).join('')}</div></section>`;
      if (discussions) html += `<div id="comments" class="heading"><h2>Bình luận</h2>${button('new-post','Viết bài',g.id,'small')}</div>${topics(discussions.items)}${pager(discussions,r)}`;
      else html += '<p class="note">Game này chỉ có trong kho riêng của bạn và không xuất hiện trên diễn đàn.</p>';
    } else if (r.view === 'forum') {
      const data = await api(`/posts?${r.query}`);
      html = heading('Diễn đàn','Hướng dẫn, hỏi đáp và thảo luận về game Java.',button('new-post','Viết bài','','primary')) + `<form data-form="filter" class="filters"><input name="q" type="search" aria-label="Tìm bài viết" placeholder="Tìm trong các cuộc thảo luận…" value="${esc(r.query.get('q'))}"><label>Tác giả<input name="author" value="${esc(r.query.get('author'))}" maxlength="40" placeholder="Tên thành viên"></label><label>Sắp xếp<select name="sort"><option value="">Mới nhất</option><option value="oldest" ${r.query.get('sort')==='oldest'?'selected':''}>Cũ nhất</option><option value="replies" ${r.query.get('sort')==='replies'?'selected':''}>Nhiều trả lời</option></select></label><label><input type="checkbox" name="unanswered" value="1" ${r.query.get('unanswered')==='1'?'checked':''}> Chưa có trả lời</label>${state.user?`<label><input type="checkbox" name="mine" value="1" ${r.query.get('mine')==='1'?'checked':''}> Bài của tôi</label>`:''}<button>Tìm bài viết</button><a href="/forum">Xóa bộ lọc</a></form>${topics(data.items)}${pager(data,r)}`;
    } else if (r.view === 'post') {
      const p = await api(`/posts/${r.id}`);
      const canDelete = owner => state.user && (state.user.id === owner || state.user.role === 'admin');
      html = `<a class="breadcrumb" href="${p.game_id ? '/game/' + p.game_id : '/forum'}">← ${esc(p.game_title || 'Diễn đàn')}</a><article class="panel"><h1>${esc(p.title)}</h1><div class="post-head"><p class="muted">${esc(p.author)} · ${date(p.created_at)}</p>${canDelete(p.user_id) ? `<div class="actions">${button('edit-post','Sửa bài',p.id,'quiet small')}${button('delete-post','Xóa bài',p.id,'quiet small danger')}</div>` : ''}</div><div class="prose">${esc(p.body)}</div>${postMedia(p.media)}</article><section class="panel comments-panel"><h2>${p.comments.length} bình luận</h2>${p.comments.map(c => `<article class="comment"><span class="comment-avatar" aria-hidden="true">${esc(c.author.slice(0,1).toUpperCase())}</span><div class="comment-content"><div class="post-head"><span class="muted"><strong>${esc(c.author)}</strong> · ${date(c.created_at)}</span>${canDelete(c.user_id) ? button('delete-comment','Xóa',c.id,'quiet small danger') : ''}</div><div class="prose">${esc(c.body)}</div></div></article>`).join('') || '<p class="muted">Hãy là người đầu tiên trả lời.</p>'}</section>` + (state.user ? `<form data-form="comment" data-id="${p.id}" class="panel stack comment-composer"><label>Viết bình luận<textarea rows="3" name="body" required maxlength="3000" placeholder="Viết câu trả lời của bạn…"></textarea></label><p class="form-error" role="alert"></p><div class="comment-submit"><span class="muted">Tối đa 3.000 ký tự</span><button class="primary">Gửi bình luận</button></div></form>` : empty('Cùng tham gia thảo luận', 'Đăng nhập để trả lời chủ đề này.',button('login','Đăng nhập','','primary')));
    } else if (r.view === 'admin') {
      if (state.user?.role !== 'admin') html = empty('Khu vực quản trị', 'Chỉ tài khoản được cấp quyền admin mới có thể truy cập.');
      else {
        const query = new URLSearchParams(r.query); query.delete('tab'); query.delete('editions');
        const [data, screens] = await Promise.all([api(`/games?${query}`), api('/game-screens')]);
        const categoriesOpen = r.query.get('tab') === 'categories';
        const total = state.categories.reduce((n,c)=>n+Number(c.games),0);
        const tabs = `<nav class="admin-tabs" aria-label="Quản lý nội dung"><a href="/admin" ${!categoriesOpen ? 'aria-current="page"' : ''}>Game công khai <span>${total} phiên bản</span></a><a href="/admin?tab=categories" ${categoriesOpen ? 'aria-current="page"' : ''}>Thể loại <span>${state.categories.length}</span></a></nav>`;
        const screenOptions = `<option value="">Tất cả màn hình</option>${screens.map(item => `<option value="${esc(item.screen)}" ${r.query.get('screen') === item.screen ? 'selected' : ''}>${item.screen === 'unknown' ? 'Chưa có màn hình' : esc(item.screen)} (${item.editions})</option>`).join('')}`;
        const filters = `<form data-form="filter" class="filters admin-filters"><input name="q" type="search" aria-label="Tìm game" placeholder="Tìm tên game hoặc phiên bản…" value="${esc(r.query.get('q'))}"><select name="category" aria-label="Thể loại">${categoryOptions(r.query.get('category'))}</select><select name="screen" aria-label="Màn hình">${screenOptions}</select><button>Tìm game</button>${r.query.get('screen') || r.query.get('q') || r.query.get('category') ? '<a class="button" href="/admin">Bỏ lọc</a>' : ''}</form>`;
        const games = `<section class="admin-catalog">${filters}<div class="admin-results"><span>${data.total} game · ${data.editions} phiên bản${data.total ? ` · ${((data.page-1)*24)+1}–${Math.min(data.page*24,data.total)}` : ''}</span><span>Trang ${data.page} / ${Math.max(1,data.pages)}</span></div>${data.items.length ? `<div class="admin-game-list">${data.items.map(g => `<div class="admin-game">${gameThumbnail(g)}<span class="admin-game-info"><a href="/game/${g.id}">${esc(g.title)}</a><small><span class="game-tag">${esc(g.category || 'Chưa phân loại')}</span> · ${g.variant_count || 1} phiên bản</small></span><div class="admin-row-actions">${button('manage-versions','Quản lý phiên bản',g.id,'small')}${button('delete-family','Xóa toàn bộ game',g.id,'small danger')}</div></div>`).join('')}</div>` : empty('Không tìm thấy game','Thử tên khác hoặc bỏ lọc để xem toàn bộ kho game.')} ${pager(data,r)}</section>`;
        const categories = `<section class="panel admin-categories"><h2>Thể loại</h2><form data-form="category" class="inline"><label>Tên thể loại mới<input name="name" required minlength="2" maxlength="40" placeholder="Ví dụ: Nhập vai"></label><button>Thêm thể loại</button><p class="form-error" role="alert"></p></form><div class="category-list">${state.categories.map(c => `<div class="category-row"><span><a href="/admin?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a><small class="muted"> · ${c.games} game</small></span>${button('edit-category','Sửa',c.id,'small quiet')}${Number(c.games) ? '<span class="category-in-use" title="Chuyển game sang thể loại khác trước khi xóa">Đang dùng</span>' : button('delete-category','Xóa',c.id,'small quiet danger')}</div>`).join('') || '<p class="muted">Thêm thể loại đầu tiên trước khi đăng game.</p>'}</div><p class="hint muted">Chọn tên thể loại để xem game. Thể loại đang có game cần được chuyển hết game trước khi xóa.</p></section>`;
        html = heading('Quản trị','Tìm game để chỉnh sửa, hoặc mở mục Thể loại để sắp xếp kho game.',button('publish','Thêm game','','primary')) + tabs + (categoriesOpen ? categories : games);

      }
    } else html = empty('Trang không tồn tại','Quay lại kho game để tiếp tục.','<a class="button" href="/games">Kho game</a>');
    if (request === state.request) {
      content.innerHTML = html; decorateContent(content); content.removeAttribute('aria-busy');
      try {
        const context={root:content,r,user:state.user,api,esc,openModal,notify,refresh:render,categories:state.categories,confirmDelete};
        await enhanceFeatures(context);await enhanceExtras(context);await enhanceSafety(context);await enhanceDiscovery(context);
        if(r.view==='post'){setupTopicSearch(content);setupDraft(content.querySelector('.comment-composer'),state.user?.id);}
      }
      catch(error) { notify(error.message,'error'); }
    }
  } catch (error) { if (request === state.request) { content.innerHTML = `<div class="panel error-panel"><h2>Chưa tải được nội dung</h2><p>${esc(error.message)}</p>${button('retry','Thử lại')}</div>`; content.removeAttribute('aria-busy'); } }
}
function gameForm(game, publish = false) {
  const editing = !!game;
  openModal(`<h2 id="modal-title">${editing ? 'Sửa thông tin game' : publish ? 'Thêm game công khai' : 'Tải game riêng'}</h2><p class="modal-intro">${publish || game?.visibility === 'public' ? 'Game xuất hiện trong kho chung cho mọi người chơi.' : 'Chỉ tài khoản của bạn có thể xem và chơi game này.'}</p><form data-form="${editing ? 'edit-game' : 'upload'}" data-id="${game?.id || ''}" class="stack"><input type="hidden" name="visibility" value="${publish ? 'public' : 'private'}"><label>Tên game<input name="title" required maxlength="100" value="${esc(game?.title)}"></label><label>Thể loại<select name="category_id" aria-label="Thể loại" ${publish || game?.visibility === 'public' ? 'required' : ''}><option value="">${publish || game?.visibility === 'public' ? 'Chọn thể loại' : 'Không phân loại'}</option>${state.categories.map(c => `<option value="${c.id}" ${game?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${editing ? metadataEditor(game,esc) : ''}${editing ? `<label>Kích thước màn hình<input name="screen" placeholder="Ví dụ: 240x320" pattern="[0-9]{2,4}x[0-9]{2,4}" value="${esc(game.screen || '')}"></label>` : ''}<label>Mô tả<textarea name="description" maxlength="3000">${esc(game?.description)}</textarea></label>${!editing ? '<label>Game Java ME (.jar)<input type="file" name="file" accept=".jar" required></label><p class="hint">Tối đa 20 MB mỗi game. Tệp sẽ được lưu trên máy chủ theo chế độ hiển thị đã chọn. Kho cá nhân tối đa 200 MB.</p>' : ''}<p class="form-error" role="alert"></p><button class="primary">${editing ? 'Lưu thông tin' : publish ? 'Đăng game' : 'Lưu vào kho riêng'}</button></form>`);
  if(!editing&&state.user?.role==='admin')setupJarInspector(document.querySelector('[data-form="upload"]'),api,esc);
  if(editing){
    const label=document.createElement('label');label.textContent='Hỗ trợ cảm ứng';
    const select=document.createElement('select');select.name='touch_supported';select.innerHTML='<option value="">Chưa rõ</option><option value="true">Có</option><option value="false">Không</option>';select.value=game.touch_supported==null?'':String(game.touch_supported);label.append(select);document.querySelector('[data-form="edit-game"] [name="screen"]').parentElement.after(label);
  }
}
async function newPost(gameId) {
  if (!requireUser()) return;
  const game = gameId ? await api(`/games/${gameId}`) : null;
  openModal(`<h2 id="modal-title">Viết bài mới</h2><p class="modal-intro">${game ? 'Trong game: ' + esc(game.title) : 'Chuyện chung · Để viết về một game cụ thể, mở trang game và chọn Viết bài.'}</p><form data-form="post" class="stack"><input type="hidden" name="game_id" value="${gameId || ''}"><label>Tiêu đề<input name="title" required minlength="3" maxlength="150" placeholder="Bạn muốn chia sẻ điều gì?"></label><label>Nội dung<textarea name="body" required minlength="3" maxlength="10000" rows="7"></textarea></label><label>Ảnh / video<input type="file" name="media" data-post-media multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"></label><p class="hint">Tối đa 4 tệp. Ảnh: 8 MB; video: 20 MB; tổng: 40 MB. Chọn lại để thay tệp.</p><div id="media-preview" class="media-preview" aria-live="polite"></div><p class="form-error" role="alert"></p><button class="primary">Đăng bài viết</button></form>`);
  const topic=document.createElement('label');topic.textContent='Loại bài viết';
  const select=document.createElement('select');select.name='tag';select.innerHTML='<option value="share">Chia sẻ</option><option value="question">Hỏi đáp</option><option value="guide">Hướng dẫn</option>';topic.append(select);
  document.querySelector('[data-form="post"] input[name="title"]').closest('label').before(topic);
  setupDraft(document.querySelector('[data-form="post"]'),state.user.id);
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const { action, id } = el.dataset;
  try {
    if (action === 'login' || action === 'register') auth(action);
    else if (action === 'logout') { await api('/logout',{method:'POST'}); state.user=null; modal.close(); await render(); notify('Đã đăng xuất.'); }
    else if (action === 'choose-game') {
      el.disabled = true;
      try {
        const game = await api(`/games/${encodeURIComponent(id)}`);
        if(game.last_played_id&&game.variants.some(v=>v.id===game.last_played_id)){location.href=play(game.last_played_id);return;}
        if (game.variants.length === 1) { location.href = play(game.variants[0].id); return; }
        const variants = [...game.variants].sort((a,b) => Number(b.id === game.last_played_id)-Number(a.id === game.last_played_id));
        openModal(`<h2 id="modal-title">Chọn phiên bản</h2><p>${esc(game.family_title || game.title)}</p><div class="edition-picker">${variants.map(v => {
          const screen = (v.screen || v.filename).match(/(\d{2,4})[xX×](\d{2,4})/);
          const label = screen ? `${screen[1]} × ${screen[2]}` : v.filename.replace(/\.jar$/i,'');
          return `<a class="button edition-choice" href="${play(v.id)}"><span><strong>${esc(label)}</strong><small>${esc(v.filename)} · ${size(v.size)}</small>${v.id === game.last_played_id ? '<small>Đã chơi gần nhất</small>' : ''}</span><span>Chơi →</span></a>`;
        }).join('')}</div>`);
      } finally { el.disabled = false; }
    }
    else if (action === 'retry') await render();
    else if (action === 'upload' || action === 'publish') { if (requireUser()) gameForm(null, action === 'publish'); }
    else if (action === 'manage-versions') {
      const g = await api(`/games/${id}`);
      openModal(`<h2 id="modal-title">${esc(g.family_title || g.title)}</h2><p>${g.variants.length} phiên bản · Sửa hoặc xóa từng bản bên dưới.</p><div class="admin-versions">${g.variants.map(v=>`<div class="admin-version"><strong>${esc(v.screen || v.filename.replace(/\.jar$/i,''))}</strong><small>${esc(v.filename)} · ${size(v.size)}</small><div class="actions">${button('edit-game','Sửa phiên bản',v.id,'small')}${button('delete-game','Xóa phiên bản',v.id,'small danger')}</div></div>`).join('')}</div>`);
    }
    else if (action === 'edit-game') gameForm(await api(`/games/${id}`));
    else if (action === 'edit-post') {
      const p = await api(`/posts/${id}`);
      openModal(`<h2 id="modal-title">Sửa bài viết</h2><form data-form="edit-post" data-id="${esc(id)}" class="stack"><label>Tiêu đề<input name="title" required minlength="3" maxlength="150" value="${esc(p.title)}"></label><label>Nội dung<textarea name="body" required minlength="3" maxlength="10000" rows="7">${esc(p.body)}</textarea></label><div class="media-preview">${(p.media || []).map((m,i)=>`<figure>${m.type.startsWith('video/') ? `<video controls preload="metadata" src="${esc(m.url)}"></video>` : `<img src="${esc(m.url)}" alt="Ảnh đã đăng ${i+1}">`}<label><input type="checkbox" data-remove-media value="${esc(m.object)}"> Bỏ tệp này</label></figure>`).join('')}</div><label>Thêm ảnh / video<input type="file" name="media" data-post-media multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"></label><p class="hint">Tối đa 4 tệp cả cũ và mới. Ảnh 8 MB, video 20 MB; tổng 40 MB. Bấm lưu để áp dụng.</p><div id="media-preview" class="media-preview" aria-live="polite"></div><p class="form-error" role="alert"></p><button class="primary">Lưu bài viết</button></form>`);
      setupDraft(document.querySelector('[data-form="edit-post"]'),state.user.id);
    }
    else if (action === 'new-post') await newPost(id);
    else if (action === 'edit-category') {
      const c = state.categories.find(c => c.id === id);
      openModal(`<h2 id="modal-title">Đổi tên thể loại</h2><form data-form="edit-category" data-id="${id}" class="stack"><label>Tên thể loại<input name="name" required minlength="2" maxlength="40" value="${esc(c.name)}"></label><p class="form-error" role="alert"></p><button class="primary">Lưu</button></form>`);
    } else if (action.startsWith('delete-')) {
      const noun = { 'delete-family':'TOÀN BỘ game và mọi phiên bản, cùng lịch sử chơi và các bài thảo luận liên quan', 'delete-game':'phiên bản này cùng lịch sử chơi và các bài thảo luận liên quan', 'delete-post':'bài viết cùng các bình luận', 'delete-comment':'bình luận', 'delete-category':'thể loại' }[action];
      const recoverable=['delete-family','delete-game','delete-post'].includes(action);
      if (!noun || !await confirmDelete(recoverable ? 'Chuyển nội dung này vào thùng rác? Tệp và bình luận sẽ được giữ lại.' : `Bạn muốn xóa ${noun}?`, recoverable ? 'Chuyển vào thùng rác?' : 'Xác nhận xóa',recoverable)) return;
      const resource = { 'delete-family':'games','delete-game':'games','delete-post':'posts','delete-comment':'comments','delete-category':'categories' }[action];
      await api(`/${resource}/${id}${action === 'delete-family' ? '?scope=family' : ''}`,{method:'DELETE'});
      modal.close();
      const r = route();
      if (action === 'delete-post') location.href='/forum'; else if (action === 'delete-game' && r.view === 'game') location.href='/games'; else await render();
      notify(recoverable?'Đã chuyển vào thùng rác.':'Đã xóa.');
    } else if (action === 'account') {
      openModal(`<h2 id="modal-title">Tài khoản của bạn</h2><p class="modal-intro">${esc(state.user.email)} · ${state.user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</p><form data-form="password" class="stack"><label>Mật khẩu hiện tại<input type="password" name="current" autocomplete="current-password" required maxlength="128"></label><label>Mật khẩu mới<input type="password" name="password" autocomplete="new-password" required minlength="10" maxlength="128"></label><p class="hint">Đổi mật khẩu sẽ đăng xuất các phiên khác.</p><p class="form-error" role="alert"></p><button class="primary">Đổi mật khẩu</button></form>`);
    }
  } catch (error) { notify(error.message, 'error'); }
});
document.addEventListener('change', e => {
  if (e.target.matches('form[data-form="filter"] select')) e.target.form.requestSubmit();
});
document.addEventListener('submit', async e => {
  const form = e.target; if (!form.dataset.form) return; e.preventDefault();
  const type = form.dataset.form, data = new FormData(form), body = Object.fromEntries(data), submit = form.querySelector('button:not([type=button])');
  const errorNode = form.querySelector('.form-error'); if (errorNode) errorNode.textContent='';
  const submitContents = submit ? [...submit.childNodes] : [];
  if (submit) { submit.disabled=true; submit.textContent='Đang xử lý…'; }
  try {
    if (type === 'filter') {
      const q = new URLSearchParams(); for (const [k,v] of Object.entries(body)) if (v) q.set(k,v);
      const next = `${route().view}?${q}`; if (location.pathname.slice(1) + location.search === next) await render(); else location.href='/'+next;
    } else if (type === 'login' || type === 'register') { const result = await api(`/${type}`,{method:'POST',body}); state.user=result.user; modal.close(); await render(); notify(type === 'register' ? 'Tài khoản đã sẵn sàng.' : 'Đăng nhập thành công.'); }
    else if (type === 'password') { const result = await api('/password',{method:'POST',body}); state.user=result.user; modal.close(); notify('Đã đổi mật khẩu.'); }
    else if (type === 'upload') {
      if (body.file.size > 20 * 1048576) throw new Error('Tệp tối đa 20 MB.');
      const game = await api('/games',{method:'POST',body:data}); modal.close(); location.href=`/game/${game.id}`; notify('Game đã được thêm vào thư viện.');
    } else if (type === 'edit-game') { await api(`/games/${form.dataset.id}`,{method:'PATCH',body}); modal.close(); await render(); notify('Đã lưu thông tin game.'); }
    else if (type === 'category' || type === 'edit-category') { await api(`/categories${type === 'edit-category' ? '/' + form.dataset.id : ''}`,{method:type === 'category' ? 'POST' : 'PATCH',body}); modal.close(); await render(); notify('Đã lưu thể loại.'); }
    else if (type === 'post') { if (!data.get('media')?.size) data.delete('media'); submit.textContent='Đang tải tệp và đăng bài…'; const post = await api('/posts',{method:'POST',body:data}); clearDraft(form); modal.close(); location.href=`/post/${post.id}`; }
    else if (type === 'edit-post') { if (!data.get('media')?.size) data.delete('media'); data.set('remove_media',JSON.stringify([...form.querySelectorAll('[data-remove-media]:checked')].map(input=>input.value))); submit.textContent='Đang lưu bài và ảnh…'; await api(`/posts/${form.dataset.id}`,{method:'PATCH',body:data}); clearDraft(form); modal.close(); await render(); notify('Đã cập nhật bài viết.'); }
    else if (type === 'comment') { await api(`/posts/${form.dataset.id}/comments`,{method:'POST',body}); clearDraft(form); await render(); notify('Đã gửi bình luận.'); }
  } catch (error) { if (errorNode) {errorNode.textContent=error.message;if(error.duplicate){const link=document.createElement('a');link.href=error.duplicate.trashed?'/admin':`/game/${encodeURIComponent(error.duplicate.id)}`;link.textContent=error.duplicate.trashed?' Mở quản trị để khôi phục.':` Mở ${error.duplicate.title}`;errorNode.append(link);}} else notify(error.message, 'error'); }
  finally { if (submit) { submit.disabled=false; submit.replaceChildren(...submitContents); } }
});
// Keep previously shared hash links working.
if (/^#(?:games|forum|history|mine|admin|game|post|login|register|account)(?:[/?]|$)/.test(location.hash)) history.replaceState(null, '', '/' + location.hash.slice(1));
try {
  const initialRoute = route();
  const listingRequest = initialRoute.view === 'games' && initialRoute.query.get('favorite') !== '1'
    ? loadListing(initialRoute, false)
    : Promise.resolve(null);
  const [session, initialListing] = await Promise.all([api('/me'), listingRequest]);
  state.user = session.user;
  state.initialListing = initialListing;
  await render();
} catch (error) { content.innerHTML=`<div class="panel"><h1>Chưa kết nối được máy chủ</h1><p>${esc(error.message)}</p><p>Chạy máy chủ mới bằng <code>npm start</code>, sau đó tải lại trang.</p><a class="button" href="/library">Mở giả lập cũ</a></div>`; content.removeAttribute('aria-busy'); }
