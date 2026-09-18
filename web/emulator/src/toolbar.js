const paths = {
 layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18M8 15v6"/>',
 volume:'<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
 zoom:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
 keys:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m4 0h1m4 0h1M6 13h1m4 0h1m4 0h1M7 16h10"/>',
 login:'<path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4"/>'
};
function icon(name){return `<svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;}
const toolbar=document.querySelector('.player-toolbar');
function compact(){
 for(const select of toolbar.querySelectorAll('select')){
  if(select.closest('.toolbar-select'))continue;
  const label=select.id==='layout'?'Bố cục':select.getAttribute('aria-label');
  const name=select.id==='layout'?'layout':label==='Âm lượng'?'volume':'zoom';
  let wrap=select.parentElement;
  if(wrap===toolbar){toolbar.querySelector('label[for="layout"]')?.remove();wrap=document.createElement('label');select.before(wrap);wrap.append(select);}
  for(const node of [...wrap.childNodes])if(node!==select)node.remove();
  wrap.classList.add('toolbar-select');wrap.insertAdjacentHTML('afterbegin',icon(name));
  select.setAttribute('aria-label',label);
  const update=()=>{wrap.title=label+': '+select.selectedOptions[0].textContent;};select.addEventListener('change',update);update();
 }
 for(const button of toolbar.querySelectorAll('button,a')){
  if(button.dataset.compact)continue;
  const label=button.getAttribute('aria-label')||button.textContent.trim();
  button.title=button.title||label;button.setAttribute('aria-label',label);
  if(!button.querySelector('svg'))button.innerHTML=icon(label.includes('Chụp')?'camera':label.includes('cấu hình')?'keys':'login');
  else for(const node of [...button.childNodes])if(node.nodeName.toLowerCase()!=='svg')node.remove();
  button.dataset.compact='1';
 }
}
compact();new MutationObserver(compact).observe(toolbar,{childList:true,subtree:true});
