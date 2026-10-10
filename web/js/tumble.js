// Отрисовка слота 6x5 с каскадами: символы падают, выигрышные исчезают, сверху добавляются новые.
import { h, sleep, fillCell, randomRegular } from './ui.js';

const GAP = 6; // px, должен совпадать с gap в .board.tumble

export function createTumble(cfg) {
  const { cols, rows } = cfg;
  const el = h('div', { class: 'board tumble' });
  const cells = []; // cells[c][r]
  for (let c = 0; c < cols; c++) cells.push([]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = h('div', { class: 'cell' });
      cells[c][r] = cell;
      el.append(cell);
    }
  }

  const stepPx = () => cells[0][0].offsetHeight + GAP;

  function paint(grid, moveMask, speed) {
    const sp = stepPx();
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cell = cells[c][r];
        fillCell(cell, cfg, grid[c][r]);
        if (moveMask && !moveMask[c][r]) continue;
        if (!moveMask) {
          // первый кадр серии: всё падает сверху
        }
        cell.animate(
          [
            { transform: `translateY(${-(r + 1.4) * sp}px)`, opacity: 0.2 },
            { transform: 'translateY(0)', opacity: 1 },
          ],
          { duration: 420 / speed, delay: (c * 35 + (rows - r) * 28) / speed, easing: 'cubic-bezier(.3,.75,.4,1.12)', fill: 'backwards' },
        );
      }
    }
  }

  async function dropOut(speed) {
    const sp = stepPx();
    const jobs = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cell = cells[c][r];
        if (!cell.dataset.id) continue;
        const a = cell.animate(
          [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: `translateY(${(rows - r + 1) * sp}px)`, opacity: 0 },
          ],
          { duration: 260 / speed, delay: (c * 25 + r * 12) / speed, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' },
        );
        jobs.push(a.finished.then(() => a.cancel()));
      }
    }
    await Promise.all(jobs);
  }

  function clearMarks() {
    el.classList.remove('has-hit');
    for (const col of cells) for (const cell of col) cell.classList.remove('hit', 'pulse');
  }

  const sameCol = (list, c) => list.filter(([cc]) => cc === c).map(([, r]) => r);

  return {
    el,
    idle() {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) fillCell(cells[c][r], cfg, randomRegular(cfg));
    },
    clear: clearMarks,

    async play(outcome, { speed, free, cb }) {
      const T = (ms) => sleep(ms / speed);
      clearMarks();
      await dropOut(speed);

      const needScatters = free ? cfg.free.retriggerCount : cfg.free.trigger;
      for (let i = 0; i < outcome.steps.length; i++) {
        const st = outcome.steps[i];
        clearMarks();

        // какие клетки «упали» с прошлого шага
        let mask = null;
        if (i > 0) {
          const removed = outcome.steps[i - 1].removed;
          mask = Array.from({ length: cols }, (_, c) => {
            const lowest = Math.max(-1, ...sameCol(removed, c));
            return Array.from({ length: rows }, (_, r) => r <= lowest);
          });
        }
        paint(st.grid, mask, speed);
        await T(i === 0 ? 700 : 520);

        // множители
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const id = st.grid[c][r];
            if (id.startsWith('B:')) {
              cells[c][r].classList.add('pulse');
              cb.bomb(Number(id.slice(2)));
            }
          }
        }
        if (st.bombValue > 0) await T(380);

        // скаттеры
        let scat = 0;
        for (const col of st.grid) for (const id of col) if (id === 'S') scat++;
        if (scat >= needScatters) {
          for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (st.grid[c][r] === 'S') cells[c][r].classList.add('hit');
          el.classList.add('has-hit');
        }

        if (st.wins.length === 0) break;

        for (const w of st.wins) for (const [c, r] of w.cells) cells[c][r].classList.add('hit');
        el.classList.add('has-hit');
        cb.stepWin(st.win);
        await T(620);

        // убираем символы
        const jobs = st.removed.map(([c, r]) => {
          const a = cells[c][r].animate(
            [
              { transform: 'scale(1)', opacity: 1 },
              { transform: 'scale(1.15)', opacity: 1, offset: 0.25 },
              { transform: 'scale(0)', opacity: 0 },
            ],
            { duration: 320 / speed, easing: 'ease-in', fill: 'forwards' },
          );
          return a.finished.then(() => a.cancel()).catch(() => {});
        });
        await Promise.all(jobs);
        for (const [c, r] of st.removed) cells[c][r].style.visibility = 'hidden';
        // клетки получат новое содержимое на следующем шаге
        await T(60);
        for (const [c, r] of st.removed) cells[c][r].style.visibility = '';
      }

      if (outcome.seqWin > 0 && outcome.mult > 1) {
        cb.applyMult({ seqWin: outcome.seqWin, mult: outcome.mult });
        await T(900);
      }
      if (outcome.scatterWin > 0) cb.toast(`Скаттеры: +${outcome.scatterWin}`);
      cb.win(outcome.win);
      await T(outcome.win > 0 ? 700 : 150);
    },
  };
}
