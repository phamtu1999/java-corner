export function setupScreenshot(){
 const button=document.createElement('button');button.type='button';button.textContent='▣ Chụp ảnh';document.querySelector('.player-toolbar').append(button);
 button.onclick=()=>{
  const canvas=document.querySelector('#display');if(!canvas||!canvas.width||canvas.style.display==='none')return;
  canvas.toBlob(blob=>{
   if(!blob)return;
   const url=URL.createObjectURL(blob),dialog=document.createElement('dialog');dialog.className='screenshot-dialog';dialog.setAttribute('aria-labelledby','screenshot-title');
   dialog.innerHTML='<h2 id="screenshot-title">Ảnh chụp game</h2><img alt="Ảnh chụp màn hình game"><a class="button" download="java-game.png">Tải ảnh xuống</a><form><label>Tiêu đề bài viết<input name="title" required minlength="3" maxlength="150"></label><label>Nội dung<textarea name="body" required minlength="3" maxlength="10000"></textarea></label><p class="screenshot-error" role="alert"></p><button type="submit">Đăng ảnh lên diễn đàn</button></form><button type="button" class="screenshot-close">Đóng</button>';
   dialog.querySelector('img').src=url;dialog.querySelector('a').href=url;dialog.querySelector('.screenshot-close').onclick=()=>dialog.close();dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove();};document.body.append(dialog);dialog.showModal();
   const form=dialog.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;const data=new FormData(form);data.set('media',blob,'screenshot.png');try{const res=await fetch('/api/posts',{method:'POST',headers:{'X-Requested-With':'JavaCommunity'},body:data});const post=await res.json();if(!res.ok)throw new Error(post.error||'Không đăng được ảnh.');location.href='/post/'+post.id;}catch(error){form.querySelector('.screenshot-error').textContent=error.message;}finally{submit.disabled=false;}};
  },'image/png');
 };
}
