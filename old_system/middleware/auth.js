const { getSessionWithUser } = require('../services/db');

function requireAuth(req, res, next) {
    const sessionId = req.cookies && req.cookies.session;
    if (!sessionId) return res.redirect('/login');
    const row = getSessionWithUser(sessionId);
    if (!row || row.expires_at < Date.now() || !row.is_active) {
        res.clearCookie('session');
        return res.redirect('/login');
    }
    req.user = row;
    next();
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (!req.user.is_admin) return res.status(403).json({ error: 'Admin required' });
        next();
    });
}

function requireAuthApi(req, res, next) {
    const sessionId = req.cookies && req.cookies.session;
    if (!sessionId) return res.status(401).json({ error: 'Unauthorized' });
    const row = getSessionWithUser(sessionId);
    if (!row || row.expires_at < Date.now() || !row.is_active) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = row;
    next();
}

module.exports = { requireAuth, requireAdmin, requireAuthApi };
