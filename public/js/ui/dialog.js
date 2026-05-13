import { modal } from './modal.js';

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const dialog = {
  alert(message, title = 'お知らせ') {
    return new Promise(resolve => {
      const { el, close } = modal.open({
        title,
        bodyHTML: `<p class="dialog-msg">${escHtml(message)}</p>`,
        footerHTML: `<button class="btn btn-primary btn-sm" id="d-ok">OK</button>`,
        onClose: resolve,
      });
      el.querySelector('#d-ok').addEventListener('click', close);
    });
  },

  confirm({ title = '確認', message = '', confirmLabel = '確認', cancelLabel = 'キャンセル', danger = false } = {}) {
    return new Promise(resolve => {
      let confirmed = false;
      const { el, close } = modal.open({
        title,
        bodyHTML: `<p class="dialog-msg">${escHtml(message)}</p>`,
        footerHTML: `
          <button class="btn btn-secondary btn-sm" id="d-cancel">${escHtml(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" id="d-confirm">${escHtml(confirmLabel)}</button>
        `,
        onClose: () => resolve(confirmed),
      });
      el.querySelector('#d-cancel').addEventListener('click', close);
      el.querySelector('#d-confirm').addEventListener('click', () => { confirmed = true; close(); });
    });
  },

  prompt({ title = '入力', message = '', label = '', placeholder = '', defaultValue = '' } = {}) {
    return new Promise(resolve => {
      const msgHtml = message ? `<p class="dialog-msg">${escHtml(message)}</p>` : '';
      const labelHtml = label ? `<label class="form-label" style="font-size:.8rem;display:block;margin-bottom:.25rem">${escHtml(label)}</label>` : '';
      const { el, close } = modal.open({
        title,
        bodyHTML: `
          ${msgHtml}
          <div class="form-group" style="margin-top:${message ? '.75rem' : '0'}">
            ${labelHtml}
            <input class="input" id="d-input" type="text"
              placeholder="${escHtml(placeholder)}"
              value="${escHtml(defaultValue)}"
              autocomplete="off">
          </div>
        `,
        footerHTML: `
          <button class="btn btn-secondary btn-sm" id="d-cancel">キャンセル</button>
          <button class="btn btn-primary btn-sm" id="d-ok">OK</button>
        `,
        onClose: () => resolve(null),
      });
      const input = el.querySelector('#d-input');
      setTimeout(() => { input.focus(); input.select(); }, 50);
      el.querySelector('#d-cancel').addEventListener('click', close);
      el.querySelector('#d-ok').addEventListener('click', () => {
        const val = input.value;
        close();
        resolve(val);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const val = input.value; close(); resolve(val); }
        if (e.key === 'Escape') { close(); resolve(null); }
      });
    });
  },

  showToken({ title = 'トークン', token = '', description = '' } = {}) {
    const { el, close } = modal.open({
      title,
      bodyHTML: `
        ${description ? `<p class="dialog-msg">${escHtml(description)}</p>` : ''}
        <div style="margin-top:${description ? '.75rem' : '0'};display:flex;gap:.5rem;align-items:center">
          <input class="input" id="d-token-val" type="text" value="${escHtml(token)}"
            readonly style="font-family:monospace;font-size:.82rem;flex:1" onclick="this.select()">
          <button class="btn btn-secondary btn-sm" id="d-token-copy" style="flex-shrink:0">コピー</button>
        </div>
      `,
      footerHTML: `<button class="btn btn-primary btn-sm" id="d-ok">閉じる</button>`,
    });
    setTimeout(() => { const i = el.querySelector('#d-token-val'); i?.select(); }, 50);
    el.querySelector('#d-ok').addEventListener('click', close);
    el.querySelector('#d-token-copy').addEventListener('click', () => {
      navigator.clipboard?.writeText(token).catch(() => { });
      const btn = el.querySelector('#d-token-copy');
      btn.textContent = 'コピー済み';
      setTimeout(() => { btn.textContent = 'コピー'; }, 2000);
    });
  },

  htmlAlert(bodyHTML, title = 'お知らせ') {
    return new Promise(resolve => {
      const { el, close } = modal.open({
        title,
        bodyHTML,
        footerHTML: `<button class="btn btn-primary btn-sm" id="d-ok">閉じる</button>`,
        onClose: resolve,
      });
      el.querySelector('#d-ok').addEventListener('click', close);
    });
  },
};

window.dialog = dialog;
