// Отрисовка слота 5x3 с линиями: вращающиеся барабаны (Web Animations API).
import { h, sleep, makeCell, randomRegular } from './ui.js';

export function createLines(cfg) {
  const { cols, rows } = cfg;
  const el = h('div', { class: 'board lines' });
  const reels = [];
  const strips = [];
  let current = []; // текущие символы по колонкам

  for (let c = 0; c < cols; c++) {
    const strip = h('div', { class: 'strip' });
    const reel = h('div', { class: 'reel' }, strip);
    el.append(reel);
    reels.push(reel);
    strips.push(strip);
  }

  const randomCol = () => Array.from({ length: rows }, () => randomRegular(cfg));

  function show(grid) {
    current = grid.map((col) => col.slice());
    for (let c = 0; c < cols; c++) {
      strips[c].replaceChildren(...grid[c].map((id) => makeCell(cfg, id)));
      strips[c].style.transform = '';
    }
  }

  function clearHits() {
    el.classList.remove('has-hit');
    for (const cell of el.querySelectorAll('.cell.hit')) cell.classList.remove('hit');
    for (const cell of el.querySelectorAll('.cell.pop')) cell.classList.remove('pop');
  }

  function markHits(outcome) {
    const cells = [];
    for (const w of outcome.lineWins) for (const [c, r] of w.cells) cells.push([c, r]);
    if (outcome.scatterCount >= 3) {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (outcome.grid[c][r] === 'S') cells.push([c, r]);
    }
    for (const [c, r] of cells) strips[c].children[r]?.classList.add('hit');
    if (cells.length) el.classList.add('has-hit');
  }

  async function spinReels(outcome, speed) {
    const cellH = reels[0].clientHeight / rows;
    const jobs = [];
    for (let c = 0; c < cols; c++) {
      const fin = outcome.grid[c];
      const fillers = Array.from({ length: 7 + c * 3 }, () => randomRegular(cfg));
      const ids = [...fin, ...fillers, ...current[c]];
      const strip = strips[c];
      strip.replaceChildren(...ids.map((id) => makeCell(cfg, id)));
      const dist = (ids.length - rows) * cellH;
      const duration = (620 + c * 180 + fillers.length * 16) / speed;
      const anim = strip.animate(
        [{ transform: `translateY(${-dist}px)` }, { transform: 'translateY(0)' }],
        { duration, easing: 'cubic-bezier(.3,.85,.35,1.1)', fill: 'forwards' },
      );
      strip.classList.add('spinning');
      jobs.push(
        anim.finished.then(() => {
          strip.classList.remove('spinning');
          strip.replaceChildren(...fin.map((id) => makeCell(cfg, id)));
          anim.cancel();
          if (outcome.expanded?.includes(c)) for (const cell of strip.children) cell.classList.add('pop');
        }),
      );
    }
    await Promise.all(jobs);
    current = outcome.grid.map((col) => col.slice());
  }

  return {
    el,
    idle() {
      show(Array.from({ length: cols }, randomCol));
    },
    async play(outcome, { speed, cb }) {
      clearHits();
      await spinReels(outcome, speed);
      markHits(outcome);
      if (outcome.scatterWin > 0) cb.toast(`Скаттеры: +${outcome.scatterWin}`);
      cb.win(outcome.win);
      await sleep((outcome.win > 0 ? 900 : 180) / speed);
    },
    clear: clearHits,
  };
}
