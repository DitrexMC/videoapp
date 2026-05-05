'use strict';
(function () {
    const FOLDER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;margin-right:.18rem"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    const DL_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    function frEsc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function frFmtBytes(b) {
        if (!b && b !== 0) return '—';
        if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
        if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
        if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
        return b + ' B';
    }

    function frFmtDate(ts) {
        if (!ts) return '—';
        return new Date(ts).toLocaleDateString('ja-JP');
    }

    window.buildFileRow = function (item, opts) {
        opts = opts || {};
        const cbClass = opts.cbClass || 'file-check';
        const showDl = opts.showDl !== false;

        const cbCell = '<td class="fr-cb-cell"><label class="custom-cb" style="padding:0;margin:0"><input type="checkbox" class="' + frEsc(cbClass) + '" data-id="f:' + frEsc(item.id) + '"><span class="custom-cb-box"></span></label></td>';

        const nameInner = '<div class="fr-name-row">'
            + '<a href="/file.html?id=' + frEsc(item.id) + '" class="fr-link fr-file-link" title="' + frEsc(item.safe_name) + '">'
            + '<span class="fr-name-text">' + frEsc(item.safe_name) + '</span>'
            + '</a>'
            + (item.public ? '' : '<span class="badge badge-gray fr-priv-badge">非公開</span>')
            + '</div>';
        const nameCell = '<td class="fr-name-cell">' + nameInner + '</td>';

        const userCell = opts.showUser
            ? '<td class="fr-user-cell">' + frEsc(item.owner_username || item.username || '—') + '</td>'
            : '';

        const size = frFmtBytes(item.size || 0);
        const sizeCell = '<td class="fr-size-cell">' + size + '</td>';

        const dateCell = '<td class="fr-date-cell">' + frFmtDate(item.created_at) + '</td>';
        const expiresCell = '<td class="fr-date-cell">' + frFmtDate(item.expires_at) + '</td>';

        const actions = [];
        if (showDl) {
            actions.push('<a class="btn btn-ghost btn-sm fr-dl-btn" href="/files/' + frEsc(item.id) + '/download" style="padding:.22rem .55rem;font-size:.74rem" title="ダウンロード">' + DL_ICON + '<span class="fr-action-label">DL</span></a>');
        }
        actions.push('<button class="btn btn-danger btn-sm fr-del-btn" data-id="' + frEsc(item.id) + '" style="padding:.22rem .55rem;font-size:.74rem">削除</button>');

        const actionCell = '<td class="fr-action-cell"><div class="fr-actions">' + actions.join('') + '</div></td>';

        return '<tr class="fr-row">' + cbCell + nameCell + userCell + sizeCell + dateCell + expiresCell + actionCell + '</tr>';
    };

    window.frFmtBytes = frFmtBytes;
    window.frFmtDate = frFmtDate;
})();
