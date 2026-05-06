const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { getGroupById, getGroupFiles, getSessionWithUser, getUserById } = require('../services/db');
const { baseUrl, uploadDir } = require('../config');
const { escapeHtml, fmtBytes, getFileCategory, fmtDate } = require('../services/file-utils');
const { buildOgMeta } = require('../services/preview-builder');
const { buildGroupPageHtml } = require('../services/preview-builder/build-group-page-html');

const router = express.Router();

router.get('/:id', (req, res) => {
    const group = getGroupById(req.params.id);
    if (!group) return res.status(404).send('Not found');

    const sessionId = req.cookies && req.cookies.session;
    const session = sessionId ? getSessionWithUser(sessionId) : null;
    const validSession = !!(session && session.expires_at > Date.now() && session.is_active);
    const isOwner = validSession && session.id === group.user_id;

    if (group.is_private && !isOwner) {
        return res.status(403).send('このグループはプライベートです');
    }

    const ua = req.headers['user-agent'] || '';
    const isDiscordBot = /Discordbot|facebookexternalhit|Twitterbot|WhatsApp|Slackbot|LinkedInBot|TelegramBot/i.test(ua);

    const files = getGroupFiles(req.params.id);
    const totalSize = files.reduce((sum, f) => sum + f.size_bytes, 0);
    const fileCount = files.length;
    const categories = [...new Set(files.map(f => getFileCategory(f.mime_type, f.original_name)))];

    const pageUrl = new URL(`/g/${req.params.id}`, baseUrl).href;
    const safeTitle = `${fileCount}ファイルのグループ — VideoApp`;

    if (isDiscordBot) {
        const firstImage = files.find(f => f.mime_type.startsWith('image/'));
        const firstVideo = files.find(f => f.mime_type.startsWith('video/'));
        const ogImageUrl = firstImage
            ? new URL(`/f/${firstImage.id}/raw`, baseUrl).href
            : firstVideo
                ? new URL(`/f/${firstVideo.id}/thumb`, baseUrl).href
                : `${baseUrl}/css/og-default.svg`;
        const ogImageType = firstImage ? firstImage.mime_type : (firstVideo ? 'image/jpeg' : 'image/svg+xml');
        const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<meta property="og:site_name" content="VideoApp">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${fileCount}件 · ${fmtBytes(totalSize)}">
<meta property="og:image" content="${escapeHtml(ogImageUrl)}">
<meta property="og:image:type" content="${escapeHtml(ogImageType)}">
<meta name="twitter:card" content="summary_large_image">
</head><body></body></html>`;
        return res.type('html').send(html);
    }

    const owner = getUserById(group.user_id);
    const ownerLabel = owner ? owner.label : null;
    const hideUploader = group.show_uploader === 0;

    const html = buildGroupPageHtml({
        group, files, fileCount, totalSize, categories,
        pageUrl, isOwner, ownerLabel, hideUploader,
    });

    res.type('html').send(html);
});

router.get('/:id/download', (req, res) => {
    const group = getGroupById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });

    if (group.is_private) {
        const sessionId = req.cookies && req.cookies.session;
        const session = sessionId ? getSessionWithUser(sessionId) : null;
        const validSession = !!(session && session.expires_at > Date.now() && session.is_active);
        const isOwner = validSession && session.id === group.user_id;
        if (!isOwner) return res.status(403).json({ error: 'Private group' });
    }

    const files = getGroupFiles(req.params.id);
    const groupName = (group.label || 'group-' + req.params.id).replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF_-]/g, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(groupName)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.pipe(res);

    for (const f of files) {
        const filePath = path.join(uploadDir, path.basename(f.storage_path));
        if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: f.original_name });
        }
    }

    archive.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    archive.finalize();
});

router.get('/:id/raw', (req, res) => {
    const group = getGroupById(req.params.id);
    if (!group) return res.status(404).send('Not found');
    res.redirect(302, `/g/${req.params.id}`);
});

module.exports = router;
