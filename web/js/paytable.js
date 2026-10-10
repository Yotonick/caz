import { h, fmt, round2, modal, makeCell } from './ui.js';

export function openPaytable(cfg, bet) {
  const labels = cfg.type === 'lines' ? ['3 в ряд', '4 в ряд', '5 в ряд'] : ['8–9', '10–11', '12+'];
  const ids = Object.keys(cfg.symbols).sort((a, b) => cfg.symbols[b].pay[2] - cfg.symbols[a].pay[2]);

  const symRows = ids.map((id) =>
    h(
      'div',
      { class: 'pt-row' },
      h('div', { class: 'pt-tile' }, makeCell(cfg, id)),
      h(
        'ul',
        { class: 'pt-pays' },
        [2, 1, 0].map((i) => h('li', {}, h('span', {}, labels[i]), h('b', {}, fmt(round2(cfg.symbols[id].pay[i] * bet))))),
      ),
    ),
  );

  const special = [];
  if (cfg.type === 'lines') {
    special.push(['W', 'Заменяет все символы, кроме скаттера' + (cfg.expand ? ' и занимает всю колонку' : '')]);
    special.push(['S', `3, 4, 5 скаттеров: ${[3, 4, 5].map((n) => fmt(cfg.scatter.pay[n] * bet)).join(' / ')} и бонус`]);
  } else {
    special.push(['S', `4, 5, 6 скаттеров: ${[4, 5, 6].map((n) => fmt(cfg.scatter.pay[n] * bet)).join(' / ')} и бонус`]);
    special.push(['B:10', 'Множитель x2–x100 для выигрыша серии']);
  }
  const specialRows = special.map(([id, text]) => h('div', { class: 'pt-row' }, h('div', { class: 'pt-tile' }, makeCell(cfg, id)), h('p', { class: 'pt-note' }, text)));

  const body = h(
    'div',
    { class: 'pt' },
    h('p', { class: 'pt-lead' }, `Выплаты показаны для ставки ${fmt(bet)}. Максимальный выигрыш за спин: x${fmt(cfg.maxWin)} от ставки.`),
    h('div', { class: 'pt-grid' }, ...symRows),
    h('h4', {}, 'Особые символы'),
    h('div', { class: 'pt-grid' }, ...specialRows),
    h('h4', {}, 'Правила'),
    h('ul', { class: 'pt-rules' }, cfg.rules.map((r) => h('li', {}, r))),
    h('p', { class: 'pt-foot' }, `Теоретический возврат (RTP) около ${fmt(Math.round(cfg.rtp * 1000) / 10)}%, измерен симуляцией. Игра на виртуальные монеты, реальных денег здесь нет.`),
  );
  modal(body, { title: cfg.name });
}
