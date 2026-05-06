(function () {
    applyTheme(localStorage.getItem('va_theme'));

    // Read navigation direction before first render (set by nav.js on the previous page)
    var dir = sessionStorage.getItem('va_nav_dir');
    sessionStorage.removeItem('va_nav_dir');
    // Fallback: back-direction stored for pages not in PAGE_POS
    if (!dir) {
        dir = sessionStorage.getItem('va_back_dir');
        sessionStorage.removeItem('va_back_dir');
    } else {
        sessionStorage.removeItem('va_back_dir');
    }
    if (dir) {
        document.documentElement.setAttribute('data-nav-dir', dir);
    }

    // PRIMARY: use pagereveal to suppress fadeUp before first paint.
    // This fires before any CSS animations start, so it reliably prevents
    // the double-animation (fadeUp + VT slide playing simultaneously).
    if ('onpagereveal' in window) {
        window.addEventListener('pagereveal', function (e) {
            if (e.viewTransition) {
                document.documentElement.classList.add('vt-navigated');
                e.viewTransition.finished.then(function () {
                    document.documentElement.classList.remove('vt-navigated');
                });
            }
        });
    } else if (sessionStorage.getItem('va_vt_nav')) {
        // FALLBACK: for browsers that support @view-transition but not pagereveal
        sessionStorage.removeItem('va_vt_nav');
        document.documentElement.classList.add('vt-navigated');
        setTimeout(function () {
            document.documentElement.classList.remove('vt-navigated');
        }, 600);
    }
})();

// Freeze CSS transitions + lock scroll + scroll-to-top before page snapshot.
// Scrolling to top prevents the VT group from animating vertically when the
// user was scrolled down (the element's viewport position would otherwise differ
// between old and new page, creating unintended vertical movement).
if ('onpageswap' in window) {
    window.addEventListener('pageswap', function (e) {
        document.documentElement.dataset.vtLeaving = '1';
        sessionStorage.setItem('va_vt_nav', '1');
        if (e.viewTransition) {
            // overflow:hidden is already applied by [data-vt-leaving] CSS,
            // so the scroll reset is invisible to the user.
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }
    });
}

function applyTheme(theme) {
    var nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('va_theme', nextTheme);
    document.dispatchEvent(new CustomEvent('va-themechange', {
        detail: { theme: nextTheme }
    }));
}

function initThemeToggle() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function sync() {
        var t = document.documentElement.getAttribute('data-theme') || 'dark';
        btn.innerHTML = t === 'dark'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        btn.title = t === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替';
    }

    btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        var nxt = cur === 'dark' ? 'light' : 'dark';
        applyTheme(nxt);
        sync();
    });

    sync();
}

function initNavUsername() {
    var username = localStorage.getItem('va_username');
    if (!username) return;
    var navEl = document.getElementById('nav-username');
    if (navEl) navEl.textContent = username;
    var drawerEl = document.getElementById('drawerUsername');
    if (drawerEl) drawerEl.textContent = username;
}

function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
}

onReady(function () {
    initThemeToggle();
    initNavUsername();
});
