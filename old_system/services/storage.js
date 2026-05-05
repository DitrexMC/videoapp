const fs = require('fs');
const { uploadDir } = require('../config');

function ensureUploadDir() {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

function deleteFile(storagePath) {
    try {
        if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
        return true;
    } catch (e) {
        console.error('File deletion error:', e);
        return false;
    }
}

module.exports = { ensureUploadDir, deleteFile };
