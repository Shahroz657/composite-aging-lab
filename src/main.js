import * as THREE from 'three';
import { MATERIALS, MAT, STAGES, FLEX, ILSS, REFERENCE, STUDY, meanFlex, meanIlss, retention, flexAt, ilssAt, astm, mean } from './data.js';
import { lineChart, columnChart, dotLine, niceTicks } from './charts.js';
import { Stage, buildStacks, buildHygroChamber, buildHydroTub, buildTestRig } from './lab3d.js';
import { uptake, profile, DAY } from './moisture.js';

const $ = id => document.getElementById(id);
const fmt = (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const dark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const color = m => (dark() ? m.colorDark : m.color);
const layupNotation = m => { const runs = []; for (const k of m.layup) { const last = runs[runs.length - 1]; if (last && last.k === k) last.n++; else runs.push({ k, n: 1 }); } return '[' + runs.map(r => r.k + (r.n > 1 ? '₀₁₂₃₄₅₆₇₈₉'[r.n] : '')).join('/') + ']'; };

// ---------- theme ----------
try { const t = localStorage.getItem('lab-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch {}
$('themeBtn').addEventListener('click', () => { const next = dark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem('lab-theme', next); } catch {} renderCharts(); });

// ---------- sections (tabs) ----------
const SECTIONS = ['overview', 'laminates', 'rigs', 'moisture', 'tests', 'results', 'checks'];
function showSection(id) {
  if (!SECTIONS.includes(id)) id = 'overview';
  document.querySelectorAll('main > .section').forEach(sec => sec.classList.toggle('active', sec.id === id || (id === 'checks' && sec.id === 'about')));
  document.querySelectorAll('#sectionNav a').forEach(a => a.classList.toggle('on', a.dataset.section === id));
  window.scrollTo(0, 0);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  window.dispatchEvent(new Event('resize'));
}
document.getElementById('sectionNav').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); showSection(a.dataset.section); });
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); showSection('overview'); });
window.addEventListener('hashchange', () => showSection(location.hash.slice(1)));

// ---------- 3D tooltip ----------
const tip = $('tip3d');
function hoverTip(meta, xy, stageEl) {
  if (!meta) { tip.classList.add('hidden'); return; }
  const r = stageEl.getBoundingClientRect();
  tip.innerHTML = `<b>${meta.name}</b>${meta.desc || ''}`; tip.classList.remove('hidden');
  const x = Math.min(r.left + xy.x + 14, innerWidth - 300), y = Math.min(r.top + xy.y + 14, innerHeight - 90);
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}

// ---------- hero: tiles + stacks ----------
$('tiles').innerHTML = [[MATERIALS.length, 'laminates'], [STUDY.plies, 'plies each'], [STAGES.length, 'aging stages · 0, 10, 20 d'], [STUDY.specimens, 'specimens broken']].map(([v, l]) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
const stackStage = new Stage($('stackStage'), { autoRotate: true, autoRotateSpeed: 0.5, onHover: (m, xy) => hoverTip(m, xy, $('stackStage')) });
const stacks = buildStacks(stackStage, MATERIALS);

// ---------- laminate cards ----------
const laminateStage = new Stage($('laminateStage'), { autoRotate: true, autoRotateSpeed: 0.4, onHover: (m, xy) => hoverTip(m, xy, $('laminateStage')) });
const stacks2 = buildStacks(laminateStage, MATERIALS);
const cards = $('laminateCards'); let exploded = null;
MATERIALS.forEach(m => {
  const c = document.createElement('button'); c.className = 'card'; c.dataset.id = m.id;
  c.innerHTML = `<div class="card-head"><span class="swatch" style="background:${m.color}"></span><b>${m.name}</b><span class="code">${m.code}</span></div>
    <div class="stack">${m.layup.slice().reverse().map(k => `<i class="${k}"></i>`).join('')}</div>
    <div class="kv"><span>Layup</span><span class="mono">${layupNotation(m)}</span><span>Basalt share</span><span class="mono">${Math.round(m.basalt * 100)}%</span><span>Flexural modulus</span><span class="mono">${fmt(meanFlex(m.id, 0, 'E'), 1)} GPa</span><span>Flexural strength</span><span class="mono">${fmt(meanFlex(m.id, 0, 'sigma'))} MPa</span><span>ILSS</span><span class="mono">${fmt(meanIlss(m.id, 0), 1)} MPa</span></div>
    <p>${m.blurb}</p>`;
  c.addEventListener('click', () => { exploded = exploded === m.id ? null : m.id; cards.querySelectorAll('.card').forEach(x => x.classList.toggle('on', x.dataset.id === exploded)); [stacks, stacks2].forEach(st => st.stacks.forEach(s => { s.target = s.mat.id === exploded ? 1.1 : (exploded ? 0.15 : 0.55); })); laminateStage.controls.autoRotate = false; });
  cards.appendChild(c);
});

// ---------- rigs ----------
const rigStage = new Stage($('rigStage'), { autoRotate: true, autoRotateSpeed: 0.4, onHover: (m, xy, obj) => { hoverTip(m, xy, $('rigStage')); $('rigParts').querySelectorAll('li').forEach(li => li.classList.toggle('hot', !!m && li.dataset.name === m.name)); } });
const RIGS = {
  hydro: { title: 'Hydro-thermal bath', desc: 'A tub of heated salt water for marine exposure. An Arduino reads a DS18B20 probe, switches a 1 kW immersion heater through a relay, shows the temperature on an LCD and logs it to an SD card with a real-time clock.', build: buildHydroTub, setpoint: 60 },
  hygro: { title: 'Hygro-thermal chamber', desc: 'An acrylic box with a heating bulb, an ultrasonic mist maker and two fans, controlled from a DHT11 sensor by an Arduino with an ESP8266 Wi-Fi module that posts readings to a phone app. Temperature and humidity are set on a keypad.', build: buildHygroChamber, setpoint: 55 },
};
let rig = null, rigId = null;
function showRig(id) {
  if (rig) { rigStage.scene.remove(rig.g); rig.g.traverse(o => { if (o.isCSS2DObject) o.element.remove(); if (o.isMesh) o.geometry.dispose(); }); rigStage.clearPicks(); rigStage.animations = []; }
  rigId = id; rig = RIGS[id].build(rigStage); rigStage.controls.autoRotate = true;
  $('rigTitle').textContent = RIGS[id].title; $('rigDesc').textContent = RIGS[id].desc;
  const seen = new Map(); rigStage.picks.forEach(o => { const m = o.userData.meta; if (!seen.has(m.name)) seen.set(m.name, m); });
  $('rigParts').innerHTML = [...seen.values()].map(m => `<li data-name="${m.name}"><b>${m.name}</b> · ${m.desc}</li>`).join('');
  ctl.T = 25; ctl.on = false; ctl.hist = []; ctl.set = RIGS[id].setpoint;
}
$('rigTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('rigTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); showRig(b.dataset.rig); rigStage.setTags($('labelsToggle').checked); });
$('labelsToggle').addEventListener('change', () => rigStage.setTags($('labelsToggle').checked));
// controller simulation: first-order thermal plant with relay hysteresis
const ctl = { T: 25, on: false, hist: [], set: 60, t: 0 };
setInterval(() => {
  const dt = 4; // simulated seconds per tick (real 0.1 s)
  if (ctl.T < ctl.set - 1) ctl.on = true; else if (ctl.T > ctl.set + 1) ctl.on = false;
  ctl.T += ((ctl.on ? 0.07 : 0) - 0.0016 * (ctl.T - 25)) * dt; ctl.t += dt;
  ctl.hist.push({ t: ctl.t, T: ctl.T, on: ctl.on }); if (ctl.hist.length > 240) ctl.hist.shift();
  $('ctlReadout').textContent = `${ctl.T.toFixed(1)} °C · set ${ctl.set} °C`; $('ctlLed').classList.toggle('on', ctl.on);
  if (rig && rig.heater) rig.heater.traverse(o => { if (o.material && o.material.emissive) o.material.emissiveIntensity = ctl.on ? 1.2 : 0.15; });
  drawCtl();
}, 100);
function drawCtl() {
  const svg = $('ctlChart'); const W = 320, H = 110, m = { l: 34, r: 8, t: 8, b: 18 }; const hist = ctl.hist; if (hist.length < 2) return;
  const t0 = hist[0].t, t1 = hist[hist.length - 1].t; const X = t => m.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - m.l - m.r); const Y = v => H - m.b - ((v - 20) / 50) * (H - m.t - m.b);
  svg.innerHTML = `<g class="grid">${[25, 40, 55, 70].map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${Y(v) + 3}" text-anchor="end" class="tick" style="font-size:9px;fill:var(--ink-3);font-family:var(--mono)">${v}</text>`).join('')}</g>
    <rect x="${m.l}" y="${Y(ctl.set + 1)}" width="${W - m.l - m.r}" height="${Y(ctl.set - 1) - Y(ctl.set + 1)}" fill="var(--accent-soft)"/>
    <path d="${hist.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.T).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
    ${hist.map((p, i) => p.on ? `<rect x="${X(p.t).toFixed(1)}" y="${H - m.b + 6}" width="${((W - m.l - m.r) / 240 + 0.5).toFixed(1)}" height="5" fill="#f08a24"/>` : '').join('')}
    <text x="${m.l}" y="${H - 1}" style="font-size:9px;fill:var(--ink-3)">heater on</text>`;
}
showRig('hydro');

// ---------- moisture ----------
const ms = { D: $('dSlider'), h: $('hSlider'), M: $('mSlider'), t: $('tSlider') };
function drawMoisture() {
  const D = Math.pow(10, +ms.D.value), h = +ms.h.value, Minf = +ms.M.value, tDay = +ms.t.value;
  $('dVal').textContent = `${D.toExponential(1)} mm²/s`; $('hVal').textContent = `${h.toFixed(1)} mm`; $('mVal').textContent = `${Minf.toFixed(1)} % by mass`; $('tVal').textContent = `day ${tDay}`;
  // uptake curve
  const c1 = $('uptakeChart'); c1.innerHTML = '';
  const fig = document.createElement('figure'); fig.className = 'chart'; fig.innerHTML = `<div class="chart-head"><div class="chart-title">Moisture uptake (model)</div><div class="chart-unit">% of dry mass</div></div>`; c1.appendChild(fig);
  const W = 320, H = 220, m = { l: 40, r: 16, t: 12, b: 36 }; const X = d => m.l + (d / 120) * (W - m.l - m.r); const Y = v => H - m.b - (v / (Minf * 1.1)) * (H - m.t - m.b);
  const pts = []; for (let d = 0; d <= 120; d += 2) pts.push([d, Minf * uptake(D, h, d * DAY)]);
  const tk = niceTicks(0, Minf * 1.1, 4).ticks.filter(v => v <= Minf * 1.1);
  const mark = d => { const v = Minf * uptake(D, h, d * DAY); return `<circle cx="${X(d)}" cy="${Y(v)}" r="6" class="ring"/><circle cx="${X(d)}" cy="${Y(v)}" r="4" fill="var(--accent)"/><text x="${X(d) + 10}" y="${Y(v) + 14}" text-anchor="start" class="value-label">${v.toFixed(2)}% at ${d} d</text>`; };
  fig.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Moisture uptake versus time"><g class="grid">${tk.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" class="tick" text-anchor="end">${v}</text>`).join('')}${[0, 30, 60, 90, 120].map(d => `<text x="${X(d)}" y="${H - m.b + 16}" class="tick" text-anchor="middle">${d}</text>`).join('')}<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" class="axis-label" text-anchor="middle">Days immersed</text><line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" class="baseline"/></g>
    <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>${mark(10)}${mark(20)}</svg>`);
  // profile through the thickness
  const c2 = $('profileChart'); c2.innerHTML = '';
  const fig2 = document.createElement('figure'); fig2.className = 'chart'; fig2.innerHTML = `<div class="chart-head"><div class="chart-title">Water through the thickness at day ${tDay} (model)</div><div class="chart-unit">% of dry mass, local</div></div>`; c2.appendChild(fig2);
  const N = 40; const prof = []; for (let i = 0; i <= N; i++) { const z = -h / 2 + (i / N) * h; prof.push([z, Minf * profile(D, h, tDay * DAY, z)]); }
  const Xz = z => m.l + ((z + h / 2) / h) * (W - m.l - m.r);
  const area = `M${Xz(-h / 2)},${Y(0)} ` + prof.map(p => `L${Xz(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ') + ` L${Xz(h / 2)},${Y(0)} Z`;
  fig2.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Moisture profile through the thickness"><g class="grid">${tk.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" class="tick" text-anchor="end">${v}</text>`).join('')}<text x="${Xz(-h / 2)}" y="${H - m.b + 16}" class="tick" text-anchor="start">face</text><text x="${Xz(0)}" y="${H - m.b + 16}" class="tick" text-anchor="middle">mid-plane</text><text x="${Xz(h / 2)}" y="${H - m.b + 16}" class="tick" text-anchor="end">face</text><text x="${(m.l + W - m.r) / 2}" y="${H - 6}" class="axis-label" text-anchor="middle">Position through the ${h.toFixed(1)} mm laminate</text><line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" class="baseline"/></g>
    <path d="${area}" fill="var(--accent)" fill-opacity="0.12"/><path d="${prof.map((p, i) => `${i ? 'L' : 'M'}${Xz(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    <text x="${Xz(0)}" y="${Y(prof[N / 2][1]) - 8}" text-anchor="middle" class="value-label">core ${prof[N / 2][1].toFixed(2)}%</text></svg>`);
}
Object.values(ms).forEach(s => s.addEventListener('input', drawMoisture)); drawMoisture();

// ---------- tests ----------
const ts = { test: 'flex', mat: 'CFRP', stage: 0, n: 1, load: 0 };
$('matTabs').innerHTML = MATERIALS.map(m => `<button data-mat="${m.id}" class="${m.id === ts.mat ? 'on' : ''}">${m.name}</button>`).join('');
$('stageTabs').innerHTML = STAGES.map(s => `<button data-stage="${s.id}" class="${s.id === ts.stage ? 'on' : ''}">${s.short}</button>`).join('');
const testStage = new Stage($('testStage'), { onHover: (m, xy) => hoverTip(m, xy, $('testStage')) });
let rigT = null, row = null;
function specimenRow() { return ts.test === 'flex' ? flexAt(ts.mat, ts.stage).find(r => r.n === ts.n) : ilssAt(ts.mat, ts.stage).find(r => r.n === ts.n); }
function buildTest() {
  if (rigT) rigT.dispose();
  row = specimenRow(); const E = meanFlex(ts.mat, ts.stage, 'E') * 1000; const span = ts.test === 'flex' ? row.span : 4 * row.h;
  rigT = buildTestRig(testStage, { test: ts.test, L: row.L, b: row.b, h: row.h, span, layup: MAT[ts.mat].layup, E, P: row.P });
  ts.load = 0; $('loadSlider').value = 0; rigT.setLoad(0); updateTestReadout(E, span);
}
function updateTestReadout(E, span) {
  const p = ts.load; const P = p * row.P; const m = MAT[ts.mat]; const flex = ts.test === 'flex';
  $('loadReadout').textContent = `${fmt(P)} N`;
  $('specTitle').textContent = `${m.name} · ${STAGES[ts.stage].label} · specimen ${ts.n}`;
  const I = row.b * row.h ** 3 / 12; const delta = rigT.deltaMax * p;
  const rows = flex
    ? [['size', `${row.L.toFixed(2)} × ${row.b.toFixed(2)} × ${row.h.toFixed(2)} mm`], ['span', `${span} mm`], ['failure load', `${fmt(row.P)} N`], ['strength', `${fmt(row.sigma, 1)} MPa reported`], ['modulus', `${fmt(row.E, 2)} GPa`], ['I', `${fmt(I, 2)} mm⁴`], ['deflection', `${delta.toFixed(2)} mm at this load (calc.)`]]
    : [['size', `${row.L.toFixed(2)} × ${row.b.toFixed(2)} × ${row.h.toFixed(2)} mm`], ['span', `${span.toFixed(1)} mm (4 h)`], ['failure load', `${fmt(row.P)} N`], ['ILSS', `${fmt(row.tau, 2)} MPa reported`], ['modulus used', `${fmt(E / 1000, 1)} GPa (flexure mean)`]];
  $('specBlock').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const sigmaNow = flex ? row.sigma * p : 0; const tauNow = flex ? (0.75 * P / (row.b * row.h)) * 2 : row.tau * p;
  $('formula').innerHTML = flex
    ? `σ = 3PL / (b h²) as reported → ${fmt(row.sigma, 1)} MPa at failure<br>ASTM D7264 σ = 3PL / (2 b h²) → ${fmt(astm.flexStrength(row), 1)} MPa (see Checks)<br>δ = P L³ / (48 E I), shown ×3`
    : `τ = 1.5 P / (b h) as reported → ${fmt(row.tau, 2)} MPa at failure<br>ASTM D2344 τ = 0.75 P / (b h) → ${fmt(astm.ilss(row), 2)} MPa (see Checks)`;
  drawStress(flex, sigmaNow, tauNow, p);
}
function drawStress(flex, sigma, tau, p) {
  const svg = $('stressChart'); const W = 320, H = 150; const x0 = 40, x1 = 150, x2 = 190, x3 = 300; const yT = 24, yB = 128, yM = (yT + yB) / 2;
  const s = Math.max(0.02, p); const xc = x0 + 55;
  const bend = flex ? `<path d="M${xc},${yT} L${xc - 50 * s},${yT} L${xc},${yM} L${xc + 50 * s},${yB} L${xc},${yB} Z" fill="#2a78d6" fill-opacity="0.18" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round"/><text x="${xc - 50 * s - 4}" y="${yT + 4}" text-anchor="end" style="font-size:9px;fill:var(--ink-3)">−</text><text x="${xc + 50 * s + 4}" y="${yB + 3}" style="font-size:9px;fill:var(--ink-3)">+</text>` : `<line x1="${xc}" y1="${yT}" x2="${xc}" y2="${yB}" stroke="var(--grid)"/>`;
  const shear = `<path d="M${x2 + 55},${yT} ${Array.from({ length: 21 }, (_, i) => { const u = i / 20; const y = yT + u * (yB - yT); const v = 4 * u * (1 - u); return `L${x2 + 55 + 50 * s * v},${y}`; }).join(' ')} Z" fill="#eb6834" fill-opacity="0.18" stroke="#eb6834" stroke-width="2" stroke-linejoin="round"/>`;
  svg.innerHTML = `<line x1="${x0 + 55}" y1="${yT}" x2="${x0 + 55}" y2="${yB}" stroke="var(--baseline)"/><line x1="${x2 + 55}" y1="${yT}" x2="${x2 + 55}" y2="${yB}" stroke="var(--baseline)"/>
    ${bend}${shear}
    <text x="${x0 + 55}" y="14" text-anchor="middle" style="font-size:11px;fill:var(--ink-2)">bending stress σ</text><text x="${x2 + 55}" y="14" text-anchor="middle" style="font-size:11px;fill:var(--ink-2)">interlaminar shear τ</text>
    <text x="${x0 + 55}" y="${yB + 14}" text-anchor="middle" style="font-size:10px;fill:var(--ink-3)">${flex ? `±${fmt(sigma)} MPa at the faces` : 'negligible at 4 h span'}</text>
    <text x="${x2 + 55}" y="${yB + 14}" text-anchor="middle" style="font-size:10px;fill:var(--ink-3)">${fmt(tau, 1)} MPa at the mid-plane</text>
    <text x="4" y="${yT + 4}" style="font-size:9px;fill:var(--ink-3)">top</text><text x="4" y="${yB + 3}" style="font-size:9px;fill:var(--ink-3)">bottom</text>`;
}
$('testTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('testTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); ts.test = b.dataset.test; buildTest(); });
$('matTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('matTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); ts.mat = b.dataset.mat; buildTest(); });
$('stageTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('stageTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); ts.stage = +b.dataset.stage; buildTest(); });
$('specTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('specTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); ts.n = +b.dataset.n; buildTest(); });
$('loadSlider').addEventListener('input', () => { ts.load = +$('loadSlider').value; rigT.setLoad(ts.load); updateTestReadout(meanFlex(ts.mat, ts.stage, 'E') * 1000, ts.test === 'flex' ? row.span : 4 * row.h); });
let runAnim = null;
$('runTest').addEventListener('click', () => { cancelAnimationFrame(runAnim); const t0 = performance.now(); const step = () => { const u = Math.min(1.02, (performance.now() - t0) / 2500 * 1.02); $('loadSlider').value = u; $('loadSlider').dispatchEvent(new Event('input')); if (u < 1.02) runAnim = requestAnimationFrame(step); }; step(); });
buildTest();

// ---------- results ----------
function seriesFor(key) {
  return MATERIALS.map(m => ({ id: m.id, name: m.name, short: m.id, color: color(m), mean: STAGES.map(s => key === 'tau' ? meanIlss(m.id, s.id) : meanFlex(m.id, s.id, key)), points: (key === 'tau' ? ILSS : FLEX).filter(r => r.mat === m.id).map(r => [STAGES[r.stage].days, key === 'tau' ? r.tau : r[key]]) }));
}
function renderCharts() {
  lineChart($('strengthChart'), { title: 'Flexural strength', unit: 'MPa, as reported', x: [0, 10, 20], series: seriesFor('sigma'), yMin: 0 });
  lineChart($('modulusChart'), { title: 'Flexural modulus', unit: 'GPa', x: [0, 10, 20], series: seriesFor('E'), yMin: 0, decimals: 1 });
  lineChart($('ilssChart'), { title: 'Interlaminar shear strength', unit: 'MPa, as reported', x: [0, 10, 20], series: seriesFor('tau'), yMin: 0, decimals: 1 });
  const ret = key => MATERIALS.map(m => ({ name: m.name, short: m.id, color: color(m), value: retention(m.id, key) * 100 }));
  columnChart($('retStrength'), { title: 'Flexural strength retained', unit: '% of un-aged', items: ret('sigma'), baseline: 100, baselineLabel: 'no change', suffix: '%', yMax: 130 });
  columnChart($('retModulus'), { title: 'Flexural modulus retained', unit: '% of un-aged', items: ret('E'), baseline: 100, baselineLabel: 'no change', suffix: '%', yMax: 130 });
  columnChart($('retIlss'), { title: 'ILSS retained', unit: '% of un-aged', items: ret('tau'), baseline: 100, baselineLabel: 'no change', suffix: '%', yMax: 130 });
  const pct = x => `${Math.round(x * 100)}%`;
  dotLine($('hybridModulus'), { title: 'Un-aged flexural modulus vs basalt share', unit: 'GPa', xLabel: 'Basalt plies as a share of eight', xFormat: pct, decimals: 1, points: MATERIALS.map(m => ({ x: m.basalt, y: meanFlex(m.id, 0, 'E'), color: color(m) })) });
  dotLine($('hybridStrength'), { title: 'Un-aged flexural strength vs basalt share', unit: 'MPa, as reported', xLabel: 'Basalt plies as a share of eight', xFormat: pct, points: MATERIALS.map(m => ({ x: m.basalt, y: meanFlex(m.id, 0, 'sigma'), color: color(m) })) });
  dotLine($('referenceChart'), { title: 'Reference: tensile modulus, Subagia et al.', unit: 'GPa, carbon → basalt', xLabel: 'CFRP, hybrids B1–B5, BFRP (report ref. 13)', xTicks: [0, 3, 6], xFormat: i => ['CFRP', '', '', 'B3', '', '', 'BFRP'][i], points: REFERENCE.rows.map((r, i) => ({ x: i, y: r.modulus, color: dark() ? '#aab3ba' : '#6f7a83' })) });
}
renderCharts();
// findings, with the numbers computed from the data
const ch = (m, key, a, b) => { const v0 = key === 'tau' ? meanIlss(m, a) : meanFlex(m, a, key), v1 = key === 'tau' ? meanIlss(m, b) : meanFlex(m, b, key); return (v1 / v0 - 1) * 100; };
const sg = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}%`;
$('findings').innerHTML = [
  ['CFRP', 'Carbon got stiffer, not weaker', `Flexural modulus rose ${sg(ch('CFRP', 'E', 0, 2))} over twenty days (${fmt(meanFlex('CFRP', 0, 'E'), 1)} → ${fmt(meanFlex('CFRP', 2, 'E'), 1)} GPa) and strength peaked at ten days (${sg(ch('CFRP', 'sigma', 0, 1))}) before returning to its starting level. A warm bath keeps curing an epoxy that left the oven at 60 °C; the literature the team cites shows the same rise-then-fall for carbon/epoxy. Only the interface-sensitive ILSS fell (${sg(ch('CFRP', 'tau', 0, 2))}).`],
  ['BFRP', 'Basalt lost on every measure', `Strength ${sg(ch('BFRP', 'sigma', 0, 2))}, modulus ${sg(ch('BFRP', 'E', 0, 2))}, ILSS ${sg(ch('BFRP', 'tau', 0, 2))} after twenty days, and the fall was steady rather than a step. The basalt–epoxy interface is the moisture-sensitive one; water reaching it undoes the bond before it can plasticise the bulk resin.`],
  ['HCB161', 'One basalt skin costs little', `With a single basalt ply on each face, strength was unchanged within scatter (${sg(ch('HCB161', 'sigma', 0, 2))}), modulus rose ${sg(ch('HCB161', 'E', 0, 2))} like carbon's, and ILSS fell ${sg(ch('HCB161', 'tau', 0, 2))}. It keeps ${Math.round(meanFlex('HCB161', 0, 'E') / meanFlex('CFRP', 0, 'E') * 100)}% of carbon's stiffness while breaking the galvanic couple with metal fasteners.`],
  ['HCB242', 'Two skins behave like basalt', `Half basalt by ply count gave the largest strength loss (${sg(ch('HCB242', 'sigma', 0, 2))}) and a modulus fall of ${sg(ch('HCB242', 'E', 0, 2))}; ILSS was flat (${sg(ch('HCB242', 'tau', 0, 2))}) but with the widest specimen-to-specimen scatter in the study (24 and 35 MPa at ten days). The outer plies carry the bending stress, so degrading basalt on the outside costs more than its share.`],
].map(([id, title, text]) => `<div class="finding"><div class="fh"><span class="swatch" style="background:${color(MAT[id])}"></span>${title}</div><p>${text}</p></div>`).join('');
// checks
const sample = FLEX[0], sample2 = ILSS[0];
$('checksList').innerHTML = [
  ['Formulas', 'Reported strengths are twice the ASTM formula values', `Recomputing from the tabulated loads and dimensions reproduces the reported numbers only with σ = 3PL/(b·h²) and τ = 1.5P/(b·h). ASTM D7264 and D2344 use σ = 3PL/(2·b·h²) and τ = 0.75P/(b·h), which give exactly half. Either the loads and span in the table are not the ones used in the calculation, or a factor of two crept into the spreadsheet. Ratios and trends are unaffected; absolute values should be checked against the raw UTM files before being quoted.<table><tr><th>Specimen</th><th>P (N)</th><th>b × h (mm)</th><th class="num">Reported</th><th class="num">ASTM</th></tr><tr><td>CFRP flexure, un-aged, no. 1</td><td class="num">${sample.P}</td><td class="num">${sample.b} × ${sample.h}</td><td class="num">${fmt(sample.sigma, 1)} MPa</td><td class="num">${fmt(astm.flexStrength(sample), 1)} MPa</td></tr><tr><td>CFRP short-beam, un-aged, no. 1</td><td class="num">${sample2.P}</td><td class="num">${sample2.b} × ${sample2.h}</td><td class="num">${fmt(sample2.tau, 2)} MPa</td><td class="num">${fmt(astm.ilss(sample2), 2)} MPa</td></tr></table>`],
  ['Sample size', 'Two specimens per point', `Every mean on this page is the average of two coupons. Differences smaller than the spread between the two dots should not be read as effects; HCB242 ILSS at ten days (24 and 35 MPa) is the clearest example.`],
  ['Figures', 'The report’s plots round, and one point disagrees with its table', `The line charts in the report use rounded values. Most match the table means to within a few MPa, but HCB161 flexural strength at ten days is plotted at 590 MPa while the two specimens in the table average ${fmt(meanFlex('HCB161', 1, 'sigma'))} MPa, and BFRP modulus at zero days is plotted at 18 GPa against a table mean of ${fmt(meanFlex('BFRP', 0, 'E'), 1)} GPa. This page uses the tables. The ILSS plots also label their x-axis 0, 1, 2 days where the aging stages were 0, 10 and 20 days.`],
  ['Conditions', 'Bath temperature and salinity are not stated', `The text describes both rigs but the results section does not record the water temperature, salt concentration, or which rig produced the 10- and 20-day data. Those numbers belong in the results table before the study is compared with published aging work.`],
  ['Fabric', '“Uni-directional” in the table, woven in the photographs', `The materials table lists the fibre structure as uni-directional, but the lay-up photographs show twill and plain-weave fabrics, and the measured moduli (43 GPa for carbon at a 40 : 60 fibre : resin ratio) are typical of woven, not uni-directional, laminates. The 3D models on this page use woven plies.`],
  ['Specimens', 'Two lengths of flexure coupon', `HCB242 flexure coupons were cut 146 mm long against 111 mm for the others. With the same 88 mm span the overhang is larger but the stress state between the supports is unchanged, so the comparison holds.`],
].map(([tag, title, body]) => `<div class="check"><div class="tag">${tag}</div><div><h4>${title}</h4><p>${body}</p></div></div>`).join('');
// footer
$('footTitle').textContent = STUDY.title; $('footTeam').textContent = STUDY.team.join(', '); $('footSup').textContent = `${STUDY.supervisor} (with ${STUDY.coSupervisor})`; $('footInst').textContent = `${STUDY.institute}, ${STUDY.year}`;
showSection(location.hash.slice(1) || 'overview');
window.lab = { stackStage, laminateStage, rigStage, testStage, ts, showSection };
