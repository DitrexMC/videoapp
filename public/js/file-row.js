'use strict';
(function () {
    var DL_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    var DISCORD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.102 18.074.11 18.09.125 18.1a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>';
    var LINK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    var TRASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
    var PENCIL_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    var ICON_BTN_STYLE = 'width:1.9rem;min-width:1.9rem;height:1.75rem;padding:0;justify-content:center;font-size:.78rem';

    function frEsc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        var d = new Date(ts);
        return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }

    function resolveExtraActions(extraActions, item) {
        if (!extraActions) return [];
        var resolved = typeof extraActions === 'function' ? extraActions(item) : extraActions;
        if (!resolved) return [];
        return Array.isArray(resolved) ? resolved : [resolved];
    }

    window.buildFileRow = function (item, opts) {
        opts = opts || {};
        var isFolder = item.type === 'folder';
        var cbClass = opts.cbClass || 'file-check';
        var showDl = opts.showDl !== false && !isFolder;
        var showUser = opts.showUser === true;
        var cbValue = isFolder ? 'd:' + item.id : 'f:' + item.id;
        var extraActions = resolveExtraActions(opts.actionExtras, item);

        var cbCell = '<td class="fr-cb-cell"><label class="custom-cb"><input type="checkbox" class="' + frEsc(cbClass) + '" data-id="' + frEsc(cbValue) + '"><span class="custom-cb-box"></span></label></td>';

        var nameInner;
        if (isFolder) {
            nameInner = '<div class="fr-name-row">'
                + '<span class="fr-link fr-folder-name" data-folder-id="' + frEsc(item.id) + '" data-folder-name="' + frEsc(item.name) + '" style="cursor:pointer" title="' + frEsc(item.name) + '">'
                + '<span class="fr-name-text">' + frEsc(item.name) + '</span>'
                + '</span>'
                + '</div>';
        } else {
            nameInner = '<div class="fr-name-row">'
                + '<a href="/file.html?id=' + frEsc(item.id) + '" class="fr-link fr-file-link" title="' + frEsc(item.safe_name) + '">'
                + '<span class="fr-name-text">' + frEsc(item.safe_name) + '</span>'
                + '</a>'
                + (item.public ? '' : '<span class="badge badge-gray fr-priv-badge" style="margin-left:.35rem">\u975e\u516c\u958b</span>')
                + '</div>';
        }
        var nameCell = '<td class="fr-name-cell">' + nameInner + '</td>';

        var userCell = '';
        if (showUser) {
            userCell = '<td class="fr-user-cell" style="font-size:.82rem;color:var(--text-sub)">' + frEsc(item.owner_username || '\u2014') + '</td>';
        }

        var size = isFolder ? '\u2014' : frFmtBytes(item.size || 0);
        var sizeCell = '<td class="fr-size-cell">' + size + '</td>';

        var dateCell = '<td class="fr-date-cell" style="white-space:nowrap">' + frFmtDate(item.created_at) + '</td>';
        var expiresCell = '<td class="fr-date-cell" style="white-space:nowrap">' + frFmtDate(isFolder ? null : item.expires_at) + '</td>';

        var actions = [];
        actions = actions.concat(extraActions);
        if (showDl && item.status === 'ready') {
            actions.push('<a class="btn btn-ghost btn-sm fr-dl-btn" href="/files/' + frEsc(item.id) + '/download" download data-no-spa="1" style="' + ICON_BTN_STYLE + '" title="\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9">' + DL_ICON + '</a>');
            actions.push('<button class="btn btn-ghost btn-sm fr-discord-btn" data-url="/files/' + frEsc(item.id) + '/stream" style="' + ICON_BTN_STYLE + '" title="Discord\u5411\u3051\u751fURL\u3092\u30b3\u30d4\u30fc">' + DISCORD_ICON + '</button>');
            actions.push('<button class="btn btn-ghost btn-sm fr-urlcopy-btn" data-url="/file.html?id=' + frEsc(item.id) + '" style="' + ICON_BTN_STYLE + '" title="\u30d7\u30ec\u30d3\u30e5\u30fc\u30da\u30fc\u30b8URL\u3092\u30b3\u30d4\u30fc">' + LINK_ICON + '</button>');
        }
        var delCls = isFolder ? 'fr-del-folder-btn' : 'fr-del-btn';
        actions.push('<button class="btn btn-danger btn-sm ' + delCls + '" data-id="' + frEsc(item.id) + '" style="' + ICON_BTN_STYLE + '">' + TRASH_ICON + '</button>');

        var actionCell = '<td class="fr-action-cell"><div class="fr-actions">' + actions.join('') + '</div></td>';

        var rowCls = isFolder ? 'fr-row fr-row-folder' : 'fr-row';
        return '<tr class="' + rowCls + '">' + cbCell + nameCell + userCell + sizeCell + dateCell + expiresCell + actionCell + '</tr>';
    };

    window.frFmtBytes = frFmtBytes;
    window.frFmtDate = frFmtDate;

    var GROUP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;margin-right:.18rem"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';

    window.buildGroupRow = function (item, opts) {
        opts = opts || {};
        var cbClass = opts.cbClass || 'file-check';
        var cbValue = 'g:' + item.id;
        var label = item.label && item.label.trim() ? item.label : null;
        var displayName = label || ('グループ (' + (item.file_count || 0) + '件)');
        var extraActions = resolveExtraActions(opts.actionExtras, item);

        var cbCell = '<td class="fr-cb-cell"><label class="custom-cb"><input type="checkbox" class="' + frEsc(cbClass) + '" data-id="' + frEsc(cbValue) + '"><span class="custom-cb-box"></span></label></td>';

        var nameInner = '<div class="fr-name-row">'
            + '<span class="fr-link fr-group-name" data-group-id="' + frEsc(item.id) + '" data-group-label="' + frEsc(displayName) + '" style="cursor:pointer" title="' + frEsc(displayName) + '">'
            + '<span class="fr-name-text">' + frEsc(displayName) + '</span>'
            + '</span>'
            + '<span class="badge badge-accent" style="margin-left:.4rem;font-size:.7rem;padding:.1rem .4rem">' + (item.file_count || 0) + '件</span>'
            + '</div>';
        var nameCell = '<td class="fr-name-cell">' + nameInner + '</td>';
        var sizeCell = '<td class="fr-size-cell">' + frFmtBytes(item.total_size || 0) + '</td>';
        var dateCell = '<td class="fr-date-cell" style="white-space:nowrap">' + frFmtDate(item.created_at) + '</td>';
        var expiresCell = '<td class="fr-date-cell" style="white-space:nowrap">' + frFmtDate(item.expires_at) + '</td>';

        var actions = [];
        actions = actions.concat(extraActions);
        actions.push('<button class="btn btn-ghost btn-sm fr-rename-group-btn" data-id="' + frEsc(item.id) + '" data-label="' + frEsc(label || '') + '" style="' + ICON_BTN_STYLE + '" title="名前変更">' + PENCIL_ICON + '</button>');
        actions.push('<button class="btn btn-danger btn-sm fr-del-group-btn" data-id="' + frEsc(item.id) + '" style="' + ICON_BTN_STYLE + '">' + TRASH_ICON + '</button>');

        var actionCell = '<td class="fr-action-cell"><div class="fr-actions">' + actions.join('') + '</div></td>';

        return '<tr class="fr-row fr-row-group">' + cbCell + nameCell + sizeCell + dateCell + expiresCell + actionCell + '</tr>';
    };
})();
