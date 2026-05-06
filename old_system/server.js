const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { port } = require('./config');
const { initDB } = require('./services/db');
const { ensureUploadDir } = require('./services/storage');
const { startCleanupJob } = require('./services/cleanup');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.disable('x-powered-by');

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api/') && req.method === 'POST') {
        const origin = req.headers.origin || req.headers.referer || '';
        if (origin && !origin.includes(req.headers.host || '') && !origin.startsWith('http://localhost')) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }
    next();
});

app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: '1h' }));
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), { maxAge: '1h' }));

app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/upload', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'upload.html')));
app.get('/myfiles', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'myfiles.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/user', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/files', require('./routes/files-api'));
app.use('/f', require('./routes/files'));
app.use('/g', require('./routes/group'));

const downloadLimiter = {};
app.use('/f/:id/download', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    if (!downloadLimiter[ip]) downloadLimiter[ip] = { count: 0, reset: now + 60000 };
    if (now > downloadLimiter[ip].reset) downloadLimiter[ip] = { count: 0, reset: now + 60000 };
    if (downloadLimiter[ip].count++ > 30) return res.status(429).json({ error: 'Too many downloads' });
    next();
});
app.use('/g/:id/download', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    if (!downloadLimiter[ip]) downloadLimiter[ip] = { count: 0, reset: now + 60000 };
    if (now > downloadLimiter[ip].reset) downloadLimiter[ip] = { count: 0, reset: now + 60000 };
    if (downloadLimiter[ip].count++ > 30) return res.status(429).json({ error: 'Too many downloads' });
    next();
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack || err.message);
    res.status(500).json({ error: 'Internal server error' });
});

ensureUploadDir();
initDB();
startCleanupJob();

const server = app.listen(port, () => {
    console.log(`VideoApp running on port ${port}`);
});
server.timeout = 600000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});
