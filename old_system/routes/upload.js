const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const { requireAuthApi } = require('../middleware/auth');
const { createFile, getUserUsage, createGroup, getGroupById, updateFileGroupId } = require('../services/db');
const { uploadDir, maxFileSize, baseUrl } = require('../config');
const { generateVideoThumbnail } = require('../services/thumbnail');
const { checkAndConsume, getWaitSeconds } = require('../services/rate-limit');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        cb(null, nanoid(16) + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter: (req, file, cb) => {
        if (!req.user) return cb(null, true);
        const usedBytes = getUserUsage(req.user.id);
        if (usedBytes >= req.user.quota_bytes) {
            return cb(Object.assign(new Error('Quota exceeded'), { code: 'QUOTA_EXCEEDED' }));
        }
        cb(null, true);
    },
});

const router = express.Router();

router.post('/group', requireAuthApi, (req, res) => {
    const groupId = nanoid(10);
    createGroup({
        id: groupId,
        userId: req.user.id,
        createdAt: Date.now(),
        isPrivate: req.body.isPrivate === '1',
    });
    const url = `${baseUrl}/g/${groupId}`;
    res.json({ groupId, url });
});

router.get('/reserve', requireAuthApi, (req, res) => {
    const fileId = nanoid(10);
    const url = `${baseUrl}/f/${fileId}`;
    res.json({ fileId, url, discordUrl: url });
});

router.post('/', requireAuthApi, (req, res, next) => {
    if (!checkAndConsume(req.user.id)) {
        const wait = getWaitSeconds(req.user.id);
        return res.status(429).json({ error: `アップロード制限中です。${wait}秒後にもう一度お試しください。`, retryAfterSeconds: wait });
    }
    next();
}, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const usedBytes = getUserUsage(req.user.id);
    if (usedBytes + req.file.size > req.user.quota_bytes) {
        try { fs.unlinkSync(req.file.path); } catch (_) { }
        return res.status(413).json({ error: 'Quota exceeded' });
    }

    let expiresAt = null;
    const rawDays = req.body.expiryDays !== undefined ? req.body.expiryDays : req.user.default_expiry_days;
    const days = rawDays ? parseInt(rawDays, 10) : null;
    if (days && days > 0) expiresAt = Date.now() + days * 86400000;

    const bodyFileId = req.body.fileId;
    const fileId = (bodyFileId && /^[A-Za-z0-9_-]{10}$/.test(bodyFileId)) ? bodyFileId : nanoid(10);

    createFile({
        id: fileId,
        userId: req.user.id,
        originalName: originalName,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: req.file.path,
        createdAt: Date.now(),
        expiresAt,
        isPrivate: req.body.isPrivate === '1' ? 1 : 0,
        groupId: req.body.groupId || null,
    });

    if (req.file.mimetype.startsWith('video/')) {
        generateVideoThumbnail(req.file.path);
    }

    const url = `${baseUrl}/f/${fileId}`;
    const groupId = req.body.groupId;
    res.json({ ok: true, fileId, url, discordUrl: url, ...(groupId ? { groupId, groupUrl: `${baseUrl}/g/${groupId}` } : {}) });
});

router.use((err, req, res, next) => {
    if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (_) { }
    }
    if (err.code === 'QUOTA_EXCEEDED') {
        return res.status(413).json({ error: 'Quota exceeded' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large (max 5GB)' });
    }
    res.status(500).json({ error: 'Upload failed' });
});

module.exports = router;
