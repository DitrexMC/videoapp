const Database = require('better-sqlite3');
const path = require('path');
const { dbPath, adminToken } = require('../config');

let db;

function getDb() {
    if (!db) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

function initDB() {
    const d = getDb();

    d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_id TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      quota_bytes INTEGER NOT NULL DEFAULT 10737418240,
      default_expiry_days INTEGER,
      created_at INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      label TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      is_private INTEGER NOT NULL DEFAULT 0,
      show_uploader INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      is_private INTEGER NOT NULL DEFAULT 0,
      show_uploader INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      user_id INTEGER PRIMARY KEY,
      tokens REAL NOT NULL DEFAULT 10,
      last_refill INTEGER NOT NULL
    );
  `);

    const col = d.prepare("SELECT name FROM pragma_table_info('files') WHERE name='is_private'").get();
    if (!col) {
        d.prepare('ALTER TABLE files ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0').run();
    }

    const showUploaderCol = d.prepare("SELECT name FROM pragma_table_info('files') WHERE name='show_uploader'").get();
    if (!showUploaderCol) {
        d.prepare('ALTER TABLE files ADD COLUMN show_uploader INTEGER NOT NULL DEFAULT 1').run();
    }

    const groupIdCol = d.prepare("SELECT name FROM pragma_table_info('files') WHERE name='group_id'").get();
    if (!groupIdCol) {
        d.prepare('ALTER TABLE files ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE SET NULL').run();
    }

    const groupLabelCol = d.prepare("SELECT name FROM pragma_table_info('groups') WHERE name='label'").get();
    if (!groupLabelCol) {
        d.prepare("ALTER TABLE groups ADD COLUMN label TEXT NOT NULL DEFAULT ''").run();
    }

    const existing = d.prepare('SELECT id FROM users WHERE auth_id = ?').get(adminToken);
    if (!existing) {
        d.prepare(
            'INSERT INTO users (auth_id, label, is_admin, quota_bytes, default_expiry_days, created_at, is_active) VALUES (?, ?, 1, ?, NULL, ?, 1)'
        ).run(adminToken, 'Admin', 10737418240, Date.now());
    }
}

function getUserByAuthId(authId) {
    return getDb().prepare('SELECT * FROM users WHERE auth_id = ?').get(authId);
}

function getUserById(id) {
    return getDb().prepare('SELECT id, label, is_admin FROM users WHERE id = ?').get(id);
}

function createSession(sessionId, userId, expiresAt) {
    getDb()
        .prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        .run(sessionId, userId, Date.now(), expiresAt);
}

function getSessionWithUser(sessionId) {
    return getDb()
        .prepare(
            `SELECT s.id AS session_id, s.expires_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
        )
        .get(sessionId);
}

function deleteSession(sessionId) {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

function createFile({ id, userId, originalName, mimeType, sizeBytes, storagePath, createdAt, expiresAt, isPrivate, groupId }) {
    getDb()
        .prepare(
            'INSERT INTO files (id, user_id, group_id, original_name, mime_type, size_bytes, storage_path, created_at, expires_at, is_private) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(id, userId, groupId ?? null, originalName, mimeType, sizeBytes, storagePath, createdAt, expiresAt ?? null, isPrivate ? 1 : 0);
}

function getFileById(fileId) {
    return getDb().prepare('SELECT * FROM files WHERE id = ?').get(fileId);
}

function getUserFiles(userId, search) {
    if (search) {
        return getDb()
            .prepare('SELECT * FROM files WHERE user_id = ? AND group_id IS NULL AND original_name LIKE ? ORDER BY created_at DESC')
            .all(userId, `%${search}%`);
    }
    return getDb()
        .prepare('SELECT * FROM files WHERE user_id = ? AND group_id IS NULL ORDER BY created_at DESC')
        .all(userId);
}

function getUserGroups(userId, search) {
    const params = [userId];
    let clause = 'WHERE g.user_id = ?';
    if (search) {
        clause += ' AND EXISTS (SELECT 1 FROM files f WHERE f.group_id = g.id AND f.original_name LIKE ?)';
        params.push(`%${search}%`);
    }
    return getDb()
        .prepare(
            `SELECT g.*,
              (SELECT COUNT(*) FROM files f WHERE f.group_id = g.id) AS file_count,
              (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.group_id = g.id) AS total_size
            FROM groups g ${clause} ORDER BY g.created_at DESC`
        )
        .all(...params);
}

function getAllFiles(search) {
    if (search) {
        return getDb()
            .prepare(
                `SELECT f.*, u.label AS user_label
         FROM files f JOIN users u ON u.id = f.user_id
         WHERE f.original_name LIKE ?
         ORDER BY f.created_at DESC`
            )
            .all(`%${search}%`);
    }
    return getDb()
        .prepare(
            `SELECT f.*, u.label AS user_label
       FROM files f JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC`
        )
        .all();
}

function deleteFile(fileId) {
    getDb().prepare('DELETE FROM files WHERE id = ?').run(fileId);
}

function getAllUsers() {
    return getDb().prepare(`
        SELECT u.*,
               COALESCE((SELECT SUM(f.size_bytes) FROM files f WHERE f.user_id = u.id), 0) AS used_bytes,
               COALESCE((SELECT COUNT(*) FROM files f WHERE f.user_id = u.id), 0) AS file_count
        FROM users u
        ORDER BY u.created_at DESC
    `).all();
}

function createUser(authId, label, isAdmin, quotaBytes, defaultExpiryDays) {
    getDb()
        .prepare(
            'INSERT INTO users (auth_id, label, is_admin, quota_bytes, default_expiry_days, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
        )
        .run(authId, label, isAdmin ? 1 : 0, quotaBytes, defaultExpiryDays ?? null, Date.now());
}

function updateUser(userId, data) {
    const allowed = ['label', 'is_admin', 'quota_bytes', 'default_expiry_days', 'is_active'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    getDb().prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...values, userId);
}

function deactivateUser(userId) {
    getDb().prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);
}

function deleteUserById(userId) {
    const files = getDb().prepare('SELECT * FROM files WHERE user_id = ?').all(userId);
    getDb().prepare('DELETE FROM files WHERE user_id = ?').run(userId);
    getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
    return files;
}

function getUserUsage(userId) {
    const row = getDb()
        .prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files WHERE user_id = ?')
        .get(userId);
    return row.total;
}

function getExpiredFiles() {
    return getDb()
        .prepare('SELECT * FROM files WHERE expires_at IS NOT NULL AND expires_at < ?')
        .all(Date.now());
}

function cleanExpiredSessions() {
    getDb().prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

function updateFile({ id, originalName, expiresAt, isPrivate, showUploader }) {
    const sets = [];
    const vals = [];
    if (originalName !== undefined) { sets.push('original_name = ?'); vals.push(originalName); }
    if (expiresAt !== undefined) { sets.push('expires_at = ?'); vals.push(expiresAt ?? null); }
    if (isPrivate !== undefined) { sets.push('is_private = ?'); vals.push(isPrivate ? 1 : 0); }
    if (showUploader !== undefined) { sets.push('show_uploader = ?'); vals.push(showUploader ? 1 : 0); }
    if (sets.length === 0) return;
    getDb().prepare(`UPDATE files SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}

function getAdminStats() {
    const d = getDb();
    const totalUsers = d.prepare('SELECT COUNT(*) AS cnt FROM users WHERE is_active = 1').get().cnt;
    const totalFiles = d.prepare('SELECT COUNT(*) AS cnt FROM files').get().cnt;
    const totalGroups = d.prepare('SELECT COUNT(*) AS cnt FROM groups').get().cnt;
    const totalStorage = d.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files').get().total;
    return { totalUsers, totalFiles, totalGroups, totalStorage };
}

function createGroup({ id, userId, label, createdAt, expiresAt, isPrivate }) {
    getDb()
        .prepare('INSERT INTO groups (id, user_id, label, created_at, expires_at, is_private) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, userId, label || '', createdAt, expiresAt ?? null, isPrivate ? 1 : 0);
}

function getGroupById(groupId) {
    return getDb().prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
}

function getGroupFiles(groupId) {
    return getDb().prepare('SELECT * FROM files WHERE group_id = ? ORDER BY original_name').all(groupId);
}

function updateFileGroupId(fileId, groupId) {
    getDb().prepare('UPDATE files SET group_id = ? WHERE id = ?').run(groupId, fileId);
}

function updateGroup({ id, label, isPrivate, showUploader }) {
    const sets = [];
    const vals = [];
    if (label !== undefined) { sets.push('label = ?'); vals.push(label); }
    if (isPrivate !== undefined) { sets.push('is_private = ?'); vals.push(isPrivate ? 1 : 0); }
    if (showUploader !== undefined) { sets.push('show_uploader = ?'); vals.push(showUploader ? 1 : 0); }
    if (sets.length === 0) return;
    getDb().prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}

function deleteGroupById(groupId) {
    getDb().prepare('DELETE FROM groups WHERE id = ?').run(groupId);
}

function getAllGroups(search) {
    const p = search ? [`%${search}%`] : [];
    const clause = search ? 'WHERE g.label LIKE ? OR EXISTS (SELECT 1 FROM files f WHERE f.group_id = g.id AND f.original_name LIKE ?)' : '';
    const params = search ? [search, search].map(s => `%${s}%`) : [];
    return getDb()
        .prepare(
            `SELECT g.*,
              (SELECT COUNT(*) FROM files f WHERE f.group_id = g.id) AS file_count,
              (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.group_id = g.id) AS total_size
            FROM groups g ${clause} ORDER BY g.created_at DESC`
        )
        .all(...params);
}

module.exports = {
    initDB,
    getDb,
    getUserByAuthId,
    getUserById,
    createSession,
    getSessionWithUser,
    deleteSession,
    createFile,
    getFileById,
    getUserFiles,
    getUserGroups,
    getAllFiles,
    deleteFile,
    getAllUsers,
    createUser,
    updateUser,
    deactivateUser,
    deleteUserById,
    getUserUsage,
    getExpiredFiles,
    cleanExpiredSessions,
    updateFile,
    getAdminStats,
    createGroup,
    getGroupById,
    getGroupFiles,
    updateFileGroupId,
    updateGroup,
    deleteGroupById,
    getAllGroups,
};
