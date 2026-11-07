/* ============================================================
   ECHOES OF THE FALLEN — procedural pixel art: terrain & props
   ============================================================ */

export function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return c;
}

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

export const R = (x, y, w, h, c) => { x.fillStyle = c; x.fillRect(Math.round(arguments[1]), Math.round(arguments[2]), Math.round(w), Math.round(h)); };

export function rect(x, px, py, w, h, col) {
  x.fillStyle = col;
  x.fillRect(Math.round(px), Math.round(py), Math.round(w), Math.round(h));
}
export function px(x, p, q, col) { x.fillStyle = col; x.fillRect(p | 0, q | 0, 1, 1); }

export function blob(x, cx, cy, rx, ry, col) {
  x.fillStyle = col;
  for (let j = -ry; j <= ry; j++) {
    const t = 1 - (j * j) / (ry * ry);
    if (t <= 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    x.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2 + 1, 1);
  }
}
export function ringBlob(x, cx, cy, rx, ry, col) {
  x.fillStyle = col;
  for (let j = -ry; j <= ry; j++) {
    const t = 1 - (j * j) / (ry * ry);
    if (t <= 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    x.fillRect(Math.round(cx - w), Math.round(cy + j), 1, 1);
    x.fillRect(Math.round(cx + w), Math.round(cy + j), 1, 1);
  }
}
export function trap(x, cx, top, bottom, topW, botW, h, col) {
  x.fillStyle = col;
  for (let j = 0; j < h; j++) {
    const w = Math.round(topW + (botW - topW) * (j / h));
    x.fillRect(Math.round(cx - w / 2), top + j, w, 1);
  }
}
export function line(x, x1, y1, x2, y2, col) {
  x.fillStyle = col;
  x1 |= 0; y1 |= 0; x2 |= 0; y2 |= 0;
  const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 400; i++) {
    x.fillRect(x1, y1, 1, 1);
    if (x1 === x2 && y1 === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x1 += sx; }
    if (e2 <= dx) { err += dx; y1 += sy; }
  }
}

export function hash2(x, y, s = 0) {
  let h = x * 374761393 + y * 668265263 + s * 1442695040;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export const PAL = {
  grass: ['#2c5137', '#26462f', '#315a3b', '#38633f', '#42714a'],
  grassLight: ['#4f814e', '#5e9459', '#72a864'],
  grassDark: ['#1c3726', '#22412c', '#193022'],
  dirt: ['#5b4a31', '#66523a', '#4d3e29', '#6f5a3e'],
  path: ['#7a6847', '#85714e', '#6b5a3d', '#8f7b57'],
  stone: ['#4c5352', '#565e5b', '#414846', '#606866'],
  stoneDark: ['#343b3a', '#2b3130', '#3c4442'],
  water: ['#17394c', '#1c4457', '#225365'],
  waterLight: ['#2f7283', '#3a8b96', '#5fb3b3'],
  snow: ['#c3d3dc', '#ccdae2', '#b7c9d4', '#dbe6ec'],
  ice: ['#8fc5d6', '#a8d6e2', '#7ab0c6'],
  cave: ['#262536', '#2c2a3d', '#333048', '#3b3752'],
  caveDark: ['#1a1927', '#14131f'],
  crystal: ['#63d7cc', '#84f0e0', '#3fb3b2', '#b8fff2'],
  moss: ['#3d5e39', '#4c7044', '#33512f'],
  wood: ['#4a3626', '#59422d', '#3b2b1e', '#6b5036'],
  autumn: ['#8a5a35', '#a7713f', '#6e4529'],
  gold: '#d8b774', goldLight: '#f2dca6', goldDark: '#8b6f3e',
  ink: '#0b0f12',
};

function noiseFill(x, r, w, h, colors, density = 0.5, size = 1) {
  const n = Math.floor(w * h * density * 0.45);
  for (let i = 0; i < n; i++) {
    const c = colors[Math.floor(r() * colors.length)];
    x.fillStyle = c;
    const s = r() < 0.2 ? size + 1 : size;
    x.fillRect(Math.floor(r() * w), Math.floor(r() * h), s, s);
  }
}

/* ---------------- terrain tiles ---------------- */
const tileCache = new Map();

function grassTile(seed, variant) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  const pal = [PAL.grass, PAL.grass, PAL.grassDark][variant % 3];
  rect(x, 0, 0, 16, 16, pal[0]);
  for (let i = 0; i < 26; i++) {
    rect(x, (r() * 16) | 0, (r() * 16) | 0, r() < 0.3 ? 2 : 1, 1, pal[1 + ((r() * 3) | 0) % 3]);
  }
  // grass blades
  for (let i = 0; i < 5; i++) {
    const gx = 2 + ((r() * 12) | 0), gy = 3 + ((r() * 11) | 0);
    const col = r() < 0.5 ? PAL.grassLight[1] : PAL.grassLight[2];
    px(x, gx, gy, col); px(x, gx, gy + 1, col);
    if (r() < 0.5) px(x, gx + 1, gy - 1, col);
    if (r() < 0.6) px(x, gx - 1, gy, PAL.grassDark[0]);
  }
  if (r() < 0.16) { // tiny flower
    const fx = 3 + ((r() * 10) | 0), fy = 3 + ((r() * 10) | 0);
    const cols = ['#e8d98a', '#e0a8b8', '#cfe4f0', '#e3b478'];
    const fc = cols[(r() * cols.length) | 0];
    px(x, fx, fy, fc); px(x, fx - 1, fy, fc); px(x, fx + 1, fy, fc); px(x, fx, fy - 1, fc);
    px(x, fx, fy, '#f7f0c8');
  }
  if (r() < 0.12) { // pebble
    px(x, 4 + ((r() * 9) | 0), 4 + ((r() * 9) | 0), PAL.stone[2]);
  }
  return c;
}

function dirtTile(seed, palette, rough) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, palette[0]);
  noiseFill(x, r, 16, 16, palette.slice(1), 0.7, 1);
  for (let i = 0; i < 10; i++) {
    const gx = (r() * 15) | 0, gy = (r() * 15) | 0;
    rect(x, gx, gy, 2, 1, r() < 0.5 ? palette[2] : palette[3]);
  }
  if (rough) {
    for (let i = 0; i < 3; i++) px(x, (r() * 16) | 0, (r() * 16) | 0, PAL.grassDark[1]);
  }
  return c;
}

function stoneTile(seed, pal) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, pal[0]);
  // block seams
  for (let row = 0; row < 4; row++) {
    const yy = row * 4;
    rect(x, 0, yy, 16, 1, pal[2]);
    const off = row % 2 ? 4 : 0;
    for (let bx = off; bx < 16; bx += 8) rect(x, bx, yy + 1, 1, 3, pal[2]);
    for (let bx = 0; bx < 16; bx += 2) {
      if (r() < 0.4) px(x, bx + (r() * 2 | 0), yy + 1 + (r() * 3 | 0), pal[1]);
    }
  }
  for (let i = 0; i < 7; i++) px(x, (r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? pal[3] : pal[2]);
  if (r() < 0.25) { // moss
    const mx = (r() * 12) | 0, my = (r() * 12) | 0;
    rect(x, mx, my, 3, 2, PAL.moss[1]);
    px(x, mx + 1, my + 2, PAL.moss[0]);
  }
  return c;
}

function brickTile(seed) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, PAL.stone[2]);
  for (let row = 0; row < 4; row++) {
    const yy = row * 4, off = row % 2 ? 4 : 0;
    for (let bx = -8 + off; bx < 16; bx += 8) {
      const w = 8 - 1;
      rect(x, bx + 1, yy + 1, w, 3, r() < 0.5 ? PAL.stone[0] : PAL.stone[1]);
      if (r() < 0.2) rect(x, bx + 1, yy + 1, w, 1, PAL.stone[2]);
    }
  }
  return c;
}

function waterTile(seed, deep) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  const p = deep ? PAL.water : ['#1c4557', '#235469', '#2c6478'];
  rect(x, 0, 0, 16, 16, p[0]);
  for (let i = 0; i < 6; i++) {
    const yy = 2 + ((r() * 13) | 0);
    rect(x, (r() * 12) | 0, yy, 3 + ((r() * 4) | 0), 1, p[1]);
  }
  for (let i = 0; i < 3; i++) px(x, (r() * 16) | 0, (r() * 16) | 0, p[2]);
  if (r() < 0.3) { // glint
    const gx = (r() * 13) | 0, gy = (r() * 14) | 0;
    px(x, gx, gy, PAL.waterLight[1]); px(x, gx + 1, gy, PAL.waterLight[2]); px(x, gx + 2, gy, PAL.waterLight[1]);
  }
  return c;
}

function snowTile(seed, variant) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, PAL.snow[variant % 3]);
  for (let i = 0; i < 22; i++) {
    rect(x, (r() * 16) | 0, (r() * 16) | 0, r() < 0.3 ? 2 : 1, 1, PAL.snow[1 + ((r() * 2) | 0)]);
  }
  for (let i = 0; i < 5; i++) px(x, (r() * 16) | 0, (r() * 16) | 0, '#eef6f9');
  if (r() < 0.15) { // exposed grass
    const gx = (r() * 12) | 0, gy = (r() * 12) | 0;
    px(x, gx, gy, '#6d7f68'); px(x, gx + 1, gy, '#7d8f72');
  }
  return c;
}

function iceTile(seed) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, PAL.ice[2]);
  for (let i = 0; i < 12; i++) rect(x, (r() * 16) | 0, (r() * 16) | 0, 1, 1 + (r() * 3 | 0), PAL.ice[r() < 0.5 ? 0 : 1]);
  // cracks
  line(x, 2 + r() * 4, 1, 6 + r() * 4, 14, '#5f93ab');
  line(x, 10, 3, 14, 8 + r() * 4, '#bfe7ef');
  return c;
}

function caveTile(seed, variant) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  const p = [PAL.cave, PAL.caveDark][variant % 2] || PAL.cave;
  rect(x, 0, 0, 16, 16, p[0]);
  noiseFill(x, r, 16, 16, [p[1], p[2], p[3]], 0.55, 1);
  for (let i = 0; i < 4; i++) {
    const sx = (r() * 13) | 0, sy = (r() * 13) | 0;
    rect(x, sx, sy, 2, 1, p[2]);
    px(x, sx, sy + 1, p[1]);
  }
  if (r() < 0.1) px(x, (r() * 16) | 0, (r() * 16) | 0, '#6d5f8f');
  return c;
}

function crystalFloorTile(seed) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, '#232a3a');
  noiseFill(x, r, 16, 16, ['#2b3546', '#1b2230', '#334155'], 0.6, 1);
  for (let i = 0; i < 3; i++) {
    const gx = (r() * 13) | 0, gy = (r() * 13) | 0;
    rect(x, gx, gy, 2, 1, '#3e5b62');
    px(x, gx, gy, '#74ded1');
  }
  return c;
}

function paveTile(seed) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, '#5a5548');
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const xx = col * 8 + (row % 2 ? 4 : 0), yy = row * 8;
    const tone = ['#66604f', '#5f5949', '#6c6654'][(r() * 3) | 0];
    rect(x, xx + (row % 2 ? -4 : 0), yy, 7, 7, tone);
    rect(x, xx + (row % 2 ? -4 : 0), yy + 6, 7, 1, '#4b463b');
  }
  if (r() < 0.3) px(x, (r() * 16) | 0, (r() * 16) | 0, '#7d775f');
  return c;
}

function woodTile(seed) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, PAL.wood[0]);
  for (let i = 0; i < 4; i++) rect(x, 0, 1 + i * 4, 16, 1, PAL.wood[2]);
  for (let i = 0; i < 5; i++) rect(x, (r() * 14) | 0, 1 + ((r() * 14) | 0), 3, 1, PAL.wood[1]);
  px(x, 3, 3, '#7a5b3c'); px(x, 11, 9, '#7a5b3c');
  return c;
}

function voidTile(seed) {
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(seed);
  rect(x, 0, 0, 16, 16, '#070a0c');
  for (let i = 0; i < 5; i++) px(x, (r() * 16) | 0, (r() * 16) | 0, '#101519');
  return c;
}

const TILE_MAKERS = {
  grass: (s, v) => grassTile(s, v),
  grass_dark: (s, v) => grassTile(s, v + 1),
  dirt: (s) => dirtTile(s, PAL.dirt, true),
  path: (s) => dirtTile(s, PAL.path, false),
  stone: (s) => stoneTile(s, PAL.stone),
  brick: (s) => brickTile(s),
  water: (s) => waterTile(s, false),
  deepwater: (s) => waterTile(s, true),
  snow: (s, v) => snowTile(s, v),
  ice: (s) => iceTile(s),
  cave: (s, v) => caveTile(s, v),
  crystalfloor: (s) => crystalFloorTile(s),
  pave: (s) => paveTile(s),
  wood: (s) => woodTile(s),
  void: (s) => voidTile(s),
  rock: (s) => stoneTile(s, PAL.stoneDark),
  snowrock: (s) => stoneTile(s, ['#7a8a92', '#8fa0a8', '#64747c', '#a8b8c0']),
  cavewall: (s, v) => caveTile(s, v + 1),
  moss: (s) => stoneTile(s, ['#3d4a38', '#4d5c44', '#2f3b2c', '#5e7050']),
  snowpath: (s) => dirtTile(s, ['#a8b8c2', '#b8c8d2', '#94a4b0', '#c8d8e0'], true),
};

export function getTile(kind, variant = 0) {
  const key = kind + ':' + variant;
  if (tileCache.has(key)) return tileCache.get(key);
  const maker = TILE_MAKERS[kind] || TILE_MAKERS.grass;
  const tiles = [];
  for (let i = 0; i < 4; i++) {
    tiles.push(maker(9173 + i * 7331 + variant * 311 + hash2(i, variant, 7) * 1000, i));
  }
  tileCache.set(key, tiles);
  return tiles;
}

/* edge fringe for path/grass transitions */
export function fringe(kind, side) {
  const key = 'fringe:' + kind + ':' + side;
  if (tileCache.has(key)) return tileCache.get(key);
  const c = cv(16, 16), x = c.getContext('2d'), r = rng(kind.length * 999 + side * 313);
  const cols = kind === 'grass' ? PAL.grassDark : PAL.grassLight;
  for (let i = 0; i < 16; i += 2) {
    const depth = 1 + ((r() * 3) | 0);
    for (let d = 0; d < depth; d++) {
      let xx = i, yy = 0;
      if (side === 'top') yy = d;
      if (side === 'bottom') yy = 15 - d;
      if (side === 'left') { xx = d; yy = i; }
      if (side === 'right') { xx = 15 - d; yy = i; }
      px(x, xx, yy, cols[d % cols.length]);
    }
  }
  tileCache.set(key, c);
  return c;
}

/* water shimmer overlay, 3 frames */
export function getWaterFrames() {
  if (tileCache.has('waterframes')) return tileCache.get('waterframes');
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = cv(64, 64), x = c.getContext('2d');
    const r = rng(4401 + f * 17);
    for (let i = 0; i < 22; i++) {
      const yy = 2 + ((r() * 60) | 0), xx = (r() * 60) | 0;
      const len = 2 + ((r() * 5) | 0);
      rect(x, xx, yy, len, 1, 'rgba(140,220,220,.22)');
      if (r() < 0.5) px(x, xx + 1, yy + 1, 'rgba(190,240,235,.25)');
    }
    frames.push(c);
  }
  tileCache.set('waterframes', frames);
  return frames;
}

/* ---------------- props ---------------- */
const propCache = new Map();
function cachedProp(key, build) {
  if (!propCache.has(key)) propCache.set(key, build());
  return propCache.get(key);
}

function shadow(x, cx, cy, rx, ry, alpha = 0.28) {
  x.fillStyle = `rgba(4,9,8,${alpha})`;
  for (let j = -ry; j <= ry; j++) {
    const t = 1 - (j * j) / (ry * ry);
    if (t <= 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    x.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2, 1);
  }
}

function treeSprite(seed, kind = 'forest', size = 1) {
  const r = rng(seed);
  const W = kind === 'ancient' ? 84 : kind === 'pine' ? 44 : 54;
  const H = kind === 'ancient' ? 112 : kind === 'pine' ? 74 : 68;
  const c = cv(W, H), x = c.getContext('2d');
  const bx = W / 2, by = H - 6;

  shadow(x, bx, by + 2, kind === 'pine' ? 13 : 17, 5, 0.32);

  if (kind === 'dead') {
    const trunk = ['#3a2d24', '#4a3a2c', '#2b211a'];
    rect(x, bx - 3, by - 26, 6, 26, trunk[0]);
    rect(x, bx - 3, by - 26, 2, 26, trunk[1]);
    for (let i = 0; i < 7; i++) {
      const yy = by - 10 - i * 4;
      const dir = i % 2 ? 1 : -1;
      line(x, bx + dir * 2, yy, bx + dir * (7 + (r() * 10 | 0)), yy - 4 - (r() * 5 | 0), trunk[i % 3]);
      if (r() < 0.6) line(x, bx + dir * (7 + (r() * 8 | 0)), yy - 4, bx + dir * (9 + (r() * 8 | 0)), yy - 10 - (r() * 4 | 0), trunk[2]);
    }
    px(x, bx - 2, by - 20, '#5a4634'); px(x, bx + 2, by - 15, '#31261e');
    return c;
  }
  if (kind === 'pine' || kind === 'snowpine') {
    // trunk
    rect(x, bx - 2, by - 22, 4, 22, '#3b2c22');
    rect(x, bx - 2, by - 22, 1, 22, '#54402d');
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const yy = by - 18 - i * 8;
      const w = 20 - i * 2.8 + (r() * 2 - 1);
      const col = ['#244937', '#2c583f', '#356847', '#1e3f30'][i % 4];
      for (let j = 0; j <= 9; j++) {
        const ww = Math.round(w * (1 - j / 13));
        if (ww <= 0) continue;
        x.fillStyle = col;
        x.fillRect(Math.round(bx - ww), yy - j, ww * 2, 1);
      }
      // snow
      if (kind === 'snowpine') {
        for (let j = 0; j < 6; j++) {
          x.fillStyle = j % 2 ? '#dbe8ee' : '#c2d6df';
          const ww = Math.round((w - j * 1.4) * 0.75);
          if (ww > 0) x.fillRect(Math.round(bx - ww + r() * 4), yy - 3 + j, ww, 1);
        }
      }
      x.fillStyle = 'rgba(10,25,18,.35)';
      for (let j = 0; j < 4; j++) x.fillRect(Math.round(bx + 1), yy - j, Math.round(w * 0.55), 1);
    }
    // tip
    px(x, bx, by - 68, '#3a6b49'); px(x, bx, by - 67, '#4c8157');
    return c;
  }

  const ancient = kind === 'ancient';
  const trunkCols = ancient ? ['#3a3020', '#4c3f2b', '#2a2318', '#5d4d33'] : ['#3f2f22', '#513d2b', '#32251b', '#5d4630'];
  // roots
  for (let i = -1; i <= 1; i += 2) {
    line(x, bx, by - 3, bx + i * 12, by + 1, trunkCols[0]);
    line(x, bx, by - 3, bx + i * 8, by + 2, trunkCols[2]);
  }
  const th = ancient ? 46 : 32;
  const tw = ancient ? 13 : 9;
  rect(x, bx - tw / 2, by - th, tw, th, trunkCols[0]);
  rect(x, bx - tw / 2, by - th, Math.max(2, tw / 2), th, trunkCols[1]);
  rect(x, bx + tw / 2 - 2, by - th, 2, th, trunkCols[2]);
  for (let i = 0; i < 6; i++) {
    const yy = by - th + 3 + ((r() * (th - 6)) | 0);
    const xx = bx - tw / 2 + ((r() * tw) | 0);
    rect(x, xx, yy, 1 + (r() * 2 | 0), 2, trunkCols[2]);
  }
  // roots flourish
  if (ancient) {
    line(x, bx - 6, by - 2, bx - 16, by + 1, trunkCols[0]);
    line(x, bx + 6, by - 2, bx + 18, by + 1, trunkCols[0]);
  }

  // canopy clusters
  const cy = by - th - (ancient ? 30 : 18);
  const clusters = ancient ? 7 : 5;
  const greens = ancient
    ? ['#1f4632', '#2a5c3f', '#356f4a', '#468456', '#5b9a62']
    : ['#24472f', '#2f5c3a', '#3c7044', '#4f874f', '#6aa05d'];
  const spread = ancient ? 25 : 16;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < clusters; i++) {
      const ang = (i / clusters) * Math.PI * 2 + 0.6;
      const rr = spread * (0.55 + (r() * 0.5));
      const cxx = bx + Math.cos(ang) * rr;
      const cyy = cy + Math.sin(ang) * rr * 0.55;
      const rad = (ancient ? 13 : 10) + r() * 5;
      if (pass === 0) blob(x, cxx, cyy + 3, rad + 2, rad * 0.9 + 2, '#13281c');
      else {
        blob(x, cxx, cyy, rad, rad * 0.9, greens[2 + ((r() * 2) | 0)]);
        blob(x, cxx - rad * 0.2, cyy - rad * 0.25, rad * 0.7, rad * 0.55, greens[3]);
        blob(x, cxx - rad * 0.35, cyy - rad * 0.4, rad * 0.35, rad * 0.3, greens[4]);
      }
    }
  }
  // top canopy mass
  blob(x, bx, cy - 2, ancient ? 30 : 21, ancient ? 20 : 14, greens[1]);
  blob(x, bx - 4, cy - 6, ancient ? 24 : 16, ancient ? 15 : 10, greens[2]);
  blob(x, bx - 8, cy - 9, ancient ? 15 : 10, ancient ? 10 : 7, greens[3]);
  // leaf speckles
  for (let i = 0; i < (ancient ? 90 : 55); i++) {
    const ang = r() * Math.PI * 2, rr = r() * spread * 1.3;
    const xx = bx + Math.cos(ang) * rr, yy = cy + Math.sin(ang) * rr * 0.75;
    px(x, xx, yy, greens[3 + ((r() * 2) | 0)]);
  }
  // hanging vines / moss
  for (let i = 0; i < (ancient ? 7 : 4); i++) {
    const vx = bx - spread + r() * spread * 2;
    const vy = cy + 6 + r() * 10;
    const len = 4 + r() * 14;
    for (let j = 0; j < len; j++) {
      px(x, vx + Math.sin(j * 0.5) * 1, vy + j, j % 3 === 0 ? '#5c8f5c' : '#3d6b45');
    }
  }
  if (ancient) {
    // glowing runes on trunk
    const runeY = by - th + 10;
    const glow = ['#5fa89a', '#84e0c8'];
    for (let i = 0; i < 3; i++) {
      const rx0 = bx - 3 + i * 3;
      px(x, rx0, runeY + i * 6, glow[0]);
      px(x, rx0 + 1, runeY + 1 + i * 6, glow[1]);
      px(x, rx0, runeY + 2 + i * 6, glow[0]);
    }
    blob(x, bx, cy - 2, 3, 3, '#9adfd0');
    px(x, bx - 1, cy - 3, '#eafff8');
  }
  return c;
}

function bushSprite(seed, snowy = false) {
  const r = rng(seed);
  const c = cv(30, 22), x = c.getContext('2d');
  shadow(x, 15, 19, 10, 3, 0.3);
  const greens = snowy ? ['#2f4f43', '#3d6152', '#527a63'] : ['#24472f', '#2f5c3a', '#417444'];
  blob(x, 15, 12, 11, 7, greens[0]);
  blob(x, 11, 10, 8, 6, greens[1]);
  blob(x, 18, 11, 7, 5, greens[1]);
  blob(x, 10, 8, 5, 3, greens[2]);
  for (let i = 0; i < 16; i++) {
    px(x, 4 + r() * 22, 4 + r() * 12, r() < 0.5 ? greens[2] : greens[1]);
  }
  if (snowy) {
    for (let i = 0; i < 10; i++) rect(x, 5 + r() * 20, 4 + r() * 6, 2, 1, '#dbe8ee');
  } else if (r() < 0.6) {
    for (let i = 0; i < 5; i++) {
      px(x, 6 + r() * 18, 5 + r() * 9, r() < 0.5 ? '#e3c06b' : '#d9e3a0');
    }
  }
  return c;
}

function rockSprite(seed, snowy = false, big = false) {
  const r = rng(seed);
  const W = big ? 40 : 26, H = big ? 30 : 20;
  const c = cv(W, H), x = c.getContext('2d');
  shadow(x, W / 2, H - 3, big ? 16 : 10, 4, 0.32);
  const base = snowy ? ['#59656b', '#6d7a80', '#4a555b', '#8a979c'] : ['#4d5452', '#5c6461', '#3d4341', '#737c77'];
  blob(x, W / 2, H - 8, big ? 15 : 9, big ? 10 : 6, base[2]);
  blob(x, W / 2, H - 10, big ? 14 : 8, big ? 10 : 6, base[0]);
  blob(x, W / 2 - 3, H - 13, big ? 9 : 6, big ? 6 : 4, base[1]);
  blob(x, W / 2 - 4, H - 14, big ? 5 : 3, big ? 3 : 2, base[3]);
  for (let i = 0; i < (big ? 5 : 3); i++) {
    line(x, W / 2 - 6 + r() * 10, H - 14 + r() * 6, W / 2 - 2 + r() * 10, H - 8 + r() * 4, base[2]);
  }
  if (snowy) {
    for (let i = 0; i < (big ? 16 : 9); i++) {
      rect(x, W / 2 - (big ? 12 : 7) + r() * (big ? 24 : 14), H - 18 + r() * 6, 2, 1, '#dbe8ee');
    }
  } else if (r() < 0.4) {
    px(x, W / 2 - 4, H - 12, PAL.moss[1]); px(x, W / 2 - 3, H - 11, PAL.moss[0]);
  }
  return c;
}

function crystalSprite(seed, big = false) {
  const r = rng(seed);
  const W = big ? 40 : 26, H = big ? 52 : 34;
  const c = cv(W, H), x = c.getContext('2d');
  shadow(x, W / 2, H - 3, big ? 14 : 9, 4, 0.3);
  const shards = big ? 4 : 3;
  for (let i = 0; i < shards; i++) {
    const bx = W / 2 + (i - shards / 2) * (big ? 6 : 4) + (r() * 3 - 1);
    const h = (big ? 26 : 16) + r() * (big ? 18 : 12);
    const w = 3 + (r() * 3 | 0);
    const lean = (r() * 4 - 2);
    for (let j = 0; j < h; j++) {
      const t = j / h;
      const ww = Math.round(w * (1 - t * 0.75));
      x.fillStyle = j < h * 0.3 ? '#9df6e8' : j < h * 0.7 ? '#5bd4c7' : '#379a9c';
      x.fillRect(Math.round(bx + lean * t - ww / 2), Math.round(H - 5 - j), Math.max(1, ww), 1);
    }
  }
  // glow
  blob(x, W / 2, H - 10, big ? 15 : 9, big ? 13 : 7, 'rgba(90,220,205,.10)');
  for (let i = 0; i < 5; i++) px(x, W / 2 - 8 + r() * 16, H - 16 + r() * 10, '#d6fff7');
  return c;
}

function mushroomSprite(seed, glow = false) {
  const r = rng(seed);
  const c = cv(22, 18), x = c.getContext('2d');
  shadow(x, 11, 16, 6, 2, 0.25);
  for (let i = 0; i < 3; i++) {
    const mx = 5 + i * 6 + r() * 2, my = 12 - i * 2;
    const h = 3 + (r() * 3 | 0);
    rect(x, mx, my, 2, h, '#c9c3a9');
    blob(x, mx + 1, my - 1, 3, 2, glow ? '#4f7fc9' : ['#a24e4e', '#c47d45', '#7d5a9c'][i % 3]);
    if (glow) px(x, mx, my - 2, '#9fd8ff');
    px(x, mx, my - 1, 'rgba(255,255,255,.55)');
  }
  return c;
}

function fernSprite(seed, snowy = false) {
  const r = rng(seed);
  const c = cv(24, 20), x = c.getContext('2d');
  const col = snowy ? ['#4d6a5a', '#6b8a74'] : ['#2f6a3c', '#4c8a4a', '#6aa05d'];
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + (i - 2) * 0.45;
    const len = 6 + r() * 6;
    for (let j = 1; j < len; j++) {
      const xx = 12 + Math.cos(ang) * j, yy = 18 + Math.sin(ang) * j;
      px(x, xx, yy, col[1]);
      if (j % 2 === 0 && j < len - 2) {
        px(x, xx + (i < 2 ? -2 : 2), yy + 1, col[0]);
      }
    }
  }
  return c;
}

function pillarSprite(seed, ruined = true) {
  const r = rng(seed);
  const c = cv(22, 48), x = c.getContext('2d');
  shadow(x, 11, 45, 7, 3, 0.3);
  const h = ruined ? 26 + (r() * 12 | 0) : 40;
  rect(x, 6, 46 - h, 10, h, PAL.stone[0]);
  rect(x, 6, 46 - h, 3, h, PAL.stone[3]);
  rect(x, 13, 46 - h, 3, h, PAL.stone[2]);
  rect(x, 4, 43, 14, 3, PAL.stone[1]);
  if (!ruined) {
    rect(x, 3, 46 - h - 4, 16, 4, PAL.stone[1]);
    rect(x, 4, 46 - h - 3, 14, 2, PAL.stone[3]);
    rect(x, 9, 46 - h - 1, 4, 2, PAL.stone[2]);
  } else {
    // broken top
    for (let i = 0; i < 4; i++) {
      const hh = 3 + r() * 5;
      rect(x, 6 + i * 3, 46 - h - hh + 2, 3, hh, PAL.stone[0]);
    }
    if (r() < 0.6) rect(x, 8, 46 - h + 4, 4, 6, PAL.moss[0]);
  }
  for (let i = 0; i < 4; i++) rect(x, 7 + r() * 8, 46 - h + 4 + r() * (h - 8), 2, 1, PAL.stone[2]);
  return c;
}

function ruinWallSprite(seed, len = 34) {
  const r = rng(seed);
  const c = cv(len, 26), x = c.getContext('2d');
  shadow(x, len / 2, 23, len * 0.45, 3, 0.28);
  const h = 8 + (r() * 12 | 0);
  for (let yy = 0; yy < h; yy++) {
    const off = yy % 4 < 2 ? 0 : 4;
    for (let xx = -off; xx < len; xx += 8) {
      if (r() < 0.06) continue;
      const col = ['#4c5352', '#565e5b', '#414846'][(r() * 3) | 0];
      rect(x, xx + 1, 22 - h + yy, 7, 1, col);
    }
  }
  // broken silhouette
  for (let xx = 0; xx < len; xx += 6) {
    const gap = 2 + r() * 10;
    if (r() < 0.5) rect(x, xx, 22 - h, 3, gap, 'rgba(0,0,0,0)');
  }
  if (r() < 0.7) {
    for (let i = 0; i < 6; i++) px(x, r() * len, 22 - r() * h, PAL.moss[1]);
  }
  return c;
}

function fenceSprite(seed) {
  const c = cv(34, 22), x = c.getContext('2d'), r = rng(seed);
  shadow(x, 17, 20, 15, 2, 0.2);
  for (let i = 0; i < 3; i++) {
    const xx = 3 + i * 12;
    rect(x, xx, 7, 3, 13, PAL.wood[1]);
    rect(x, xx, 7, 1, 13, PAL.wood[3]);
    px(x, xx + 1, 6, PAL.wood[1]);
  }
  rect(x, 2, 10, 30, 2, PAL.wood[0]);
  rect(x, 2, 16, 30, 2, PAL.wood[0]);
  rect(x, 2, 10, 30, 1, PAL.wood[3]);
  return c;
}

function lampSprite(seed, frozen = false) {
  const c = cv(14, 46), x = c.getContext('2d');
  shadow(x, 7, 44, 4, 2, 0.3);
  rect(x, 6, 10, 2, 33, '#3a3a3a');
  rect(x, 6, 10, 1, 33, '#585858');
  rect(x, 4, 42, 6, 2, '#2e2e2e');
  // lantern
  rect(x, 3, 4, 8, 9, '#2e2b26');
  rect(x, 4, 5, 6, 7, frozen ? '#7bc8e0' : '#f0c26a');
  rect(x, 4, 5, 6, 2, frozen ? '#b8e8f5' : '#fff0b8');
  px(x, 4, 8, '#ffffff');
  rect(x, 2, 2, 10, 2, '#3b352c');
  rect(x, 5, 1, 4, 1, '#3b352c');
  return c;
}

function brazierSprite(seed) {
  const c = cv(20, 30), x = c.getContext('2d');
  shadow(x, 10, 28, 6, 2, 0.3);
  rect(x, 5, 18, 10, 8, '#3b3a36');
  rect(x, 3, 16, 14, 3, '#55534a');
  rect(x, 3, 16, 14, 1, '#6e6b5c');
  rect(x, 6, 26, 2, 3, '#2c2b28');
  rect(x, 12, 26, 2, 3, '#2c2b28');
  return c;
}

function chestSprite(seed, open = false) {
  const c = cv(20, 18), x = c.getContext('2d'), r = rng(seed);
  shadow(x, 10, 16, 8, 3, 0.3);
  rect(x, 2, 7, 16, 9, '#5a3d26');
  rect(x, 2, 7, 16, 2, '#7c5734');
  if (!open) {
    rect(x, 2, 4, 16, 5, '#6f4c2e');
    rect(x, 2, 4, 16, 2, '#8a6239');
    rect(x, 9, 6, 2, 6, '#c9a45c');
    px(x, 9, 9, '#3a2a1a');
  } else {
    rect(x, 2, 1, 16, 4, '#4a3320');
    rect(x, 4, 8, 12, 4, '#c9a45c');
    rect(x, 6, 9, 8, 2, '#f2dca6');
  }
  rect(x, 2, 14, 16, 2, '#3b2718');
  return c;
}

function gravestoneSprite(seed, snowy = false) {
  const c = cv(18, 30), x = c.getContext('2d'), r = rng(seed);
  shadow(x, 9, 28, 6, 2, 0.3);
  rect(x, 5, 8, 8, 19, '#5d6560');
  rect(x, 4, 10, 10, 16, '#525a56');
  blob(x, 9, 10, 5, 3, '#5d6560');
  rect(x, 6, 10, 2, 15, '#6d756e');
  if (snowy) rect(x, 4, 8, 10, 3, '#dbe8ee');
  for (let i = 0; i < 3; i++) px(x, 7 + r() * 4, 14 + r() * 8, '#454c48');
  return c;
}

function statueSprite(seed) {
  const c = cv(26, 44), x = c.getContext('2d');
  shadow(x, 13, 41, 9, 3, 0.3);
  rect(x, 4, 37, 18, 5, '#4b504c');
  rect(x, 4, 37, 18, 1, '#646b64');
  rect(x, 9, 26, 8, 12, '#5a615c');
  rect(x, 9, 26, 2, 12, '#6f776f');
  blob(x, 13, 23, 5, 5, '#5a615c');
  rect(x, 10, 15, 6, 7, '#5a615c');
  // wings
  for (let i = 0; i < 8; i++) {
    px(x, 5 - i * 0.4, 30 - i, '#4a514d');
    px(x, 21 + i * 0.4, 30 - i, '#4a514d');
    px(x, 6 - i * 0.4, 31 - i, '#6a716b');
    px(x, 22 + i * 0.4, 31 - i, '#6a716b');
  }
  // head
  blob(x, 13, 9, 4, 4, '#5f6660');
  px(x, 11, 9, '#9aa49b'); px(x, 14, 9, '#9aa49b');
  // sword
  rect(x, 22, 18, 2, 15, '#757b72');
  rect(x, 20, 16, 6, 2, '#8a9088');
  return c;
}

function bannerSprite(seed) {
  const c = cv(16, 36), x = c.getContext('2d');
  rect(x, 7, 0, 2, 36, '#3b3630');
  px(x, 7, 0, '#6a6254');
  trap(x, 8, 2, 2, 12, 12, 24, '#6e2f39');
  trap(x, 8, 2, 2, 6, 6, 24, '#8a3f47');
  rect(x, 2, 26, 12, 2, '#8a3f47');
  // emblem
  px(x, 7, 10, '#d8b774'); px(x, 8, 9, '#d8b774'); px(x, 8, 10, '#d8b774'); px(x, 8, 11, '#d8b774'); px(x, 9, 10, '#d8b774');
  return c;
}

function bonesSprite(seed) {
  const c = cv(22, 12), x = c.getContext('2d'), r = rng(seed);
  line(x, 3, 8, 12, 4, '#cfc6ab');
  line(x, 5, 9, 14, 5, '#b3aa93');
  line(x, 12, 8, 18, 8, '#cfc6ab');
  px(x, 2, 7, '#e3dcc5'); px(x, 2, 9, '#e3dcc5'); px(x, 3, 8, '#e3dcc5');
  blob(x, 15, 6, 3, 2, '#cfc6ab');
  px(x, 14, 5, '#3a3a30'); px(x, 16, 5, '#3a3a34');
  return c;
}

function shrineSprite(seed) {
  const c = cv(58, 54), x = c.getContext('2d'), r = rng(seed);
  shadow(x, 29, 49, 20, 5, 0.33);
  // platform
  rect(x, 6, 43, 46, 6, '#4d5350');
  rect(x, 6, 43, 46, 2, '#6a716a');
  rect(x, 9, 39, 40, 5, '#454b48');
  // pillars
  rect(x, 12, 25, 5, 16, '#565d59');
  rect(x, 41, 25, 5, 16, '#565d59');
  rect(x, 13, 25, 2, 16, '#6d756e');
  // roof
  trap(x, 29, 8, 8, 42, 48, 8, '#3f4642');
  trap(x, 29, 6, 6, 34, 40, 3, '#4b524d');
  trap(x, 29, 9, 9, 26, 34, 3, '#57605a');
  // arch
  blob(x, 29, 32, 7, 7, '#2a302e');
  rect(x, 22, 32, 14, 9, '#2a302e');
  rect(x, 26, 27, 6, 5, '#3a423e');
  // vines
  for (let i = 0; i < 5; i++) {
    const vx = 10 + r() * 38;
    for (let j = 0; j < 5 + r() * 6; j++) px(x, vx + Math.sin(j * 0.6), 15 + j, '#4c7a45');
  }
  // rune light
  const rc = ['#7eeadc', '#a8fff1'];
  px(x, 28, 36, rc[0]); px(x, 29, 35, rc[0]); px(x, 30, 36, rc[0]); px(x, 29, 37, rc[1]);
  return c;
}

function monumentSprite(active = false) {
  const c = cv(76, 120), x = c.getContext('2d');
  shadow(x, 38, 114, 23, 6, 0.35);
  // base steps
  rect(x, 14, 108, 48, 7, '#3f4748');
  rect(x, 14, 108, 48, 2, '#5e6868');
  rect(x, 20, 103, 36, 6, '#485050');
  rect(x, 20, 103, 36, 2, '#667070');
  rect(x, 26, 98, 24, 6, '#50595a');
  // shaft
  trap(x, 38, 40, 32, 18, 28, 61, '#4a5355');
  trap(x, 38, 40, 32, 10, 16, 61, '#5b6668');
  rect(x, 30, 46, 3, 53, '#6b7779');
  rect(x, 47, 50, 3, 48, '#394243');
  // top
  trap(x, 38, 26, 34, 6, 20, 15, '#596365');
  trap(x, 38, 24, 28, 2, 8, 12, '#6c7778');
  // glowing core
  const glowA = active ? '#8ff5e4' : '#5c6f70';
  const glowB = active ? '#e6fffa' : '#8a9c9c';
  blob(x, 38, 66, 7, 13, active ? 'rgba(100,240,220,.16)' : 'rgba(0,0,0,.18)');
  blob(x, 38, 66, 4, 9, glowA);
  px(x, 36, 60, glowB); px(x, 37, 59, glowB);
  // rings
  const ringCol = active ? '#7fe6d8' : '#4d5a5b';
  for (let i = 0; i < 3; i++) {
    px(x, 32 + i * 4, 78 - i * 2, ringCol); px(x, 43 - i * 4, 78 - i * 2, ringCol);
  }
  // eroded edges
  for (let i = 0; i < 14; i++) {
    const yy = 46 + (i * 4) % 50;
    rect(x, 26 + (i % 3), yy, 2, 2, '#3c4546');
    rect(x, 48 - (i % 3), yy + 2, 2, 2, '#3c4546');
  }
  return c;
}

function statueGuardianSprite(seed) {
  const c = cv(34, 56), x = c.getContext('2d');
  shadow(x, 17, 53, 12, 4, 0.3);
  rect(x, 6, 47, 22, 6, '#464e4c');
  rect(x, 6, 47, 22, 2, '#606a66');
  rect(x, 12, 28, 10, 21, '#555e5a');
  rect(x, 12, 28, 3, 21, '#6b756f');
  // arms crossed
  rect(x, 8, 34, 18, 4, '#4c5551');
  blob(x, 17, 22, 7, 8, '#555e5a');
  rect(x, 12, 13, 10, 10, '#535c58');
  // helmet
  blob(x, 17, 11, 6, 5, '#5f6a64');
  rect(x, 11, 11, 12, 3, '#3f4844');
  px(x, 14, 11, '#8fd6c8'); px(x, 19, 11, '#8fd6c8');
  // horns
  line(x, 12, 8, 8, 2, '#767f78');
  line(x, 22, 8, 26, 2, '#767f78');
  // moss
  for (let i = 0; i < 8; i++) px(x, 8 + Math.random() * 18, 20 + Math.random() * 26, '#3d5e39');
  return c;
}

function signpostSprite(seed) {
  const c = cv(20, 28), x = c.getContext('2d');
  shadow(x, 10, 26, 5, 2, 0.25);
  rect(x, 9, 10, 2, 16, PAL.wood[0]);
  rect(x, 3, 6, 15, 8, PAL.wood[1]);
  rect(x, 3, 6, 15, 1, PAL.wood[3]);
  rect(x, 9, 6, 1, 8, PAL.wood[2]);
  px(x, 5, 9, '#d8c49a'); px(x, 7, 9, '#d8c49a'); px(x, 12, 9, '#d8c49a');
  return c;
}

function flowerPatchSprite(seed, glow = false) {
  const c = cv(22, 16), x = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 7; i++) {
    const fx = 3 + r() * 16, fy = 6 + r() * 8;
    px(x, fx, fy, '#3d6b45');
    const col = glow ? ['#8ff5e4', '#c8fff8', '#6fd9c8'] : ['#e3c06b', '#e0a8c0', '#dce8a8', '#c9d9f0'];
    const fc = col[(r() * col.length) | 0];
    px(x, fx, fy - 1, fc); px(x, fx - 1, fy, fc); px(x, fx + 1, fy, fc); px(x, fx, fy + 1, fc);
    px(x, fx, fy, glow ? '#ffffff' : '#f7f0c8');
  }
  return c;
}

function bonesSwordSprite(seed) {
  const c = cv(24, 20), x = c.getContext('2d'), r = rng(seed);
  shadow(x, 12, 17, 7, 2, 0.25);
  line(x, 4, 15, 18, 7, '#9aa39b');
  line(x, 4, 16, 18, 8, '#6d756f');
  rect(x, 15, 5, 4, 2, '#8a7a5a');
  line(x, 2, 16, 6, 13, '#6d756f');
  // shield
  blob(x, 7, 8, 4, 5, '#5a5244');
  blob(x, 7, 8, 3, 4, '#6e6450');
  return c;
}

function crystalClusterAnimated(seed) {
  return crystalSprite(seed, true);
}

function makeProps() {
  const P = {};
  for (let i = 0; i < 4; i++) P['tree' + i] = treeSprite(1000 + i * 71, 'forest');
  for (let i = 0; i < 3; i++) P['treeBig' + i] = treeSprite(2100 + i * 137, 'forest', 1);
  for (let i = 0; i < 3; i++) P['pine' + i] = treeSprite(3200 + i * 73, 'pine');
  for (let i = 0; i < 2; i++) P['snowpine' + i] = treeSprite(3300 + i * 91, 'snowpine');
  for (let i = 0; i < 3; i++) P['deadTree' + i] = treeSprite(4300 + i * 61, 'dead');
  for (let i = 0; i < 3; i++) P['ancientTree' + i] = treeSprite(5400 + i * 131, 'ancient');
  for (let i = 0; i < 3; i++) P['bush' + i] = bushSprite(6100 + i * 29);
  for (let i = 0; i < 2; i++) P['snowBush' + i] = bushSprite(6400 + i * 31, true);
  for (let i = 0; i < 3; i++) P['rock' + i] = rockSprite(7100 + i * 41);
  for (let i = 0; i < 2; i++) P['rockBig' + i] = rockSprite(7300 + i * 53, false, true);
  for (let i = 0; i < 2; i++) P['snowRock' + i] = rockSprite(7500 + i * 37, true);
  for (let i = 0; i < 2; i++) P['snowRockBig' + i] = rockSprite(7700 + i * 47, true, true);
  for (let i = 0; i < 2; i++) P['crystal' + i] = crystalSprite(8100 + i * 67);
  for (let i = 0; i < 2; i++) P['crystalBig' + i] = crystalSprite(8400 + i * 83, true);
  for (let i = 0; i < 3; i++) P['mushroom' + i] = mushroomSprite(9100 + i * 23);
  for (let i = 0; i < 2; i++) P['glowMushroom' + i] = mushroomSprite(9300 + i * 29, true);
  for (let i = 0; i < 3; i++) P['fern' + i] = fernSprite(10100 + i * 19);
  P['snowFern'] = fernSprite(10400, true);
  for (let i = 0; i < 2; i++) P['pillar' + i] = pillarSprite(11100 + i * 53);
  P['pillarWhole'] = pillarSprite(11300, false);
  for (let i = 0; i < 3; i++) P['wall' + i] = ruinWallSprite(12100 + i * 71, 30 + i * 8);
  P['fence'] = fenceSprite(13100);
  P['lamp'] = lampSprite(14100);
  P['lampFrost'] = lampSprite(14200, true);
  P['brazier'] = brazierSprite(15100);
  for (let i = 0; i < 3; i++) P['chest' + i] = chestSprite(16100 + i * 37);
  P['chestOpen'] = chestSprite(16400, true);
  for (let i = 0; i < 2; i++) P['grave' + i] = gravestoneSprite(17100 + i * 41);
  P['graveSnow'] = gravestoneSprite(17300, true);
  P['statue'] = statueSprite(18100);
  P['statueGuardian'] = statueGuardianSprite(18200);
  P['banner'] = bannerSprite(19100);
  P['bones'] = bonesSprite(20100);
  P['bonesSword'] = bonesSwordSprite(20200);
  P['shrine'] = shrineSprite(21100);
  P['monumentOff'] = monumentSprite(false);
  P['monumentOn'] = monumentSprite(true);
  P['signpost'] = signpostSprite(22100);
  for (let i = 0; i < 2; i++) P['flowers' + i] = flowerPatchSprite(23100 + i * 31);
  P['glowFlowers'] = flowerPatchSprite(23400, true);
  return P;
}

export const PROPS = makeProps();

/* ---------------- buildings ---------------- */
const buildingCache = new Map();

function roofRows(x, cx, top, h, topW, botW, cols) {
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const w = Math.round(topW + (botW - topW) * t);
    x.fillStyle = cols[0];
    x.fillRect(Math.round(cx - w / 2), top + j, w, 1);
    // shingle ridges
    if (j % 3 === 2) {
      x.fillStyle = cols[1];
      x.fillRect(Math.round(cx - w / 2), top + j, w, 1);
    }
    if (j % 3 === 0) {
      x.fillStyle = cols[2];
      for (let sx = Math.round(cx - w / 2) + (j % 6 < 3 ? 2 : 6); sx < cx + w / 2 - 1; sx += 7) {
        x.fillRect(sx, top + j, 1, 2);
      }
    }
  }
}

function buildingSprite(o) {
  const r = rng(o.seed || 1);
  const W = o.w, H = o.h;
  const c = cv(W, H), x = c.getContext('2d');
  const style = o.style;
  shadow(x, W / 2, H - 4, W * 0.42, 6, 0.32);

  const stoneCols = ['#4f5450', '#5b615c', '#424743'];
  const wallCols = style === 'ruin' ? ['#4a4f4a', '#565b54'] : style === 'frost' ? ['#7c8b91', '#94a3a8'] : ['#8a7a5f', '#9c8b6c'];
  const roofCols = style === 'ruin' ? ['#3a3f3a', '#2e332f', '#4a4f48']
    : style === 'frost' ? ['#5a7b8c', '#48697a', '#7394a2']
      : style === 'sanctuary' ? ['#5b4630', '#493828', '#6f583c']
        : style === 'library' ? ['#3f4a5a', '#323b49', '#4f5c6c']
          : ['#6b3f38', '#59332f', '#7d4b41'];
  const baseY = H - 5;
  const bodyH = Math.round(H * (style === 'tower' ? 0.62 : 0.44));
  const roofH = Math.round(H * (style === 'tower' ? 0.3 : 0.34));
  const wallW = W - 10;
  const wallTop = baseY - bodyH;

  // foundation
  rect(x, 3, baseY - 2, W - 6, 6, stoneCols[2]);
  rect(x, 3, baseY - 2, W - 6, 2, stoneCols[1]);

  // body
  if (style === 'tower') {
    const w = Math.round(W * 0.56);
    rect(x, (W - w) / 2, wallTop, w, bodyH, wallCols[0]);
    rect(x, (W - w) / 2, wallTop, 3, bodyH, wallCols[1]);
    rect(x, (W + w) / 2 - 3, wallTop, 3, bodyH, stoneCols[2]);
    for (let i = 0; i < 5; i++) {
      rect(x, (W - w) / 2 + 4, wallTop + 6 + i * 9, w - 8, 1, stoneCols[2]);
    }
    // conical roof
    trap(x, W / 2, wallTop - roofH, wallTop, 4, W * 0.62, roofH, roofCols[0]);
    for (let j = 0; j < roofH; j += 3) {
      const w = Math.round(4 + W * 0.31 * (j / roofH));
      rect(x, W / 2 - w, wallTop - roofH + j, w * 2, 1, roofCols[1]);
    }
    px(x, W / 2, wallTop - roofH - 3, '#8a7a5a');
    // pennant
    line(x, W / 2, wallTop - roofH - 3, W / 2, wallTop - roofH - 12, '#5a4a32');
    trap(x, W / 2 + 4, wallTop - roofH - 11, wallTop - roofH - 11, 1, 8, 5, '#7a3d44');
  } else {
    rect(x, 5, wallTop, wallW, bodyH, wallCols[0]);
    rect(x, 5, wallTop, 3, bodyH, wallCols[1]);
    rect(x, W - 8, wallTop, 3, bodyH, stoneCols[2]);
    // timber framing
    if (style === 'cottage' || style === 'tavern' || style === 'forge') {
      for (let i = 0; i <= 3; i++) {
        rect(x, 5 + (wallW / 3) * i, wallTop, 2, bodyH, '#4a3626');
      }
      rect(x, 5, wallTop, wallW, 2, '#4a3626');
      rect(x, 5, wallTop + bodyH - 2, wallW, 2, '#3a2c20');
      if (style !== 'forge') {
        // plaster patches
        for (let i = 0; i < 3; i++) {
          if (r() < 0.5) rect(x, 10 + (wallW / 3) * i, wallTop + 4, wallW / 3 - 8, bodyH - 9, '#a3906f');
        }
      }
    }
    if (style === 'ruin') {
      // broken top silhouette
      for (let i = 0; i < W; i += 5) {
        if (r() < 0.55) rect(x, i, wallTop, 4, 3 + r() * 9, 'rgba(0,0,0,0)');
      }
      // holes
      for (let i = 0; i < 3; i++) {
        const hx = 8 + r() * (W - 20), hy = wallTop + 6 + r() * (bodyH - 14);
        rect(x, hx, hy, 4 + r() * 4, 3 + r() * 4, '#232723');
      }
    }
    // windows
    const winN = style === 'library' ? 3 : 2;
    for (let i = 0; i < winN; i++) {
      const wx = 12 + (wallW / winN) * i + (winN === 2 ? 0 : 2);
      const wy = wallTop + Math.round(bodyH * 0.26);
      const ww = style === 'library' ? 6 : 7, wh = style === 'library' ? 11 : 8;
      if (style === 'ruin' && r() < 0.5) continue;
      rect(x, wx, wy, ww, wh, style === 'library' ? '#2e4a58' : '#2a2418');
      rect(x, wx + 1, wy + 1, ww - 2, wh - 2, style === 'library' ? '#5f9db0' : '#e8b96a');
      rect(x, wx + 1, wy + 1, ww - 2, 2, style === 'library' ? '#a8dfe8' : '#ffe7a8');
      rect(x, wx + (ww >> 1), wy, 1, wh, '#2a2418');
      rect(x, wx, wy + (wh >> 1), ww, 1, '#2a2418');
    }
    // door
    const dx = W / 2 - 6;
    rect(x, dx, baseY - 18, 12, 18, '#2b2119');
    blob(x, W / 2, baseY - 18, 6, 5, '#2b2119');
    rect(x, dx + 1, baseY - 16, 10, 16, '#3a2a1f');
    rect(x, dx + 1, baseY - 16, 2, 16, '#4d3829');
    px(x, W / 2 + 3, baseY - 9, '#c9a45c');
    if (style === 'forge') {
      rect(x, dx + 1, baseY - 15, 10, 2, '#e08a3a');
      px(x, W / 2, baseY - 13, '#ffd28a');
    }
    // steps
    rect(x, W / 2 - 10, baseY, 20, 4, stoneCols[1]);
    rect(x, W / 2 - 8, baseY + 2, 16, 3, stoneCols[2]);

    // roof
    roofRows(x, W / 2, wallTop - roofH, roofH + 4, Math.round(W * 0.72), W + 6, roofCols);
    // ridge + eaves
    rect(x, W / 2 - Math.round(W * 0.72) / 2, wallTop - roofH, Math.round(W * 0.72), 2, roofCols[2]);
    // chimney
    if (style === 'cottage' || style === 'tavern' || style === 'forge') {
      const chx = W * 0.72;
      rect(x, chx, wallTop - roofH - 8, 7, 16, stoneCols[0]);
      rect(x, chx, wallTop - roofH - 8, 2, 16, stoneCols[1]);
      rect(x, chx - 1, wallTop - roofH - 10, 9, 3, stoneCols[1]);
      if (r() < 0.8) {
        for (let i = 0; i < 3; i++) blob(x, chx + 3 + i * 2, wallTop - roofH - 13 - i * 3, 2 + i, 2, `rgba(200,200,200,${0.16 - i * 0.04})`);
      }
    }
    // hanging sign
    if (style === 'tavern' || style === 'merchant') {
      rect(x, W - 14, wallTop + 9, 3, 8, '#4a3626');
      rect(x, W - 22, wallTop + 16, 14, 8, '#5b4630');
      rect(x, W - 22, wallTop + 16, 14, 1, '#7a5f40');
      px(x, W - 16, wallTop + 19, '#d8b774');
      px(x, W - 15, wallTop + 20, '#d8b774');
    }
  }

  // snow on roof for frost
  if (style === 'frost') {
    for (let i = 0; i < 30; i++) {
      const xx = 8 + r() * (W - 16);
      const yy = wallTop - roofH + r() * 8;
      rect(x, xx, yy, 3, 1, '#dfeaf0');
    }
  }
  // vines
  if (style !== 'frost' && style !== 'library' && r() < 0.85) {
    for (let i = 0; i < 4; i++) {
      const vx = 8 + r() * (W - 16), von = r() < 0.4;
      if (!von) continue;
      const vlen = 6 + r() * 16;
      for (let j = 0; j < vlen; j++) {
        px(x, vx + Math.sin(j * 0.45) * 1.5, wallTop + 2 + j, j % 4 === 0 ? '#56824b' : '#3f6a3c');
        if (j % 3 === 0) px(x, vx + 1, wallTop + 2 + j, '#6a9a58');
      }
    }
  }
  return c;
}

function makeBuilding(o) {
  const key = JSON.stringify(o);
  if (!buildingCache.has(key)) buildingCache.set(key, buildingSprite(o));
  return buildingCache.get(key);
}

export const BUILDINGS = {
  cottage: (w = 92, h = 96, seed = 1) => makeBuilding({ w, h, style: 'cottage', seed }),
  ruin: (w = 104, h = 100, seed = 2) => makeBuilding({ w, h, style: 'ruin', seed }),
  tavern: (w = 110, h = 102, seed = 3) => makeBuilding({ w, h, style: 'tavern', seed }),
  tower: (w = 76, h = 124, seed = 4) => makeBuilding({ w, h, style: 'tower', seed }),
  library: (w = 148, h = 118, seed = 5) => makeBuilding({ w, h, style: 'library', seed }),
  sanctuary: (w = 128, h = 116, seed = 6) => makeBuilding({ w, h, style: 'sanctuary', seed }),
  forge: (w = 100, h = 94, seed = 7) => makeBuilding({ w, h, style: 'forge', seed }),
  frost: (w = 100, h = 100, seed = 8) => makeBuilding({ w, h, style: 'frost', seed }),
  merchant: (w = 96, h = 92, seed = 9) => makeBuilding({ w, h, style: 'merchant', seed }),
};

/* fountain, well, arena details */
const extraCache = new Map();
function extra(key, fn) { if (!extraCache.has(key)) extraCache.set(key, fn()); return extraCache.get(key); }

export function getFountain() {
  return extra('fountain', () => {
    const c = cv(64, 50), x = c.getContext('2d');
    shadow(x, 32, 46, 26, 5, 0.3);
    blob(x, 32, 38, 26, 10, '#4d5350');
    blob(x, 32, 36, 25, 9, '#5e6661');
    blob(x, 32, 35, 21, 7, '#2a4f5e');
    blob(x, 32, 34, 20, 6, '#2f6373');
    blob(x, 30, 33, 12, 4, '#4a8a96');
    // statue
    rect(x, 30, 18, 4, 14, '#6a716a');
    blob(x, 32, 14, 4, 5, '#6a716a');
    rect(x, 29, 8, 6, 7, '#6a716a');
    rect(x, 26, 10, 12, 2, '#6a716a');
    // trickles
    for (let i = 0; i < 6; i++) {
      const xx = 25 + i * 3;
      for (let j = 0; j < 4; j++) px(x, xx, 30 + j, 'rgba(170,230,235,.4)');
    }
    return c;
  });
}

export function getWell() {
  return extra('well', () => {
    const c = cv(36, 34), x = c.getContext('2d');
    shadow(x, 18, 31, 14, 4, 0.3);
    blob(x, 18, 24, 14, 7, '#4c534f');
    blob(x, 18, 23, 12, 6, '#5b6360');
    blob(x, 18, 22, 8, 4, '#14212a');
    blob(x, 18, 22, 7, 3, '#1d3a48');
    rect(x, 8, 8, 3, 15, '#4a3626');
    rect(x, 25, 8, 3, 15, '#4a3626');
    trap(x, 18, 4, 4, 24, 26, 5, '#5b4630');
    rect(x, 17, 8, 2, 8, '#7a5f40');
    return c;
  });
}

export function getWoodenPlatform(w, h) {
  return extra('platform' + w + h, () => {
    const c = cv(w, h), x = c.getContext('2d'), r = rng(w * 7 + h);
    rect(x, 0, 0, w, h, '#5d452f');
    for (let y = 0; y < h; y += 6) {
      rect(x, 0, y, w, 1, '#412f20');
      rect(x, 0, y + 1, w, 1, '#6d5136');
      for (let i = 0; i < w / 20; i++) px(x, r() * w, y + 2 + r() * 3, '#7a5b3c');
    }
    rect(x, 0, 0, 1, h, '#2f2116'); rect(x, w - 1, 0, 1, h, '#2f2116');
    return c;
  });
}

/* portrait generation uses character sprites at 2.4x with backdrop */
export function makePortrait(spriteCanvas, accent = '#6fd9c8') {
  const c = cv(76, 88), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 88);
  g.addColorStop(0, '#16242a'); g.addColorStop(1, '#080d11');
  x.fillStyle = g; x.fillRect(0, 0, 76, 88);
  x.fillStyle = accent; x.globalAlpha = 0.1;
  for (let i = 0; i < 6; i++) x.fillRect(0, 20 + i * 12, 76, 1);
  x.globalAlpha = 1;
  // halo
  const rg = x.createRadialGradient(38, 38, 2, 38, 38, 34);
  rg.addColorStop(0, accent + '44'); rg.addColorStop(1, 'transparent');
  x.fillStyle = rg; x.fillRect(0, 0, 76, 76);
  // crop of sprite head/upper body
  const sw = spriteCanvas.width, sh = spriteCanvas.height;
  const cw = Math.min(sw, Math.round(sh * 0.72));
  const ch = Math.min(sh, Math.round(sh * 0.86));
  x.imageSmoothingEnabled = false;
  x.drawImage(spriteCanvas, Math.round((sw - cw) / 2), Math.max(0, sh - ch - Math.round(sh * 0.06)), cw, ch, 10, 10, 56, 74);
  // vignette
  const vg = x.createRadialGradient(38, 40, 20, 38, 40, 50);
  vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(3,6,9,.75)');
  x.fillStyle = vg; x.fillRect(0, 0, 76, 88);
  return c;
}

export function tintCanvas(src, color, alpha = 1) {
  const c = cv(src.width, src.height), x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = alpha;
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
