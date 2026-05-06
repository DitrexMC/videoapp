const { getExpiredFiles, deleteFile: deleteFileRecord, cleanExpiredSessions } = require('./db');
const { deleteFile } = require('./storage');
const { cleanupInterval } = require('../config');

function runCleanup() {
    const expired = getExpiredFiles();
    for (const file of expired) {
        const deleted = deleteFile(file.storage_path);
        if (deleted) deleteFileRecord(file.id);
    }
    cleanExpiredSessions();
}

function startCleanupJob() {
    runCleanup();
    setInterval(runCleanup, cleanupInterval);
}

module.exports = { startCleanupJob };
