// Конфигурация всех слотов. Всё считается на сервере (engine.js), клиент только рисует результат.
//
// pay у "lines"-слотов — в множителях ставки НА ЛИНИЮ (ставка / lines).
// pay у "tumble"-слотов — в множителях ОБЩЕЙ ставки.
// scale — калибровочный коэффициент, подобранный симуляцией (npm run sim) под целевой RTP.
// Поменял веса/выплаты — прогони симуляцию и поправь scale.

export const BETS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
export const START_BALANCE = 10000;
export const DAILY_BONUS = 5000;
export const MAX_WIN_MULT = 5000; // потолок выигрыша за один спин (включая бонус), в ставках

// 10 линий для поля 5x3. Значение = номер строки (0 — верхняя) для каждой из 5 колонок.
export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];

export const SLOTS = {
  // ───────────────────────── 5x3, 10 линий, дикий + бонус ─────────────────────────
  pharaoh: {
    id: 'pharaoh',
    type: 'lines',
    name: "Pharaoh's Gold",
    tagline: 'Бонус с множителем x3',
    cols: 5,
    rows: 3,
    lines: 10,
    scale: 1.355,
    rtp: 0.955,
    symbols: {
      PHA: { icon: '👑', color: '#f5c542', pay: [30, 150, 1000] },
      EAG: { icon: '🦅', color: '#e8743b', pay: [25, 100, 500] },
      SCA: { icon: '🪲', color: '#2fbf8f', pay: [20, 70, 300] },
      VAS: { icon: '🏺', color: '#c8643c', pay: [15, 50, 250] },
      A: { icon: 'A', text: true, color: '#8a5cf6', pay: [7, 20, 80] },
      K: { icon: 'K', text: true, color: '#3b9cf6', pay: [7, 20, 80] },
      Q: { icon: 'Q', text: true, color: '#e0557f', pay: [5, 15, 60] },
      J: { icon: 'J', text: true, color: '#4fb35f', pay: [5, 15, 60] },
    },
    weights: { PHA: 4, EAG: 6, SCA: 8, VAS: 10, A: 14, K: 14, Q: 16, J: 16 },
    wild: { icon: '🌞', color: '#ff8a3d', reels: [1, 2, 3], weight: 5 },
    scatter: { icon: '🔺', color: '#33d6c2', weight: 3, pay: { 3: 2, 4: 10, 5: 50 } },
    expand: false,
    free: { spins: { 3: 10, 4: 15, 5: 20 }, mult: 3, retrigger: 5, maxSpins: 60, wildWeight: 8 },
    rules: [
      '10 фиксированных линий, выигрыш считается слева направо от 1-й колонки.',
      '🌞 WILD появляется на колонках 2–4 и заменяет все символы, кроме 🔺.',
      '3+ символа 🔺 в любом месте дают выплату и 10 / 15 / 20 бесплатных спинов.',
      'В бесплатных спинах все выигрыши по линиям умножаются на x3, WILD выпадает чаще.',
      '3+ символа 🔺 во время бонуса добавляют ещё 5 спинов.',
    ],
  },

  fruit: {
    id: 'fruit',
    type: 'lines',
    name: 'Fruit Fiesta',
    tagline: 'Расширяющиеся WILD',
    cols: 5,
    rows: 3,
    lines: 10,
    scale: 1.06,
    rtp: 0.955,
    symbols: {
      SEV: { icon: '7️⃣', color: '#e63946', pay: [12, 60, 300] },
      BEL: { icon: '🔔', color: '#f5c542', pay: [9, 35, 140] },
      MEL: { icon: '🍉', color: '#2fbf6f', pay: [7, 25, 90] },
      GRA: { icon: '🍇', color: '#8a5cf6', pay: [5, 18, 70] },
      ORA: { icon: '🍊', color: '#f08a24', pay: [3, 12, 45] },
      LEM: { icon: '🍋', color: '#d9c928', pay: [2, 9, 35] },
      CHE: { icon: '🍒', color: '#d6336c', pay: [2, 7, 28] },
    },
    weights: { SEV: 4, BEL: 6, MEL: 8, GRA: 10, ORA: 13, LEM: 15, CHE: 17 },
    wild: { icon: '🃏', color: '#ff4fa3', reels: [1, 2, 3], weight: 4 },
    scatter: { icon: '⭐', color: '#33d6c2', weight: 2.5, pay: { 3: 2, 4: 10, 5: 50 } },
    expand: true,
    free: { spins: { 3: 8, 4: 12, 5: 20 }, mult: 2, retrigger: 4, maxSpins: 60, wildWeight: 8 },
    rules: [
      '10 фиксированных линий, выигрыш считается слева направо от 1-й колонки.',
      '🃏 WILD появляется на колонках 2–4, заменяет все символы, кроме ⭐, и растягивается на всю колонку.',
      '3+ символа ⭐ в любом месте дают выплату и 8 / 12 / 20 бесплатных спинов.',
      'В бесплатных спинах выигрыши по линиям умножаются на x2, а WILD выпадает вдвое чаще.',
      '3+ символа ⭐ во время бонуса добавляют ещё 4 спина.',
    ],
  },

  // ───────────────────────── 6x5, платит в любом месте, каскады ─────────────────────────
  candy: {
    id: 'candy',
    type: 'tumble',
    name: 'Candy Cascade',
    tagline: 'Каскады и множители до x100',
    cols: 6,
    rows: 5,
    minCount: 8,
    scale: 1.035,
    rtp: 0.955,
    symbols: {
      LOL: { icon: '🍭', color: '#e63e8b', pay: [10, 25, 50] },
      DON: { icon: '🍩', color: '#e8743b', pay: [2.5, 10, 25] },
      CUP: { icon: '🧁', color: '#a46bf0', pay: [2, 5, 15] },
      CAN: { icon: '🍬', color: '#3ba6f0', pay: [1.5, 2, 12] },
      STR: { icon: '🍓', color: '#e0334f', pay: [1, 1.5, 10] },
      GRA: { icon: '🍇', color: '#7d4fd6', pay: [0.75, 1.2, 8] },
      BAN: { icon: '🍌', color: '#e0c12a', pay: [0.5, 1, 5] },
      MEL: { icon: '🍉', color: '#2fbf6f', pay: [0.4, 0.9, 4] },
      APL: { icon: '🍏', color: '#6fbf2f', pay: [0.25, 0.75, 2] },
    },
    weights: { LOL: 2, DON: 3, CUP: 4, CAN: 5, STR: 7, GRA: 7, BAN: 8, MEL: 9, APL: 10 },
    scatter: { icon: '🎂', color: '#33d6c2', weight: 1.25, pay: { 4: 3, 5: 5, 6: 100 } },
    bomb: {
      icon: '🎁',
      color: '#ffb02e',
      weight: 0.25,
      fsWeight: 6.5,
      values: { 2: 25, 3: 20, 4: 15, 5: 10, 6: 8, 8: 6, 10: 5, 12: 4, 15: 3, 20: 2, 25: 1.5, 50: 0.5, 100: 0.2 },
    },
    free: {
      triggerCount: 4,
      retriggerCount: 3,
      spins: { 4: 10, 5: 12, 6: 15 },
      retrigger: 5,
      maxSpins: 50,
      scatterWeight: 0.8,
      mode: 'sequence', // множители 🎁 суммируются в рамках одной серии каскадов
    },
    rules: [
      'Выигрыш даёт 8 и более одинаковых символов в любом месте поля.',
      'Выигрышные символы исчезают, остальные падают вниз, сверху добавляются новые — пока есть выигрыш.',
      '🎁 несут множитель x2–x100. Если серия каскадов принесла выигрыш, все 🎁 серии складываются и умножают его.',
      '4+ символа 🎂 дают выплату и 10 / 12 / 15 бесплатных спинов, где 🎁 выпадают заметно чаще.',
      '3+ символа 🎂 во время бонуса добавляют ещё 5 спинов.',
    ],
  },

  thunder: {
    id: 'thunder',
    type: 'tumble',
    name: 'Thunder Realm',
    tagline: 'Накопительный множитель в бонусе',
    cols: 6,
    rows: 5,
    minCount: 8,
    scale: 1.0,
    rtp: 0.955,
    symbols: {
      TRI: { icon: '🔱', color: '#f5c542', pay: [10, 25, 50] },
      EAG: { icon: '🦅', color: '#d98b3a', pay: [3, 10, 25] },
      SWD: { icon: '⚔️', color: '#9aa7b8', pay: [2, 5, 15] },
      SHD: { icon: '🛡️', color: '#4a86d6', pay: [1.5, 2, 12] },
      RED: { icon: '🔴', color: '#e63946', pay: [1, 1.5, 10], gem: true },
      ORG: { icon: '🟠', color: '#f08a24', pay: [0.75, 1.2, 8], gem: true },
      YEL: { icon: '🟡', color: '#e0c12a', pay: [0.5, 1, 5], gem: true },
      GRN: { icon: '🟢', color: '#2fbf6f', pay: [0.4, 0.9, 4], gem: true },
      BLU: { icon: '🔵', color: '#3b8cf6', pay: [0.25, 0.75, 2], gem: true },
    },
    weights: { TRI: 2, EAG: 3, SWD: 4, SHD: 5, RED: 7, ORG: 7, YEL: 8, GRN: 9, BLU: 10 },
    scatter: { icon: '🌩️', color: '#33d6c2', weight: 1.2, pay: { 4: 3, 5: 5, 6: 100 } },
    bomb: {
      icon: '⚡',
      color: '#7cc6ff',
      weight: 0.25,
      fsWeight: 0.9,
      values: { 2: 25, 3: 20, 4: 15, 5: 10, 6: 8, 8: 6, 10: 5, 12: 4, 15: 3, 20: 2, 25: 1.5, 50: 0.5, 100: 0.2 },
    },
    free: {
      triggerCount: 4,
      retriggerCount: 3,
      spins: { 4: 10, 5: 12, 6: 15 },
      retrigger: 5,
      maxSpins: 50,
      scatterWeight: 0.8,
      mode: 'persistent', // множитель ⚡ копится на протяжении всех бесплатных спинов
    },
    rules: [
      'Выигрыш даёт 8 и более одинаковых символов в любом месте поля.',
      'Выигрышные символы исчезают, остальные падают вниз, сверху добавляются новые — пока есть выигрыш.',
      '⚡ несут множитель x2–x100. В обычной игре они суммируются в рамках серии и умножают её выигрыш.',
      '4+ символа 🌩️ дают выплату и 10 / 12 / 15 бесплатных спинов.',
      'В бесплатных спинах множитель ⚡ НЕ сгорает: он копится от спина к спину и умножает каждый выигрыш.',
      '3+ символа 🌩️ во время бонуса добавляют ещё 5 спинов.',
    ],
  },
};

export const SLOT_IDS = Object.keys(SLOTS);

// То, что уходит клиенту. Все выплаты пересчитаны в множители ОБЩЕЙ ставки.
export function publicSlots() {
  const out = {};
  for (const cfg of Object.values(SLOTS)) {
    const symbols = {};
    for (const [id, s] of Object.entries(cfg.symbols)) {
      const k = cfg.type === 'lines' ? cfg.scale / cfg.lines : cfg.scale;
      symbols[id] = {
        icon: s.icon,
        text: !!s.text,
        gem: !!s.gem,
        color: s.color,
        pay: s.pay.map((p) => Math.round(p * k * 1000) / 1000),
      };
    }
    const o = {
      id: cfg.id,
      type: cfg.type,
      name: cfg.name,
      tagline: cfg.tagline,
      cols: cfg.cols,
      rows: cfg.rows,
      rtp: cfg.rtp,
      maxWin: MAX_WIN_MULT,
      rules: cfg.rules,
      symbols,
      scatter: { icon: cfg.scatter.icon, color: cfg.scatter.color, pay: cfg.scatter.pay },
    };
    if (cfg.type === 'lines') {
      o.lines = cfg.lines;
      o.expand = cfg.expand;
      o.wild = { icon: cfg.wild.icon, color: cfg.wild.color };
      o.free = { spins: cfg.free.spins, mult: cfg.free.mult, retrigger: cfg.free.retrigger };
    } else {
      o.minCount = cfg.minCount;
      o.bomb = { icon: cfg.bomb.icon, color: cfg.bomb.color };
      o.free = {
        spins: cfg.free.spins,
        retrigger: cfg.free.retrigger,
        mode: cfg.free.mode,
        trigger: cfg.free.triggerCount,
        retriggerCount: cfg.free.retriggerCount,
      };
    }
    out[cfg.id] = o;
  }
  return out;
}
