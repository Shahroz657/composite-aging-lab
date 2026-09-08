// Small SVG chart kit following the data-viz method: thin marks, hairline grid, legend for >= 2 series, hover layer, table view.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const h = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
export function niceTicks(min, max, n = 5) {
  const span = max - min || 1; const raw = span / n; const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * p).find(s => span / s <= n) || p * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const t = [];
  for (let v = lo; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6));
  return { ticks: t, lo, hi };
}
const fmt = (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Line chart of a measure vs aging time. spec: { title, unit, x: [0,10,20], xLabel, series: [{ id, name, color, mean: [..], points: [[x, y, label], ...] }], decimals, yMin }
 */
export function lineChart(container, spec) {
  container.innerHTML = '';
  const card = h('figure', 'chart', container);
  const head = h('div', 'chart-head', card); h('div', 'chart-title', head, spec.title); if (spec.unit) h('div', 'chart-unit', head, spec.unit);
  const W = 520, H = 300, m = { l: 48, r: 118, t: 14, b: 38 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': spec.title }, card);
  const allY = spec.series.flatMap(s => s.mean.concat(s.points.map(p => p[1])));
  const yMinRaw = spec.yMin ?? Math.min(...allY), yMaxRaw = Math.max(...allY);
  const pad = (yMaxRaw - yMinRaw) * 0.12 || 1;
  const { ticks, lo, hi } = niceTicks(spec.yMin ?? yMinRaw - pad, yMaxRaw + pad, 5);
  const xs = spec.x; const x0 = xs[0], x1 = xs[xs.length - 1];
  const X = v => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const grid = el('g', { class: 'grid' }, svg);
  ticks.forEach(t => { el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid); el('text', { x: m.l - 8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, grid).textContent = fmt(t); });
  xs.forEach(x => { el('text', { x: X(x), y: H - m.b + 18, class: 'tick', 'text-anchor': 'middle' }, grid).textContent = x; });
  el('text', { x: (m.l + W - m.r) / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, grid).textContent = spec.xLabel || 'Aging time (days)';
  el('line', { x1: m.l, x2: W - m.r, y1: Y(lo), y2: Y(lo), class: 'baseline' }, grid);
  const marks = el('g', { class: 'marks' }, svg);
  const dec = spec.decimals ?? 0;
  // specimen points (small, ringed), then mean lines and markers on top
  spec.series.forEach(s => {
    const g = el('g', { class: 'series', 'data-id': s.id }, marks);
    s.points.forEach(([px, py]) => { el('circle', { cx: X(px), cy: Y(py), r: 4.5, class: 'ring' }, g); el('circle', { cx: X(px), cy: Y(py), r: 3, fill: s.color, 'fill-opacity': 0.45 }, g); });
    el('path', { d: s.mean.map((v, i) => `${i ? 'L' : 'M'}${X(xs[i])},${Y(v)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    s.mean.forEach((v, i) => { el('circle', { cx: X(xs[i]), cy: Y(v), r: 6, class: 'ring' }, g); el('circle', { cx: X(xs[i]), cy: Y(v), r: 4, fill: s.color }, g); });
  });
  // end labels with collision nudge + leader lines
  const ends = spec.series.map(s => ({ s, y: Y(s.mean[s.mean.length - 1]), v: s.mean[s.mean.length - 1] })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  for (let i = ends.length - 2; i >= 0; i--) if (ends[i + 1].y - ends[i].y < 14) ends[i].y = ends[i + 1].y - 14;
  const labels = el('g', { class: 'end-labels' }, svg);
  ends.forEach(e => {
    const yLine = Y(e.v); const xEnd = X(x1);
    if (Math.abs(e.y - yLine) > 2) el('line', { x1: xEnd + 6, y1: yLine, x2: xEnd + 14, y2: e.y, class: 'leader' }, labels);
    el('text', { x: xEnd + 18, y: e.y + 4, class: 'end-label' }, labels).textContent = `${fmt(e.v, dec)} ${e.s.short || e.s.name}`;
  });
  // legend
  const legend = h('div', 'legend', card);
  spec.series.forEach(s => { const item = h('button', 'legend-item', legend); item.dataset.id = s.id; const sw = h('span', 'swatch', item); sw.style.background = s.color; h('span', '', item, s.name); item.addEventListener('mouseenter', () => focus(s.id)); item.addEventListener('mouseleave', () => focus(null)); });
  function focus(id) { marks.querySelectorAll('.series').forEach(g => g.classList.toggle('dim', !!id && g.dataset.id !== id)); }
  // hover layer: nearest x, tooltip listing every series
  const hover = el('g', { class: 'hover' }, svg); const cross = el('line', { y1: m.t, y2: H - m.b, class: 'crosshair', visibility: 'hidden' }, hover);
  const tip = h('div', 'tooltip', card); tip.hidden = true;
  const rect = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
  rect.addEventListener('mousemove', ev => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    let best = 0; xs.forEach((x, i) => { if (Math.abs(X(x) - p.x) < Math.abs(X(xs[best]) - p.x)) best = i; });
    cross.setAttribute('x1', X(xs[best])); cross.setAttribute('x2', X(xs[best])); cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="tip-title">${xs[best]} days</div>` + spec.series.map(s => { const pts = s.points.filter(q => q[0] === xs[best]).map(q => fmt(q[1], dec)); return `<div class="tip-row"><span class="swatch" style="background:${s.color}"></span><span>${s.name}</span><b>${fmt(s.mean[best], dec)}</b><small>${pts.join(' · ')}</small></div>`; }).join('');
    tip.hidden = false; const cr = card.getBoundingClientRect(); tip.style.left = `${Math.min(ev.clientX - cr.left + 14, cr.width - 230)}px`; tip.style.top = `${ev.clientY - cr.top + 10}px`;
  });
  rect.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  // table view
  const foot = h('div', 'chart-foot', card);
  const btn = h('button', 'linkbtn', foot, 'Show table');
  const table = h('table', 'chart-table', card); table.hidden = true;
  const thead = h('thead', '', table); const tr = h('tr', '', thead); h('th', '', tr, 'Laminate'); xs.forEach(x => h('th', '', tr, `${x} d mean`)); xs.forEach(x => h('th', '', tr, `${x} d specimens`));
  const tbody = h('tbody', '', table);
  spec.series.forEach(s => { const r = h('tr', '', tbody); h('td', '', r, s.name); s.mean.forEach(v => h('td', 'num', r, fmt(v, dec))); xs.forEach(x => h('td', 'num', r, s.points.filter(q => q[0] === x).map(q => fmt(q[1], dec)).join(' / '))); });
  btn.addEventListener('click', () => { table.hidden = !table.hidden; btn.textContent = table.hidden ? 'Show table' : 'Hide table'; });
  return card;
}

/** Column chart, one series per item (colour follows the entity). spec: { title, unit, items: [{ name, color, value }], baseline (value drawn as reference), decimals, yMax } */
export function columnChart(container, spec) {
  container.innerHTML = '';
  const card = h('figure', 'chart', container);
  const head = h('div', 'chart-head', card); h('div', 'chart-title', head, spec.title); if (spec.unit) h('div', 'chart-unit', head, spec.unit);
  const W = 320, H = 240, m = { l: 44, r: 12, t: 16, b: 44 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': spec.title }, card);
  const vals = spec.items.map(i => i.value); const top = Math.max(spec.yMax ?? 0, ...vals, spec.baseline ?? 0);
  const { ticks, lo, hi } = niceTicks(0, top * 1.08, 4);
  const Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const grid = el('g', { class: 'grid' }, svg);
  ticks.forEach(t => { el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid); el('text', { x: m.l - 8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, grid).textContent = fmt(t); });
  el('line', { x1: m.l, x2: W - m.r, y1: Y(lo), y2: Y(lo), class: 'baseline' }, grid);
  if (spec.baseline !== undefined) { el('line', { x1: m.l, x2: W - m.r, y1: Y(spec.baseline), y2: Y(spec.baseline), class: 'reference' }, grid); el('text', { x: W - m.r, y: Y(spec.baseline) - 4, class: 'tick', 'text-anchor': 'end' }, grid).textContent = spec.baselineLabel || ''; }
  const band = (W - m.l - m.r) / spec.items.length; const bw = Math.min(24, band * 0.5);
  const dec = spec.decimals ?? 0;
  spec.items.forEach((it, i) => {
    const cx = m.l + band * (i + 0.5); const y = Y(it.value), y0 = Y(lo); const hgt = Math.max(0, y0 - y);
    const r = Math.min(4, hgt / 2);
    const d = `M${cx - bw / 2},${y0} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${cx + bw / 2 - r} a${r},${r} 0 0 1 ${r},${r} V${y0} Z`;
    const g = el('g', { class: 'col' }, svg);
    el('path', { d, fill: it.color }, g);
    el('text', { x: cx, y: y - 6, class: 'value-label', 'text-anchor': 'middle' }, g).textContent = fmt(it.value, dec) + (spec.suffix || '');
    el('text', { x: cx, y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, g).textContent = it.short || it.name;
    const hit = el('rect', { x: cx - band / 2, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent' }, g);
    hit.addEventListener('mouseenter', () => g.classList.add('hot')); hit.addEventListener('mouseleave', () => g.classList.remove('hot'));
  });
  return card;
}

/** Dots + line against a numeric x (single series, no legend). spec: { title, unit, xLabel, xTicks, points: [{x, y, label, color}] , decimals } */
export function dotLine(container, spec) {
  container.innerHTML = '';
  const card = h('figure', 'chart', container);
  const head = h('div', 'chart-head', card); h('div', 'chart-title', head, spec.title); if (spec.unit) h('div', 'chart-unit', head, spec.unit);
  const W = 320, H = 240, m = { l: 44, r: 16, t: 18, b: 44 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': spec.title }, card);
  const ys = spec.points.map(p => p.y); const { ticks, lo, hi } = niceTicks(0, Math.max(...ys) * 1.15, 4);
  const xs = spec.points.map(p => p.x); const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = v => m.l + ((v - x0) / (x1 - x0 || 1)) * (W - m.l - m.r); const Y = v => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
  const grid = el('g', { class: 'grid' }, svg);
  ticks.forEach(t => { el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid); el('text', { x: m.l - 8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' }, grid).textContent = fmt(t); });
  (spec.xTicks || xs).forEach(x => el('text', { x: X(x), y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, grid).textContent = spec.xFormat ? spec.xFormat(x) : x);
  el('text', { x: (m.l + W - m.r) / 2, y: H - 8, class: 'axis-label', 'text-anchor': 'middle' }, grid).textContent = spec.xLabel || '';
  el('line', { x1: m.l, x2: W - m.r, y1: Y(lo), y2: Y(lo), class: 'baseline' }, grid);
  const sorted = spec.points.slice().sort((a, b) => a.x - b.x);
  el('path', { d: sorted.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' '), fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, svg);
  const dec = spec.decimals ?? 0;
  sorted.forEach(p => { el('circle', { cx: X(p.x), cy: Y(p.y), r: 6.5, class: 'ring' }, svg); el('circle', { cx: X(p.x), cy: Y(p.y), r: 4.5, fill: p.color }, svg); el('text', { x: X(p.x), y: Y(p.y) - 11, class: 'value-label', 'text-anchor': 'middle' }, svg).textContent = `${fmt(p.y, dec)}`; });
  return card;
}
