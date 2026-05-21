(async function () {
    try {
        const response = await fetch('/config', { cache: 'no-store' });
        if (!response.ok) {
            return;
        }

        const config = await response.json();
        if (!config || config.devMode !== true) {
            return;
        }

        const style = document.createElement('style');
        style.textContent = '.dev-reload-btn{position:fixed;right:16px;bottom:16px;z-index:99999;display:inline-flex;align-items:center;gap:.45rem;padding:.7rem .95rem;border:1px solid rgba(239,68,68,.35);border-radius:999px;background:rgba(15,17,23,.92);color:#f8fafc;font:700 12px/1.1 Inter,\'Noto Sans JP\',\'Segoe UI\',system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(12px)}[data-theme="light"] .dev-reload-btn{background:rgba(255,255,255,.94);color:#0f172a;border-color:rgba(239,68,68,.28)}.dev-reload-btn:hover{transform:translateY(-1px);box-shadow:0 14px 34px rgba(0,0,0,.32)}.dev-reload-btn:disabled{opacity:.7;cursor:wait;transform:none}.dev-reload-btn svg{flex-shrink:0}';
        document.head.appendChild(style);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dev-reload-btn';
        button.title = 'Service Worker と Cache Storage を消して再読み込み';
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg><span>強制再読み込み</span>';

        button.addEventListener('click', async function () {
            if (button.disabled) {
                return;
            }

            button.disabled = true;
            button.lastElementChild.textContent = '再読み込み中...';

            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(function (registration) {
                        return registration.unregister();
                    }));
                }

                if ('caches' in window) {
                    const cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys.map(function (cacheKey) {
                        return caches.delete(cacheKey);
                    }));
                }
            } catch (_) {
            }

            const currentUrl = new URL(location.href);
            currentUrl.searchParams.set('_dev_reload', String(Date.now()));
            location.replace(currentUrl.toString());
        });

        document.body.appendChild(button);
    } catch (_) {
    }
})();