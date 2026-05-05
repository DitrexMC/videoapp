const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { port } = require('./config');
const { initDB } = require('./services/db');
const { ensureUploadDir } = require('./services/storage');
const { startCleanupJob } = require('./services/cleanup');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

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

ensureUploadDir();
initDB();
startCleanupJob();

const server = app.listen(port, () => {
    console.log(`VideoApp running on port ${port}`);
});
server.timeout = 600000;
