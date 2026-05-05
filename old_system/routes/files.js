const express = require('express');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const { getFileById, getGroupById, getSessionWithUser, getUserById } = require('../services/db');
const { checkFileAccess } = require('../middleware/file-auth');
const { baseUrl, uploadDir } = require('../config');
const {
  streamFile,
  getFileCategory,
  getHljsLang,
  getBinaryMeta,
} = require('../services/file-utils');
const {
  buildPreview,
  buildOgMeta,
  buildPageHtml,
} = require('../services/preview-builder');
const { getThumbnailPath } = require('../services/thumbnail');

const router = express.Router();

router.get('/:id', (req, res) => {
  const file = getFileById(req.params.id);
  if (!file) return res.status(404).send('Not found');

  const sessionId = req.cookies && req.cookies.session;
  const session = sessionId ? getSessionWithUser(sessionId) : null;
  const validSession = !!(session && session.expires_at > Date.now() && session.is_active);
  const isOwner = validSession && session.id === file.user_id;

  const effectivePrivate = file.group_id
    ? (getGroupById(file.group_id)?.is_private || file.is_private)
    : file.is_private;

  if (effectivePrivate && !isOwner) {
    return res.status(403).send('このファイルはプライベートです');
  }

  const ua = req.headers['user-agent'] || '';
  const isDiscordBot = /Discordbot|facebookexternalhit|Twitterbot|WhatsApp|Slackbot|LinkedInBot|TelegramBot/i.test(ua);
  const isRaw = req.query.raw === '1';
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');

  const absRawUrl = new URL(`/f/${req.params.id}/raw`, baseUrl).href;
  const rawUrl = `/f/${req.params.id}/raw`;
  const pageUrl = new URL(`/f/${req.params.id}`, baseUrl).href;
  const thumbUrl = `${baseUrl}/f/${req.params.id}/thumb`;

  const category = getFileCategory(file.mime_type, file.original_name);
  const isVideo = category === 'video';
  const isImage = category === 'image';

  const ogResult = buildOgMeta({
    file, category, pageUrl, absRawUrl, thumbUrl, baseUrl, isImage, isVideo, isDiscordBot,
  });

  if (ogResult.botHtml) {
    return res.type('html').send(ogResult.html);
  }

  const { ogImageTag, ogVideoTag } = ogResult;

  if (isRaw || !acceptsHtml) {
    return streamFile(req, res, file, 'inline');
  }

  const ext = (file.original_name.split('.').pop() || '').toLowerCase();
  const hljsLang = getHljsLang(file.mime_type, file.original_name);
  const binMeta = getBinaryMeta(file.mime_type, file.original_name);
  const isMarkdown = (file.mime_type === 'text/markdown' || ext === 'md' || ext === 'markdown');
  const isSvg = (file.mime_type === 'image/svg+xml');

  const owner = getUserById(file.user_id);
  const ownerLabel = owner ? owner.label : null;
  const hideUploader = file.show_uploader === 0;

  const extraHeadLinks = (category === 'text')
    ? `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" id="hljs-theme">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css" id="hljs-theme-light" disabled>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-dark.min.css" id="md-theme">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css" id="md-theme-light" disabled>`
    : '';

  const extraScripts = (category === 'text')
    ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js"></script>`
    : '';

  const previewSection = buildPreview(category, file, rawUrl, req.params.id, hljsLang, isMarkdown, isSvg, binMeta, ext);

  const html = buildPageHtml({
    file, category, ext, hljsLang, binMeta, isMarkdown, isSvg,
    rawUrl, fileId: req.params.id, pageUrl, absRawUrl, thumbUrl,
    ogImageTag, ogVideoTag, extraHeadLinks, extraScripts,
    previewSection, isOwner, ownerLabel, hideUploader,
  });

  res.type('html').send(html);
});

router.get('/:id/thumb', async (req, res) => {
  const file = getFileById(req.params.id);
  if (!file) return res.status(404).end();
  const effectivePrivate = file.group_id
    ? (getGroupById(file.group_id)?.is_private || file.is_private)
    : file.is_private;
  if (effectivePrivate) return res.status(404).end();
  const category = getFileCategory(file.mime_type, file.original_name);
  if (category === 'image') {
    return res.redirect(302, `/f/${req.params.id}/raw`);
  }
  if (category === 'video') {
    const filePath = path.join(uploadDir, path.basename(file.storage_path));
    if (!fs.existsSync(filePath)) return res.status(404).end();
    const thumbPath = getThumbnailPath(filePath);
    if (thumbPath) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(thumbPath).pipe(res);
    }
    return res.status(404).end();
  }
  if (category === 'audio') {
    const filePath = path.join(uploadDir, path.basename(file.storage_path));
    if (!fs.existsSync(filePath)) return res.status(404).end();
    try {
      const metadata = await mm.parseFile(filePath, { skipCovers: false, duration: false });
      const pic = metadata.common.picture && metadata.common.picture[0];
      if (pic) {
        const ALLOWED_IMG_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
        const contentType = ALLOWED_IMG_TYPES.has(pic.format) ? pic.format : 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(Buffer.from(pic.data));
      }
    } catch (e) {
      console.error('[thumb] metadata parse error:', e.message);
    }
  }
  return res.status(404).end();
});

router.get('/:id/meta', async (req, res) => {
  const file = getFileById(req.params.id);
  if (!file || !file.mime_type.startsWith('audio/')) return res.json({});
  if (file.is_private) {
    const sessionId = req.cookies && req.cookies.session;
    const session = sessionId ? getSessionWithUser(sessionId) : null;
    if (!session || session.expires_at < Date.now() || session.id !== file.user_id) return res.json({});
  }
  const filePath = path.join(uploadDir, path.basename(file.storage_path));
  if (!fs.existsSync(filePath)) return res.json({});
  try {
    const metadata = await mm.parseFile(filePath, { skipCovers: false, duration: false });
    const c = metadata.common;
    const result = {
      title: c.title || null,
      artist: c.artist || (c.artists ? c.artists.join(', ') : null),
      album: c.album || null,
      year: c.year || null,
      genre: c.genre ? c.genre.join(', ') : null,
      track: (c.track && c.track.no) ? String(c.track.no) + (c.track.of ? '/' + c.track.of : '') : null,
    };
    if (c.picture && c.picture.length > 0) {
      const pic = c.picture[0];
      result.coverArt = 'data:' + pic.format + ';base64,' + Buffer.from(pic.data).toString('base64');
    }
    res.json(result);
  } catch (e) {
    res.json({});
  }
});

router.get('/:id/raw', (req, res) => {
  const file = getFileById(req.params.id);
  if (!file) return res.status(404).send('Not found');
  req.file = file;
  checkFileAccess(req, res, () => {
    streamFile(req, res, file, 'inline');
  });
});

router.get('/:id/download', (req, res) => {
  const file = getFileById(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  req.file = file;
  checkFileAccess(req, res, () => {
    streamFile(req, res, file, 'attachment');
  });
});

module.exports = router;
