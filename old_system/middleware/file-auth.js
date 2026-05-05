const { getSessionWithUser } = require('../services/db');

function checkFileAccess(req, res, next) {
  const { file } = req;
  if (!file) return next();

  if (file.is_private) {
    const sessionId = req.cookies && req.cookies.session;
    const session = sessionId ? getSessionWithUser(sessionId) : null;
    const validSession = !!(session && session.expires_at > Date.now() && session.is_active);
    const isOwner = validSession && session.id === file.user_id;

    if (!isOwner) {
      return res.status(403).send('このファイルはプライベートです');
    }
  }
  next();
}

module.exports = { checkFileAccess };
