// All measured values are transcribed from the FYP report tables (Report-Final Defense, NUST CEME 2024).
// Nothing here is modelled or smoothed; models live in moisture.js and are labelled as such in the page.

export const STAGES = [
  { id: 0, days: 0, label: 'Un-aged', short: '0 d' },
  { id: 1, days: 10, label: '10 days aged', short: '10 d' },
  { id: 2, days: 20, label: '20 days aged', short: '20 d' },
];

// Categorical slots follow the validated palette order (blue, orange, aqua, yellow); identity never changes with filtering.
export const MATERIALS = [
  { id: 'CFRP', code: 'PC', name: 'Carbon (CFRP)', layup: ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C'], basalt: 0, color: '#2a78d6', colorDark: '#3987e5',
    blurb: 'Eight carbon plies in epoxy. The stiffest and strongest of the four, and the reference the hybrids are measured against. Its weakness is not mechanical: carbon is electrically conductive and noble, so it drives galvanic corrosion of any aluminium or steel it touches.' },
  { id: 'HCB161', code: 'HCB161', name: 'Hybrid 1-6-1', layup: ['B', 'C', 'C', 'C', 'C', 'C', 'C', 'B'], basalt: 0.25, color: '#eb6834', colorDark: '#d95926',
    blurb: 'One basalt ply on each face over a six-ply carbon core. The basalt skins insulate the carbon from any metal in contact, so the galvanic couple is broken, at the cost of the outermost plies, which carry the highest bending stress.' },
  { id: 'HCB242', code: 'HCB242', name: 'Hybrid 2-4-2', layup: ['B', 'B', 'C', 'C', 'C', 'C', 'B', 'B'], basalt: 0.5, color: '#1baf7a', colorDark: '#199e70',
    blurb: 'Two basalt plies on each face over a four-ply carbon core. Half the fibre is basalt, so the laminate is cheaper and fully isolated, and about half as stiff in bending as pure carbon.' },
  { id: 'BFRP', code: 'PB', name: 'Basalt (BFRP)', layup: ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'], basalt: 1, color: '#eda100', colorDark: '#c98500',
    blurb: 'Eight basalt plies in epoxy. Basalt fibre is spun from molten volcanic rock: inert, non-conductive, cheaper than carbon, with about 40% of its stiffness. It is the corrosion-proof end of the hybrid spectrum.' },
];
export const MAT = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

// Three-point flexure, ASTM D7264 procedure A as run: span 88 mm, loading nose and supports r = 5 mm, 5 mm/min.
// Columns: material, stage, specimen no., length, width, height (mm), failure load (N), reported strength (MPa), reported modulus (GPa)
const F = [
  ['CFRP', 0, 1, 111.69, 16.86, 4.05, 591, 564.19, 42.59], ['CFRP', 0, 2, 110.59, 17.72, 3.88, 602, 595.76, 43.62],
  ['HCB161', 0, 1, 112.52, 17.61, 3.76, 506, 536.56, 32.76], ['HCB161', 0, 2, 112.64, 17.83, 3.73, 412, 438.46, 32.59],
  ['HCB242', 0, 1, 146.19, 17.66, 3.72, 485, 702.54, 23.95], ['HCB242', 0, 2, 145.54, 17.77, 3.78, 488, 680.38, 23.97],
  ['BFRP', 0, 1, 110.72, 17.77, 3.88, 550, 542.77, 18.06], ['BFRP', 0, 2, 110.85, 17.73, 3.84, 575, 580.63, 15.61],
  ['CFRP', 1, 1, 112.23, 17.84, 3.94, 732, 697.79, 50.12], ['CFRP', 1, 2, 112.28, 17.87, 3.95, 721, 682.69, 50.43],
  ['HCB161', 1, 1, 113.18, 17.99, 3.63, 475, 529.00, 35.64], ['HCB161', 1, 2, 113.32, 18.08, 3.75, 528, 548.25, 34.31],
  ['HCB242', 1, 1, 147.08, 17.97, 3.66, 380, 558.83, 22.38], ['HCB242', 1, 2, 147.01, 17.90, 3.89, 426, 556.75, 20.27],
  ['BFRP', 1, 1, 112.59, 18.04, 3.98, 533, 492.41, 15.43], ['BFRP', 1, 2, 111.45, 18.05, 3.78, 506, 517.96, 15.38],
  ['CFRP', 2, 1, 110.65, 17.92, 3.72, 555, 590.84, 53.00], ['CFRP', 2, 2, 112.76, 17.85, 3.92, 642, 617.91, 49.91],
  ['HCB161', 2, 1, 113.06, 17.98, 3.62, 431, 482.92, 34.16], ['HCB161', 2, 2, 114.15, 17.86, 3.48, 409, 499.21, 38.48],
  ['HCB242', 2, 1, 146.51, 17.88, 4.03, 395, 481.53, 18.95], ['HCB242', 2, 2, 146.61, 17.65, 4.10, 389, 464.18, 18.23],
  ['BFRP', 2, 1, 111.88, 17.98, 3.96, 479, 448.50, 15.56], ['BFRP', 2, 2, 110.28, 17.33, 3.82, 399, 416.54, 15.34],
];
export const FLEX = F.map(([m, s, n, L, b, h, P, sigma, E]) => ({ mat: m, stage: s, n, L, b, h, P, sigma, E, span: 88 }));

// Short-beam shear (ILSS), ASTM D2344: span 4 × thickness, loading nose r = 3 mm, supports r = 1.5 mm.
// Columns: material, stage, specimen no., length, width, height (mm), failure load (N), reported ILSS (MPa)
const S = [
  ['CFRP', 0, 1, 23.99, 17.65, 3.28, 1860, 48.19], ['CFRP', 0, 2, 23.19, 17.58, 3.58, 1785, 42.54],
  ['HCB161', 0, 1, 23.49, 17.81, 3.52, 1640, 39.24], ['HCB161', 0, 2, 23.96, 18.13, 3.46, 1680, 40.17],
  ['HCB242', 0, 1, 23.47, 17.79, 3.43, 1220, 29.99], ['HCB242', 0, 2, 23.66, 17.91, 3.52, 1350, 32.12],
  ['BFRP', 0, 1, 23.55, 17.81, 3.91, 1330, 28.65], ['BFRP', 0, 2, 23.75, 17.89, 4.06, 1280, 26.43],
  ['CFRP', 1, 1, 23.75, 17.84, 3.55, 1809, 42.85], ['CFRP', 1, 2, 23.75, 17.64, 3.60, 1848, 43.65],
  ['HCB161', 1, 1, 23.75, 17.74, 3.70, 1538, 35.15], ['HCB161', 1, 2, 23.75, 17.80, 3.40, 1495, 37.05],
  ['HCB242', 1, 1, 23.75, 17.26, 3.50, 974, 24.18], ['HCB242', 1, 2, 23.75, 17.96, 3.40, 1440, 35.37],
  ['BFRP', 1, 1, 23.75, 16.96, 3.92, 1220, 27.53], ['BFRP', 1, 2, 23.75, 17.74, 3.82, 1250, 27.67],
  ['CFRP', 2, 1, 23.75, 18.00, 3.52, 1799, 42.59], ['CFRP', 2, 2, 23.75, 17.80, 3.25, 1460, 37.86],
  ['HCB161', 2, 1, 23.75, 17.70, 3.50, 1413, 34.21], ['HCB161', 2, 2, 23.75, 17.92, 3.30, 1156, 29.32],
  ['HCB242', 2, 1, 23.75, 18.16, 3.60, 1476, 33.87], ['HCB242', 2, 2, 23.75, 17.34, 3.20, 1113, 30.09],
  ['BFRP', 2, 1, 23.75, 17.84, 4.12, 1148, 23.43], ['BFRP', 2, 2, 23.75, 17.96, 4.16, 1071, 21.50],
];
export const ILSS = S.map(([m, s, n, L, b, h, P, tau]) => ({ mat: m, stage: s, n, L, b, h, P, tau }));

// Benchmark used in the report for validation: I.D.G. Ary Subagia et al., carbon/basalt hybrids, tensile properties.
export const REFERENCE = {
  source: 'Subagia et al., tensile tests of carbon/basalt/epoxy hybrids (report ref. 13)',
  rows: [
    { code: 'CFRP', strength: 687, modulus: 65, strain: 1.062 }, { code: 'B1', strength: 630, modulus: 60, strain: 1.07 },
    { code: 'B2', strength: 602, modulus: 55, strain: 1.095 }, { code: 'B3', strength: 558, modulus: 50, strain: 1.1 },
    { code: 'B4', strength: 536, modulus: 45, strain: 1.14 }, { code: 'B5', strength: 502, modulus: 40, strain: 1.2 },
    { code: 'BFRP', strength: 402, modulus: 18, strain: 2.2 },
  ],
};

// ---------- derived ----------
export function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
export function flexAt(mat, stage) { return FLEX.filter(r => r.mat === mat && r.stage === stage); }
export function ilssAt(mat, stage) { return ILSS.filter(r => r.mat === mat && r.stage === stage); }
export function meanFlex(mat, stage, key) { return mean(flexAt(mat, stage).map(r => r[key])); }
export function meanIlss(mat, stage) { return mean(ilssAt(mat, stage).map(r => r.tau)); }
/** Retention after 20 days as a fraction of the un-aged mean. */
export function retention(mat, key) {
  if (key === 'tau') return meanIlss(mat, 2) / meanIlss(mat, 0);
  return meanFlex(mat, 2, key) / meanFlex(mat, 0, key);
}
/** ASTM formulas from the tabulated load and dimensions (see the checks section). */
export const astm = {
  flexStrength: r => (3 * r.P * r.span) / (2 * r.b * r.h * r.h),          // D7264, MPa
  reportedFlexStrength: r => (3 * r.P * r.span) / (r.b * r.h * r.h),      // what reproduces the table
  ilss: r => (0.75 * r.P) / (r.b * r.h),                                   // D2344, MPa
  reportedIlss: r => (1.5 * r.P) / (r.b * r.h),
};
export const STUDY = {
  title: 'Effects of environmental aging on the mechanical properties of synthetic–natural fibre reinforced hybrid composites',
  team: ['Romman Ahmed', 'Muhammad Shahroz', 'Qasim Mushtaq', 'Muhammad Usman Malik'],
  supervisor: 'Asst. Prof. Dr. Zubair Sajid', coSupervisor: 'Asst. Prof. Dr. Rehan Khan',
  institute: 'NUST College of Electrical & Mechanical Engineering, Rawalpindi', year: 2024, degree: 'DE-42 Mechanical Engineering',
  plies: 8, fibreRatio: '40 : 60 fibre to epoxy by weight', cure: '60 °C oven cure after vacuum bagging', specimens: FLEX.length + ILSS.length,
};
