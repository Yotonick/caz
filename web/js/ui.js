// Мелкие помощники для DOM, форматирования и оверлеев.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const round2 = (x) => Math.round(x * 100) / 100;

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const fmt = (n) => nf.format(n);

// ── Telegram ──
const tg = window.Telegram?.WebApp;
const safe = (fn) => {
  try {
    fn();
  } catch {
    /* вне Telegram haptics недоступен */
  }
};
export const haptic = {
  tap: () => safe(() => tg?.HapticFeedback?.impactOccurred('light')),
  win: () => safe(() => tg?.HapticFeedback?.notificationOccurred('success')),
  err: () => safe(() => tg?.HapticFeedback?.notificationOccurred('error')),
};

// ── сообщения об ошибках ──
const ERRORS = {
  network: 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.',
  insufficient_funds: 'Не хватает монет для такой ставки.',
  too_fast: 'Слишком быстро. Подожди секунду.',
  unauthorized: 'Не удалось подтвердить Telegram-аккаунт. Закрой игру и открой её заново.',
  session_expired: 'Сессия устарела. Закрой игру и открой её заново.',
  nick_taken: 'Этот ник уже занят. Попробуй другой.',
  bad_nick: 'Ник: от 3 до 16 символов — буквы, цифры, _ и -.',
  bonus_not_ready: 'Бонус пока недоступен.',
  not_registered: 'Сначала нужно создать профиль.',
};
export const errText = (e) => ERRORS[e?.code] || 'Что-то пошло не так. Попробуй ещё раз.';

// ── тосты ──
export function toast(msg, ms = 2600) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: 'toast' }, msg);
  root.append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 300);
}

// ── модальное окно ──
export function modal(content, { title, onClose } = {}) {
  const root = document.getElementById('modal-root');
  const close = () => {
    backdrop.remove();
    onClose?.();
  };
  const card = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' }, h('h3', {}, title || ''), h('button', { class: 'icon-btn', 'aria-label': 'Закрыть', onclick: close }, '✕')),
    h('div', { class: 'modal-body' }, content),
  );
  const backdrop = h('div', { class: 'backdrop', onclick: (e) => e.target === backdrop && close() }, card);
  root.append(backdrop);
  return { close, el: card };
}

// ── счётчик ──
export function countTo(el, from, to, ms = 500) {
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(round2(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── оверлей выигрыша (большой выигрыш / итог бонуса / вход в бонус) ──
export function winOverlay({ title, sub, amount, tier = 0, autoMs = 3200 }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const num = h('div', { class: 'ov-amount' }, amount != null ? '0' : '');
    const box = h(
      'div',
      { class: 'ov-card tier' + tier },
      h('div', { class: 'ov-title' }, title),
      amount != null ? num : null,
      sub ? h('div', { class: 'ov-sub' }, sub) : null,
      h('div', { class: 'ov-hint' }, 'Нажми, чтобы продолжить'),
    );
    const ov = h('div', { class: 'overlay' }, box);
    root.append(ov);
    if (tier > 0) rain(ov, tier);
    if (amount != null) countTo(num, 0, amount, Math.min(2200, 900 + tier * 500));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ov.classList.add('out');
      setTimeout(() => {
        ov.remove();
        resolve();
      }, 220);
    };
    ov.addEventListener('click', finish);
    if (autoMs) setTimeout(finish, autoMs);
  });
}

function rain(host, tier) {
  const n = 14 + tier * 8;
  for (let i = 0; i < n; i++) {
    const c = h('span', { class: 'coin', style: { left: Math.random() * 100 + '%', animationDelay: Math.random() * 1.2 + 's', animationDuration: 1.8 + Math.random() * 1.6 + 's', fontSize: 16 + Math.random() * 18 + 'px' } }, '🪙');
    host.append(c);
  }
}

// ── отрисовка символов ──
export function symView(cfg, id) {
  if (id === 'W') return { icon: cfg.wild.icon, color: cfg.wild.color, cls: 'wild', label: 'WILD' };
  if (id === 'S') return { icon: cfg.scatter.icon, color: cfg.scatter.color, cls: 'scatter' };
  if (id.startsWith('B:')) return { icon: cfg.bomb.icon, color: cfg.bomb.color, cls: 'bomb', label: 'x' + id.slice(2) };
  const s = cfg.symbols[id];
  return { icon: s.icon, color: s.color, cls: (s.text ? 'text ' : '') + (s.gem ? 'gem' : '') };
}

export function fillCell(el, cfg, id) {
  const v = symView(cfg, id);
  el.className = 'cell ' + v.cls;
  el.dataset.id = id;
  el.style.setProperty('--c', v.color);
  el.replaceChildren(h('span', { class: 'sym' }, v.icon), ...(v.label ? [h('b', { class: 'tag' }, v.label)] : []));
  return el;
}

export const makeCell = (cfg, id) => fillCell(document.createElement('div'), cfg, id);

export function randomRegular(cfg) {
  const ids = Object.keys(cfg.symbols);
  return ids[Math.floor(Math.random() * ids.length)];
}
