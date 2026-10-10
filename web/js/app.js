import { api, isDemo } from './api.js';
import { h, fmt, toast, modal, errText, haptic, makeCell } from './ui.js';
import { mountGame } from './game.js';

const tg = window.Telegram?.WebApp;
const app = document.getElementById('app');

const state = {
  config: null,
  user: null,
  clockOffset: 0,
  onBalance: null,
};
const serverNow = () => Date.now() + state.clockOffset;

function initTelegram() {
  try {
    tg?.ready();
    tg?.expand();
    tg?.disableVerticalSwipes?.();
    tg?.setHeaderColor?.('#0c2f26');
    tg?.setBackgroundColor?.('#0c2f26');
  } catch {
    /* не в Telegram */
  }
}

// ───────────── экраны ─────────────
function screenMessage(title, text, action) {
  app.replaceChildren(
    h('div', { class: 'center-screen' }, h('h1', {}, title), h('p', {}, text), action ? h('button', { class: 'btn', onclick: action.fn }, action.label) : null),
  );
}

function screenLoading() {
  app.replaceChildren(h('div', { class: 'center-screen' }, h('div', { class: 'loader', 'aria-label': 'Загрузка' })));
}

function screenRegister(suggested) {
  const input = h('input', {
    id: 'nick',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    maxlength: '16',
    placeholder: 'Например, Lucky_77',
    value: suggested || '',
  });
  const error = h('p', { class: 'field-error', role: 'alert' }, '');
  const btn = h('button', { class: 'btn', type: 'submit' }, 'Играть');

  const form = h(
    'form',
    {
      class: 'register',
      onsubmit: async (e) => {
        e.preventDefault();
        const nick = input.value.trim();
        error.textContent = '';
        if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(nick)) {
          error.textContent = 'Ник: от 3 до 16 символов — буквы, цифры, _ и -.';
          return;
        }
        btn.disabled = true;
        try {
          const r = await api.register(nick);
          state.user = r.user;
          state.clockOffset = r.now - Date.now();
          haptic.win();
          screenLobby();
        } catch (err) {
          error.textContent = errText(err);
          haptic.err();
          btn.disabled = false;
        }
      },
    },
    h('h1', {}, 'Придумай ник'),
    h('p', { class: 'muted' }, `Он будет виден в рейтинге. На старте тебя ждёт ${fmt(state.config.start_balance)} монет.`),
    h('label', { for: 'nick', class: 'sr-only' }, 'Ник'),
    input,
    error,
    btn,
    h('p', { class: 'fine' }, 'Монеты виртуальные: их нельзя купить или вывести.'),
  );
  app.replaceChildren(h('div', { class: 'center-screen' }, form));
}

// ───────────── лобби ─────────────
const pad = (n) => String(n).padStart(2, '0');
function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function screenLobby() {
  const balEl = h('b', {}, fmt(state.user.balance));
  state.onBalance = () => (balEl.textContent = fmt(state.user.balance));

  const bonusBtn = h('button', { class: 'bonus', onclick: claimBonus });
  function paintBonus() {
    const left = state.user.bonus_ready_at - serverNow();
    if (left <= 0) {
      bonusBtn.disabled = false;
      bonusBtn.replaceChildren(h('span', { class: 'bonus-main' }, `Забрать ${fmt(state.config.daily_bonus)} монет`), h('span', { class: 'bonus-sub' }, 'Ежедневный бонус готов'));
    } else {
      bonusBtn.disabled = true;
      bonusBtn.replaceChildren(h('span', { class: 'bonus-main' }, 'Ежедневный бонус'), h('span', { class: 'bonus-sub' }, `Следующий через ${countdown(left)}`));
    }
  }
  async function claimBonus() {
    bonusBtn.disabled = true;
    try {
      const r = await api.bonus();
      state.user.balance = r.balance;
      state.user.bonus_ready_at = r.bonus_ready_at;
      balEl.textContent = fmt(r.balance);
      haptic.win();
      toast(`+${fmt(r.amount)} монет на баланс`);
    } catch (e) {
      if (e.data?.bonus_ready_at) state.user.bonus_ready_at = e.data.bonus_ready_at;
      toast(errText(e));
    }
    paintBonus();
  }

  const cards = Object.values(state.config.slots).map((cfg) => {
    const top = Object.keys(cfg.symbols)
      .filter((id) => !cfg.symbols[id].text)
      .sort((a, b) => cfg.symbols[b].pay[2] - cfg.symbols[a].pay[2])
      .slice(0, 3);
    const tiles = h('div', { class: 'tiles' }, top.map((id, i) => h('div', { class: 'tile t' + i }, makeCell(cfg, id))));
    return h(
      'button',
      { class: `game-card theme-${cfg.id}`, onclick: () => openSlot(cfg) },
      h('div', { class: 'gc-text' }, h('h3', {}, cfg.name), h('p', {}, cfg.tagline), h('span', { class: 'gc-meta' }, cfg.type === 'lines' ? `${cfg.cols}×${cfg.rows}, ${cfg.lines} линий` : `${cfg.cols}×${cfg.rows}, выигрыш в любом месте`)),
      tiles,
    );
  });

  const el = h(
    'div',
    { class: 'lobby' },
    h(
      'header',
      { class: 'l-head' },
      h('div', { class: 'who' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, [...state.user.nick][0].toUpperCase()), h('span', { class: 'nick' }, state.user.nick)),
      h('div', { class: 'wallet' }, h('span', { class: 'coin-ico', 'aria-hidden': 'true' }, '🪙'), balEl),
    ),
    bonusBtn,
    h('h2', { class: 'section' }, 'Слоты'),
    h('div', { class: 'cards' }, ...cards),
    h('button', { class: 'btn ghost', onclick: openLeaderboard }, 'Рейтинг игроков'),
    h('p', { class: 'fine' }, 'Игра на виртуальные монеты. Реальных денег здесь нет.'),
    isDemo ? h('p', { class: 'fine demo' }, 'Демо-режим: без сервера. Баланс и ник хранятся только в этом браузере, рейтинг показывает одного тебя.') : null,
  );
  app.replaceChildren(el);
  paintBonus();
  const timer = setInterval(() => {
    if (!el.isConnected) return clearInterval(timer);
    paintBonus();
  }, 1000);
}

function openSlot(cfg) {
  mountGame({ root: app, cfg, state, bets: state.config.bets, onExit: screenLobby });
}

async function openLeaderboard() {
  const body = h('div', { class: 'lb' }, h('div', { class: 'loader small' }));
  modal(body, { title: 'Рейтинг игроков' });
  try {
    const data = await api.leaderboard();
    let tab = 'balance';
    const list = h('ol', { class: 'lb-list' });
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const draw = () => {
      list.replaceChildren(...data[tab].map((r) => h('li', { class: r.nick === data.me.nick ? 'me' : '' }, h('span', { class: 'lb-nick' }, r.nick), h('b', {}, fmt(r.value)))));
      if (!data[tab].length) list.replaceChildren(h('li', { class: 'empty' }, 'Пока никого. Крути барабаны — и ты первый.'));
      for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    };
    for (const [key, label] of [['balance', 'По балансу'], ['win', 'Лучший выигрыш']]) {
      tabs.append(h('button', { 'data-tab': key, role: 'tab', onclick: () => ((tab = key), draw()) }, label));
    }
    body.replaceChildren(tabs, list, h('p', { class: 'lb-me' }, `Твоё место по балансу: ${fmt(data.me.rank)}`));
    draw();
  } catch (e) {
    body.replaceChildren(h('p', { class: 'muted' }, errText(e)));
  }
}

// ───────────── запуск ─────────────
async function boot() {
  initTelegram();
  screenLoading();
  try {
    const [config, me] = await Promise.all([api.config(), api.me()]);
    state.config = config;
    if (!me.registered) return screenRegister(me.suggested_nick);
    state.user = me.user;
    state.clockOffset = me.now - Date.now();
    screenLobby();
  } catch (e) {
    screenMessage('Не удалось войти', errText(e), { label: 'Повторить', fn: boot });
  }
}

boot();
