const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

function generateVideoThumbnail(videoPath) {
    const thumbPath = videoPath + '.thumb.jpg';

    if (fs.existsSync(thumbPath)) return;

    const args = [
        '-y',
        '-ss', '2',
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '5',
        '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
        thumbPath,
    ];

    execFile('ffmpeg', args, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err && !fs.existsSync(thumbPath)) {
            console.error('[thumbnail] ffmpeg error for', videoPath, ':', err.message);
        }
    });
}

function getThumbnailPath(videoPath) {
    const thumbPath = videoPath + '.thumb.jpg';
    return fs.existsSync(thumbPath) ? thumbPath : null;
}

module.exports = { generateVideoThumbnail, getThumbnailPath };
