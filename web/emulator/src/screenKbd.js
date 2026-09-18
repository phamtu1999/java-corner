let handleKey = null;
const pointers = new Map();

function release(pointerId) {
    const key = pointers.get(pointerId);
    pointers.delete(pointerId);
    if (key && ![...pointers.values()].includes(key)) {
        key.classList.remove('active');
        handleKey?.(false, key.dataset.key);
    }
}

export function initKbdListeners() {
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            key.setPointerCapture(event.pointerId);
            const alreadyPressed = [...pointers.values()].includes(key);
            pointers.set(event.pointerId, key);
            key.classList.add('active');
            if (!alreadyPressed) handleKey?.(true, key.dataset.key);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            key.addEventListener(type, event => release(event.pointerId));
        }
        key.addEventListener('keydown', event => {
            if (!['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            if (!event.repeat) {
                key.classList.add('active');
                handleKey?.(true, key.dataset.key);
            }
        });
        key.addEventListener('keyup', event => {
            if (!['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            key.classList.remove('active');
            handleKey?.(false, key.dataset.key);
        });
        key.addEventListener('blur', () => {
            if (!pointers.size && key.classList.contains('active')) {
                key.classList.remove('active');
                handleKey?.(false, key.dataset.key);
            }
        });
    });
    window.addEventListener('blur', () => {
        for (const pointerId of pointers.keys()) release(pointerId);
    });
}

export function setKbdHandler(handler) {
    handleKey = handler;
}
