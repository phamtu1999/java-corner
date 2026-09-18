// Text entry is opt-in: game movement keeps its existing key mappings.
export function textKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null;
    if (event.key === 'Backspace') return {code: 8, character: '\0'};
    if (event.key.length === 1) return {code: event.key.charCodeAt(0), character: event.key};
    return null;
}

export function setupTextInput(display, queue) {
    let enabled = false;
    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Nhập chữ bằng bàn phím: tắt';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"/></svg>';
    document.querySelector('.player-toolbar').append(button);
    const panel=document.createElement('form');panel.className='game-text-entry';panel.hidden=true;
    panel.innerHTML='<label>Nhập chữ vào ô đang chọn trong game<input type="password" maxlength="1000" autocomplete="off" spellcheck="false" aria-label="Nội dung gửi vào game"></label><label><input type="checkbox"> Hiện nội dung</label><button type="submit">Gửi vào game</button><p role="status">Chọn ô trong game trước khi gửi. Không lưu nội dung đã nhập.</p>';
    document.querySelector('.player-toolbar').after(panel);
    const field=panel.querySelector('input');
    panel.querySelector('[type=checkbox]').onchange=e=>field.type=e.target.checked?'text':'password';
    const send=text=>{let skipped=0;for(const character of text.slice(0,1000)){if(character.length===1&&character.charCodeAt(0)>=32)queue.queueEvent({kind:'textinput',code:character.charCodeAt(0),character});else skipped++;}return skipped;};
    panel.onsubmit=e=>{e.preventDefault();const skipped=send(field.value);field.value='';panel.querySelector('[role=status]').textContent=skipped?'Đã gửi; game Java không hỗ trợ một số ký tự như emoji.':'Đã gửi vào ô đang chọn trong game.';display.focus();};
    button.onclick = () => {
        enabled = !enabled;
        panel.hidden=!enabled;field.value='';
        button.setAttribute('aria-pressed', String(enabled));
        button.title = 'Nhập chữ bằng bàn phím: ' + (enabled ? 'bật — chọn ô trong game rồi gõ; bấm để tắt' : 'tắt');
        button.setAttribute('aria-label', button.title);
        button.style.background = enabled ? '#dff4ff' : '';
        display.focus();
    };
    display.addEventListener('paste', event => {
        if (!enabled) return;
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return;
        event.preventDefault();
        send(text);
    });
    return event => {
        if (!enabled) return false;
        const key = textKey(event);
        if (!key) return false;
        event.preventDefault();
        if (event.type === 'keydown') queue.queueEvent({kind: 'textinput', ...key});
        return true;
    };
}
