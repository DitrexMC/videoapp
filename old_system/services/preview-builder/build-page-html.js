const { escapeHtml, fmtBytes, fmtDate } = require('../file-utils');

function buildPageHtml({
    file, category, ext, hljsLang, isMarkdown, isSvg,
    rawUrl, fileId, pageUrl,
    ogImageTag, ogVideoTag, extraHeadLinks, extraScripts,
    previewSection, isOwner, ownerLabel, hideUploader,
}) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(file.original_name)} — VideoApp</title>
<meta property="og:site_name" content="VideoApp">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:title" content="${escapeHtml(file.original_name)}">
<meta property="og:description" content="${escapeHtml(file.mime_type)} · ${escapeHtml(fmtBytes(file.size_bytes))}">
${ogImageTag}
${ogVideoTag}
${extraHeadLinks}
<link rel="stylesheet" href="/css/file-preview.css">
<script>(function(){var m=document.cookie.match('(?:^|;)\\s*theme\\s*=\\s*([^;]+)');document.documentElement.setAttribute('data-theme',m?m[1]:'dark');})();</script>
</head>
<body class="preview-${escapeHtml(category)}">
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
  ${previewSection}

  <div class="info-panel">
      <div class="info-inner">
      <div id="owner-data" data-owner-id="${escapeHtml(String(file.user_id))}" hidden></div>
      <div class="info-top">
        <div>
          <div class="file-name">${escapeHtml(file.original_name)}</div>
          <div class="file-mime">${escapeHtml(file.mime_type)}</div>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="/f/${escapeHtml(fileId)}/download">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ダウンロード
          </a>
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
        <span class="chip">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          ${escapeHtml(fmtBytes(file.size_bytes))}
        </span>
        <span class="chip">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${escapeHtml(fmtDate(file.created_at))} アップロード
        </span>
        ${file.expires_at ? `<span class="chip" style="border-color:rgba(245,158,11,.3);color:var(--y)">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${escapeHtml(fmtDate(file.expires_at))}まで有効
        </span>` : ''}
        <span class="chip">${escapeHtml(ext ? ext.toUpperCase() : '—')}</span>
        ${!hideUploader && ownerLabel ? `<span class="chip" style="color:var(--a3);border-color:rgba(59,130,246,.3)">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${escapeHtml(ownerLabel)}
      </span>` : ''}
      </div>
      <div id="owner-panel"${isOwner ? '' : ' hidden'}>
        <div class="owner-panel-inner">
          <div class="owner-section-title">オーナー操作</div>
          <div class="owner-row">
            <label class="owner-label">ファイル名変更</label>
            <div class="owner-rename-row">
              <input class="owner-input" id="owner-name-input" type="text" maxlength="255" placeholder="${escapeHtml(file.original_name)}" value="${escapeHtml(file.original_name)}">
              <button type="button" class="btn btn-sm" id="owner-rename-btn">保存</button>
            </div>
          </div>
          <div class="owner-row">
            <label class="owner-label">有効期限変更</label>
            <div class="owner-rename-row">
              <input class="owner-input" id="owner-expiry-input" type="datetime-local"${file.expires_at ? ' value="' + escapeHtml(new Date(file.expires_at).toISOString().slice(0,16)) + '"' : ''}>
              <button type="button" class="btn btn-sm" id="owner-expiry-btn">保存</button>
              <button type="button" class="btn btn-sm" id="owner-expiry-clear-btn" style="color:var(--y);border-color:rgba(245,158,11,.3)">期限なし</button>
            </div>
          </div>
          <div class="owner-row">
            <label class="owner-label">公開設定</label>
            <button type="button" class="btn btn-sm" id="owner-privacy-btn">${file.is_private ? '非公開 → 公開にする' : '公開 → 非公開 にする'}</button>
          </div>
          <div class="owner-row">
            <label class="owner-label">投稿者表示</label>
            <button type="button" class="btn btn-sm" id="btn-toggle-uploader" data-show-uploader="${file.show_uploader ? '1' : '0'}">${file.show_uploader ? '投稿者表示: ON' : '投稿者表示: OFF'}</button>
          </div>
          <div class="owner-row">
            <label class="owner-label">削除</label>
            <button type="button" class="btn btn-sm" id="owner-delete-btn" style="color:var(--r);border-color:rgba(239,68,68,.3)">このファイルを削除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

${category === 'image' ? `
<div class="lightbox" id="lightbox">
  <button type="button" class="lightbox-close" id="lb-close" aria-label="閉じる">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <img id="lb-img" src="${escapeHtml(rawUrl)}" alt="${escapeHtml(file.original_name)}">
</div>` : ''}

${extraScripts}
<script>
window.__previewConfig = {
  category: ${JSON.stringify(category)},
  rawUrl: ${JSON.stringify(rawUrl)},
  hljsLang: ${JSON.stringify(hljsLang)},
  isMarkdown: ${!!isMarkdown},
  isSvg: ${!!isSvg},
  fileId: ${JSON.stringify(fileId)}
};
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
    var hlDark=document.getElementById('hljs-theme');
    var hlLight=document.getElementById('hljs-theme-light');
    var mdDark=document.getElementById('md-theme');
    var mdLight=document.getElementById('md-theme-light');
    if(hlDark&&hlLight){hlDark.disabled=!isDark;hlLight.disabled=isDark;}
    if(mdDark&&mdLight){mdDark.disabled=!isDark;mdLight.disabled=isDark;}
  }
  if(btn){
    btn.addEventListener('click',function(){
      var cur=document.documentElement.getAttribute('data-theme')||'dark';
      var nxt=cur==='dark'?'light':'dark';
      document.cookie='theme='+nxt+';path=/;max-age=31536000;SameSite=Lax';
      applyTheme(nxt);
    });
  }
  applyTheme(document.documentElement.getAttribute('data-theme')||'dark');

  var restartBtn=document.getElementById('aud-restart');
  if(restartBtn){
    restartBtn.addEventListener('click',function(){
      var aud=document.getElementById('aud');
      if(aud){aud.currentTime=0;if(aud.paused)aud.play();}
    });
  }

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

    var currentFileId = ${JSON.stringify(fileId)};
    var ownerEl = document.getElementById('owner-data');
    var ownerPanel = document.getElementById('owner-panel');
    if (ownerPanel && ownerEl && String(me.id) === ownerEl.dataset.ownerId) {
      ownerPanel.hidden = false;
    }

    if (ownerPanel && !ownerPanel.hidden) {
      document.getElementById('owner-rename-btn').addEventListener('click', function() {
        var name = document.getElementById('owner-name-input').value.trim();
        if (!name) return;
        fetch('/api/user/files/' + currentFileId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name })
        }).then(function(r) { if (r.ok) location.reload(); });
      });

      var expiryInput = document.getElementById('owner-expiry-input');
      document.getElementById('owner-expiry-btn').addEventListener('click', function() {
        var val = expiryInput.value;
        if (!val) return;
        var ts = new Date(val).getTime();
        if (isNaN(ts) || ts <= Date.now()) { alert('有効期限は未来の日時を指定してください'); return; }
        fetch('/api/user/files/' + currentFileId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresAt: ts })
        }).then(function(r) { if (r.ok) location.reload(); });
      });

      document.getElementById('owner-expiry-clear-btn').addEventListener('click', function() {
        fetch('/api/user/files/' + currentFileId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresAt: null })
        }).then(function(r) { if (r.ok) location.reload(); });
      });

      document.getElementById('owner-privacy-btn').addEventListener('click', function() {
        fetch('/api/user/files/' + currentFileId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPrivate: ${!!file.is_private} ? false : true })
        }).then(function(r) { if (r.ok) location.reload(); });
      });

      document.getElementById('owner-delete-btn').addEventListener('click', function() {
        if (!confirm('このファイルを削除しますか？この操作は取り消せません。')) return;
        fetch('/api/user/files/' + currentFileId, { method: 'DELETE' })
          .then(function(r) { if (r.ok) location.href = '/'; });
      });

      document.getElementById('btn-toggle-uploader').addEventListener('click', function() {
        var current = this.dataset.showUploader === '1';
        var self = this;
        fetch('/api/files/' + currentFileId + '/show-uploader', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ show: !current })
        }).then(function(r) {
          if (r.ok) {
            self.dataset.showUploader = current ? '0' : '1';
            self.textContent = '投稿者表示: ' + (current ? 'OFF' : 'ON');
          }
        });
      });
    }
  }).catch(function(){});
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

module.exports = { buildPageHtml };