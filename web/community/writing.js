const keys = new WeakMap();

export function clearDraft(form) {
  try { localStorage.removeItem(keys.get(form)); } catch {}
}

// Drafts belong to the signed-in author and destination, never to a shared form.
export function setupDraft(form, userId) {
  if (!form || !userId) return;
  const key = `java-corner.draft:${userId}:${form.dataset.form}:${form.dataset.id || form.elements.game_id?.value || 'forum'}`;
  keys.set(form, key);
  const fields = ['title', 'body', 'tag', 'mentions'].filter(name => form.elements[name]);
  const controls = document.createElement('div');
  controls.className = 'writing-tools';
  const status = document.createElement('p');
  status.className = 'hint'; status.setAttribute('role', 'status');
  status.textContent = 'Bản nháp lưu trên trình duyệt này; tệp đính kèm không được lưu.';
  const preview = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = 'Xem trước nội dung';
  const title = document.createElement('h3'), body = document.createElement('div'); body.className = 'prose';
  preview.append(summary, title, body);
  const refresh = () => {title.textContent = form.elements.title?.value || '';body.textContent = form.elements.body.value || 'Nội dung xem trước sẽ xuất hiện ở đây.';};
  const action = (label, fn) => {const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;controls.append(b);return b;};
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved.body === 'string') {
      const restore = action('Khôi phục bản nháp', () => {
        for (const name of fields) if (typeof saved[name] === 'string') form.elements[name].value = saved[name].slice(0,form.elements[name].maxLength > 0 ? form.elements[name].maxLength : 10000);
        refresh();restore.remove();form.elements.body.focus();status.textContent='Đã khôi phục bản nháp. Chọn lại tệp đính kèm nếu có.';
      });
    }
  } catch {}
  action('Bỏ bản nháp đã lưu', () => {clearDraft(form);status.textContent='Đã bỏ bản nháp đã lưu. Nội dung đang soạn vẫn được giữ.';controls.querySelector('button')?.textContent === 'Khôi phục bản nháp' && controls.firstChild.remove();});
  form.elements.body.closest('label').after(controls, status, preview);
  form.addEventListener('input', e => {
    if (!fields.includes(e.target.name)) return;
    refresh();
    try {localStorage.setItem(key, JSON.stringify(Object.fromEntries(fields.map(name => [name, form.elements[name].value]))));status.textContent='Đã lưu bản nháp trên trình duyệt này.';}
    catch {status.textContent='Không lưu được bản nháp. Hãy sao chép nội dung trước khi rời trang.';}
  });
  refresh();
}

export function setupTopicSearch(root) {
  const panel=root.querySelector('.comments-panel');if(!panel)return;
  const rows=[...panel.querySelectorAll('.comment')];if(!rows.length)return;
  const label=document.createElement('label');label.className='topic-search';label.textContent='Tìm trong bình luận';
  const input=document.createElement('input');input.type='search';input.placeholder='Tên thành viên hoặc nội dung';label.append(input);
  const status=document.createElement('p');status.className='muted';status.setAttribute('role','status');
  panel.querySelector('h2').after(label,status);
  input.oninput=()=>{const term=input.value.trim().toLocaleLowerCase('vi');let count=0;for(const row of rows){row.hidden=!row.textContent.toLocaleLowerCase('vi').includes(term);if(!row.hidden)count++;}status.textContent=term?`${count}/${rows.length} bình luận phù hợp`:'';};
}
