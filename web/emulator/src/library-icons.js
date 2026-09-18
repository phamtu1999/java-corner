const paths={recent:'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9ZM12 7v5l3 2',play:'m8 4 12 8-12 8Z',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',remove:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',save:'M4 3h13l3 3v15H4ZM8 3v6h8V3M8 21v-8h8v8',profile:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM8 12l3 3 5-6',update:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 7M4 12l2 7a7 7 0 0 0 12-2',storage:'M4 4h16v6H4ZM4 14h16v6H4ZM7 7h1m-1 10h1',select:'M9 4h11v16H4V9M3 4l3 3 5-5',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',cloud:'M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-1 5 5 0 0 1 0 9h-1M12 21V11m-4 4 4-4 4 4'};
export function iconButton(button,name,label){
 if(!button)return;label=label||button.getAttribute('aria-label')||button.textContent.trim();button.title=label;button.setAttribute('aria-label',label);button.classList.add('library-icon-button');
 button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
}
export function compactGameActions(item){
 const actions=document.createElement('div');actions.className='game-row-actions';
 const names=['play','settings','remove','save','profile','update'];
 [...item.querySelectorAll(':scope > .game-action')].forEach((button,i)=>{iconButton(button,names[i]);actions.append(button);});item.append(actions);
}
