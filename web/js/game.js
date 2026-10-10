// Экран игры: управление ставкой, спин, автоигра, бонусные раунды.
import { api } from './api.js';
import { h, fmt, sleep, round2, toast, haptic, errText, countTo, winOverlay } from './ui.js';
import { createLines } from './lines.js';
import { createTumble } from './tumble.js';
import { openPaytable } from './paytable.js';

const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

const svgSpin = `<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><path d="M24 9a15 15 0 1 0 14.2 10.2" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M33 4l7 14-15-1z" fill="currentColor"/></svg>`;
const svgStop = `<svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true"><rect x="12" y="12" width="24" height="24" rx="5" fill="currentColor"/></svg>`;

function icon(svg) {
  const s = document.createElement('span');
  s.className = 'ico';
  s.innerHTML = svg; // статичная разметка из констант выше
  return s;
}

export function mountGame({ root, cfg, state, bets, onExit }) {
  let betIdx = Math.min(bets.length - 1, Math.max(0, Number(store.get('betIdx', 3))));
  let busy = false;
  let auto = false;
  let turbo = store.get('turbo', '0') === '1';
  let multAcc = 0;
  let spinWinShown = 0;
  let alive = true;

  const renderer = cfg.type === 'lines' ? createLines(cfg) : createTumble(cfg);

  // ── DOM ──
  const balEl = h('b', { class: 'val' }, fmt(state.user.balance));
  const winEl = h('b', { class: 'val' }, '0');
  const betEl = h('b', { class: 'val' }, fmt(bets[betIdx]));
  const floatEl = h('div', { class: 'float-win', 'aria-hidden': 'true' });
  const badge = h('div', { class: 'mult-badge', hidden: true });
  const fsCount = h('span', {}, '');
  const fsWin = h('span', {}, '');
  const fsBar = h('div', { class: 'fsbar', hidden: true }, fsCount, fsWin);

  const spinBtn = h('button', { class: 'spin', 'aria-label': 'Крутить', onclick: onSpinClick });
  const turboBtn = h('button', { class: 'pill', 'aria-pressed': String(turbo), onclick: toggleTurbo }, 'Турбо');
  const autoBtn = h('button', { class: 'pill', 'aria-pressed': 'false', onclick: toggleAuto }, 'Авто');
  const minusBtn = h('button', { class: 'step', 'aria-label': 'Уменьшить ставку', onclick: () => changeBet(-1) }, '−');
  const plusBtn = h('button', { class: 'step', 'aria-label': 'Увеличить ставку', onclick: () => changeBet(1) }, '+');

  const el = h(
    'section',
    { class: `game theme-${cfg.id}` },
    h(
      'header',
      { class: 'g-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'В лобби', onclick: exit }, '‹'),
      h('div', { class: 'g-title' }, h('h2', {}, cfg.name), h('span', {}, `RTP ${fmt(Math.round(cfg.rtp * 1000) / 10)}%`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Правила и выплаты', onclick: () => openPaytable(cfg, bets[betIdx]) }, 'i'),
    ),
    fsBar,
    h(
      'div',
      { class: 'stage' },
      h('div', { class: 'marquee' }, h('div', { class: 'board-wrap' }, renderer.el, badge, floatEl)),
    ),
    h(
      'footer',
      { class: 'dock' },
      h(
        'div',
        { class: 'readouts' },
        h('div', { class: 'readout' }, h('span', {}, 'Баланс'), balEl),
        h('div', { class: 'readout win' }, h('span', {}, 'Выигрыш'), winEl),
      ),
      h(
        'div',
        { class: 'bet' },
        minusBtn,
        h('div', { class: 'bet-val' }, h('span', {}, 'Ставка'), betEl),
        plusBtn,
      ),
      h('div', { class: 'actions' }, turboBtn, spinBtn, autoBtn),
    ),
  );
  root.replaceChildren(el);
  renderer.idle();
  setSpinIcon();
  syncBet();

  // ── вспомогательное ──
  function setSpinIcon() {
    spinBtn.replaceChildren(icon(auto ? svgStop : svgSpin));
    spinBtn.classList.toggle('busy', busy && !auto);
  }
  const setBalance = (v) => (balEl.textContent = fmt(v));
  function setWin(v, animate = true) {
    if (animate && v > 0) {
      countTo(winEl, spinWinShown, v, 450);
    } else winEl.textContent = fmt(v);
    spinWinShown = v;
  }
  function setBadge(v) {
    badge.hidden = !(v > 0);
    badge.textContent = 'x' + fmt(v);
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }
  function float(text) {
    floatEl.textContent = text;
    floatEl.classList.remove('show');
    void floatEl.offsetWidth;
    floatEl.classList.add('show');
  }
  function lights(on) {
    el.querySelector('.marquee').classList.toggle('lit', on);
  }
  function syncBet() {
    betEl.textContent = fmt(bets[betIdx]);
    minusBtn.disabled = busy || betIdx === 0;
    plusBtn.disabled = busy || betIdx === bets.length - 1;
    store.set('betIdx', String(betIdx));
  }
  function setBusy(v) {
    busy = v;
    spinBtn.disabled = v && !auto;
    turboBtn.disabled = false;
    syncBet();
    setSpinIcon();
  }
  function changeBet(d) {
    if (busy) return;
    betIdx = Math.min(bets.length - 1, Math.max(0, betIdx + d));
    syncBet();
    haptic.tap();
  }
  function toggleTurbo() {
    turbo = !turbo;
    turboBtn.setAttribute('aria-pressed', String(turbo));
    store.set('turbo', turbo ? '1' : '0');
  }
  function toggleAuto() {
    if (auto) return stopAuto();
    auto = true;
    autoBtn.setAttribute('aria-pressed', 'true');
    setSpinIcon();
    if (!busy) runAuto();
  }
  function stopAuto() {
    auto = false;
    autoBtn.setAttribute('aria-pressed', 'false');
    setSpinIcon();
    spinBtn.disabled = busy;
  }
  function onSpinClick() {
    if (auto) return stopAuto();
    spin();
  }
  function exit() {
    alive = false;
    auto = false;
    onExit();
  }

  async function runAuto() {
    while (auto && alive) {
      while (busy && alive) await sleep(100);
      if (!auto || !alive) break;
      const ok = await spin();
      if (!ok) break;
      await sleep(turbo ? 250 : 600);
    }
    if (alive) stopAuto();
  }

  // ── спин ──
  async function spin() {
    if (busy || !alive) return false;
    const bet = bets[betIdx];
    if (state.user.balance < bet) {
      toast('Не хватает монет. Уменьши ставку или забери бонус в лобби.');
      haptic.err();
      return false;
    }
    setBusy(true);
    haptic.tap();
    const before = state.user.balance;
    setBalance(round2(before - bet));
    spinWinShown = 0;
    winEl.textContent = '0';
    lights(false);
    renderer.clear();
    multAcc = 0;
    badge.hidden = true;

    let res;
    try {
      res = await api.spin(cfg.id, bet);
    } catch (e) {
      if (e.code === 'insufficient_funds' && e.data?.balance != null) state.user.balance = e.data.balance;
      setBalance(state.user.balance);
      toast(errText(e));
      haptic.err();
      setBusy(false);
      return false;
    }

    try {
      await playResult(res, bet, before);
    } catch (e) {
      console.error(e);
    } finally {
      state.user.balance = res.balance;
      setBalance(res.balance);
      setBusy(false);
      state.onBalance?.();
    }
    return true;
  }

  const makeCb = (speed) => ({
    toast,
    win: (amount) => {
      setWin(amount);
      if (amount > 0) {
        float('+' + fmt(amount));
        lights(true);
      }
    },
    stepWin: (amount) => {
      const next = round2(spinWinShown + amount);
      setWin(next);
      float('+' + fmt(amount));
    },
    bomb: (v) => {
      multAcc += v;
      setBadge(multAcc);
      haptic.tap();
    },
    applyMult: ({ seqWin, mult }) => {
      float(`${fmt(seqWin)} × ${fmt(mult)}`);
      haptic.win();
    },
    speed,
  });

  async function playResult(res, bet, before) {
    const speed = turbo ? 2.2 : 1;
    let shown = round2(before - bet);

    await renderer.play(res.base, { speed, free: false, cb: makeCb(speed) });
    shown = round2(shown + res.base.win);
    setBalance(shown);
    if (res.base.win > 0) haptic.win();

    if (!alive) return;
    if (res.free) {
      const f = res.free;
      const extra =
        cfg.type === 'lines'
          ? `Все выигрыши по линиям x${cfg.free.mult}`
          : cfg.free.mode === 'persistent'
            ? 'Множитель накапливается до конца бонуса'
            : 'Множители выпадают чаще';
      await winOverlay({ title: `${f.awarded} бесплатных спинов`, sub: extra, tier: 1, autoMs: auto ? 1800 : 3000 });

      el.classList.add('fs');
      fsBar.hidden = false;
      let total = f.awarded;
      let fsSum = 0;
      for (let i = 0; i < f.spins.length; i++) {
        if (!alive) break;
        const s = f.spins[i];
        const spd = turbo ? 2.2 : 1;
        fsCount.textContent = `Бесплатный спин ${i + 1} из ${total}`;
        fsWin.textContent = `Бонус: ${fmt(fsSum)}`;
        multAcc = cfg.type === 'tumble' && cfg.free.mode === 'persistent' ? s.multBefore || 0 : 0;
        setBadge(multAcc);
        spinWinShown = 0;
        winEl.textContent = '0';
        lights(false);
        await renderer.play(s, { speed: spd, free: true, cb: makeCb(spd) });
        fsSum = round2(fsSum + s.win);
        shown = round2(shown + s.win);
        setBalance(shown);
        fsWin.textContent = `Бонус: ${fmt(fsSum)}`;
        if (s.retrigger) {
          total += s.retrigger;
          fsCount.textContent = `Бесплатный спин ${i + 1} из ${total}`;
          toast(`+${s.retrigger} бесплатных спинов`);
        }
        await sleep(260 / spd);
      }
      el.classList.remove('fs');
      fsBar.hidden = true;
      badge.hidden = true;
      renderer.clear();
    }

    // итог
    if (!alive) return;
    const mult = res.win / bet;
    const tier = mult >= 100 ? 3 : mult >= 40 ? 2 : mult >= 15 ? 1 : 0;
    if (res.free || tier > 0) {
      const title = res.free
        ? 'Бонус завершён'
        : tier === 3
          ? 'Невероятный выигрыш'
          : tier === 2
            ? 'Огромный выигрыш'
            : 'Большой выигрыш';
      haptic.win();
      winOverlay({ title, sub: res.capped ? `Достигнут максимум: x${fmt(cfg.maxWin)} от ставки` : `x${fmt(round2(mult))} от ставки`, amount: res.win, tier: Math.max(tier, res.free ? 1 : 0), autoMs: auto ? 2200 : 4200 });
      // оверлей закрывается сам или по нажатию; ждём, пока игрок его увидит
      await sleep(auto ? 2400 : 700);
    }
    setWin(res.win, false);
  }

  return { destroy: () => (alive = false) };
}
