// One-dimensional Fickian diffusion through a plate of thickness h with both faces at saturation. A model, not a measurement.
const SERIES = 40;
/** Fractional uptake M(t)/M∞ for diffusivity D (mm²/s), thickness h (mm), time t (s). */
export function uptake(D, h, t) {
  let s = 0; for (let n = 0; n < SERIES; n++) { const k = 2 * n + 1; s += Math.exp(-(k * k) * Math.PI * Math.PI * D * t / (h * h)) / (k * k); }
  return 1 - (8 / (Math.PI * Math.PI)) * s;
}
/** Local concentration C(z,t)/C∞ at depth z from the mid-plane (−h/2 … h/2). */
export function profile(D, h, t, z) {
  let s = 0; for (let n = 0; n < SERIES; n++) { const k = 2 * n + 1; s += (Math.pow(-1, n) / k) * Math.cos(k * Math.PI * z / h) * Math.exp(-(k * k) * Math.PI * Math.PI * D * t / (h * h)); }
  return Math.max(0, Math.min(1, 1 - (4 / Math.PI) * s));
}
export const DAY = 86400;
