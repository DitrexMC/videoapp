'use strict';
(function () {
    var FOLDER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;margin-right:.18rem"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    var DL_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    var DISCORD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    function frEsc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function frFmtBytes(b) {
        if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
        if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
        if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
        return b + ' B';
    }

    function frFmtDate(ts) {
        if (!ts) return '—';
        return new Date(ts).toLocaleDateString('ja-JP');
    }

    /**
     * Build a <tr> HTML string for a file or group item.
     *
     * @param {object} item
     * @param {object} [opts]
     * @param {string}   [opts.cbClass='file-check']  checkbox CSS class
     * @param {boolean}  [opts.showUser=false]         include user_label column
     * @param {boolean}  [opts.showDl=true]            include DL button
     * @param {boolean}  [opts.showDiscord=true]       include Discord copy button
     * @param {function} [opts.grpExtras]              (item, rawName) => HTML prepended in name cell for groups
     */
    function buildFileRow(item, opts) {
        opts = opts || {};
        var isGroup = item.type === 'group';
        var cbClass = opts.cbClass || 'file-check';
        var showDl = opts.showDl !== false;
        var showDiscord = opts.showDiscord !== false;
        var cbValue = isGroup ? 'g:' + item.id : 'f:' + item.id;
        var extraActions = opts.actionExtras ? opts.actionExtras(item) : '';

        // ── Checkbox cell ────────────────────────────────────────────────
        var cbCell = '<td class="fr-cb-cell"><label class="custom-cb" style="padding:0;margin:0"><input type="checkbox" class="' + frEsc(cbClass) + '" data-id="' + frEsc(cbValue) + '"><span class="custom-cb-box"></span></label></td>';

        // ── Name cell ────────────────────────────────────────────────────
        var nameInner;
        if (isGroup) {
            var rawName = item.label || ('グループ (' + (item.file_count || 0) + '件)');
            nameInner = '<div class="fr-name-row">'
                + '<a href="/g/' + frEsc(item.id) + '" class="fr-link" title="' + frEsc(rawName) + '">'
                + FOLDER_ICON
                + '<span class="fr-name-text">' + frEsc(rawName) + '</span>'
                + '</a>'
                + '<span class="fr-meta-count">' + (item.file_count || 0) + '件</span>'
                + (item.is_private ? '<span class="badge badge-gray fr-priv-badge">非公開</span>' : '')
                + '</div>';
        } else {
            nameInner = '<div class="fr-name-row">'
                + '<a href="/f/' + frEsc(item.id) + '" class="fr-link fr-file-link" title="' + frEsc(item.original_name) + '">'
                + '<span class="fr-name-text">' + frEsc(item.original_name) + '</span>'
                + '</a>'
                + (item.is_private ? '<span class="badge badge-gray fr-priv-badge">非公開</span>' : '')
                + '</div>';
        }
        var nameCell = '<td class="fr-name-cell">' + nameInner + '</td>';

        // ── User cell (admin only) ────────────────────────────────────────
        var userCell = opts.showUser
            ? '<td class="fr-user-cell">' + frEsc(item.user_label || '—') + '</td>'
            : '';

        // ── Size ─────────────────────────────────────────────────────────
        var size = isGroup ? frFmtBytes(item.total_size || 0) : frFmtBytes(item.size_bytes || 0);
        var sizeCell = '<td class="fr-size-cell">' + size + '</td>';

        // ── Dates ─────────────────────────────────────────────────────────
        var dateCell = '<td class="fr-date-cell">' + frFmtDate(item.created_at) + '</td>';
        var expiresCell = '<td class="fr-date-cell">' + frFmtDate(item.expires_at) + '</td>';

        // ── Actions ───────────────────────────────────────────────────────
        var actions = [];
        if (extraActions) {
            if (Array.isArray(extraActions)) {
                actions = actions.concat(extraActions);
            } else {
                actions.push(extraActions);
            }
        }
        if (showDl) {
            if (isGroup) {
                actions.push('<button class="btn btn-ghost btn-sm fr-grp-dl-btn" data-id="' + frEsc(item.id) + '" style="padding:.22rem .55rem;font-size:.74rem;opacity:.38" disabled title="ダウンロード">' + DL_ICON + '<span class="fr-action-label">DL</span></button>');
            } else {
                actions.push('<a class="btn btn-ghost btn-sm fr-dl-btn" href="/f/' + frEsc(item.id) + '/download" style="padding:.22rem .55rem;font-size:.74rem" title="ダウンロード">' + DL_ICON + '<span class="fr-action-label">DL</span></a>');
            }
        }
        if (showDiscord) {
            var discordPath = isGroup ? ('g/' + item.id) : (item.id + '/raw');
            actions.push('<button class="btn btn-ghost btn-sm fr-discord-btn fr-icon-btn" data-path="' + frEsc(discordPath) + '" style="padding:.22rem .45rem;font-size:.74rem;color:#8b5cf6;border-color:rgba(139,92,246,.3)" title="Discord用">' + DISCORD_ICON + '</button>');
        }
        var delCls = isGroup ? 'fr-del-grp-btn' : 'fr-del-btn';
        actions.push('<button class="btn btn-danger btn-sm ' + delCls + '" data-id="' + frEsc(item.id) + '" style="padding:.22rem .55rem;font-size:.74rem">削除</button>');

        var actionCell = '<td class="fr-action-cell"><div class="fr-actions">' + actions.join('') + '</div></td>';

        var rowCls = isGroup ? 'fr-row fr-row-group' : 'fr-row';
        return '<tr class="' + rowCls + '">' + cbCell + nameCell + userCell + sizeCell + dateCell + expiresCell + actionCell + '</tr>';
    }

    window.buildFileRow = buildFileRow;
    window.frEsc = frEsc;
    window.frFmtBytes = frFmtBytes;
    window.frFmtDate = frFmtDate;
})();
