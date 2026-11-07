/* ============================================================
   ECHOES OF THE FALLEN — shared helpers
   ============================================================ */
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = arr => arr[(Math.random() * arr.length) | 0];
export const chance = p => Math.random() < p;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);
export const smoothstep = t => t * t * (3 - 2 * t);

export function dirFromAngle(angle) {
  const a = ((angle % TAU) + TAU) % TAU;
  if (a > Math.PI * 0.25 && a < Math.PI * 0.75) return 'down';
  if (a > Math.PI * 0.75 && a < Math.PI * 1.25) return 'side';
  if (a > Math.PI * 1.25 && a < Math.PI * 1.75) return 'up';
  return 'side';
}
export function dirFromVec(x, y, fallback = 'down') {
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return fallback;
  if (Math.abs(x) > Math.abs(y)) return 'side';
  return y > 0 ? 'down' : 'up';
}
export function fmt(n) { return Math.max(0, Math.round(n)).toLocaleString(); }
export function roman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return s || 'I';
}
export function titleCase(s) { return String(s).replace(/(^|\s)\S/g, c => c.toUpperCase()); }

export function bytesToB64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
export function b64ToBytes(str, length) {
  try {
    const raw = atob(str || '');
    const out = new Uint8Array(length);
    for (let i = 0; i < Math.min(raw.length, length); i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch { return new Uint8Array(length); }
}

export function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) < r * r;
}

export function nowStamp() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
