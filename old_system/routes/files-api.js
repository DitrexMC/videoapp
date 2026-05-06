'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const { getFileById, updateFile, deleteFile, getUserById, getSessionWithUser } = require('../services/db');
const { deleteFile: storageDelete } = require('../services/storage');
const { requireAuthApi } = require('../middleware/auth');
const { uploadDir } = require('../config');

const router = express.Router();

router.get('/:id', async (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });

    if (file.is_private) {
        const sessionId = req.cookies && req.cookies.session;
        const session = sessionId ? getSessionWithUser(sessionId) : null;
        if (!session || session.expires_at < Date.now() || !session.is_active || session.id !== file.user_id) {
            return res.status(403).json({ error: 'このファイルはプライベートです' });
        }
    }

    const response = {
        id: file.id,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        created_at: new Date(file.created_at).toISOString(),
        expires_at: file.expires_at ? new Date(file.expires_at).toISOString() : null,
        is_private: file.is_private === 1,
        show_uploader: file.show_uploader !== 0,
    };

    if (file.show_uploader !== 0) {
        const owner = getUserById(file.user_id);
        if (owner) {
            response.uploaded_by = owner.label;
        }
    }

    if (file.mime_type.startsWith('audio/')) {
        const filePath = path.join(uploadDir, path.basename(file.storage_path));
        if (fs.existsSync(filePath)) {
            try {
                const metadata = await mm.parseFile(filePath, { skipCovers: true, duration: true });
                const c = metadata.common;
                const f = metadata.format;
                response.audio_meta = {
                    title: c.title || null,
                    artist: c.artist || (c.artists ? c.artists.join(', ') : null),
                    album: c.album || null,
                    year: c.year || null,
                    duration: f.duration || null,
                };
            } catch (_) { }
        }
    }

    res.json(response);
});

router.delete('/:id', requireAuthApi, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    storageDelete(file.storage_path);
    deleteFile(file.id);
    res.json({ ok: true });
});

router.patch('/:id/expiry', requireAuthApi, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { days } = req.body;
    if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) {
        return res.status(400).json({ error: 'days must be a non-negative number' });
    }

    const expiresAt = days === 0 ? null : Date.now() + Math.floor(days) * 86400000;
    updateFile({ id: file.id, expiresAt });
    res.json({ ok: true });
});

router.patch('/:id/rename', requireAuthApi, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' });
    }

    const safeName = name.trim().replace(/[/\\]/g, '').slice(0, 255);
    if (!safeName) return res.status(400).json({ error: 'Invalid name' });

    updateFile({ id: file.id, originalName: safeName });
    res.json({ ok: true });
});

router.patch('/:id/show-uploader', requireAuthApi, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { show } = req.body;
    if (typeof show !== 'boolean') {
        return res.status(400).json({ error: 'show must be a boolean' });
    }

    updateFile({ id: file.id, showUploader: show });
    res.json({ ok: true });
});

module.exports = router;
