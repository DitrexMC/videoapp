const express = require('express');
const { randomUUID } = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const {
    getAllUsers,
    createUser,
    updateUser,
    deactivateUser,
    deleteUserById,
    getAllFiles,
    getAllGroups,
    getFileById,
    getGroupById,
    getGroupFiles,
    deleteFile,
    deleteGroupById,
    getAdminStats,
} = require('../services/db');
const { deleteFile: storageDelete } = require('../services/storage');

const router = express.Router();

router.get('/users', requireAdmin, (req, res) => {
    res.json(getAllUsers());
});

router.get('/stats', requireAdmin, (req, res) => {
    res.json(getAdminStats());
});

router.post('/users', requireAdmin, (req, res) => {
    const { label, isAdmin, quotaBytes, defaultExpiryDays } = req.body;
    if (!label) return res.status(400).json({ error: 'label required' });
    const authId = randomUUID();
    try {
        createUser(
            authId,
            label,
            isAdmin || 0,
            quotaBytes || 10737418240,
            defaultExpiryDays || null
        );
        res.json({ ok: true, authId });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.patch('/users/:id', requireAdmin, (req, res) => {
    updateUser(req.params.id, req.body);
    res.json({ ok: true });
});

router.patch('/users/:id/quota', requireAdmin, (req, res) => {
    const quota = parseInt(req.body.quotaBytes, 10);
    if (!quota || quota <= 0) return res.status(400).json({ error: 'Invalid quota' });
    updateUser(req.params.id, { quota_bytes: quota });
    res.json({ ok: true });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
    deactivateUser(req.params.id);
    res.json({ ok: true });
});

router.delete('/users/:id/purge', requireAdmin, (req, res) => {
    const files = deleteUserById(req.params.id);
    files.forEach(f => storageDelete(f.storage_path));
    res.json({ ok: true });
});

router.get('/files', requireAdmin, (req, res) => {
    res.json(getAllFiles(req.query.search || ''));
});

router.get('/groups', requireAdmin, (req, res) => {
    res.json(getAllGroups(req.query.search || ''));
});

router.delete('/files/:id', requireAdmin, (req, res) => {
    const file = getFileById(req.params.id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    storageDelete(file.storage_path);
    deleteFile(file.id);
    res.json({ ok: true });
});

router.delete('/groups/:id', requireAdmin, (req, res) => {
    const group = getGroupById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });
    const files = getGroupFiles(req.params.id);
    files.forEach(f => { try { storageDelete(f.storage_path); } catch (_) {} });
    const db = require('../services/db').getDb();
    db.prepare('DELETE FROM files WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
