const express = require('express');
const { requireAuthApi } = require('../middleware/auth');
const { getUserFiles, getUserGroups, getFileById, getGroupById, getGroupFiles, deleteFile, getUserUsage, updateFile, updateGroup } = require('../services/db');
const { deleteFile: storageDelete } = require('../services/storage');

const router = express.Router();

router.get('/files', requireAuthApi, (req, res) => {
    const files = getUserFiles(req.user.id, req.query.search || '');
    res.json(files);
});

router.get('/groups', requireAuthApi, (req, res) => {
    const groups = getUserGroups(req.user.id, req.query.search || '');
    res.json(groups);
});

router.patch('/files/:id', requireAuthApi, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { name, expiresAt, isPrivate } = req.body;
    if (name !== undefined && (typeof name !== 'string' || name.length > 255)) {
        return res.status(400).json({ error: 'Name too long' });
    }
    if (expiresAt !== undefined && expiresAt !== null && (typeof expiresAt !== 'number' || expiresAt <= Date.now())) {
        return res.status(400).json({ error: 'expiresAt must be in the future or null' });
    }

    updateFile({ id: file.id, originalName: name, expiresAt, isPrivate });
    res.json({ ok: true });
});

router.patch('/groups/:id', requireAuthApi, (req, res) => {
    const group = getGroupById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    if (group.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { label, isPrivate } = req.body;
    updateGroup({ id: group.id, label, isPrivate });
    res.json({ ok: true });
});

router.delete('/files/:id', requireAuthApi, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    storageDelete(file.storage_path);
    deleteFile(file.id);
    res.json({ ok: true });
});

router.delete('/groups/:id', requireAuthApi, (req, res) => {
    const group = getGroupById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    if (group.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const files = getGroupFiles(req.params.id);
    files.forEach(f => { try { storageDelete(f.storage_path); } catch (_) {} });
    const db = require('../services/db').getDb();
    db.prepare('DELETE FROM files WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

router.get('/stats', requireAuthApi, (req, res) => {
    const usedBytes = getUserUsage(req.user.id);
    res.json({ usedBytes, quotaBytes: req.user.quota_bytes });
});

module.exports = router;
