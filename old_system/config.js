require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    adminToken: process.env.ADMIN_TOKEN || 'admin-secret',
    baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    uploadDir: require('path').join(__dirname, 'data', 'uploads'),
    dbPath: require('path').join(__dirname, 'data', 'db.sqlite'),
    maxFileSize: 5 * 1024 * 1024 * 1024,
    sessionExpiry: 30 * 24 * 60 * 60 * 1000,
    cleanupInterval: 60 * 60 * 1000,
};
