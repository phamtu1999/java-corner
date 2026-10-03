// Load Java without blocking HTML parsing or the metadata-only library preview.
export function loadJavaRuntime(document, runtime = globalThis) {
    if (typeof runtime.cheerpjInit === 'function') return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cjrtnc.leaningtech.com/20260317_2978/loader.js';
        script.async = true;
        script.onload = () => {
            if (typeof runtime.cheerpjInit === 'function') resolve();
            else reject(new Error('Bộ chạy Java không khởi tạo được.'));
        };
        script.onerror = () => reject(new Error('Không tải được bộ chạy Java.'));
        document.head.append(script);
    });
}
