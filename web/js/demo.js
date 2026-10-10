// Демо-режим без сервера: тот же движок слотов, но баланс и ник лежат в localStorage браузера.
// Нужен, чтобы проверить игру на GitHub Pages до деплоя Worker. Ничего общего с настоящим
// режимом (сервер, Telegram ID, рейтинг) тут нет: данные живут только в этом браузере.
import { play, cryptoRng, round2 } from './shared/engine.js';
import { BETS, START_BALANCE, DAILY_BONUS, SLOTS, publicSlots } from './shared/slots.js';

const KEY = 'slots_demo_user_v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const NICK_RE = /^[\p{L}\p{N}_-]{3,16}$/u;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
function save(u) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* приватный режим: прогресс не сохранится, игра продолжит работать до перезагрузки */
    mem = u;
  }
}
let mem = null;
const get = () => load() || mem;

const pub = (u) => ({
  nick: u.nick,
  balance: round2(u.balance),
  spins: u.spins,
  total_wagered: round2(u.total_wagered),
  total_won: round2(u.total_won),
  biggest_win: round2(u.biggest_win),
  bonus_ready_at: u.last_bonus_at + DAY_MS,
});

export function createDemo(ApiError) {
  const fail = (status, code, data) => {
    throw new ApiError(status, code, data);
  };
  const need = () => get() || fail(404, 'not_registered');
  let lastSpin = 0;

  return {
    config: async () => ({ slots: publicSlots(), bets: BETS, start_balance: START_BALANCE, daily_bonus: DAILY_BONUS }),

    me: async () => {
      const u = get();
      return u ? { registered: true, user: pub(u), now: Date.now() } : { registered: false, suggested_nick: '' };
    },

    register: async (nick) => {
      nick = String(nick ?? '').trim();
      if (!NICK_RE.test(nick)) fail(400, 'bad_nick');
      const u = get() || { nick, balance: START_BALANCE, spins: 0, total_wagered: 0, total_won: 0, biggest_win: 0, last_bonus_at: 0 };
      save(u);
      return { registered: true, user: pub(u), now: Date.now() };
    },

    spin: async (slot, bet) => {
      const u = need();
      if (!SLOTS[slot]) fail(400, 'bad_slot');
      if (!BETS.includes(bet)) fail(400, 'bad_bet');
      if (u.balance < bet) fail(402, 'insufficient_funds', { balance: round2(u.balance) });
      const now = Date.now();
      if (now - lastSpin < 250) fail(429, 'too_fast');
      lastSpin = now;
      const result = play(slot, bet, cryptoRng());
      u.balance = round2(u.balance - bet + result.win);
      u.spins += 1;
      u.total_wagered = round2(u.total_wagered + bet);
      u.total_won = round2(u.total_won + result.win);
      u.biggest_win = Math.max(u.biggest_win, result.win);
      save(u);
      return { ...result, balance: u.balance };
    },

    bonus: async () => {
      const u = need();
      const now = Date.now();
      if (now - u.last_bonus_at < DAY_MS) fail(429, 'bonus_not_ready', { bonus_ready_at: u.last_bonus_at + DAY_MS });
      u.balance = round2(u.balance + DAILY_BONUS);
      u.last_bonus_at = now;
      save(u);
      return { amount: DAILY_BONUS, balance: u.balance, bonus_ready_at: now + DAY_MS };
    },

    leaderboard: async () => {
      const u = need();
      return {
        balance: [{ nick: u.nick, value: round2(u.balance) }],
        win: u.biggest_win > 0 ? [{ nick: u.nick, value: round2(u.biggest_win) }] : [],
        me: { nick: u.nick, balance: round2(u.balance), rank: 1 },
      };
    },
  };
}
