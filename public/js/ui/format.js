/**
 * Shared formatting utilities used across pages.
 */

export function fmtBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024)       return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtRelative(ts) {
  if (!ts) return '—';
  const now  = Date.now();
  const diff = now - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s <  60)   return 'たった今';
  const m = Math.floor(s / 60);
  if (m <  60)   return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h <  24)   return `${h}時間前`;
  const day = Math.floor(h / 24);
  if (day < 30)  return `${day}日前`;
  return fmtDate(ts);
}

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mimeIcon(mimeType) {
  if (!mimeType) return genericIcon();
  if (mimeType.startsWith('image/'))  return imageIcon();
  if (mimeType.startsWith('video/'))  return videoIcon();
  if (mimeType.startsWith('audio/'))  return audioIcon();
  if (mimeType.includes('pdf'))       return pdfIcon();
  if (mimeType.includes('zip') || mimeType.includes('gzip') || mimeType.includes('tar')) return archiveIcon();
  if (mimeType.includes('text/'))     return textIcon();
  return genericIcon();
}

export function statusBadge(status) {
  const map = {
    uploading:  { cls: 'badge-warning', label: 'アップロード中' },
    processing: { cls: 'badge-primary', label: '処理中' },
    ready:      { cls: 'badge-success', label: '完了' },
    expired:    { cls: 'badge-muted',   label: '期限切れ' },
    deleted:    { cls: 'badge-error',   label: '削除済み' },
    failed:     { cls: 'badge-error',   label: '失敗' },
  };
  const info = map[status] ?? { cls: 'badge-muted', label: status };
  return `<span class="badge ${info.cls}"><span class="badge-dot"></span>${escHtml(info.label)}</span>`;
}

export function copyToClipboard(text) {
  return navigator.clipboard.writeText(text);
}

// ── Icon SVGs ─────────────────────────────────────────────────
function imageIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#22c55e"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>`;
}
function videoIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#3b82f6"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/></svg>`;
}
function audioIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#a855f7"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd"/></svg>`;
}
function pdfIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#ef4444"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>`;
}
function archiveIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#f59e0b"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`;
}
function textIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#94a3b8"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>`;
}
function genericIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="color:#64748b"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>`;
}
