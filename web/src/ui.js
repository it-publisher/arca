const SIZE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ'];
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
const shortDateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const pluralRules = new Intl.PluralRules('ru');
const UNIT_FORMS = {
  day: ['день', 'дня', 'дней'],
  hour: ['час', 'часа', 'часов'],
  minute: ['минуту', 'минуты', 'минут'],
};

// Lucide icons (ISC license): only the inner shapes, wrapped by svgIcon().
const ICON_SHAPES = {
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
};
const svgIcon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_SHAPES[name]}</svg>`;

let toastTimer;

export function $(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
}

export function el(tag, props = {}, children = []) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

export function icon(name) {
  if (!ICON_SHAPES[name]) throw new Error(`Unknown icon: ${name}`);
  const element = el('span', { className: 'icon', innerHTML: svgIcon(name) });
  element.setAttribute('aria-hidden', 'true');
  return element;
}

/** Fills every <button data-icon="name"> on the page with its icon. */
export function renderIconButtons(root = document) {
  for (const button of root.querySelectorAll('[data-icon]')) button.replaceChildren(icon(button.dataset.icon));
}

export function createIconButton(name, label) {
  const button = el('button', { type: 'button', className: 'btn btn-icon', title: label }, [icon(name)]);
  button.setAttribute('aria-label', label);
  return button;
}

export function showToast(message, durationMs = 3000) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, durationMs);
}

export async function copyText(text, successMessage = 'Скопировано') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    showToast(`Не удалось скопировать: ${error.message}`);
  }
}

export function formatBytes(bytes) {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex ? 1 : 0)} ${SIZE_UNITS[unitIndex]}`;
}

export const formatDate = (timestamp) => dateFormat.format(new Date(timestamp));
export const formatShortDate = (timestamp) => shortDateFormat.format(new Date(timestamp));

function pluralize(count, unit) {
  const rule = pluralRules.select(count);
  const formIndex = { one: 0, few: 1 }[rule] ?? 2;
  return `${count} ${UNIT_FORMS[unit][formIndex]}`;
}

export function formatTimeLeft(expiresAt, now = Date.now()) {
  const msLeft = expiresAt - now;
  // Rounded, not floored: a note created a second ago for 30 days reads "30 дней".
  if (msLeft >= DAY_MS) return pluralize(Math.round(msLeft / DAY_MS), 'day');
  if (msLeft >= HOUR_MS) return pluralize(Math.round(msLeft / HOUR_MS), 'hour');
  return pluralize(Math.max(1, Math.ceil(msLeft / MINUTE_MS)), 'minute');
}

/** "🔥 29 дней" / "🔥 после прочтения" / "бессрочно". */
export function createExpiryBadge({ expiresAt, isBurnAfterRead, isBurned }) {
  if (isBurned) return el('span', { className: 'badge', textContent: 'прочитана' });
  if (isBurnAfterRead) {
    return el('span', { className: 'badge badge-burn', title: 'Откроется один раз' }, [icon('flame'), 'после прочтения']);
  }
  if (!expiresAt) return el('span', { className: 'badge', textContent: 'бессрочно' });
  return el('span', { className: 'badge badge-burn', title: `Сгорит ${formatDate(expiresAt)}` }, [
    icon('flame'),
    formatTimeLeft(expiresAt),
  ]);
}

export function toFileName(title) {
  return title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'note';
}

export function downloadBlob(blob, filename) {
  // Forced octet-stream: a blob URL with text/html would run in our origin if ever navigated to.
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  el('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
