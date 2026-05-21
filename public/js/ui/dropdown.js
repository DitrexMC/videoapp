const GAP = 4;
const MARGIN = 8;

let activeDropdown = null;

document.addEventListener('click', event => {
  if (!activeDropdown) return;
  if (activeDropdown.trigger.contains(event.target)) return;
  if (activeDropdown.menu.contains(event.target)) return;
  closeDropdown(activeDropdown);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !activeDropdown) return;
  closeDropdown(activeDropdown);
});

window.addEventListener('scroll', () => {
  if (activeDropdown) positionMenu(activeDropdown);
}, { passive: true, capture: true });

window.addEventListener('resize', () => {
  if (activeDropdown) positionMenu(activeDropdown);
}, { passive: true });

function getMenu(containerEl) {
  return containerEl._ddMenu ?? containerEl.querySelector(':scope > .dd-menu');
}

function measureMenu(menu) {
  const previousVisibility = menu.style.visibility;
  const previousDisplay = menu.style.display;
  const previousTop = menu.style.top;
  const previousLeft = menu.style.left;
  const previousRight = menu.style.right;
  const previousMinWidth = menu.style.minWidth;

  menu.style.visibility = 'hidden';
  menu.style.display = 'block';
  menu.style.top = '-9999px';
  menu.style.left = '-9999px';
  menu.style.right = 'auto';

  const width = menu.offsetWidth;
  const height = menu.offsetHeight;

  menu.style.visibility = previousVisibility;
  menu.style.display = previousDisplay;
  menu.style.top = previousTop;
  menu.style.left = previousLeft;
  menu.style.right = previousRight;
  menu.style.minWidth = previousMinWidth;

  return { width, height };
}

function ensureMenuLayer(menu) {
  if (menu.parentElement === document.body) return;
  document.body.appendChild(menu);
}

function restoreMenu(dropdown) {
  const { containerEl, menu } = dropdown;
  if (menu.parentElement !== containerEl) {
    containerEl.appendChild(menu);
  }
  delete dropdown.placement;
  menu.style.visibility = '';
  menu.style.top = '';
  menu.style.left = '';
  menu.style.right = '';
  menu.style.minWidth = '';
  delete menu.dataset.ddPlacement;
}

function positionMenu(dropdown) {
  const { trigger, menu } = dropdown;
  const triggerRect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  menu.style.minWidth = `${triggerRect.width}px`;
  const { width, height } = measureMenu(menu);

  const spaceBelow = viewportHeight - triggerRect.bottom - GAP;
  const spaceAbove = triggerRect.top - GAP;
  const placeBelow = dropdown.placement
    ? dropdown.placement === 'bottom'
    : spaceBelow >= height || spaceBelow >= spaceAbove;
  let top = placeBelow
    ? triggerRect.bottom + GAP
    : triggerRect.top - GAP - height;
  top = Math.max(MARGIN, Math.min(top, viewportHeight - height - MARGIN));

  let left = menu.dataset.ddAlign === 'right'
    ? triggerRect.right - width
    : triggerRect.left;
  left = Math.max(MARGIN, Math.min(left, viewportWidth - width - MARGIN));

  menu.dataset.ddPlacement = placeBelow ? 'bottom' : 'top';
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.right = 'auto';
  menu.style.minWidth = `${triggerRect.width}px`;
}

function openDropdown(dropdown) {
  if (activeDropdown && activeDropdown !== dropdown) {
    closeDropdown(activeDropdown);
  }

  const triggerRect = dropdown.trigger.getBoundingClientRect();
  const { height } = measureMenu(dropdown.menu);
  const spaceBelow = window.innerHeight - triggerRect.bottom - GAP;
  const spaceAbove = triggerRect.top - GAP;
  dropdown.placement = spaceBelow >= height || spaceBelow >= spaceAbove ? 'bottom' : 'top';
  dropdown.menu.classList.remove('dd-open');
  dropdown.menu.style.visibility = 'hidden';
  ensureMenuLayer(dropdown.menu);
  positionMenu(dropdown);
  dropdown.menu.getBoundingClientRect();
  dropdown.containerEl.classList.add('dd-open');
  dropdown.menu.style.visibility = '';
  dropdown.menu.classList.add('dd-open');
  activeDropdown = dropdown;
  requestAnimationFrame(() => {
    if (activeDropdown === dropdown) positionMenu(dropdown);
  });
}

function closeDropdown(dropdown) {
  if (!dropdown) return;
  dropdown.containerEl.classList.remove('dd-open');
  dropdown.menu.classList.remove('dd-open');
  restoreMenu(dropdown);
  if (activeDropdown === dropdown) activeDropdown = null;
}

function initDropdown(containerEl) {
  if (containerEl.dataset.ddInit) return;

  const trigger = containerEl.querySelector('.dd-trigger');
  const menu = containerEl.querySelector(':scope > .dd-menu');
  if (!trigger || !menu) return;

  containerEl.dataset.ddInit = '1';
  menu.dataset.ddAlign = menu.classList.contains('dd-menu-right') ? 'right' : 'left';
  containerEl._ddMenu = menu;
  const dropdown = { containerEl, trigger, menu };

  trigger.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (activeDropdown === dropdown) {
      closeDropdown(dropdown);
      return;
    }
    openDropdown(dropdown);
  });

  menu.addEventListener('click', event => {
    const item = event.target.closest('.dd-item');
    if (!item || item.disabled) return;
    closeDropdown(dropdown);
  });
}

export function initDropdowns(root = document) {
  root.querySelectorAll('.dd').forEach(initDropdown);
}

export function bindTypeDropdown({ ddEl, hiddenInput, options, onSelect } = {}) {
  const trigger = ddEl?.querySelector('.dd-trigger');
  const labelEl = ddEl?.querySelector('.dd-label');
  if (!trigger) return;

  initDropdown(ddEl);

  const menu = getMenu(ddEl);
  if (!menu || menu.dataset.ddBound === '1') return;
  menu.dataset.ddBound = '1';

  menu.querySelectorAll('.dd-item').forEach(item => {
    item.addEventListener('click', event => {
      event.stopPropagation();
      const value = item.dataset.value;
      const label = item.textContent.trim();
      if (hiddenInput) hiddenInput.value = value;
      if (labelEl) labelEl.textContent = label;
      menu.querySelectorAll('.dd-item').forEach(menuItem => menuItem.classList.remove('dd-active'));
      item.classList.add('dd-active');
      if (activeDropdown?.containerEl === ddEl) closeDropdown(activeDropdown);
      onSelect?.(value, label);
    });
  });
}

export function buildTypeDropdownHTML(inputId, options, currentValue) {
  const currentOption = options.find(option => option.value === currentValue) || options[0];
  const itemsHtml = options.map(option =>
    `<button type="button" class="dd-item${option.value === currentOption?.value ? ' dd-active' : ''}" data-value="${option.value}">${option.label}</button>`
  ).join('');

  return `
    <input type="hidden" id="${inputId}" value="${currentOption?.value ?? ''}">
    <div class="dd" id="${inputId}-dd">
      <button type="button" class="dd-trigger input" style="text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;width:100%">
        <span class="dd-label">${currentOption?.label ?? ''}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
      <div class="dd-menu">${itemsHtml}</div>
    </div>
  `;
}

export function setupTypeDropdown(inputId) {
  const hiddenInput = document.getElementById(inputId);
  const ddEl = document.getElementById(`${inputId}-dd`);
  if (!hiddenInput || !ddEl) return;
  bindTypeDropdown({ ddEl, hiddenInput });
}
