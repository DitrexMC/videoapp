const { escapeHtml, fmtBytes } = require('../file-utils');

function buildOgMeta({ file, category, pageUrl, absRawUrl, thumbUrl, baseUrl, isImage, isVideo, isDiscordBot }) {
    const safeRawAbs = escapeHtml(absRawUrl);
    const safePage = escapeHtml(pageUrl);
    const safeMime = escapeHtml(file.mime_type);

    const defaultOgImage = `<meta property="og:image" content="${escapeHtml(baseUrl)}/css/og-default.svg">
<meta property="og:image:type" content="image/svg+xml">`;

    if (isDiscordBot) {
        const safeTitle = escapeHtml(file.original_name);
        let botOgImage = defaultOgImage;
        if (isImage) {
            botOgImage = `<meta property="og:type" content="image">
<meta property="og:image" content="${safeRawAbs}">
<meta property="og:image:secure_url" content="${safeRawAbs}">
<meta property="og:image:type" content="${safeMime}">
<meta name="twitter:card" content="summary_large_image">`;
        } else if (isVideo) {
            botOgImage = `<meta property="og:type" content="video.other">
<meta property="og:image" content="${escapeHtml(thumbUrl)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:video" content="${safeRawAbs}">
<meta property="og:video:secure_url" content="${safeRawAbs}">
<meta property="og:video:type" content="${safeMime}">
<meta property="og:video:width" content="1280">
<meta property="og:video:height" content="720">
<meta name="twitter:card" content="player">
<meta name="twitter:player" content="${safeRawAbs}">
<meta name="twitter:player:width" content="1280">
<meta name="twitter:player:height" content="720">
<meta name="twitter:player:stream" content="${safeRawAbs}">
<meta name="twitter:player:stream:content_type" content="${safeMime}">`;
        } else if (category === 'audio') {
            botOgImage = `<meta property="og:type" content="music.song">
<meta property="og:image" content="${escapeHtml(thumbUrl)}">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">`;
        } else {
            botOgImage = `<meta property="og:image" content="${escapeHtml(baseUrl)}/css/og-default.svg">
<meta property="og:image:type" content="image/svg+xml">`;
        }
        return {
            html: `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<meta property="og:site_name" content="VideoApp">
<meta property="og:url" content="${safePage}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${escapeHtml(fmtBytes(file.size_bytes))} · ${escapeHtml(file.mime_type)}">
${botOgImage}
</head><body></body></html>`, botHtml: true,
        };
    }

    const ogImageTag = (category === 'image')
        ? `<meta property="og:image" content="${safeRawAbs}">
<meta property="og:image:type" content="${escapeHtml(file.mime_type)}">`
        : (category === 'video' || category === 'audio')
            ? `<meta property="og:image" content="${escapeHtml(thumbUrl)}">
<meta property="og:image:type" content="image/jpeg">`
            : defaultOgImage;
    const ogVideoTag = (category === 'video')
        ? `<meta property="og:video" content="${safeRawAbs}">
     <meta property="og:video:type" content="${safeMime}">
     <meta property="og:video:width" content="1280">
     <meta property="og:video:height" content="720">
     <meta name="twitter:card" content="player">
     <meta name="twitter:player" content="${safePage}">
     <meta name="twitter:player:width" content="1280">
     <meta name="twitter:player:height" content="720">`
        : `<meta name="twitter:card" content="summary_large_image">`;

    return { ogImageTag, ogVideoTag, botHtml: false };
}

module.exports = { buildOgMeta };