function copyText(text, onSuccess) {
    text = text.replace(/([^:])\/\/+/g, '$1/');
    function execFallback() {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); onSuccess(); } catch (_) { }
        document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(execFallback);
    } else {
        execFallback();
    }
}

function fmtBytes(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
}

function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const date = d.toLocaleDateString('ja-JP');
    const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
}

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PAGE_SIZE = 100;
let allItems = [];
let currentPage = 1;



async function loadStats() {
    const stats = await fetch('/api/user/stats').then(r => r.json());
    const pct = stats.quotaBytes > 0 ? Math.min(100, stats.usedBytes / stats.quotaBytes * 100) : 0;
    document.getElementById('usage-bar').style.width = pct + '%';
    document.getElementById('usage-label').textContent =
        `${fmtBytes(stats.usedBytes)} / ${fmtBytes(stats.quotaBytes)}`;
}

async function loadAllData() {
    const [files, groups] = await Promise.all([
        fetch('/api/user/files').then(r => r.json()),
        fetch('/api/user/groups').then(r => r.json())
    ]);
    allItems = [
        ...files.map(f => ({ type: 'file', ...f })),
        ...groups.map(g => ({ type: 'group', ...g })),
    ];
    allItems.sort((a, b) => b.created_at - a.created_at);
    currentPage = 1;
    applyFilter();
}

function applyFilter() {
    const searchInput = document.getElementById('search-input').value.trim().toLowerCase();
    const filterType = document.getElementById('filter-type').value;

    let filtered = allItems;

    if (filterType === 'group') {
        filtered = filtered.filter(item => item.type === 'group');
    } else if (filterType === 'file') {
        filtered = filtered.filter(item => item.type === 'file');
    }

    if (searchInput) {
        if (searchInput.startsWith('.')) {
            const ext = searchInput.slice(1);
            filtered = filtered.filter(item => {
                if (item.type === 'file') {
                    const e = (item.original_name.split('.').pop() || '').toLowerCase();
                    return e === ext;
                }
                return false;
            });
        } else {
            filtered = filtered.filter(item => {
                const name = item.type === 'file' ? item.original_name : (item.label || 'グループ') + ' (' + (item.file_count || 0) + '件)';
                return name.toLowerCase().includes(searchInput);
            });
        }
    }

    renderList(filtered);
}

function renderList(items) {
    const tbody = document.getElementById('file-list');
    const totalPages = Math.ceil(items.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    document.getElementById('page-info').textContent = items.length > 0
        ? `${start + 1}–${Math.min(start + PAGE_SIZE, items.length)} / ${items.length}件`
        : '0件';
    document.getElementById('page-prev').disabled = currentPage <= 1;
    document.getElementById('page-next').disabled = currentPage >= totalPages;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-sub">ファイルがありません</td></tr>';
        updateBulkBtn();
        return;
    }

    tbody.innerHTML = pageItems.map(item => buildFileRow(item, {
        cbClass: 'file-check',
        actionExtras: (itm) => itm.type !== 'group'
            ? ''
            : [
                `<button class="btn btn-ghost btn-sm fr-mini-btn rename-grp-btn" data-id="${esc(itm.id)}" data-name="${esc(itm.label || ('グループ (' + (itm.file_count || 0) + '件)'))}" style="padding:.22rem .45rem;font-size:.7rem" title="名前変更">✎</button>`,
                `<button class="btn btn-ghost btn-sm fr-mini-btn toggle-grp-btn" data-id="${esc(itm.id)}" data-private="${itm.is_private ? '1' : '0'}" style="padding:.22rem .45rem;font-size:.7rem;color:${itm.is_private ? 'var(--r)' : 'var(--g)'}" title="公開設定">${itm.is_private ? '🔒' : '🌐'}</button>`
            ],
    })).join('');

    document.querySelectorAll('.file-check').forEach(cb => {
        cb.addEventListener('change', updateBulkBtn);
    });

    document.querySelectorAll('.fr-del-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('このファイルを削除しますか？')) return;
            const res = await fetch(`/api/user/files/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadStats(); loadAllData(); }
            else { alert('削除に失敗しました'); }
        });
    });

    document.querySelectorAll('.fr-discord-btn').forEach(btn => {
        const originalTitle = btn.title;
        btn.addEventListener('click', () => {
            const url = `${location.origin}/${btn.dataset.path}`;
            copyText(url, () => {
                btn.classList.add('is-copied');
                btn.title = 'コピー済み';
                btn.setAttribute('aria-label', 'コピー済み');
                setTimeout(() => {
                    btn.classList.remove('is-copied');
                    btn.title = originalTitle;
                    btn.removeAttribute('aria-label');
                }, 1600);
            });
        });
    });

    document.querySelectorAll('.fr-del-grp-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('このグループとその中のファイルをすべて削除しますか？')) return;
            const res = await fetch(`/api/user/groups/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadStats(); loadAllData(); }
            else { alert('削除に失敗しました'); }
        });
    });

    document.querySelectorAll('.rename-grp-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const name = prompt('新しいグループ名:', btn.dataset.name);
            if (name === null || name.trim() === '') return;
            fetch(`/api/user/groups/${btn.dataset.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: name.trim() }),
            }).then(r => { if (r.ok) loadAllData(); });
        });
    });

    document.querySelectorAll('.toggle-grp-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const isPrivate = btn.dataset.private === '1';
            fetch(`/api/user/groups/${btn.dataset.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPrivate: !isPrivate }),
            }).then(r => { if (r.ok) loadAllData(); });
        });
    });

    document.getElementById('select-all').checked = false;
    updateBulkBtn();
}

async function init() {
    const me = await fetch('/api/auth/me').then(r => r.json());
    document.getElementById('nav-username').textContent = me.label;
    if (me.isAdmin) document.getElementById('nav-admin-link').classList.remove('hidden');

    loadStats();
    loadAllData();

    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const filterType = document.getElementById('filter-type');

    searchBtn.addEventListener('click', () => { currentPage = 1; applyFilter(); });
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { currentPage = 1; applyFilter(); } });
    searchInput.addEventListener('input', () => { currentPage = 1; applyFilter(); });
    filterType.addEventListener('change', () => { currentPage = 1; applyFilter(); });

    document.getElementById('page-prev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; applyFilter(); }
    });
    document.getElementById('page-next').addEventListener('click', () => {
        const total = Math.ceil(allItems.length / PAGE_SIZE) || 1;
        if (currentPage < total) { currentPage++; applyFilter(); }
    });

    document.getElementById('select-all').addEventListener('change', function () {
        document.querySelectorAll('.file-check').forEach(cb => { cb.checked = this.checked; });
        updateBulkBtn();
    });

    document.getElementById('bulk-delete-btn').addEventListener('click', async () => {
        const checked = Array.from(document.querySelectorAll('.file-check:checked'));
        if (checked.length === 0) return;
        if (!confirm(`${checked.length} 件を削除しますか？`)) return;

        const fileIds = checked.filter(cb => cb.dataset.id.startsWith('f:')).map(cb => cb.dataset.id.slice(2));
        const groupIds = checked.filter(cb => cb.dataset.id.startsWith('g:')).map(cb => cb.dataset.id.slice(2));

        await Promise.all([
            ...fileIds.map(id => fetch(`/api/user/files/${id}`, { method: 'DELETE' })),
            ...groupIds.map(id => fetch(`/api/user/groups/${id}`, { method: 'DELETE' })),
        ]);
        loadStats();
        loadAllData();
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        location.href = '/login';
    });
}

function updateBulkBtn() {
    const count = document.querySelectorAll('.file-check:checked').length;
    const btn = document.getElementById('bulk-delete-btn');
    btn.style.display = count > 0 ? '' : 'none';
    btn.textContent = count > 0 ? `選択分を削除 (${count})` : '選択分を削除';
}

init();