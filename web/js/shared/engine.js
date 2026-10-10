// Игровой движок. Чистые функции без обращения к БД/сети — поэтому его можно
// гонять в симуляции на миллионы спинов (scripts/simulate.js) и использовать в Worker.

import { SLOTS, LINES, MAX_WIN_MULT } from './slots.js';

export const round2 = (x) => Math.round(x * 100) / 100;

// Криптографический RNG (в Workers и Node 20+ доступен глобальный crypto).
export function cryptoRng() {
  const buf = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  };
}

// ───────────────────────── взвешенные таблицы ─────────────────────────
function compile(weights) {
  const ids = [];
  const cum = [];
  let total = 0;
  for (const [id, w] of Object.entries(weights)) {
    if (w > 0) {
      total += w;
      ids.push(id);
      cum.push(total);
    }
  }
  return { ids, cum, total };
}

function draw(t, rng) {
  const x = rng() * t.total;
  for (let i = 0; i < t.cum.length; i++) if (x < t.cum[i]) return t.ids[i];
  return t.ids[t.ids.length - 1];
}

const prepared = new Map();
function prep(cfg) {
  let p = prepared.get(cfg.id);
  if (p) return p;
  if (cfg.type === 'lines') {
    if (cfg.wild.reels.includes(0)) throw new Error('WILD не может быть на 1-й колонке');
    const mk = (wildWeight) =>
      Array.from({ length: cfg.cols }, (_, c) =>
        compile({
          ...cfg.weights,
          W: cfg.wild.reels.includes(c) ? wildWeight : 0,
          S: cfg.scatter.weight,
        }),
      );
    p = { base: mk(cfg.wild.weight), free: mk(cfg.free.wildWeight ?? cfg.wild.weight) };
  } else {
    const mk = (bombW, scatW) =>
      compile({ ...cfg.weights, S: scatW, B: bombW });
    p = {
      base: mk(cfg.bomb.weight, cfg.scatter.weight),
      free: mk(cfg.bomb.fsWeight, cfg.free.scatterWeight ?? cfg.scatter.weight),
      bombValues: compile(cfg.bomb.values),
    };
  }
  prepared.set(cfg.id, p);
  return p;
}

// ───────────────────────── слоты с линиями (5x3) ─────────────────────────
function linesSpin(cfg, P, bet, rng, free) {
  const reels = free ? P.free : P.base;
  const grid = [];
  for (let c = 0; c < cfg.cols; c++) {
    const col = [];
    for (let r = 0; r < cfg.rows; r++) col.push(draw(reels[c], rng));
    grid.push(col);
  }

  // расширяющийся WILD: заполняет всю колонку (кроме скаттеров)
  const expanded = [];
  if (cfg.expand) {
    for (let c = 0; c < cfg.cols; c++) {
      if (grid[c].includes('W')) {
        grid[c] = grid[c].map((s) => (s === 'S' ? 'S' : 'W'));
        expanded.push(c);
      }
    }
  }

  const mult = free ? cfg.free.mult : 1;
  const lineWins = [];
  let total = 0;
  for (let l = 0; l < cfg.lines; l++) {
    const L = LINES[l];
    const base = grid[0][L[0]]; // на 1-й колонке WILD не бывает
    if (base === 'S') continue;
    let n = 1;
    for (let c = 1; c < cfg.cols; c++) {
      const s = grid[c][L[c]];
      if (s === base || s === 'W') n++;
      else break;
    }
    if (n < 3) continue;
    const pay = cfg.symbols[base].pay[n - 3];
    if (!pay) continue;
    const win = round2((bet * pay * cfg.scale * mult) / cfg.lines);
    if (win <= 0) continue;
    total += win;
    const cells = [];
    for (let c = 0; c < n; c++) cells.push([c, L[c]]);
    lineWins.push({ line: l, sym: base, count: n, win, cells });
  }

  let scatterCount = 0;
  for (let c = 0; c < cfg.cols; c++) for (let r = 0; r < cfg.rows; r++) if (grid[c][r] === 'S') scatterCount++;
  let scatterWin = 0;
  if (scatterCount >= 3) scatterWin = round2(bet * cfg.scatter.pay[Math.min(scatterCount, cfg.cols)]);

  return {
    grid,
    lineWins,
    expanded,
    scatterCount,
    scatterWin,
    win: round2(total + scatterWin),
  };
}

function playLines(cfg, P, bet, rng) {
  const cap = round2(bet * MAX_WIN_MULT);
  const base = linesSpin(cfg, P, bet, rng, false);
  let total = base.win;
  let free = null;

  if (base.scatterCount >= 3 && total < cap) {
    const awarded = cfg.free.spins[Math.min(base.scatterCount, cfg.cols)];
    let remaining = awarded;
    const spins = [];
    let fsTotal = 0;
    while (remaining > 0 && spins.length < cfg.free.maxSpins) {
      const s = linesSpin(cfg, P, bet, rng, true);
      remaining--;
      if (s.scatterCount >= 3) {
        s.retrigger = cfg.free.retrigger;
        remaining += cfg.free.retrigger;
      }
      spins.push(s);
      fsTotal = round2(fsTotal + s.win);
      if (total + fsTotal >= cap) break;
    }
    free = { awarded, spins, total: fsTotal, multiplier: cfg.free.mult };
    total = round2(total + fsTotal);
  }

  const capped = total >= cap;
  if (capped) {
    total = cap;
    if (free) free.total = round2(Math.max(0, cap - base.win));
  }
  return { base, free, win: total, capped };
}

// ───────────────────────── слоты с каскадами (6x5) ─────────────────────────
function tumbleCell(P, table, rng) {
  const id = draw(table, rng);
  return id === 'B' ? 'B:' + draw(P.bombValues, rng) : id;
}

function tumbleSpin(cfg, P, bet, rng, free, state) {
  const table = free ? P.free : P.base;
  const { cols, rows } = cfg;
  const grid = [];
  for (let c = 0; c < cols; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) col.push(tumbleCell(P, table, rng));
    grid.push(col);
  }

  const steps = [];
  let seqMult = 0; // выигрыш серии в множителях ставки (до бонусного множителя)
  let bombSum = 0;
  let maxScatters = 0;

  for (let guard = 0; guard < 40; guard++) {
    const counts = new Map();
    const scatters = [];
    const bombs = [];
    let stepBombs = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const s = grid[c][r];
        if (s === 'S') scatters.push([c, r]);
        else if (s.startsWith('B:')) {
          bombs.push([c, r]);
          stepBombs += Number(s.slice(2));
        } else {
          let a = counts.get(s);
          if (!a) counts.set(s, (a = []));
          a.push([c, r]);
        }
      }
    }

    const wins = [];
    let stepMult = 0;
    for (const [sym, cells] of counts) {
      const n = cells.length;
      if (n < cfg.minCount) continue;
      const pay = cfg.symbols[sym].pay[n >= 12 ? 2 : n >= 10 ? 1 : 0];
      const m = pay * cfg.scale;
      stepMult += m;
      wins.push({ sym, count: n, win: round2(bet * m), cells });
    }

    maxScatters = Math.max(maxScatters, scatters.length);
    bombSum += stepBombs;
    seqMult += stepMult;

    const step = {
      grid: grid.map((col) => col.slice()),
      wins,
      win: round2(bet * stepMult),
      bombValue: stepBombs,
      removed: [],
    };
    steps.push(step);
    if (wins.length === 0) break;

    // убираем выигрышные символы, а также 🎂 и 🎁 (они «собраны»)
    const gone = new Set();
    for (const w of wins) for (const [c, r] of w.cells) gone.add(c * rows + r);
    for (const [c, r] of scatters) gone.add(c * rows + r);
    for (const [c, r] of bombs) gone.add(c * rows + r);
    for (const k of gone) step.removed.push([Math.floor(k / rows), k % rows]);

    // гравитация + новые символы сверху
    for (let c = 0; c < cols; c++) {
      const keep = [];
      for (let r = 0; r < rows; r++) if (!gone.has(c * rows + r)) keep.push(grid[c][r]);
      const fresh = [];
      for (let i = rows - keep.length; i > 0; i--) fresh.push(tumbleCell(P, table, rng));
      grid[c] = fresh.concat(keep);
    }
  }

  // множитель серии
  let applied = 1;
  let multBefore = null;
  let multAfter = null;
  if (free && cfg.free.mode === 'persistent') {
    multBefore = state.R;
    state.R += bombSum;
    multAfter = state.R;
    if (seqMult > 0 && state.R > 0) applied = state.R;
  } else if (seqMult > 0 && bombSum > 0) {
    applied = bombSum;
  }

  const seqWin = round2(bet * seqMult);
  let win = round2(seqWin * applied);

  let scatterWin = 0;
  if (!free && maxScatters >= cfg.free.triggerCount) {
    scatterWin = round2(bet * cfg.scatter.pay[Math.min(maxScatters, 6)]);
    win = round2(win + scatterWin);
  }

  return { steps, seqWin, mult: applied, bombTotal: bombSum, multBefore, multAfter, scatterCount: maxScatters, scatterWin, win };
}

function playTumble(cfg, P, bet, rng) {
  const cap = round2(bet * MAX_WIN_MULT);
  const state = { R: 0 };
  const base = tumbleSpin(cfg, P, bet, rng, false, state);
  let total = base.win;
  let free = null;

  if (base.scatterCount >= cfg.free.triggerCount && total < cap) {
    const awarded = cfg.free.spins[Math.min(base.scatterCount, 6)];
    let remaining = awarded;
    const spins = [];
    let fsTotal = 0;
    while (remaining > 0 && spins.length < cfg.free.maxSpins) {
      const s = tumbleSpin(cfg, P, bet, rng, true, state);
      remaining--;
      if (s.scatterCount >= cfg.free.retriggerCount) {
        s.retrigger = cfg.free.retrigger;
        remaining += cfg.free.retrigger;
      }
      spins.push(s);
      fsTotal = round2(fsTotal + s.win);
      if (total + fsTotal >= cap) break;
    }
    free = { awarded, spins, total: fsTotal, mode: cfg.free.mode };
    total = round2(total + fsTotal);
  }

  const capped = total >= cap;
  if (capped) {
    total = cap;
    if (free) free.total = round2(Math.max(0, cap - base.win));
  }
  return { base, free, win: total, capped };
}

// ───────────────────────── публичный вход ─────────────────────────
export function play(slotId, bet, rng) {
  const cfg = SLOTS[slotId];
  if (!cfg) throw new Error('unknown slot');
  const P = prep(cfg);
  const r = cfg.type === 'lines' ? playLines(cfg, P, bet, rng) : playTumble(cfg, P, bet, rng);
  return { slot: slotId, bet, win: r.win, mult: round2(r.win / bet), capped: r.capped, base: r.base, free: r.free };
}
