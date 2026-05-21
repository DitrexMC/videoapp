/**
 * Modal utility.
 * Usage:
 *   modal.open({ title, body, footer, onClose });
 *   modal.confirm({ title, message, confirmLabel, onConfirm, danger });
 */

function createBackdrop() {
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  return el;
}

function closeBackdrop(backdrop, onClose) {
  backdrop.classList.remove('open');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    backdrop.remove();
    onClose?.();
  };
  backdrop.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 400);
}

export const modal = {
  /**
   * Open a generic modal.
   * @param {{ title: string, bodyHTML: string, footerHTML?: string, onClose?: () => void }} opts
   */
  open({ title, bodyHTML, footerHTML = '', onClose } = {}) {
    const backdrop = createBackdrop();
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escHtml(title)}">
        <div class="modal-header">
          <h2 class="modal-title">${escHtml(title)}</h2>
          <button class="modal-close" aria-label="閉じる">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>
    `;

    const close = () => closeBackdrop(backdrop, onClose);

    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    return { el: backdrop, close };
  },

  /**
   * Confirmation dialog.
   */
  confirm({ title, message, confirmLabel = '確認', cancelLabel = 'キャンセル', onConfirm, danger = false } = {}) {
    const { el, close } = this.open({
      title,
      bodyHTML: `<p style="font-size:0.875rem;color:var(--text-sub);line-height:1.6">${escHtml(message)}</p>`,
      footerHTML: `
        <button class="btn btn-secondary btn-sm" id="modal-cancel">${escHtml(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" id="modal-confirm">${escHtml(confirmLabel)}</button>
      `,
    });

    el.querySelector('#modal-cancel').addEventListener('click', close);
    el.querySelector('#modal-confirm').addEventListener('click', () => {
      close();
      onConfirm?.();
    });
  },

  /** Show a transient loading modal. Returns { close }. */
  loading(message = '処理中...') {
    const { el, close } = this.open({
      title: message,
      bodyHTML: `<div style="display:flex;justify-content:center;padding:8px"><div class="spinner"></div></div>`,
    });
    el.querySelector('.modal-close').style.display = 'none';
    return { close };
  },
};

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
