import {showMessage} from './dialogs.js';
import {setupHeaderTools} from './header-tools.js?v=20260917-6';
// Decorate existing controls without changing their navigation or event handlers.
export function decorateAccount(container) {
  const signedIn=container.querySelector('[data-action="account"],a[href="/account"]');
  if(signedIn&&!container.querySelector('.header-favorite')){
    const favorite=document.createElement('a');favorite.href='/games?favorite=1';favorite.className='header-favorite';favorite.title='Yêu thích';favorite.setAttribute('aria-label','Yêu thích');
    favorite.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
    if(location.pathname==='/games'&&new URLSearchParams(location.search).get('favorite')==='1')favorite.setAttribute('aria-current','page');
    container.prepend(favorite);
  }
  const icons = {
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    logout: '<path d="M9 4H4v16h5m6-12 4 4-4 4m-7-4h11"/>',
    login: '<path d="M15 4h5v16h-5M9 8l4 4-4 4m-6-4h10"/>',
    register: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 12-5m4 0v8m-4-4h8"/>'
  };
  container.querySelectorAll('a,button').forEach(control => {
    const action = control.dataset.action || control.getAttribute('href')?.split('/')[1] || 'logout';
    if (!icons[action] || control.querySelector('.account-icon')) return;
    const label = document.createElement('span');
    label.className = 'account-label';
    label.textContent = control.textContent;
    control.title = control.textContent;
    control.classList.add('account-control', `account-${action}`);
    control.innerHTML = `<svg class="account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[action]}</svg>`;
    control.append(label);
  });
}

const page = document.body.dataset.page || 'community';
const header = document.getElementById('site-header');
if (header) {
  header.className = 'site-header';
  header.innerHTML = `<div class="site-top"><a class="site-brand" href="/games"><span class="site-emblem" aria-hidden="true">J</span>Java Corner</a><div id="account" class="site-account"><a href="/login">Đăng nhập</a></div></div><div class="site-nav-wrap"><nav class="site-nav" aria-label="Điều hướng chính"><a href="/games" data-nav="games">Kho game</a><a href="/forum" data-nav="forum">Diễn đàn</a><a href="/history" data-nav="history">Đã chơi</a><a href="/mine" data-nav="mine">Game của tôi</a><a href="/library" data-nav="local">Game trên máy</a><a href="/admin" data-nav="admin" id="admin-nav" hidden>Quản trị</a></nav></div>`;
  const navIcons = {
    games: '<path d="M7 8h10a4 4 0 0 1 3.9 3.1l1 5a2.4 2.4 0 0 1-4 2.3L15 16H9l-2.9 2.4a2.4 2.4 0 0 1-4-2.3l1-5A4 4 0 0 1 7 8Z"/><path d="M7 10v5m-2.5-2.5h5"/><circle cx="16" cy="11" r=".8" fill="currentColor"/><circle cx="18" cy="14" r=".8" fill="currentColor"/>',
    forum: '<path d="M20 15a2 2 0 0 1-2 2H9l-5 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/><path d="M8 8h8M8 12h5"/>',
    history: '<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2"/>',
    mine: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M12 11v5m-2.5-2.5h5"/>',
    local: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8m-4-4v4M7 8h10"/>',
    admin: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="m8 12 3 3 5-6"/>'
  };
  header.querySelectorAll('[data-nav]').forEach(link => {
    const label = document.createElement('span');
    label.textContent = link.textContent;
    link.innerHTML = `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${navIcons[link.dataset.nav]}</svg>`;
    link.append(label);
  });
  header.removeAttribute('aria-busy');
  if (page !== 'community') {
    header.querySelector('[data-nav="local"]').setAttribute('aria-current', 'page');
    const account = document.getElementById('account');
    const login = document.createElement('a');
    login.href = '/login'; login.className = 'button quiet'; login.textContent = 'Đăng nhập';
    const register = document.createElement('a');
    register.href = '/register'; register.className = 'button primary'; register.textContent = 'Đăng ký';
    account.replaceChildren(login, register);
    decorateAccount(account);
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(data => {
      if (!data?.user) return;
      const link = document.createElement('a');
      link.href = '/account'; link.textContent = data.user.name; link.className = 'button quiet';
      const logout = document.createElement('button');
      logout.type = 'button'; logout.className = 'small'; logout.textContent = 'Đăng xuất';
      logout.onclick = async () => {
        logout.disabled = true;
        try {
          const response = await fetch('/api/logout', { method: 'POST', headers: { 'X-Requested-With': 'JavaCommunity' } });
          if (!response.ok) throw new Error('Không đăng xuất được. Hãy thử lại.');
          localStorage.removeItem('java-corner.offline-metadata');
          location.href = '/games';
        } catch (error) { logout.disabled = false; await showMessage(error.message); }
      };
      account.replaceChildren(link, logout);
      decorateAccount(account);
      setupHeaderTools(account,data.user);
      document.getElementById('admin-nav').hidden = data.user.role !== 'admin';
    }).catch(() => {});
  }
}
const footer = document.getElementById('site-footer');
if (footer) {
  footer.className = 'site-footer';
  footer.innerHTML = '<span>Java Corner · Game Java ME</span><span><a href="/offline.html">Cài app / Metadata offline</a> · <a href="/library">Quản lý bản lưu</a> · <a href="/emulator/LICENSE.txt">FreeJ2ME &amp; CheerpJ</a></span>';
}

if (page === 'player' && header) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--site-header-height', `${header.getBoundingClientRect().height}px`);
  }).observe(header);
}

if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
