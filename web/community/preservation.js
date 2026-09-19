import {renderJarInspection} from './jar-inspector.js?v=20260919-stock';
export async function setupPreservation({root,r,user,api,esc,openModal,notify,refresh}) {
 if(r.view!=='game')return;
 const data=await api(`/games/${r.id}/preservation`),m=data.metadata;
 const section=document.createElement('section');section.className='panel';section.style.overflowWrap='anywhere';
 const labels={sha256:'SHA256',manifest:'Manifest đã kiểm tra',icon:'Icon',version:'Phiên bản',publisher:'Nhà phát hành',year:'Năm phát hành',source:'Nguồn',evidence:'Bằng chứng nguồn',classification:'Phân loại'};
 section.innerHTML=`<h2>Hồ sơ bảo tồn · ${data.score.percent}%</h2><p>Độ đầy đủ dữ liệu, không phải điểm chất lượng hoặc chứng nhận an toàn.</p><p><strong>${esc(m.classification||'UNKNOWN')}</strong> · ${m.status==='verified'?'Nguồn được admin xác nhận':'Nguồn chưa xác minh'}</p><p>Người upload: ${esc(data.uploader)} · Năm lưu trữ: ${esc(m.archived_year||'Chưa rõ')}</p><p>Nguồn: ${esc(m.source||'Chưa có')}</p><p>Bằng chứng: ${esc(m.evidence||'Chưa có')}</p><p>${esc(m.notes||'')}</p><p>SHA256: ${esc(data.sha256)}</p>${data.parent?`<p>Phiên bản gốc: <a href="/game/${esc(data.parent.id)}">${esc(data.parent.title)}</a></p>`:''}<details><summary>Tiêu chí tính điểm</summary><ul>${Object.entries(data.score.checks).map(([k,v])=>`<li>${v?'✓':'○'} ${labels[k]}</li>`).join('')}</ul></details>`;
 root.append(section);
 if(user?.role!=='admin')return;
 const button=(title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){notify(e.message,'error');}finally{b.disabled=false;}};section.append(b);};
 button('Sửa hồ sơ nguồn',()=>{
  const fields=['source','evidence','notes','archived_year','parent_id'];
  const titles=['Nguồn lưu trữ','Bằng chứng / URL tham chiếu','Ghi chú','Năm lưu trữ','ID phiên bản gốc công khai'];
  openModal(`<h2 id="modal-title">Hồ sơ bảo tồn</h2><form class="stack preservation-form"><label>Phân loại<select name="classification">${['UNKNOWN','ORIGINAL','MOD','VIETNAMESE PATCH','TOUCH MOD','FULLSCREEN MOD'].map(v=>`<option ${v===m.classification?'selected':''}>${v}</option>`).join('')}</select></label>${fields.map((f,i)=>`<label>${titles[i]}<input name="${f}" maxlength="2000" value="${esc(f==='parent_id'?data.parent?.id:m[f])}"></label>`).join('')}<label>Xác minh nguồn<select name="status"><option value="unverified">Chưa xác minh</option><option value="verified" ${m.status==='verified'?'selected':''}>Verified — có bằng chứng</option></select></label><p role="alert"></p><button>Lưu hồ sơ</button></form>`);
  const form=document.querySelector('.preservation-form');form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api(`/games/${r.id}/preservation`,{method:'PUT',body:Object.fromEntries(new FormData(form))});document.querySelector('#modal').close();await refresh();}catch(error){form.querySelector('[role=alert]').textContent=error.message;}finally{b.disabled=false;}};
 });
 button('Chạy / cập nhật Inspector',async()=>{await api(`/admin/games/${r.id}/verify-archive`,{method:'POST'});await refresh();});
 if(data.inspection){const details=document.createElement('details');details.innerHTML=`<summary>Inspector · ${esc(data.inspected_at)}</summary>${renderJarInspection({...data.inspection,duplicates:[]},esc)}`;section.append(details);}
 button('So sánh JAR',()=>{
  openModal('<h2 id="modal-title">JAR Version Diff</h2><form class="stack jar-diff-form"><label>ID phiên bản đích<input name="other" required></label><button>So sánh</button><div role="status"></div></form>');
  const form=document.querySelector('.jar-diff-form');form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button'),out=form.querySelector('[role=status]');b.disabled=true;try{const d=await api(`/admin/games/${r.id}/diff/${encodeURIComponent(form.elements.other.value.trim())}`);out.innerHTML=`<h3>${esc(d.from)} → ${esc(d.to)}</h3><p>Dung lượng: ${d.sizeDelta>0?'+':''}${d.sizeDelta} byte</p><p>Thay đổi nội dung dựa trên CRC và kích thước; không phải phân tích hành vi mã.</p>${['added','removed','changed','endpointsAdded','endpointsRemoved'].map((k,i)=>`<details><summary>${['Tệp thêm','Tệp bỏ','Tệp thay đổi','Endpoint thêm','Endpoint bỏ'][i]}: ${d[k].length}</summary><ul>${d[k].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}${d.partial?'<p>Endpoint chỉ từ phần dữ liệu đã quét; báo cáo có giới hạn.</p>':''}`;}catch(error){out.textContent=error.message;}finally{b.disabled=false;}};
 });
}
