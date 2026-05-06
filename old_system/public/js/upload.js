document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const queueSection = document.getElementById('queue-section');
    const queueList = document.getElementById('queue-list');

    let dragCounter = 0;

    document.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        dropzone.classList.add('drag-over');
    });
    document.addEventListener('dragover', e => {
        e.preventDefault();
    });
    document.addEventListener('dragleave', () => {
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dropzone.classList.remove('drag-over');
        }
    });
    document.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) startQueue(Array.from(e.dataTransfer.files));
    });

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) startQueue(Array.from(fileInput.files));
        fileInput.value = '';
    });

    document.addEventListener('paste', e => {
        const clipFiles = [];
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            clipFiles.push(...Array.from(e.clipboardData.files));
        } else if (e.clipboardData.items) {
            for (const item of e.clipboardData.items) {
                if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f) clipFiles.push(f);
                }
            }
        }
        if (clipFiles.length > 0) {
            e.preventDefault();
            startQueue(clipFiles);
        }
    });

    document.getElementById('expiry-select').addEventListener('change', function () {
        document.getElementById('custom-days').classList.toggle('hidden', this.value !== 'custom');
    });

    const privateToggle = document.getElementById('private-toggle');
    const privateLabel = document.getElementById('private-label');
    if (privateToggle && privateLabel) {
        privateToggle.addEventListener('change', function () {
            privateLabel.textContent = this.checked ? 'オン（非公開）' : 'オフ（公開）';
        });
    }

    function getExpiryDays() {
        const select = document.getElementById('expiry-select');
        if (select.value === 'custom') {
            const v = parseInt(document.getElementById('custom-days').value, 10);
            return v > 0 ? String(v) : '';
        }
        return select.value;
    }

    function startQueue(files) {
        const MAX_SIZE = 5 * 1024 * 1024 * 1024;
        const tooBig = files.filter(f => f.size > MAX_SIZE);
        const valid = files.filter(f => f.size <= MAX_SIZE);
        if (tooBig.length > 0) {
            queueSection.hidden = false;
            tooBig.forEach(f => {
                const err = document.createElement('div');
                err.className = 'qi';
                err.innerHTML = `<div class="qi-header"><span class="qi-name">${esc(f.name)}</span><span class="qi-size">${fmtBytes(f.size)}</span><span class="qi-status qi-status--error">サイズ超過 (最大5GB)</span></div>`;
                queueList.prepend(err);
            });
        }
        if (valid.length === 0) return;
        queueSection.hidden = false;
        triggerAcceptAnimation();
        const fragment = document.createDocumentFragment();
        const items = valid.map((file, i) => {
            const item = createQueueItem(file, i + Date.now());
            fragment.appendChild(item.el);
            return { file, ...item };
        });
        queueList.insertBefore(fragment, queueList.firstChild);

        const batchSize = valid.length;
        const expiryDays = getExpiryDays();
        const isPrivate = document.getElementById('private-toggle')?.checked ? '1' : '0';

        if (batchSize >= 2) {
            fetch('/api/upload/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPrivate }),
            })
                .then(r => r.json())
                .then(g => {
                    items.forEach(item => { item.groupId = g.groupId; item.groupUrl = g.url; });
                    uploadConcurrent(items, expiryDays, 5);
                })
                .catch(() => { uploadConcurrent(items, expiryDays, 5); });
        } else {
            uploadConcurrent(items, expiryDays, 5);
        }
    }

    function createQueueItem(file, idx) {
        const el = document.createElement('div');
        el.className = 'qi';
        el.id = `qi-${idx}`;
        el.innerHTML = `
            <div class="qi-header">
                <span class="qi-name">${esc(file.name)}</span>
                <span class="qi-size">${fmtBytes(file.size)}</span>
                <span class="qi-status qi-status--wait">待機中</span>
            </div>
            <div class="qi-progress" hidden>
                <div class="progress-wrap"><div class="progress-bar qi-bar" style="width:0%"></div></div>
                <span class="qi-pct">0%</span>
            </div>
            <div class="qi-result" hidden></div>
        `;
        return {
            el,
            statusEl: el.querySelector('.qi-status'),
            progressEl: el.querySelector('.qi-progress'),
            barEl: el.querySelector('.qi-bar'),
            pctEl: el.querySelector('.qi-pct'),
            resultEl: el.querySelector('.qi-result'),
        };
    }

    function uploadConcurrent(items, expiryDays, maxConcurrency) {
        let idx = 0;
        let active = 0;
        let completed = 0;
        const hasGroup = items.length >= 2 && items[0].groupId;
        const groupUrl = hasGroup ? items[0].groupUrl : null;

        function next() {
            while (active < maxConcurrency && idx < items.length) {
                active++;
                const item = items[idx++];
                uploadOne(item, expiryDays, () => {
                    active--;
                    completed++;
                    if (completed === items.length && hasGroup) {
                        const groupEl = document.createElement('div');
                        groupEl.className = 'qi';
                        groupEl.style.borderColor = 'var(--accent2)';
                        groupEl.style.borderWidth = '2px';
                        groupEl.innerHTML = `<div style="text-align:center;padding:.5rem">
                            <div style="font-weight:700;margin-bottom:.5rem;color:var(--accent2)">${items.length}ファイルのグループ</div>
                            <a class="btn btn-primary btn-sm" href="${groupUrl}" style="text-decoration:none">グループプレビュー →</a>
                        </div>`;
                        queueList.insertBefore(groupEl, queueList.firstChild);
                    }
                    next();
                });
            }
        }
        next();
    }

    function uploadOne(item, expiryDays, onDone) {
        item.statusEl.textContent = 'アップロード中';
        item.statusEl.className = 'qi-status qi-status--uploading';
        item.progressEl.hidden = false;

        let reservedFileId = null;

        function doUpload(fileId) {
            const formData = new FormData();
            formData.append('file', item.file);
            const isPrivate = document.getElementById('private-toggle')?.checked ? '1' : '0';
            formData.append('isPrivate', isPrivate);
            if (expiryDays) formData.append('expiryDays', expiryDays);
            if (fileId) formData.append('fileId', fileId);
            if (item.groupId) formData.append('groupId', item.groupId);

            const xhr = new XMLHttpRequest();
            const startTime = Date.now();

            xhr.upload.addEventListener('progress', e => {
                if (!e.lengthComputable) return;
                const pct = Math.round(e.loaded / e.total * 100);
                const elapsed = (Date.now() - startTime) / 1000 || 0.001;
                const speed = e.loaded / elapsed;
                const speedMB = speed / 1024 / 1024;
                const remaining = speed > 0 ? (e.total - e.loaded) / speed : 0;
                item.barEl.style.width = pct + '%';
                let etaStr = '';
                if (remaining > 0 && pct < 100) {
                    if (remaining < 60) etaStr = ` — 残り${Math.ceil(remaining)}秒`;
                    else etaStr = ` — 残り${Math.ceil(remaining / 60)}分`;
                }
                item.pctEl.textContent = `${pct}% — ${speedMB.toFixed(1)} MB/s${etaStr}`;
            });

            xhr.addEventListener('load', () => {
                item.progressEl.hidden = true;
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    item.statusEl.textContent = '完了';
                    item.statusEl.className = 'qi-status qi-status--done';
                    item.resultEl.hidden = false;
                    item.resultEl.innerHTML = `
                        <div style="display:flex;gap:.5rem;flex-wrap:nowrap;align-items:center;margin-top:.3rem">
                            <button class="copy-btn" data-url="${esc(data.url)}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> URLコピー</button>
                            <button class="copy-btn discord-copy-btn" data-url="${esc(data.discordUrl)}/raw"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Discord</button>
                            <a class="btn btn-primary btn-sm" href="/f/${esc(data.fileId)}" style="text-decoration:none">プレビュー →</a>
                            ${data.groupUrl ? `<a class="btn btn-sm" href="${esc(data.groupUrl)}" style="text-decoration:none;color:var(--p);border-color:rgba(139,92,246,.3)">グループ →</a>` : ''}
                        </div>
                    `;
                    item.resultEl.querySelectorAll('.copy-btn').forEach(btn => {
                        btn.addEventListener('click', () => copyUrl(btn, btn.dataset.url));
                    });
                } else {
                    item.statusEl.textContent = 'エラー';
                    item.statusEl.className = 'qi-status qi-status--error';
                    let msg = 'エラー';
                    try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) { }
                    item.resultEl.hidden = false;
                    item.resultEl.innerHTML = `<span class="qi-error-msg">${esc(msg)}</span>`;
                }
                onDone();
            });

            xhr.addEventListener('error', () => {
                item.progressEl.hidden = true;
                item.statusEl.textContent = 'エラー';
                item.statusEl.className = 'qi-status qi-status--error';
                item.resultEl.hidden = false;
                item.resultEl.innerHTML = '<span class="qi-error-msg">ネットワークエラー</span>';
                onDone();
            });

            xhr.open('POST', '/api/upload');
            xhr.send(formData);
        }

        fetch('/api/upload/reserve')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.fileId) {
                    reservedFileId = data.fileId;
                }
            })
            .catch(() => { })
            .finally(() => doUpload(reservedFileId));
    }

    function normalizeUrl(url) {
        return url.replace(/([^:])\/\/+/g, '$1/');
    }

    function copyUrl(btn, url) {
        url = normalizeUrl(url);
        const orig = btn.textContent;
        function onSuccess() {
            btn.textContent = '✓ コピー済み';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(onSuccess).catch(() => fallback());
        } else {
            fallback();
        }
        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { document.execCommand('copy'); onSuccess(); } catch (_) { }
            document.body.removeChild(ta);
        }
    }

    function triggerAcceptAnimation() {
        dropzone.style.transition = 'box-shadow 0.08s ease, border-color 0.08s ease, transform 0.08s ease';
        dropzone.style.boxShadow = '0 0 60px rgba(59,130,246,1), inset 0 0 40px rgba(59,130,246,0.3), 0 0 0 4px rgba(59,130,246,0.4)';
        dropzone.style.borderColor = 'var(--accent2)';
        dropzone.style.transform = 'scale(1.01)';
        setTimeout(() => {
            dropzone.style.boxShadow = '';
            dropzone.style.borderColor = '';
            dropzone.style.transform = '';
        }, 500);

        const overlay = document.createElement('div');
        overlay.className = 'drop-accept-overlay';
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('drop-accept-overlay--active'));
        overlay.addEventListener('animationend', () => overlay.remove());
        dropzone.classList.add('drop-accepted');
        setTimeout(() => dropzone.classList.remove('drop-accepted'), 700);
    }

    function fmtBytes(b) {
        if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
        if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
        if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
        return b + ' B';
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
