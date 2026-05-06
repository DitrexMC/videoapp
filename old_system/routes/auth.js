const express = require('express');
const crypto = require('crypto');
const { getUserByAuthId, createSession, deleteSession } = require('../services/db');
const { requireAuthApi } = require('../middleware/auth');
const { sessionExpiry } = require('../config');

const router = express.Router();

router.post('/login', (req, res) => {
    const { authId } = req.body;
    if (!authId || typeof authId !== 'string') {
        return res.status(400).json({ error: 'authId required' });
    }

    const user = getUserByAuthId(authId.trim());
    if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Invalid auth ID' });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    createSession(sessionId, user.id, Date.now() + sessionExpiry);

    res.cookie('session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionExpiry,
        sameSite: 'Lax',
    });

    res.json({ ok: true, isAdmin: user.is_admin });
});

router.post('/logout', (req, res) => {
    const sessionId = req.cookies && req.cookies.session;
    if (sessionId) deleteSession(sessionId);
    res.clearCookie('session');
    res.json({ ok: true });
});

router.get('/me', requireAuthApi, (req, res) => {
    res.json({ id: req.user.id, label: req.user.label, isAdmin: req.user.is_admin });
});

module.exports = router;
