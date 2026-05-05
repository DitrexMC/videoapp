const { escapeHtml, fmtBytes } = require('../file-utils');

function buildGroupPageHtml({ group, files, fileCount, totalSize, categories, pageUrl, isOwner, ownerLabel, hideUploader }) {
  const groupName = group.label || (fileCount + 'ファイルのグループ');
  const catLabelMap = {
    video: '動画', image: '画像', audio: '音声',
    pdf: 'PDF', text: 'テキスト', font: 'フォント', binary: 'その他'
  };

  const fileRow = f => {
    const ext = (f.original_name.split('.').pop() || '').toLowerCase();
    const isHidden = !!f.is_private;
    const isImage = f.mime_type.startsWith('image/');
    const isVideo = f.mime_type.startsWith('video/');
    const showThumb = !isHidden && (isImage || isVideo);
    const thumbUrl = showThumb ? `/f/${escapeHtml(f.id)}/thumb` : '';
    const title = isHidden ? '非表示ファイル' : f.original_name;
    const meta = isHidden ? '非表示' : fmtBytes(f.size_bytes);
    const icon = isHidden && !isOwner
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
      : getMimeIcon(f.mime_type);

    const thumbHTML = showThumb
      ? `<img src="${thumbUrl}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:11px" onerror="this.style.display='none';this.nextElementSibling.style.display=''">
               <span class="gfi-icon" style="display:none">${getMimeIcon(f.mime_type)}</span>`
      : `<span class="gfi-icon${isHidden ? ' is-hidden' : ''}">${icon}</span>`;

    const openTag = isHidden && !isOwner
      ? '<div class="gfi gfi-hidden" aria-disabled="true">'
      : `<a class="gfi${isHidden ? ' gfi-hidden' : ''}" href="/f/${escapeHtml(f.id)}">`;
    const closeTag = isHidden && !isOwner ? '</div>' : '</a>';

    return `
        ${openTag}
          <div class="gfi-thumb">
            ${thumbHTML}
          </div>
          <span class="gfi-ext">${isHidden ? 'HIDDEN' : escapeHtml(ext.toUpperCase())}</span>
          <div class="gfi-name">${escapeHtml(title)}</div>
          <div class="gfi-meta">${escapeHtml(meta)}</div>
        ${closeTag}`;
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(groupName)} — VideoApp</title>
<meta property="og:site_name" content="VideoApp">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:title" content="${escapeHtml(groupName)}">
<meta property="og:description" content="${fileCount}件 · ${fmtBytes(totalSize)}">
<meta property="og:image" content="/css/og-default.svg">
<meta property="og:image:type" content="image/svg+xml">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/css/file-preview.css">
<link rel="stylesheet" href="/css/group-preview.css">
<script>(function(){var m=document.cookie.match('(?:^|;)\\s*theme\\s*=\\s*([^;]+)');document.documentElement.setAttribute('data-theme',m?m[1]:'dark');})();</script>
</head>
<body class="preview-group">
<nav>
  <a class="nav-logo" href="/">VideoApp</a>
  <ul class="nav-links">
    <li><a href="/">ホーム</a></li>
    <li><a href="/upload">アップロード</a></li>
    <li><a href="/myfiles">マイファイル</a></li>
    <li id="nav-admin-li" style="display:none"><a href="/admin">管理</a></li>
  </ul>
  <div class="nav-r">
    <span class="nav-username" id="nav-username"></span>
    <button type="button" class="theme-toggle" id="theme-toggle" title="テーマ切替"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></button>
    <button type="button" class="btn btn-sm" id="logout-btn" style="display:none">ログアウト</button>
  </div>
</nav>

<div class="viewer">
  <div class="group-header">
    <div class="gh-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    </div>
    <h1 class="gh-title">${escapeHtml(groupName)}</h1>
    <p class="gh-meta">${fileCount}ファイル · ${fmtBytes(totalSize)} · ${categories.map(c => catLabelMap[c] || c).join(' · ')}</p>
  </div>

  <div class="group-files">
    ${files.map(f => fileRow(f)).join('')}
  </div>

  <div class="info-panel">
    <div class="info-inner">
      <div id="owner-data" data-owner-id="${escapeHtml(String(group.user_id))}" hidden></div>
      <div class="info-top">
        <div>
          <div class="file-name">${fileCount}ファイルのグループ</div>
          <div class="file-mime">${categories.map(c => catLabelMap[c] || c).join(' · ')}</div>
        </div>
        <div class="actions">
          <button type="button" class="btn copy-btn" data-url="${escapeHtml(pageUrl)}" data-label="URLコピー">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            URLコピー
          </button>
          <button type="button" class="btn copy-btn" data-url="${escapeHtml(pageUrl)}/raw" data-label="Discord" style="color:#8b5cf6;border-color:rgba(139,92,246,.3)">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Discord
          </button>
        </div>
      </div>
      <div class="meta-chips">
        <span class="chip">${escapeHtml(fileCount)}件</span>
        <span class="chip">${escapeHtml(fmtBytes(totalSize))}</span>
        ${!hideUploader && ownerLabel ? `<span class="chip" style="color:var(--a3);border-color:rgba(59,130,246,.3)">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escapeHtml(ownerLabel)}
        </span>` : ''}
      </div>
    </div>
  </div>
</div>

<script>
window.__previewConfig = { category: 'group', fileCount: ${fileCount} };
</script>
<script src="/js/file-preview.js"></script>
<script>
(function(){
  var btn=document.getElementById('theme-toggle');
  function applyTheme(t){
    document.documentElement.setAttribute('data-theme',t);
    var isDark=t==='dark';
    if(btn){
      btn.innerHTML=isDark
        ?'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        :'<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      btn.title=isDark?'ライトモードに切替':'ダークモードに切替';
    }
  }
  if(btn){
    btn.addEventListener('click',function(){
      var cur=document.documentElement.getAttribute('data-theme')||'dark';
      var nxt=cur=='dark'?'light':'dark';
      document.cookie='theme='+nxt+';path=/;max-age=31536000;SameSite=Lax';
      applyTheme(nxt);
    });
  }
  applyTheme(document.documentElement.getAttribute('data-theme')||'dark');

  function copyText(text, button) {
    function onSuccess() {
      var orig = button.getAttribute('data-orig-html') || button.innerHTML;
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> コピー済み';
      button.classList.add('copied');
      setTimeout(function() { button.innerHTML = orig; button.classList.remove('copied'); }, 2000);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function() { fallback(text, onSuccess); });
    } else {
      fallback(text, onSuccess);
    }
  }
  function fallback(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (_) {}
    document.body.removeChild(ta);
  }
  function normalizeUrl(url) {
    try {
      var u = new URL(url, location.origin);
      u.pathname = u.pathname.replace(/\\/{2,}/g, '/');
      return u.toString();
    } catch (e) {
      return url.replace(/\\/{2,}/g, '/');
    }
  }
  document.querySelectorAll('.copy-btn').forEach(function(copyButton) {
    copyButton.setAttribute('data-orig-html', copyButton.innerHTML);
    copyButton.addEventListener('click', function() {
      var url = copyButton.dataset.url;
      if (url && url.startsWith('/')) { url = location.origin + url; }
      url = normalizeUrl(url);
      copyText(url, copyButton);
    });
  });

  fetch('/api/auth/me').then(function(r){ return r.ok ? r.json() : null; }).then(function(me) {
    if (!me) return;
    var uEl = document.getElementById('nav-username');
    if (uEl) uEl.textContent = me.label;
    var adminLi = document.getElementById('nav-admin-li');
    if (adminLi && me.isAdmin) adminLi.style.display = '';
    var logoutButton = document.getElementById('logout-btn');
    if (logoutButton) logoutButton.style.display = '';
  });
  var logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      fetch('/api/auth/logout', { method: 'POST' }).then(function() { location.href = '/login'; });
    });
  }
})();
</script>
</body>
</html>`;
}

function getMimeIcon(mime) {
  if (mime.startsWith('video/')) return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;
  if (mime.startsWith('image/')) return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  if (mime.startsWith('audio/')) return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  if (mime === 'application/pdf') return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  if (mime.startsWith('font/')) return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
  if (mime.startsWith('text/')) return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

module.exports = { buildGroupPageHtml };
