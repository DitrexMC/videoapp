function fmtBytes(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
}

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('ja-JP');
}

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

async function loadStats() {
    const stats = await fetch('/api/admin/stats').then(r => r.json());
    document.getElementById('stat-users').textContent = stats.totalUsers;
    document.getElementById('stat-files').textContent = stats.totalFiles;
    document.getElementById('stat-storage').textContent = fmtBytes(stats.totalStorage);
}

async function loadUsers() {
    const users = await fetch('/api/admin/users').then(r => r.json());
    const tbody = document.getElementById('user-list');
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-sub" style="padding:2rem;text-align:center">ユーザーがいません</td></tr>';
        return;
    }
    tbody.innerHTML = users.map(u => {
        const usedPct = u.quota_bytes > 0 ? Math.min(100, (u.used_bytes || 0) / u.quota_bytes * 100) : 0;
        return `
    <tr style="white-space:nowrap">
      <td><span style="font-weight:700">${esc(u.label)}</span></td>
      <td style="white-space:nowrap"><code style="font-size:.78rem;color:var(--text-sub);font-family:monospace">${esc(u.auth_id.slice(0, 7))}...</code><button class="btn btn-ghost btn-sm copy-auth-btn" data-auth="${esc(u.auth_id)}" style="font-size:.7rem;padding:.18rem .55rem;margin-left:.3rem;vertical-align:middle">コピー</button></td>
      <td>${u.is_admin ? '<span class="badge badge-gold">管理者</span>' : '<span class="badge badge-gray">一般</span>'}</td>
      <td>
                <div class="admin-usage-inline">
                    <span style="font-size:.78rem;color:var(--text-sub)">${fmtBytes(u.used_bytes || 0)} / ${fmtBytes(u.quota_bytes)}</span>
                    <div class="quota-bar-wrap" style="width:96px;min-width:96px"><div class="quota-bar" style="width:${usedPct.toFixed(1)}%"></div></div>
                    <span style="font-size:.72rem;color:var(--text-sub)">${u.file_count || 0}件</span>
        </div>
      </td>
      <td>${u.is_active ? '<span class="badge badge-green">有効</span>' : '<span class="badge badge-red">無効</span>'}</td>
      <td>
        <div style="display:flex;gap:.35rem;align-items:center;flex-wrap:nowrap">
          ${u.is_active ? `<button class="btn btn-danger btn-sm deactivate-btn" data-id="${esc(String(u.id))}" style="font-size:.7rem;padding:.18rem .55rem">無効化</button>` : `<button class="btn btn-ghost btn-sm activate-btn" data-id="${esc(String(u.id))}" style="font-size:.7rem;padding:.18rem .55rem">有効化</button>`}
          <button class="btn btn-ghost btn-sm quota-edit-btn" data-id="${esc(String(u.id))}" data-quota="${u.quota_bytes}" style="font-size:.7rem;padding:.18rem .55rem">クォータ編集</button>
          <button class="btn btn-danger btn-sm delete-user-btn" data-id="${esc(String(u.id))}" data-label="${esc(u.label)}" style="font-size:.7rem;padding:.18rem .55rem">削除</button>
        </div>
      </td>
    </tr>`;
    }).join('');

    document.querySelectorAll('.copy-auth-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.auth);
            const orig = btn.textContent;
            btn.textContent = '✓コピー済み';
            setTimeout(() => { btn.textContent = orig; }, 1500);
        });
    });

    document.querySelectorAll('.deactivate-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('このユーザーを無効化しますか？')) return;
            const res = await fetch(`/api/admin/users/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) loadUsers();
        });
    });

    document.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const res = await fetch(`/api/admin/users/${btn.dataset.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: 1 }),
            });
            if (res.ok) loadUsers();
        });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(`「${btn.dataset.label}」を完全に削除しますか？\nこのユーザーのファイルもすべて削除されます。この操作は取り消せません。`)) return;
            const res = await fetch(`/api/admin/users/${btn.dataset.id}/purge`, { method: 'DELETE' });
            if (res.ok) { loadUsers(); loadStats(); loadAdminFiles(); }
        });
    });

    document.querySelectorAll('.quota-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const currentMB = Math.round(parseInt(btn.dataset.quota, 10) / 1048576);
            const input = prompt(`新しいクォータ (MB):\n現在: ${currentMB} MB`, currentMB);
            if (input === null) return;
            const mb = parseInt(input, 10);
            if (!mb || mb <= 0) { alert('無効な値です'); return; }
            const res = await fetch(`/api/admin/users/${btn.dataset.id}/quota`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotaBytes: mb * 1048576 }),
            });
            if (res.ok) loadUsers();
        });
    });
}

document.getElementById('create-user-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('create-user-msg');
    const body = {
        label: document.getElementById('new-label').value.trim(),
        isAdmin: document.getElementById('new-is-admin').checked ? 1 : 0,
        quotaBytes: (parseFloat(document.getElementById('new-quota').value) || 10) * 1073741824,
        defaultExpiryDays: parseInt(document.getElementById('new-expiry').value, 10) || null,
    };

    const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (res.ok) {
        const data = await res.json();
        msg.style.color = 'var(--green)';
        msg.innerHTML = `ユーザーを作成しました — Auth ID: <code style="user-select:all;background:var(--bg3);padding:2px 6px;border-radius:4px;font-size:.85rem">${esc(data.authId.slice(0, 7))}...</code> <button type="button" class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${esc(data.authId)}');this.textContent='コピー済み';setTimeout(()=>this.textContent='コピー',1500)" style="margin-left:.4rem">コピー</button>`;
        e.target.reset();
        loadUsers();
    } else {
        const data = await res.json();
        msg.style.color = 'var(--red)';
        msg.textContent = data.error || '作成に失敗しました';
    }
});

async function loadAdminFiles(search = '') {
    const tbody = document.getElementById('admin-file-list');
    if (!tbody) return;

    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    let files = [];
    let groups = [];

    try {
        const [filesRes, groupsRes] = await Promise.all([
            fetch('/api/admin/files' + q),
            fetch('/api/admin/groups' + q),
        ]);

        if (!filesRes.ok || !groupsRes.ok) {
            throw new Error('admin files fetch failed');
        }

        [files, groups] = await Promise.all([
            filesRes.json(),
            groupsRes.json(),
        ]);
    } catch (_) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-sub" style="padding:2rem;text-align:center">ファイル一覧の取得に失敗しました</td></tr>';
        return;
    }

    const all = [
        ...groups.map(g => ({ type: 'group', ...g })),
        ...files.map(f => ({ type: 'file', ...f })),
    ];
    all.sort((a, b) => b.created_at - a.created_at);

    if (all.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-sub">ファイルがありません</td></tr>';
        return;
    }

    tbody.innerHTML = all.map(item => buildFileRow(item, {
        cbClass: 'admin-file-check',
        showUser: true,
        showDl: false,
        showDiscord: false,
    })).join('');

    document.querySelectorAll('.fr-del-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('このファイルを削除しますか？')) return;
            const res = await fetch(`/api/admin/files/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) loadAdminFiles(document.getElementById('file-search-input').value.trim());
        });
    });

    document.querySelectorAll('.fr-del-grp-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('このグループと含まれるファイルをすべて削除しますか？')) return;
            const res = await fetch(`/api/admin/groups/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) loadAdminFiles(document.getElementById('file-search-input').value.trim());
        });
    });

    const selectAll = document.getElementById('admin-select-all');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onchange = function () {
            document.querySelectorAll('.admin-file-check').forEach(cb => { cb.checked = this.checked; });
        };
    }
}

document.getElementById('file-search-btn').addEventListener('click', () => {
    loadAdminFiles(document.getElementById('file-search-input').value.trim());
});

document.getElementById('file-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadAdminFiles(document.getElementById('file-search-input').value.trim());
});

async function init() {
    const me = await fetch('/api/auth/me').then(r => r.json());
    document.getElementById('nav-username').textContent = me.label;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        location.href = '/login';
    });

    loadStats();
    loadUsers();
    loadAdminFiles();
}

init();
