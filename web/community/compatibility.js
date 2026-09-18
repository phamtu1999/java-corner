const labels={works:'Chơi tốt',graphics:'Lỗi hình',network:'Lỗi kết nối',startup:'Không khởi động'};
export async function setupCompatibility({root,game,user,api,notify,update}) {
  const rows=[...root.querySelectorAll('#versions .game-card')];
  await Promise.all(rows.map(async(row,i)=>{
    const id=game.variants[i]?.id;if(!id)return;
    const box=document.createElement('details');box.className='compatibility';
    const summary=document.createElement('summary');summary.textContent='Phản hồi tương thích';box.append(summary);
    const status=document.createElement('p');status.setAttribute('role','status');box.append(status);
    const select=document.createElement('select');select.setAttribute('aria-label','Trạng thái chơi của bạn');
    select.add(new Option('Chọn trải nghiệm của bạn',''));
    for(const [value,label] of Object.entries(labels))select.add(new Option(label,value));
    const configLabel=document.createElement('label');configLabel.textContent='Cấu hình đã thử (màn hình, phím, mạng)';const configuration=document.createElement('input');configuration.maxLength=300;configuration.placeholder='Ví dụ: 240x320, phím Nokia, tắt mạng';configLabel.append(configuration);const reports=document.createElement('div');box.append(reports);
    const button=document.createElement('button');button.type='button';button.textContent='Gửi phản hồi';
    if(user)box.append(select,configLabel,button);else{const link=document.createElement('a');link.href='/login';link.textContent='Đăng nhập để đánh giá';box.append(link);}
    const refresh=async()=>{const data=await api(`/games/${id}/compatibility`);status.textContent=Object.entries(labels).map(([key,label])=>`${label}: ${data.counts[key]||0}`).join(' · ');select.value=data.mine||'';configuration.value=data.configuration||'';reports.replaceChildren(...(data.configurations||[]).map(r=>{const p=document.createElement('p');p.textContent=(labels[r.status]||r.status)+' · '+r.configuration;return p;}));};
    button.onclick=async()=>{if(!select.value){select.focus();return;}button.disabled=true;try{await api(`/games/${id}/compatibility`,{method:'POST',body:{status:select.value,configuration:configuration.value}});await refresh();await update();notify('Đã lưu phản hồi. Bạn có thể thay đổi khi chơi lại.');}catch(e){notify(e.message,'error');}finally{button.disabled=false;}};
    row.append(box);
    try{await refresh();}catch{status.textContent='Chưa tải được phản hồi.';const retry=document.createElement('button');retry.type='button';retry.textContent='Thử lại';retry.onclick=async()=>{try{await refresh();retry.remove();}catch(e){notify(e.message,'error');}};box.append(retry);}
  }));
}
