const path = require('path');
const fs = require('fs');
const { uploadDir } = require('../config');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtBytes(b) {
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
  return b + ' B';
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function streamFile(req, res, file, disposition) {
  const filePath = path.join(uploadDir, path.basename(file.storage_path));

  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(file.original_name)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const rawEnd = endStr ? parseInt(endStr, 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
      return res.end();
    }

    const end = Math.min(isNaN(rawEnd) ? fileSize - 1 : rawEnd, fileSize - 1);

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': end - start + 1,
    });
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => { if (!res.headersSent) res.end(); else res.destroy(); });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => { if (!res.headersSent) res.end(); else res.destroy(); });
    stream.pipe(res);
  }
}

function isTextMime(mime, name) {
  if (mime.startsWith('text/')) return true;
  const textMimes = new Set([
    'application/json', 'application/xml', 'application/javascript',
    'application/typescript', 'application/x-yaml', 'application/yaml',
    'application/toml', 'application/x-sh', 'application/graphql',
    'application/ld+json', 'image/svg+xml', 'application/x-httpd-php',
  ]);
  if (textMimes.has(mime)) return true;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const textExts = new Set([
    'txt', 'md', 'markdown', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
    'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm',
    'xhtml', 'php', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'cpp', 'h', 'hpp', 'cs',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'lua', 'sql', 'gql', 'graphql', 'vue',
    'svelte', 'astro', 'env', 'gitignore', 'gitattributes', 'editorconfig',
    'dockerfile', 'makefile', 'cmake', 'gradle', 'properties', 'log', 'patch',
    'diff', 'tex', 'r', 'scala', 'clj', 'cljs', 'ex', 'exs', 'erl', 'ml', 'mli',
    'swift', 'dart', 'zig', 'tf', 'hcl', 'nix',
  ]);
  return textExts.has(ext);
}

function getFileCategory(mime, name) {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('font/') || mime.startsWith('application/font') || mime === 'application/vnd.ms-fontobject' || mime === 'application/x-font-ttf' || mime === 'application/x-font-woff') return 'font';
  if (isTextMime(mime, name)) return 'text';
  return 'binary';
}

function getHljsLang(mime, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const byExt = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript',
    jsx: 'javascript', tsx: 'typescript', css: 'css', scss: 'scss', less: 'less',
    html: 'html', htm: 'html', xhtml: 'xml', xml: 'xml', svg: 'xml', json: 'json',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', py: 'python', rb: 'ruby', go: 'go',
    rs: 'rust', java: 'java', kt: 'kotlin', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'shell',
    ps1: 'powershell', lua: 'lua', sql: 'sql', gql: 'graphql', graphql: 'graphql',
    php: 'php', swift: 'swift', dart: 'dart', r: 'r', scala: 'scala',
    md: 'markdown', markdown: 'markdown', dockerfile: 'dockerfile',
    tf: 'hcl', hcl: 'hcl', nix: 'nix',
  };
  if (byExt[ext]) return byExt[ext];
  if (mime === 'application/json') return 'json';
  if (mime === 'application/xml' || mime === 'image/svg+xml') return 'xml';
  if (mime === 'application/javascript') return 'javascript';
  if (mime === 'text/css') return 'css';
  if (mime === 'text/html') return 'html';
  if (mime === 'application/x-sh') return 'bash';
  return 'plaintext';
}

function getBinaryMeta(mime, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const archives = new Set(['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'tgz', 'tbz', 'br']);
  const office = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key']);
  const exe = new Set(['exe', 'dmg', 'pkg', 'deb', 'rpm', 'msi', 'app', 'apk', 'ipa', 'bin', 'out', 'run']);
  const db = new Set(['db', 'sqlite', 'sqlite3', 'mdb', 'accdb']);
  const threed = new Set(['obj', 'fbx', 'stl', 'glb', 'gltf', 'blend', '3ds', 'dae']);
  const cert = new Set(['pem', 'crt', 'cer', 'der', 'p12', 'pfx', 'key', 'csr']);

  if (archives.has(ext)) return { label: 'Archive', color: '#f59e0b', icon: 'archive' };
  if (office.has(ext)) return { label: 'Document', color: '#3b82f6', icon: 'document' };
  if (exe.has(ext)) return { label: 'Executable', color: '#ef4444', icon: 'exe' };
  if (db.has(ext)) return { label: 'Database', color: '#8b5cf6', icon: 'database' };
  if (threed.has(ext)) return { label: '3D Model', color: '#10b981', icon: '3d' };
  if (cert.has(ext)) return { label: 'Certificate', color: '#f472b6', icon: 'cert' };
  return { label: ext ? ext.toUpperCase() : 'Binary', color: '#94a3b8', icon: 'file' };
}

const BINARY_ICONS = {
  archive: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  document: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  exe: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  '3d': `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  cert: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  file: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

module.exports = {
  escapeHtml,
  fmtBytes,
  fmtDate,
  streamFile,
  isTextMime,
  getFileCategory,
  getHljsLang,
  getBinaryMeta,
  BINARY_ICONS,
};
