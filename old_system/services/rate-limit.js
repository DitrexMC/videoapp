const { getDb } = require('./db');

const MAX_TOKENS = 10;
const REFILL_INTERVAL_MS = 6000;

function checkAndConsume(userId) {
    const db = getDb();
    const now = Date.now();

    const trx = db.transaction(() => {
        db.prepare(
            'INSERT OR IGNORE INTO rate_limits (user_id, tokens, last_refill) VALUES (?, ?, ?)'
        ).run(userId, MAX_TOKENS, now);

        const row = db.prepare(
            'SELECT tokens, last_refill FROM rate_limits WHERE user_id = ?'
        ).get(userId);

        if (!row) return false;

        const elapsed = now - row.last_refill;
        const refilled = Math.min(MAX_TOKENS, row.tokens + elapsed / REFILL_INTERVAL_MS);

        if (refilled < 1) {
            db.prepare(
                'UPDATE rate_limits SET tokens = ?, last_refill = ? WHERE user_id = ?'
            ).run(refilled, now, userId);
            return false;
        }

        db.prepare(
            'UPDATE rate_limits SET tokens = ?, last_refill = ? WHERE user_id = ?'
        ).run(refilled - 1, now, userId);
        return true;
    });

    return trx();
}

function getWaitSeconds(userId) {
    const db = getDb();
    const row = db.prepare(
        'SELECT tokens, last_refill FROM rate_limits WHERE user_id = ?'
    ).get(userId);

    if (!row) return 0;
    const elapsed = Date.now() - row.last_refill;
    const tokens = Math.min(MAX_TOKENS, row.tokens + elapsed / REFILL_INTERVAL_MS);
    if (tokens >= 1) return 0;
    const deficit = 1 - tokens;
    return Math.ceil(deficit * (REFILL_INTERVAL_MS / 1000));
}

module.exports = { checkAndConsume, getWaitSeconds };
