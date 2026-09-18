let sequence=0;
function show(message,confirming){
 return new Promise(resolve=>{
  const previous=document.activeElement,d=document.createElement('dialog'),id='message-'+(++sequence);
  d.className='app-message-dialog';d.setAttribute('aria-labelledby',id);d.setAttribute('aria-describedby',id+'-body');
  const heading=document.createElement('h2');heading.id=id;heading.textContent=confirming?'Xác nhận thao tác':'Thông báo';
  const body=document.createElement('p');body.id=id+'-body';body.textContent=String(message);
  const actions=document.createElement('div');actions.className='app-message-actions';
  if(confirming){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Hủy';cancel.autofocus=true;cancel.onclick=()=>d.close('cancel');actions.append(cancel);}
  const accept=document.createElement('button');accept.type='button';accept.className='primary';accept.textContent=confirming?'Xác nhận':'Đã hiểu';accept.autofocus=!confirming;accept.onclick=()=>d.close('accept');actions.append(accept);
  d.append(heading,body,actions);d.addEventListener('close',()=>{const accepted=d.returnValue==='accept';d.remove();if(previous?.isConnected)previous.focus();resolve(accepted);},{once:true});document.body.append(d);d.showModal();
 });
}
export const confirmAction=message=>show(message,true);
export const showMessage=message=>show(message,false);
