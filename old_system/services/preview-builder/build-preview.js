const { escapeHtml, BINARY_ICONS } = require('../file-utils');

function buildPreview(category, file, rawUrl, fileId, hljsLang, isMarkdown, isSvg, binMeta, ext) {
    const safeRaw = escapeHtml(rawUrl);
    const safeName = escapeHtml(file.original_name);
    const safeId = escapeHtml(fileId);
    const safeMime = escapeHtml(file.mime_type);

    if (category === 'video') {
        const thumbPoster = `/f/${escapeHtml(fileId)}/thumb`;
        return `<div class="media-wrap">
  <div class="media-glow"></div>
  <video id="vid" controls preload="metadata" playsinline poster="${thumbPoster}">
    <source id="vid-src" src="${safeRaw}" type="${safeMime}">
  </video>
  <div class="media-err" id="media-err" style="display:none;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:3rem 2rem;z-index:2;position:relative;">
    <div class="media-err-icon">⚠️</div>
    <p>このブラウザでは再生できません<br><small style="font-size:.75rem;opacity:.7">(コーデック非対応またはファイルエラー)</small></p>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center">
      <a class="btn btn-primary" href="/f/${safeId}/download">ダウンロード</a>
      <a class="btn" href="${safeRaw}" target="_blank">直接開く</a>
    </div>
  </div>
</div>`;
    }

    if (category === 'image') {
        const showChecker = (ext === 'png' || ext === 'webp' || ext === 'gif' || ext === 'avif' || ext === 'svg' || isSvg);
        return `<div class="img-wrap${showChecker ? ' checker' : ''}" id="img-wrap">
  <div class="img-toolbar">
    ${showChecker ? `<button class="img-tb-btn" id="checker-toggle" type="button" title="透過グリッド切替">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      グリッド
    </button>` : ''}
    <button class="img-tb-btn" id="zoom-btn" type="button" title="拡大">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      拡大
    </button>
  </div>
  <img id="preview-img" src="${safeRaw}" alt="${safeName}" onerror="this.style.display='none';document.getElementById('img-err').style.display='flex'">
  <div id="img-err" style="display:none;position:relative;z-index:2;text-align:center;padding:4rem 2rem;flex-direction:column;align-items:center;gap:1rem;color:var(--ts);">
    <div style="font-size:2.5rem">🖼️</div>
    <p style="font-size:.9rem">画像を読み込めませんでした</p>
    <a class="btn btn-primary" href="/f/${safeId}/download">ダウンロード</a>
  </div>
</div>`;
    }

    if (category === 'audio') {
        return `<div class="audio-wrap">
  <canvas id="aud-spectrum" style="position:absolute;inset:0;width:100%;height:100%;opacity:.35;pointer-events:none;"></canvas>
  <div class="audio-bg-glow"></div>
  <audio id="aud" preload="auto" src="${safeRaw}" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none"></audio>
  <div class="audio-player">
    <div class="audio-art" id="aud-art-box">
      <img id="aud-art-img" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:50%" alt="cover">
      <svg id="aud-art-icon" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    </div>
    <div class="audio-title" id="aud-title" title="${safeName}">${safeName}</div>
    <div class="audio-sub" id="aud-sub">${escapeHtml(file.mime_type)}</div>
    <div id="aud-meta" class="audio-meta" hidden></div>
    <input type="range" class="audio-seek" id="aud-seek" min="0" max="100" step="0.1" value="0" style="touch-action:none">
    <div class="audio-times">
      <span id="aud-cur">0:00</span>
      <span id="aud-dur">—</span>
    </div>
    <div class="audio-controls">
      <button class="audio-btn" id="aud-restart" type="button" title="最初から再生">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
      </button>
      <button class="audio-btn" id="aud-rew" type="button" title="10秒戻る">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
      </button>
      <button class="audio-btn audio-btn-play" id="aud-play" type="button" title="再生/一時停止">
        <svg id="aud-play-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <button class="audio-btn" id="aud-fwd" type="button" title="10秒進む">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.51"/></svg>
      </button>
      <button class="audio-btn" id="aud-loop" type="button" title="ループ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      </button>
    </div>
    <div class="audio-vol-row" id="aud-vol-row">
      <span class="audio-vol-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      </span>
      <input class="audio-vol" id="aud-vol" type="range" min="0" max="1" step="0.02" value="1">
    </div>
    <div id="aud-vol-ios" style="display:none;font-size:.72rem;color:var(--ts);text-align:center;padding:.3rem 0">端末の音量ボタンで調節してください</div>
  </div>
</div>`;
    }

    if (category === 'pdf') {
        return `<div class="pdf-wrap-outer">
  <object id="pdf-obj" data="${safeRaw}" type="application/pdf" class="pdf-wrap">
    <div class="pdf-fallback">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>PDFをブラウザで表示できませんでした</p>
      <a class="btn btn-primary" href="${safeRaw}" target="_blank">別タブで開く</a>
      <a class="btn" href="/f/${safeId}/download">ダウンロード</a>
    </div>
  </object>
</div>`;
    }

    if (category === 'text') {
        const langLabel = isMarkdown ? 'Markdown' : hljsLang;
        return `<div class="code-outer">
  <div class="code-toolbar">
    <span class="code-lang-badge">${escapeHtml(langLabel)}</span>
    <div class="code-actions">
      ${isMarkdown ? `<button class="btn btn-sm" id="md-toggle" type="button" style="color:var(--a3)">レンダリング表示</button>` : ''}
      <button class="btn btn-sm" id="code-copy-btn" type="button">コードコピー</button>
      <a class="btn btn-sm" href="${safeRaw}" target="_blank">Raw</a>
    </div>
  </div>
  <div id="code-truncated-warn" class="code-truncated" style="display:none">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    ファイルが大きいため最初の部分のみ表示しています
  </div>
  <div id="code-container"><div class="code-loading">読み込み中...</div></div>
  <div id="md-container" style="display:none" class="md-body"></div>
</div>`;
    }

    if (category === 'font') {
        return `<div class="font-wrap">
  <div class="font-glow"></div>
  <style id="font-face-style">@font-face{font-family:'PreviewFont';src:url('${safeRaw}');}</style>
  <div class="font-sample" id="font-sample" style="font-family:'PreviewFont',serif">
    The quick brown fox jumps over the lazy dog
  </div>
  <div class="font-sample-sm" style="font-family:'PreviewFont',sans-serif">
    あいうえお　ABCDEFGHIJKLMNOPQRSTUVWXYZ　0123456789
  </div>
  <div class="font-controls">
    <span style="font-size:.75rem;color:var(--ts)">サイズ</span>
    <input class="font-size-slider" id="font-slider" type="range" min="16" max="120" value="48">
    <span class="font-size-lbl" id="font-size-lbl">48px</span>
  </div>
</div>`;
    }

    const glowColor = binMeta.color.replace('#', '');
    const r = parseInt(glowColor.slice(0, 2), 16);
    const g = parseInt(glowColor.slice(2, 4), 16);
    const b = parseInt(glowColor.slice(4, 6), 16);
    return `<div class="binary-wrap">
  <div class="binary-glow" style="background:radial-gradient(ellipse,rgba(${r},${g},${b},.12) 0%,transparent 70%)"></div>
  <div class="binary-icon-box" style="background:rgba(${r},${g},${b},.08);border-color:rgba(${r},${g},${b},.25);color:${binMeta.color};position:relative">
    ${BINARY_ICONS[binMeta.icon] || BINARY_ICONS.file}
    ${ext ? `<span class="binary-ext" style="background:rgba(${r},${g},${b},.15);color:${binMeta.color}">.${escapeHtml(ext)}</span>` : ''}
  </div>
  <div class="binary-label" style="color:${binMeta.color}">${escapeHtml(binMeta.label)}</div>
  <div class="binary-sub">このファイル形式はブラウザでプレビューできません。<br>ダウンロードして対応アプリで開いてください。</div>
  <div class="binary-actions">
    <a class="btn btn-primary" href="/f/${safeId}/download">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      ダウンロード
    </a>
  </div>
</div>`;
}

module.exports = { buildPreview };