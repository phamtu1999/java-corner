export const layouts = ['screen', 'split', 'bottom', 'nokia'];

export function resolveLayout(saved, mobile) {
    return layouts.includes(saved) ? saved : mobile ? 'bottom' : 'screen';
}

export function fitScale(width, height, canvasWidth, canvasHeight, fractional) {
    const scale = Math.min(width / canvasWidth, height / canvasHeight);
    return Math.max(0.01, fractional || scale < 1 ? scale : Math.floor(scale));
}

export function initLayout(onChange) {
    const key='java-emulator.layout:'+ (new URLSearchParams(location.search).get('app')||'default');
    const select = document.getElementById('layout');
    let saved;
    try { saved = localStorage.getItem(key)||localStorage.getItem('java-emulator.layout'); } catch {}
    select.value = resolveLayout(saved, new URLSearchParams(location.search).get('mobile') === '1');
    const apply = () => {
        document.body.dataset.layout = select.value;
        onChange();
    };
    select.addEventListener('change', () => {
        apply();
        try { localStorage.setItem(key, select.value); } catch {}
    });
    apply();
}
