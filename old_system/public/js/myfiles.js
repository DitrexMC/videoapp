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

    tbody.innerHTML = pageItems.map(item => {
        if (item.type === 'group') {
            const rawName = item.label || ('グループ (' + (item.file_count || 0) + '件)');
            const displayName = rawName.length > 30 ? rawName.slice(0, 30) + '…' : rawName;
            return `
    <tr class="entry-group">
      <td style="width:1%;padding:.5rem 1rem">
        <label class="custom-cb">
          <input type="checkbox" class="file-check" data-id="g:${esc(item.id)}">
          <span class="custom-cb-box"></span>
        </label>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:.3rem;flex-wrap:nowrap;max-width:100%">
          <a href="/g/${esc(item.id)}" style="color:var(--p);text-decoration:none;font-weight:700;flex-shrink:0;white-space:nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:.3rem"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            ${esc(displayName)}
          </a>
          <button class="btn btn-ghost btn-sm rename-grp-btn" data-id="${esc(item.id)}" data-name="${esc(rawName)}" style="padding:.12rem .4rem;font-size:.62rem;flex-shrink:0" title="名前変更">✎</button>
          <button class="btn btn-ghost btn-sm toggle-grp-btn" data-id="${esc(item.id)}" data-private="${item.is_private ? '1' : '0'}" style="padding:.12rem .5rem;font-size:.62rem;color:${item.is_private ? 'var(--r)' : 'var(--g)'};flex-shrink:0" title="公開設定切替">${item.is_private ? '非公開' : '公開'}</button>
          ${item.is_private ? '<span class="badge badge-gray" style="margin-left:.2rem;font-size:.65rem;flex-shrink:0">非公開</span>' : ''}
        </div>
      </td>
      <td>${fmtBytes(item.total_size)}</td>
      <td class="col-date">${fmtDate(item.created_at)}</td>
      <td class="col-date">${fmtDate(item.expires_at)}</td>
      <td style="width:1%;white-space:nowrap">
        <div style="display:flex;gap:.4rem;flex-wrap:nowrap;align-items:center;white-space:nowrap">
          <a class="btn btn-ghost btn-sm" href="/g/${esc(item.id)}/download" style="padding:.22rem .55rem;font-size:.74rem" title="ZIPダウンロード"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ZIP</a>
          <button class="btn btn-ghost btn-sm copy-discord-btn" data-id="g/${esc(item.id)}" style="padding:.22rem .55rem;font-size:.74rem;color:#8b5cf6;border-color:rgba(139,92,246,.3)" title="Discord用"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Discord</button>
          <button class="btn btn-danger btn-sm delete-group-btn" data-id="${esc(item.id)}" style="padding:.22rem .55rem;font-size:.74rem">削除</button>
        </div>
      </td>
    </tr>`;
        }
        return `
    <tr>
      <td style="width:1%;padding:.5rem 1rem">
        <label class="custom-cb">
          <input type="checkbox" class="file-check" data-id="f:${esc(item.id)}">
          <span class="custom-cb-box"></span>
        </label>
      </td>
      <td><a href="/f/${esc(item.id)}" style="color:var(--accent3);text-decoration:none">${esc(item.original_name)}</a>${item.is_private ? '<span class="badge badge-gray" style="margin-left:.4rem;font-size:.65rem">非公開</span>' : ''}</td>
      <td>${fmtBytes(item.size_bytes)}</td>
      <td class="col-date">${fmtDate(item.created_at)}</td>
      <td class="col-date">${fmtDate(item.expires_at)}</td>
      <td style="width:1%;white-space:nowrap">
        <div style="display:flex;gap:.4rem;flex-wrap:nowrap;align-items:center;white-space:nowrap">
          <a class="btn btn-ghost btn-sm" href="/f/${esc(item.id)}/download" style="padding:.22rem .55rem;font-size:.74rem" title="ダウンロード"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> DL</a>
          <button class="btn btn-ghost btn-sm copy-discord-btn" data-id="f/${esc(item.id)}/raw" style="padding:.22rem .55rem;font-size:.74rem;color:#8b5cf6;border-color:rgba(139,92,246,.3)" title="Discord用"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Discord</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${esc(item.id)}" style="padding:.22rem .55rem;font-size:.74rem">削除</button>
        </div>
      </td>
    </tr>`;
    }).join('');

    document.querySelectorAll('.file-check').forEach(cb => {
        cb.addEventListener('change', updateBulkBtn);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('このファイルを削除しますか？')) return;
            const res = await fetch(`/api/user/files/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) { loadStats(); loadAllData(); }
            else { alert('削除に失敗しました'); }
        });
    });

    document.querySelectorAll('.copy-discord-btn').forEach(btn => {
        const origHTML = btn.innerHTML;
        btn.addEventListener('click', () => {
            const url = `${location.origin}/${btn.dataset.id}`;
            const w = btn.offsetWidth;
            btn.style.minWidth = w + 'px';
            copyText(url, () => {
                btn.textContent = '✓ コピー済み';
                setTimeout(() => { btn.innerHTML = origHTML; btn.style.minWidth = ''; }, 2000);
            });
        });
    });

    document.querySelectorAll('.delete-group-btn').forEach(btn => {
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