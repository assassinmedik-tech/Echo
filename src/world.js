/* ============================================================
   ECHOES OF THE FALLEN — world generation & regions
   ============================================================ */
import { rng, hash2, BUILDINGS, PROPS, getFountain, getWell, getTile, getTile as _gt } from './art.js';
import { getNPC } from './sprites.js';

export const TILE = 16;
export const T = {
  VOID: 0, GRASS: 1, GRASS_DARK: 2, DIRT: 3, PATH: 4, WATER: 5, DEEP: 6,
  STONE: 7, BRICK: 8, SNOW: 9, ICE: 10, CAVE: 11, CRYSTAL_FLOOR: 12,
  PAVE: 13, WOOD: 14, ROCK: 15, SNOWROCK: 16, CAVEWALL: 17, MOSS: 18, SNOWPATH: 19,
};
export const TILE_KIND = {
  [T.VOID]: 'void', [T.GRASS]: 'grass', [T.GRASS_DARK]: 'grass_dark', [T.DIRT]: 'dirt',
  [T.PATH]: 'path', [T.WATER]: 'water', [T.DEEP]: 'deepwater', [T.STONE]: 'stone',
  [T.BRICK]: 'brick', [T.SNOW]: 'snow', [T.ICE]: 'ice', [T.CAVE]: 'cave',
  [T.CRYSTAL_FLOOR]: 'crystalfloor', [T.PAVE]: 'pave', [T.WOOD]: 'wood',
  [T.ROCK]: 'rock', [T.SNOWROCK]: 'snowrock', [T.CAVEWALL]: 'cavewall',
  [T.MOSS]: 'moss', [T.SNOWPATH]: 'snowpath',
};
export const SOLID_TILES = new Set([T.VOID, T.WATER, T.DEEP, T.ROCK, T.SNOWROCK, T.CAVEWALL]);
export const WATER_TILES = new Set([T.WATER, T.DEEP]);
export const MINI_COLORS = {
  [T.VOID]: '#080c0f', [T.GRASS]: '#355c3c', [T.GRASS_DARK]: '#294b33', [T.DIRT]: '#5b4a31',
  [T.PATH]: '#7a6847', [T.WATER]: '#1d4759', [T.DEEP]: '#143646', [T.STONE]: '#4c5352',
  [T.BRICK]: '#4a4f4a', [T.SNOW]: '#c3d3dc', [T.ICE]: '#8fc5d6', [T.CAVE]: '#262536',
  [T.CRYSTAL_FLOOR]: '#2c3f4a', [T.PAVE]: '#68604e', [T.WOOD]: '#5d452f', [T.ROCK]: '#343b3a',
  [T.SNOWROCK]: '#7a8a92', [T.CAVEWALL]: '#191826', [T.MOSS]: '#3d4a38', [T.SNOWPATH]: '#a8b8c2',
};

export const REGIONS = [
  { id: 'greenfall', name: 'Greenfall Forest', sub: 'Where the old roots remember', mapX: 30, mapY: 72, color: '#4f8350', icon: 'forest' },
  { id: 'sanctuary', name: 'Central Sanctuary', sub: 'The last hearth of Aetheria', mapX: 47, mapY: 47, color: '#c9a45c', icon: 'hub' },
  { id: 'kingdom', name: 'The Forgotten Kingdom', sub: 'Crowns of dust and silence', mapX: 44, mapY: 24, color: '#7a7f88', icon: 'castle' },
  { id: 'frost', name: 'Frostbound Mountains', sub: 'The wind keeps its old vows', mapX: 72, mapY: 20, color: '#9fc4d4', icon: 'peak' },
  { id: 'depths', name: 'The Sunken Depths', sub: 'Beneath the world, something sings', mapX: 47, mapY: 87, color: '#7a67a8', icon: 'depths' },
];

/* ---------------- map scaffolding ---------------- */
function makeMap(id, name, sub, w, h, opts = {}) {
  const m = {
    id, name, sub, w, h,
    tiles: new Uint8Array(w * h).fill(opts.fill ?? T.GRASS),
    variants: new Uint8Array(w * h),
    solid: new Uint8Array(w * h),
    explored: new Uint8Array(w * h),
    props: [], buildings: [], npcs: [], interactables: [],
    enemies: [], portals: [], lore: [],
    occ: new Uint8Array(w * h),
    colliderCircles: [], colliderRects: [],
    gridCircles: new Map(), gridRects: new Map(),
    music: opts.music || 'forest',
    ambient: opts.ambient || 'day',
    darkness: opts.darkness ?? 0.06,
    lightTint: opts.lightTint || '#9fd0c8',
    lightGlow: opts.lightGlow || 'rgba(255,226,160,.07)',
    weather: opts.weather || null,
    arena: null,
    discovered: false,
    spawn: opts.spawn || { x: w / 2, y: h / 2 },
  };
  for (let i = 0; i < w * h; i++) m.variants[i] = (hash2(i % w, (i / w) | 0, 3) * 4) | 0;
  return m;
}

function idx(m, x, y) { return y * m.w + x; }
export function tileAt(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return T.VOID;
  return m.tiles[y * m.w + x];
}
function setT(m, x, y, t, force = false) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return;
  if (!force && m.occ[y * m.w + x] === 2) return;
  m.tiles[y * m.w + x] = t;
  m.solid[y * m.w + x] = SOLID_TILES.has(t) ? 1 : 0;
}
function fillRect(m, x0, y0, w, h, t, force = false) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(m, x, y, t, force);
}
function circle(m, cx, cy, rx, ry, t, force = false) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setT(m, x, y, t, force);
    }
  }
}
function organicCircle(m, cx, cy, rx, ry, t, seed, force = false) {
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) {
    for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const n = (hash2(x, y, seed) - 0.5) * 0.22;
      if (dx * dx + dy * dy <= 1 + n) setT(m, x, y, t, force);
    }
  }
}
function carvePath(m, pts, width, t, edgeT) {
  for (let p = 0; p < pts.length - 1; p++) {
    const [x1, y1] = pts[p], [x2, y2] = pts[p + 1];
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist * 1.6));
    for (let s = 0; s <= steps; s++) {
      const tt = s / steps;
      const x = x1 + (x2 - x1) * tt, y = y1 + (y2 - y1) * tt;
      const wob = Math.sin((s + p * 13) * 0.5) * 0.8;
      for (let oy = -width; oy <= width; oy++) {
        for (let ox = -width; ox <= width; ox++) {
          const d = Math.hypot(ox, oy + wob);
          if (d <= width + 0.35) {
            const tx = Math.round(x + ox), ty = Math.round(y + oy);
            if (edgeT && d > width - 0.6) {
              const cur = tileAt(m, tx, ty);
              if (cur === T.GRASS || cur === T.GRASS_DARK || cur === T.SNOW || cur === T.DIRT) setT(m, tx, ty, edgeT);
            } else setT(m, tx, ty, t);
          }
        }
      }
    }
  }
}
function bridge(m, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(m, x, y, T.WOOD, true);
}

function occupy(m, tx, ty, r) {
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.occ[y * m.w + x] = Math.max(m.occ[y * m.w + x], 2);
    }
  }
}
function markClear(m, tx, ty, w, h) {
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
    if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.occ[y * m.w + x] = 2;
  }
}
function groundUnder(m, tx, ty) {
  const t = tileAt(m, tx, ty);
  return t === T.GRASS || t === T.GRASS_DARK || t === T.SNOW || t === T.MOSS || t === T.DIRT;
}
function free(m, tx, ty, r = 1) {
  for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) return false;
    if (m.occ[y * m.w + x] === 2) return false;
    if (SOLID_TILES.has(m.tiles[y * m.w + x])) return false;
    if (m.tiles[y * m.w + x] === T.PATH || m.tiles[y * m.w + x] === T.SNOWPATH || m.tiles[y * m.w + x] === T.PAVE) return false;
  }
  return true;
}

function addProp(m, imgKey, tx, ty, opts = {}) {
  const x = tx * TILE, y = ty * TILE;
  const img = typeof imgKey === 'string' ? PROPS[imgKey] : imgKey;
  if (!img) return null;
  const p = {
    img, x, y,
    sort: y + (opts.sortOffset || 0),
    solid: opts.solid || 0,
    sway: opts.sway || 0,
    kind: opts.kind || 'prop',
    alpha: opts.alpha ?? 1,
  };
  m.props.push(p);
  if (opts.solid) {
    const c = { x, y: y - 2, r: opts.solid };
    m.colliderCircles.push(c);
    const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const k = gx + ',' + gy;
      if (!m.gridCircles.has(k)) m.gridCircles.set(k, []);
      m.gridCircles.get(k).push(c);
    }
  }
  if (opts.block !== false) occupy(m, tx, ty, opts.blockR ?? 1);
  return p;
}

function addBuilding(m, canvas, tx, ty, opts = {}) {
  const x = tx * TILE, y = ty * TILE;
  const w = canvas.width, h = canvas.height;
  const p = { img: canvas, x, y, sort: y, kind: 'building', sway: 0, alpha: 1 };
  m.props.push(p);
  const cw = opts.cw ?? Math.round(w * 0.78);
  const ch = opts.ch ?? 20;
  const rect = { x: x - cw / 2, y: y - ch, w: cw, h: ch + 4 };
  m.colliderRects.push(rect);
  const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
  for (let gy = cy - 1; gy <= Math.ceil((y + 20) / 64); gy++) for (let gx = Math.floor((x - cw / 2) / 64); gx <= Math.ceil((x + cw / 2) / 64); gx++) {
    const k = gx + ',' + gy;
    if (!m.gridRects.has(k)) m.gridRects.set(k, []);
    m.gridRects.get(k).push(rect);
  }
  markClear(m, tx - Math.ceil(cw / 32) - 1, ty - Math.ceil(h / 16) - 1, Math.ceil(cw / 16) + 2, Math.ceil(h / 16) + 3);
  // keep the doorway approach clear
  markClear(m, tx - 2, ty, 5, 3);
  m.buildings.push(p);
  return p;
}

function addNpc(m, key, tx, ty, data = {}) {
  const x = tx * TILE, y = ty * TILE;
  const npc = { id: data.id || key, key, x, y, name: data.name || key, dir: data.dir || 'down', ...data };
  m.npcs.push(npc);
  m.interactables.push({ type: 'npc', id: npc.id, x, y, r: 30, npc });
  markClear(m, tx - 1, ty - 1, 3, 3);
  return npc;
}

function addInteract(m, obj) {
  m.interactables.push(obj);
  const tx = Math.floor(obj.x / TILE), ty = Math.floor(obj.y / TILE);
  markClear(m, tx - 1, ty - 1, 3, 3);
  return obj;
}

function addPortal(m, rect, target, spawn, opts = {}) {
  m.portals.push({ rect, target, spawn, label: opts.label || '', require: opts.require, lockedText: opts.lockedText });
}

function scatter(m, opts) {
  const { x0, y0, x1, y1, kinds, density = 0.08, solidR = 4, seed = 1, blockR = 1, sway = 0.4, scale = 1 } = opts;
  const r = rng(seed * 3571 + m.w * 7 + m.h);
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      if (!free(m, tx, ty, blockR)) continue;
      if (!groundUnder(m, tx, ty)) continue;
      const n = hash2(tx, ty, seed);
      const d = Array.isArray(density) ? density[Math.min(density.length - 1, (n * density.length) | 0)] : density;
      if (r() > d) continue;
      let kind = kinds[(r() * kinds.length) | 0];
      if (!PROPS[kind]) {
        const variantKeys = Object.keys(PROPS).filter(k => k.startsWith(kind) && /^\d*$/.test(k.slice(kind.length)));
        if (!variantKeys.length) continue;
        kind = variantKeys[(r() * variantKeys.length) | 0];
      }
      if (kind.startsWith('tree') || kind.startsWith('pine') || kind.startsWith('snowpine')) {
        addProp(m, kind, tx, ty, { solid: solidR, sway: sway + r() * 0.5, blockR });
      } else {
        addProp(m, kind, tx, ty, { solid: solidR, blockR });
      }
    }
  }
}

/* terrain beautification: scatter flowers/fern/rocks without collision */
function scatterDecor(m, opts) {
  const { x0, y0, x1, y1, kinds, density = 0.04, seed = 5, solid = 0 } = opts;
  const r = rng(seed * 7919 + 13);
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      if (!free(m, tx, ty, 0)) continue;
      const t = tileAt(m, tx, ty);
      if (t !== T.GRASS && t !== T.GRASS_DARK && t !== T.SNOW && t !== T.CAVE && t !== T.MOSS && t !== T.CRYSTAL_FLOOR) continue;
      const n = hash2(tx, ty, seed);
      if (n > density) continue;
      const kind = kinds[(r() * kinds.length) | 0];
      addProp(m, kind, tx, ty, { solid, blockR: 0, sway: kind.includes('flower') ? 0 : 0.2 });
    }
  }
}

/* finalize: compute tile solid, build arena helpers */
function finalize(m) {
  for (let i = 0; i < m.w * m.h; i++) m.solid[i] = SOLID_TILES.has(m.tiles[i]) ? 1 : 0;
  m.spawnPx = { x: m.spawn.x * TILE, y: m.spawn.y * TILE };
}

/* ---------------- map 1: sanctuary ---------------- */
function buildSanctuary() {
  const m = makeMap('sanctuary', 'Central Sanctuary', 'The last hearth of Aetheria', 68, 58, {
    music: 'sanctuary', ambient: 'dusk', darkness: 0.16, lightTint: '#e0b98a', lightGlow: 'rgba(255,214,150,.1)', spawn: { x: 34, y: 46 },
  });
  // ground
  fillRect(m, 0, 0, m.w, m.h, T.GRASS);
  for (let y = 3; y < m.h - 3; y++) for (let x = 3; x < m.w - 3; x++) {
    if (hash2(x, y, 11) < 0.22) setT(m, x, y, T.GRASS_DARK);
  }
  circle(m, 34, 28, 13, 12, T.PAVE);
  carvePath(m, [[34, 56], [34, 30], [34, 2]], 2, T.PAVE, T.DIRT);
  carvePath(m, [[2, 27], [33, 27]], 2, T.PAVE, T.DIRT);
  carvePath(m, [[35, 29], [66, 29]], 2, T.PAVE, T.DIRT);
  // wall ring
  for (let x = 1; x < m.w - 1; x++) {
    if (!(x >= 31 && x <= 36)) { setT(m, x, 0, T.ROCK, true); setT(m, x, m.h - 1, T.ROCK, true); }
  }
  for (let y = 1; y < m.h - 1; y++) {
    if (!(y >= 26 && y <= 30)) { setT(m, 0, y, T.ROCK, true); setT(m, m.w - 1, y, T.ROCK, true); }
  }
  // gate posts
  for (const [gx, gy] of [[30, 1], [37, 1], [30, 56], [37, 56], [1, 25], [1, 31], [66, 25], [66, 31]]) {
    addProp(m, 'pillarWhole', gx, gy, { solid: 5, blockR: 0 });
  }
  // buildings
  addBuilding(m, BUILDINGS.sanctuary(132, 120, 6), 34, 17);
  addBuilding(m, BUILDINGS.forge(104, 96, 7), 16, 28);
  addBuilding(m, BUILDINGS.cottage(94, 96, 12), 52, 28);
  addBuilding(m, BUILDINGS.tavern(112, 104, 3), 13, 44);
  addBuilding(m, BUILDINGS.cottage(92, 92, 23), 54, 44);
  addBuilding(m, BUILDINGS.merchant(92, 90, 9), 23, 37);
  // plaza details
  addProp(m, getFountain(), 34, 27, { solid: 20, blockR: 2, kind: 'fountain' });
  addProp(m, 'lamp', 27, 22, { solid: 3 });
  addProp(m, 'lamp', 41, 22, { solid: 3 });
  addProp(m, 'lamp', 27, 34, { solid: 3 });
  addProp(m, 'lamp', 41, 34, { solid: 3 });
  addProp(m, 'lamp', 34, 41, { solid: 3 });
  addProp(m, 'banner', 30, 20, { solid: 0 });
  addProp(m, 'banner', 38, 20, { solid: 0 });
  addProp(m, 'banner', 30, 36, { solid: 0 });
  addProp(m, 'banner', 38, 36, { solid: 0 });
  addProp(m, 'well', 25, 22, { solid: 12, blockR: 2 });
  addProp(m, 'signpost', 37, 40, { blockR: 0 });
  addProp(m, 'flowers0', 28, 25, { blockR: 0 });
  addProp(m, 'flowers1', 40, 25, { blockR: 0 });
  addProp(m, 'flowers0', 30, 32, { blockR: 0 });
  // market crates
  const cr = rng(414);
  for (let i = 0; i < 6; i++) {
    const tx = 21 + ((cr() * 5) | 0), ty = 34 + ((cr() * 5) | 0);
    addProp(m, 'bush' + ((cr() * 3) | 0), tx, ty, { blockR: 0 });
  }
  // trees in gardens
  for (const [tx, ty] of [[6, 8], [10, 14], [58, 8], [62, 14], [6, 50], [60, 51], [8, 33], [60, 34], [44, 8], [24, 8]]) {
    addProp(m, 'tree' + ((tx + ty) % 4), tx, ty, { solid: 5, sway: 0.6, blockR: 0 });
  }
  scatterDecor(m, { x0: 3, y0: 3, x1: 65, y1: 55, kinds: ['flowers0', 'flowers1', 'fern0', 'fern1', 'bush0'], density: 0.035, seed: 9 });
  // NPCs
  addNpc(m, 'maelin', 34, 20, { id: 'maelin', name: 'Elder Maelin', dir: 'down' });
  addNpc(m, 'brann', 18, 31, { id: 'brann', name: 'Brann the Smith' });
  addNpc(m, 'sera', 50, 31, { id: 'sera', name: 'Sera the Herbalist' });
  addNpc(m, 'ilse', 52, 47, { id: 'ilse', name: 'Keeper Ilse' });
  addNpc(m, 'pip', 38, 36, { id: 'pip', name: 'Pip', dir: 'side' });
  addNpc(m, 'garrick', 34, 51, { id: 'garrick', name: 'Garrick the Wanderer' });
  // interactables
  addInteract(m, { type: 'monument', id: 'sanctuary', x: 34 * 16, y: 12 * 16, sub: 'The silent heart of Aetheria', active: true });
  addInteract(m, { type: 'lore', id: 'sa1', x: 43 * 16, y: 30 * 16, title: 'The Hearth Oath', text: 'Carved above the gate: "Whatever the dark takes, the hearth remembers. Feed the fire, and the fire will feed the world."' });
  addInteract(m, { type: 'lore', id: 'sa2', x: 28 * 16, y: 39 * 16, title: 'Ledger of the Last Caravan', text: 'A water-stained ledger lists grain, lamp oil, and forty-two names. Only three have been struck through. Someone still updates it.' });
  addInteract(m, { type: 'sign', id: 'sa_sign', x: 37 * 16 + 8, y: 40 * 16, text: 'North — The Forgotten Kingdom   ·   South — Greenfall Forest   ·   East — Frostbound Pass' });
  // portals
  addPortal(m, { x: 31 * 16, y: 56 * 16, w: 6 * 16, h: 2 * 16 }, 'greenfall', { x: 68, y: 98 }, { label: 'Greenfall Forest' });
  addPortal(m, { x: 31 * 16, y: 0, w: 6 * 16, h: 1.4 * 16 }, 'kingdom', { x: 68, y: 100 }, { label: 'Forgotten Kingdom' });
  addPortal(m, { x: 66 * 16, y: 25 * 16, w: 2 * 16, h: 6 * 16 }, 'frost', { x: 3, y: 52 }, { label: 'Frostbound Pass' });
  // depths entrance via well
  addInteract(m, { type: 'depthWell', id: 'depthwell', x: 25 * 16, y: 23 * 16, r: 44 });
  // keep plaza clear
  markClear(m, 22, 18, 25, 21);
  finalize(m);
  return m;
}

/* ---------------- map 2: greenfall ---------------- */
function buildGreenfall() {
  const m = makeMap('greenfall', 'Greenfall Forest', 'Where the old roots remember', 140, 104, {
    music: 'forest', ambient: 'day', darkness: 0.04, lightTint: '#8fe0b0', lightGlow: 'rgba(255,230,150,.06)', weather: 'leaves', spawn: { x: 68, y: 98 },
    boss: 'grove',
  });
  fillRect(m, 0, 0, m.w, m.h, T.GRASS);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const n = hash2(x, y, 21);
    if (n < 0.18) setT(m, x, y, T.GRASS_DARK);
    if (hash2(x, y, 77) < 0.02) setT(m, x, y, T.DIRT);
  }
  // river
  const river = [[20, 0], [23, 14], [19, 30], [16, 48], [21, 62], [29, 76], [26, 90], [22, 104]];
  carvePath(m, river, 3.2, T.WATER, T.DIRT);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (tileAt(m, x, y) === T.WATER && hash2(x, y, 9) < 0.3) setT(m, x, y, T.DEEP);
  }
  // paths
  carvePath(m, [[68, 103], [68, 92], [62, 86], [58, 76], [58, 58], [64, 46], [76, 38], [92, 30], [106, 25]], 2, T.PATH, T.DIRT);
  carvePath(m, [[58, 76], [50, 76], [42, 74], [32, 70], [23, 66], [16, 64]], 1.4, T.PATH, T.DIRT);
  bridge(m, 18, 63, 10, 4);
  carvePath(m, [[58, 76], [46, 82], [38, 88]], 1.2, T.PATH, T.DIRT);
  carvePath(m, [[58, 58], [46, 56], [36, 56]], 0.9, T.DIRT);
  // village clearing
  circle(m, 57, 77, 16, 12, T.GRASS);
  markClear(m, 44, 68, 30, 22);
  addBuilding(m, BUILDINGS.cottage(92, 96, 31), 51, 73);
  addBuilding(m, BUILDINGS.cottage(88, 92, 32), 65, 76);
  addBuilding(m, BUILDINGS.tavern(108, 100, 33), 55, 84);
  addProp(m, getWell(), 60, 77, { solid: 12, blockR: 2 });
  addProp(m, 'fence', 47, 77, { solid: 0 });
  addProp(m, 'fence', 70, 80, { solid: 0 });
  addProp(m, 'lamp', 54, 74, { solid: 2 });
  addProp(m, 'lamp', 64, 80, { solid: 2 });
  addProp(m, 'signpost', 62, 84, { blockR: 0 });
  // campfire (brazier non-interactive warm)
  addProp(m, 'brazier', 47, 81, { solid: 3 });
  addProp(m, 'bones', 72, 73, { blockR: 0 });
  // pond
  organicCircle(m, 40, 91, 8, 5.5, T.WATER, 31);
  circle(m, 40, 91, 5.5, 3.5, T.DEEP);
  addProp(m, 'lamp', 31, 88, { solid: 2 });
  // ancient grove (hidden west)
  circle(m, 15, 62, 8, 7, T.GRASS_DARK);
  markClear(m, 9, 56, 14, 14);
  addProp(m, 'ancientTree0', 15, 58, { solid: 9, sway: 0.8, blockR: 2 });
  addProp(m, 'glowMushroom0', 12, 63, { blockR: 0 });
  addProp(m, 'glowMushroom1', 18, 65, { blockR: 0 });
  addProp(m, 'glowFlowers', 13, 66, { blockR: 0 });
  addProp(m, 'glowFlowers', 19, 60, { blockR: 0 });
  addNpc(m, 'orin', 17, 65, { id: 'orin', name: 'Orin the Rootless' });
  // hidden grove chest
  // shrine arena northeast
  const ax = 108, ay = 25;
  circle(m, ax, ay, 11, 10, T.PAVE);
  circle(m, ax, ay, 10, 9, T.STONE);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const px0 = Math.round(ax + Math.cos(a) * 10), py0 = Math.round(ay + Math.sin(a) * 10);
    addProp(m, 'pillar' + (a < 2 ? 0 : 1), px0, py0, { solid: 5, blockR: 0 });
  }
  addProp(m, 'shrine', 108, 16, { solid: 14, blockR: 2, sortOffset: 0 });
  addProp(m, 'lamp', 98, 24, { solid: 2 });
  addProp(m, 'lamp', 118, 24, { solid: 2 });
  addProp(m, 'banner', 103, 20, { blockR: 0 });
  addProp(m, 'banner', 113, 20, { blockR: 0 });
  addInteract(m, { type: 'monument', id: 'greenfall', x: 108 * 16, y: 13 * 16, sub: 'Root Monument — first of three' });
  markClear(m, 96, 12, 25, 18);
  // abandoned camp south east
  markClear(m, 86, 70, 12, 10);
  addProp(m, 'deadTree0', 88, 68, { solid: 4, blockR: 1 });
  addProp(m, 'bones', 92, 74, { blockR: 0 });
  addProp(m, 'brazier', 90, 73, { solid: 3 });
  addProp(m, 'wall0', 95, 71, { solid: 8, blockR: 1 });
  // lore & chests & crystals
  addInteract(m, { type: 'lore', id: 'gf1', x: 60 * 16, y: 86 * 16, title: 'Village Notice', text: 'The wolves no longer fear our fires. Rook says they follow something older than hunger. Do not walk the north road alone.' });
  addInteract(m, { type: 'lore', id: 'gf2', x: 102 * 16, y: 31 * 16, title: 'Pilgrim\'s Stone', text: 'Three monuments hold the world together. When the first fell silent, the roots began to dream. We should not have listened.' });
  addInteract(m, { type: 'lore', id: 'gf3', x: 15 * 16, y: 68 * 16, title: 'Orin\'s Journal', text: 'The tree speaks in a voice like snapping twigs. It asks for my name. I have decided not to give it.' });
  addInteract(m, { type: 'chest', id: 'gf_c1', x: 12 * 16, y: 66 * 16, rarity: 'rare' });
  addInteract(m, { type: 'chest', id: 'gf_c2', x: 93 * 16, y: 72 * 16, rarity: 'uncommon' });
  addInteract(m, { type: 'chest', id: 'gf_c3', x: 126 * 16, y: 90 * 16, rarity: 'epic' });
  addInteract(m, { type: 'lore', id: 'gf4', x: 124 * 16, y: 88 * 16, title: 'Moss-Covered Stone', text: 'A child\'s drawing scratched into the rock: three tall shapes, a circle above them, and a stick figure holding hands with something much taller.' });
  addInteract(m, { type: 'crystal', id: 'gf_cr1', x: 84 * 16, y: 52 * 16 });
  addInteract(m, { type: 'crystal', id: 'gf_cr2', x: 118 * 16, y: 40 * 16 });
  addInteract(m, { type: 'crystal', id: 'gf_cr3', x: 34 * 16, y: 84 * 16 });
  addInteract(m, { type: 'locket', id: 'gf_locket', x: 40 * 16, y: 96 * 16 });
  addInteract(m, { type: 'sign', id: 'gf_sign', x: 65 * 16, y: 90 * 16, text: 'Thornhollow — shelter, water, and stubborn folk.  Shrine Road → north-east.' });
  // NPCs
  addNpc(m, 'mira', 63, 79, { id: 'mira', name: 'Mira of Thornhollow' });
  addNpc(m, 'rook', 49, 80, { id: 'rook', name: 'Rook the Hunter' });
  // enemies
  const e = [
    ['thornling', 60, 92], ['thornling', 74, 88], ['thornling', 52, 64], ['thornling', 66, 62],
    ['wolf', 78, 78], ['wolf', 84, 70], ['wolf', 40, 62], ['wolf', 68, 46],
    ['thornling', 90, 36], ['wolf', 96, 34], ['thornling', 118, 32], ['wolf', 122, 28],
    ['thornling', 32, 94], ['wolf', 24, 88], ['thornling', 104, 60], ['wolf', 112, 68],
    ['thornling', 44, 44], ['wolf', 36, 52], ['wolf', 78, 96], ['thornling', 28, 38],
  ];
  for (const [type, tx, ty] of e) m.enemies.push({ type, x: tx * 16, y: ty * 16, elite: false });
  // one elite wolf
  m.enemies.push({ type: 'wolf', x: 124 * 16, y: 84 * 16, elite: true });
  // boss
  m.enemies.push({ type: 'grove', x: 108 * 16, y: 30 * 16, boss: 'grove', home: { x: 108 * 16, y: 30 * 16 } });
  m.arena = { x: 108 * 16, y: 25 * 16, r: 10.5 * 16, boss: 'grove', trigger: 11 * 16, flag: 'boss:grove' };
  addPortal(m, { x: 66 * 16, y: 0, w: 5 * 16, h: 1.5 * 16 }, 'sanctuary', { x: 34, y: 53 }, { label: 'Central Sanctuary' });
  // scatter trees & decor
  scatterDecor(m, { x0: 2, y0: 2, x1: 137, y1: 101, kinds: ['flowers0', 'flowers1', 'fern0', 'fern1', 'fern2', 'bush0', 'bush1', 'mushroom0', 'mushroom1'], density: 0.05, seed: 33 });
  scatter(m, { x0: 2, y0: 2, x1: 138, y1: 102, kinds: ['tree', 'tree', 'treeBig', 'bush'], density: [0.03, 0.05, 0.09], solidR: 4.5, seed: 41, blockR: 1 });
  scatter(m, { x0: 2, y0: 2, x1: 138, y1: 102, kinds: ['rock0', 'rock1', 'bush2'], density: 0.012, solidR: 4, seed: 42, blockR: 1 });
  finalize(m);
  return m;
}

/* ---------------- map 3: kingdom ---------------- */
function buildKingdom() {
  const m = makeMap('kingdom', 'The Forgotten Kingdom', 'Crowns of dust and silence', 140, 104, {
    music: 'kingdom', ambient: 'overcast', darkness: 0.15, lightTint: '#a8b0c8', lightGlow: 'rgba(180,200,230,.05)', weather: 'ash', spawn: { x: 68, y: 100 },
    boss: 'hollowking',
  });
  fillRect(m, 0, 0, m.w, m.h, T.GRASS_DARK);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const n = hash2(x, y, 51);
    if (n < 0.4) setT(m, x, y, T.GRASS);
    if (hash2(x, y, 52) < 0.1) setT(m, x, y, T.DIRT);
  }
  // city floor
  organicCircle(m, 68, 58, 44, 36, T.STONE, 61);
  organicCircle(m, 68, 58, 40, 32, T.PAVE, 62);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (tileAt(m, x, y) === T.PAVE && hash2(x, y, 63) < 0.28) setT(m, x, y, T.BRICK);
    if (tileAt(m, x, y) === T.PAVE && hash2(x, y, 64) < 0.08) setT(m, x, y, T.GRASS_DARK);
  }
  // roads
  carvePath(m, [[68, 103], [68, 76], [67, 58], [68, 40], [68, 22]], 2.2, T.PAVE, T.STONE);
  carvePath(m, [[18, 58], [50, 58], [66, 58], [88, 58], [122, 58]], 2, T.PAVE, T.STONE);
  circle(m, 68, 58, 9, 8, T.PAVE);
  carvePath(m, [[68, 58], [92, 54], [104, 52]], 1.6, T.PAVE);
  carvePath(m, [[68, 58], [44, 54], [30, 52]], 1.2, T.DIRT);
  // castle walls
  markClear(m, 48, 12, 42, 26);
  for (let x = 50; x <= 86; x++) {
    if (x < 64 || x > 72) { addProp(m, 'wall' + (x % 3), x, 34, { solid: 10, blockR: 0 }); }
  }
  for (let y = 17; y <= 34; y += 2) {
    addProp(m, 'wall' + (y % 3), 50, y, { solid: 10, blockR: 0 });
    addProp(m, 'wall' + (y % 3), 86, y, { solid: 10, blockR: 0 });
  }
  for (const [tx, ty] of [[50, 17], [86, 17], [50, 34], [86, 34]]) addProp(m, 'pillarWhole', tx, ty, { solid: 10, blockR: 0 });
  addBuilding(m, BUILDINGS.tower(80, 128, 71), 56, 20);
  addBuilding(m, BUILDINGS.tower(80, 128, 72), 80, 20);
  addBuilding(m, BUILDINGS.ruin(180, 132, 73), 68, 17);
  addProp(m, 'statueGuardian', 68, 26, { solid: 10, blockR: 1 });
  addProp(m, 'banner', 62, 24, { blockR: 0 });
  addProp(m, 'banner', 74, 24, { blockR: 0 });
  addProp(m, 'brazier', 60, 30, { solid: 3 });
  addProp(m, 'brazier', 76, 30, { solid: 3 });
  addInteract(m, { type: 'monument', id: 'kingdom', x: 68 * 16, y: 22 * 16, sub: 'Crown Monument — second of three' });
  // library district
  markClear(m, 94, 42, 22, 20);
  addBuilding(m, BUILDINGS.library(152, 122, 74), 104, 52);
  addProp(m, 'pillar0', 95, 55, { solid: 5, blockR: 0 });
  addProp(m, 'pillar1', 113, 55, { solid: 5, blockR: 0 });
  addProp(m, 'statue', 100, 60, { solid: 8, blockR: 1 });
  addProp(m, 'lamp', 96, 50, { solid: 2 });
  addProp(m, 'lamp', 112, 50, { solid: 2 });
  addNpc(m, 'vela', 90, 60, { id: 'vela', name: 'Vela the Archivist' });
  addInteract(m, { type: 'lore', id: 'kg1', x: 100 * 16, y: 57 * 16, title: 'The Buried Tome', text: 'A book bound in grey leather, warm to the touch. Its pages describe the three Echo Monuments and the day they "turned their faces away".' });
  addInteract(m, { type: 'tome', id: 'kg_tome', x: 108 * 16, y: 58 * 16 });
  // ruined houses
  const houses = [[40, 70, 34], [92, 74, 35], [44, 44, 36], [96, 40, 37], [28, 78, 38], [114, 76, 39], [32, 36, 40], [118, 42, 41]];
  for (const [tx, ty, seed] of houses) addBuilding(m, BUILDINGS.ruin(104 + (seed % 3) * 12, 100, seed), tx, ty);
  // graveyard
  markClear(m, 22, 44, 22, 22);
  const r = rng(88);
  for (let i = 0; i < 12; i++) {
    const tx = 24 + ((r() * 18) | 0), ty = 46 + ((r() * 16) | 0);
    if (free(m, tx, ty, 0)) addProp(m, r() < 0.3 ? 'graveSnow' : 'grave' + (r() < 0.5 ? 0 : 1), tx, ty, { solid: 3, blockR: 0 });
  }
  addProp(m, 'statue', 34, 44, { solid: 8, blockR: 1 });
  addProp(m, 'deadTree0', 29, 50, { solid: 4 });
  addProp(m, 'deadTree1', 24, 58, { solid: 4 });
  addInteract(m, { type: 'lore', id: 'kg2', x: 34 * 16, y: 42 * 16, title: 'A Name Worn Away', text: 'Here lies the last keeper of the Crown. The stone has been scratched at by claws, but the words "he stayed" are still legible.' });
  // secret vault
  markClear(m, 18, 82, 12, 12);
  addProp(m, 'rockBig0', 18, 84, { solid: 12, blockR: 1 });
  addProp(m, 'rockBig1', 27, 84, { solid: 12, blockR: 1 });
  addProp(m, 'wall1', 22, 86, { solid: 10, blockR: 1 });
  addInteract(m, { type: 'chest', id: 'kg_c1', x: 22 * 16, y: 88 * 16, rarity: 'epic' });
  addInteract(m, { type: 'lore', id: 'kg3', x: 24 * 16, y: 90 * 16, title: 'Vault Letter', text: 'To whoever finds this: the Crown was never a seat of power. It was a lock. We have done a terrible thing by forgetting which way it turns.' });
  // plaza camps / chests
  addInteract(m, { type: 'chest', id: 'kg_c2', x: 58 * 16, y: 66 * 16, rarity: 'rare' });
  addInteract(m, { type: 'chest', id: 'kg_c3', x: 124 * 16, y: 64 * 16, rarity: 'uncommon' });
  addInteract(m, { type: 'crystal', id: 'kg_cr1', x: 36 * 16, y: 64 * 16 });
  addInteract(m, { type: 'crystal', id: 'kg_cr2', x: 120 * 16, y: 50 * 16 });
  addInteract(m, { type: 'crystal', id: 'kg_cr3', x: 82 * 16, y: 88 * 16 });
  addInteract(m, { type: 'lore', id: 'kg4', x: 66 * 16, y: 92 * 16, title: 'Royal Proclamation', text: 'By decree: the lower city is closed until the echoing stops. Citizens are reminded that silence is a form of loyalty.' });
  addInteract(m, { type: 'sign', id: 'kg_sign', x: 70 * 16, y: 86 * 16, text: 'Castle district — north.  Archive — east.  The old city remembers nothing kindly.' });
  // NPCs
  // enemies
  const es = [
    ['knight', 60, 80], ['knight', 78, 70], ['wisps', 84, 62], ['knight', 92, 58], ['wisp', 50, 64],
    ['wisp', 100, 60], ['knight', 106, 70], ['wolf', 40, 66], ['knight', 34, 72], ['wisp', 30, 60],
    ['knight', 112, 84], ['wisp', 120, 56], ['knight', 54, 46], ['wisps', 80, 44], ['wolf', 24, 70],
    ['knight', 68, 40], ['wisp', 70, 36], ['knight', 120, 36], ['wisp', 44, 88], ['knight', 96, 90],
  ];
  for (const [type, tx, ty] of es) m.enemies.push({ type: type === 'wisps' ? 'wisp' : type, x: tx * 16, y: ty * 16 });
  m.enemies.push({ type: 'hollowking', x: 68 * 16, y: 30 * 16, boss: 'hollowking', home: { x: 68 * 16, y: 30 * 16 } });
  m.arena = { x: 68 * 16, y: 29 * 16, r: 13 * 16, boss: 'hollowking', trigger: 14 * 16, flag: 'boss:hollowking' };
  addPortal(m, { x: 65 * 16, y: 102 * 16, w: 6 * 16, h: 2 * 16 }, 'sanctuary', { x: 34, y: 53 }, { label: 'Central Sanctuary' });
  // decor
  scatterDecor(m, { x0: 2, y0: 2, x1: 137, y1: 101, kinds: ['bush0', 'bush1', 'fern0', 'fern1', 'mushroom0', 'flowers1'], density: 0.03, seed: 66 });
  scatter(m, { x0: 2, y0: 2, x1: 138, y1: 102, kinds: ['deadTree', 'bush', 'rock'], density: [0.02, 0.02, 0.015], solidR: 4, seed: 67, blockR: 1 });
  // some surviving trees outside city
  scatter(m, { x0: 2, y0: 82, x1: 28, y1: 102, kinds: ['tree', 'treeBig'], density: 0.08, solidR: 4.5, seed: 68, blockR: 1 });
  scatter(m, { x0: 104, y0: 84, x1: 138, y1: 102, kinds: ['tree', 'deadTree'], density: 0.06, solidR: 4.5, seed: 69, blockR: 1 });
  finalize(m);
  return m;
}

/* ---------------- map 4: frost ---------------- */
function buildFrost() {
  const m = makeMap('frost', 'Frostbound Mountains', 'The wind keeps its old vows', 120, 96, {
    music: 'frost', ambient: 'snow', darkness: 0.1, lightTint: '#bcd8e8', lightGlow: 'rgba(210,235,255,.06)', weather: 'snow', spawn: { x: 3, y: 52 },
    boss: 'frostwarden',
  });
  fillRect(m, 0, 0, m.w, m.h, T.SNOW);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const n = hash2(x, y, 91);
    if (n < 0.14) setT(m, x, y, T.SNOWROCK);
    else if (n > 0.9) setT(m, x, y, T.ICE);
  }
  // frozen lake
  organicCircle(m, 40, 74, 15, 9, T.ICE, 92);
  organicCircle(m, 40, 74, 10, 6, T.ICE, 93);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (tileAt(m, x, y) === T.ICE && hash2(x, y, 94) < 0.15) setT(m, x, y, T.WATER);
  }
  // paths
  carvePath(m, [[2, 52], [18, 52], [30, 48], [44, 42], [56, 36], [68, 32], [80, 28], [90, 24]], 1.8, T.SNOWPATH, null);
  carvePath(m, [[30, 48], [30, 60], [42, 64]], 1.2, T.SNOWPATH);
  carvePath(m, [[90, 24], [100, 32], [104, 48], [98, 62], [106, 70]], 1.2, T.SNOWPATH);
  // hermit hut
  markClear(m, 20, 40, 16, 14);
  addBuilding(m, BUILDINGS.frost(96, 96, 81), 28, 48);
  addProp(m, 'snowRock1', 20, 46, { solid: 8, blockR: 1 });
  addProp(m, 'snowRock0', 36, 45, { solid: 7, blockR: 1 });
  addProp(m, 'lampFrost', 24, 52, { solid: 2 });
  addNpc(m, 'ysra', 33, 51, { id: 'ysra', name: 'Ysra the Frostbound' });
  addInteract(m, { type: 'chest', id: 'fr_c1', x: 22 * 16, y: 43 * 16, rarity: 'rare' });
  addInteract(m, { type: 'lore', id: 'fr1', x: 34 * 16, y: 53 * 16, title: 'Wind-Carved Warning', text: 'Do not light the three fires for curiosity. Flame remembers what the cold forgives.' });
  // frozen cave
  markClear(m, 98, 64, 16, 14);
  addProp(m, 'snowRockBig0', 98, 68, { solid: 14, blockR: 1 });
  addProp(m, 'snowRockBig1', 110, 68, { solid: 14, blockR: 1 });
  addProp(m, 'snowRock0', 104, 62, { solid: 8, blockR: 1 });
  addInteract(m, { type: 'chest', id: 'fr_c2', x: 104 * 16, y: 70 * 16, rarity: 'epic' });
  addInteract(m, { type: 'crystal', id: 'fr_cr1', x: 102 * 16, y: 72 * 16 });
  addInteract(m, { type: 'crystal', id: 'fr_cr2', x: 108 * 16, y: 74 * 16 });
  addInteract(m, { type: 'lore', id: 'fr2', x: 107 * 16, y: 66 * 16, title: 'Frozen Journal', text: 'Third day. The lake sings at night. I have started answering it. It knows my mother\'s name.' });
  // summit courtyard
  const sx = 92, sy = 22;
  markClear(m, 78, 10, 28, 22);
  circle(m, sx, sy, 12, 10, T.SNOW);
  circle(m, sx, sy, 10, 8, T.ICE);
  circle(m, sx, 27, 12, 2, T.SNOWPATH);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
    const tx = Math.round(sx + Math.cos(a) * 11), ty = Math.round(sy + Math.sin(a) * 9);
    addProp(m, 'snowRock' + (a < 2 ? 'Big0' : '1'), tx, ty, { solid: 8, blockR: 0 });
  }
  addProp(m, 'monumentOff', sx, 15, { solid: 12, blockR: 2 });
  addInteract(m, { type: 'monument', id: 'frost', x: sx * 16, y: 12 * 16, sub: 'Peak Monument — third of three' });
  addInteract(m, { type: 'brazier', id: 'fr_b1', x: 83 * 16, y: 27 * 16 });
  addInteract(m, { type: 'brazier', id: 'fr_b2', x: 92 * 16, y: 29 * 16 });
  addInteract(m, { type: 'brazier', id: 'fr_b3', x: 101 * 16, y: 27 * 16 });
  addInteract(m, { type: 'runeGate', id: 'fr_gate', x: 92 * 16, y: 25 * 16, require: ['brazier:fr_b1', 'brazier:fr_b2', 'brazier:fr_b3'] });
  // gate visuals (rock slabs)
  addProp(m, 'snowRockBig0', 87, 25, { solid: 12, blockR: 0 });
  addProp(m, 'snowRockBig1', 97, 25, { solid: 12, blockR: 0 });
  // shrine altar stands
  addInteract(m, { type: 'lore', id: 'fr3', x: 84 * 16, y: 34 * 16, title: 'Cliffside Prayer', text: 'The mountain was not always cold. Once, these peaks caught the echoes and sang them back as green things. Now the echoes fall as snow.' });
  addInteract(m, { type: 'chest', id: 'fr_c3', x: 104 * 16, y: 16 * 16, rarity: 'legendary' });
  // bones and dead trees
  addProp(m, 'bonesSword', 56, 32, { blockR: 0 });
  addProp(m, 'deadTree0', 52, 40, { solid: 4, blockR: 1 });
  addProp(m, 'deadTree1', 12, 66, { solid: 4, blockR: 1 });
  addProp(m, 'bones', 70, 46, { blockR: 0 });
  addInteract(m, { type: 'sign', id: 'fr_sign', x: 34 * 16, y: 47 * 16, text: 'Summit — north-east.  The three fires must burn together.  (The hermit watches.)' });
  // enemies
  const es = [
    ['wolf', 22, 62], ['wolf', 36, 56], ['wolf', 48, 48], ['revenant', 56, 34], ['wolf', 66, 44],
    ['revenant', 74, 36], ['wolf', 82, 38], ['wisp', 98, 52], ['wolf', 96, 44], ['revenant', 106, 58],
    ['wolf', 14, 34], ['revenant', 44, 66], ['wisp', 58, 62], ['wolf', 72, 60], ['revenant', 88, 56],
    ['wolf', 112, 34], ['wisp', 68, 22], ['wolf', 34, 30], ['revenant', 118, 80],
  ];
  for (const [type, tx, ty] of es) m.enemies.push({ type, x: tx * 16, y: ty * 16 });
  // frost guardian (elite boss-like revenant) at summit
  m.enemies.push({ type: 'revenant', x: 92 * 16, y: 20 * 16, elite: true, boss: 'frostwarden', home: { x: 92 * 16, y: 20 * 16 }, guardian: true });
  m.arena = { x: 92 * 16, y: 20 * 16, r: 10.5 * 16, boss: 'frostwarden', trigger: 12 * 16, flag: 'boss:frostwarden' };
  addPortal(m, { x: 0, y: 50 * 16, w: 1.5 * 16, h: 6 * 16 }, 'sanctuary', { x: 63, y: 28 }, { label: 'Central Sanctuary' });
  // decor
  scatterDecor(m, { x0: 2, y0: 2, x1: 117, y1: 93, kinds: ['snowFern', 'snowBush0'], density: 0.02, seed: 96 });
  scatter(m, { x0: 2, y0: 2, x1: 118, y1: 94, kinds: ['snowpine', 'snowpine', 'snowRock', 'snowRockBig'], density: [0.045, 0.03], solidR: 5, seed: 97, blockR: 1 });
  scatter(m, { x0: 2, y0: 2, x1: 118, y1: 94, kinds: ['rock', 'snowRock'], density: 0.02, solidR: 4, seed: 98, blockR: 1 });
  finalize(m);
  return m;
}

/* ---------------- map 5: depths ---------------- */
function buildDepths() {
  const m = makeMap('depths', 'The Sunken Depths', 'Beneath the world, something sings', 120, 100, {
    music: 'depths', ambient: 'cave', darkness: 0.72, lightTint: '#6f9fc8', lightGlow: 'rgba(110,230,220,.1)', weather: 'motes', spawn: { x: 60, y: 5 },
    boss: 'chorus',
  });
  fillRect(m, 0, 0, m.w, m.h, T.CAVEWALL);
  // carve large cavern system
  organicCircle(m, 60, 50, 33, 27, T.CAVE, 101);
  organicCircle(m, 60, 30, 24, 19, T.CAVE, 102);
  organicCircle(m, 28, 66, 19, 15, T.CAVE, 103);
  organicCircle(m, 92, 66, 19, 15, T.CAVE, 104);
  organicCircle(m, 60, 84, 22, 14, T.CAVE, 105);
  carvePath(m, [[60, 4], [60, 20], [56, 30], [60, 40]], 3, T.CAVE);
  carvePath(m, [[60, 40], [44, 46], [30, 58], [28, 66]], 3, T.CAVE);
  carvePath(m, [[60, 40], [78, 46], [92, 58], [92, 66]], 3, T.CAVE);
  carvePath(m, [[60, 40], [60, 68], [60, 82]], 3, T.CAVE);
  // crystal floor patches
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (tileAt(m, x, y) === T.CAVE && hash2(x, y, 106) < 0.1) setT(m, x, y, T.CRYSTAL_FLOOR);
  }
  // underground lake south-west
  organicCircle(m, 27, 82, 15, 8, T.WATER, 107);
  circle(m, 27, 82, 10, 5, T.DEEP);
  bridge(m, 20, 76, 5, 14);
  bridge(m, 30, 76, 5, 14);
  // central ruins
  circle(m, 60, 50, 12, 9, T.BRICK);
  circle(m, 60, 50, 11, 8, T.MOSS);
  circle(m, 60, 50, 6, 5, T.BRICK);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const tx = Math.round(60 + Math.cos(a) * 12), ty = Math.round(50 + Math.sin(a) * 9);
    if (free(m, tx, ty, 0)) addProp(m, 'pillar' + (a < 3 ? 0 : 1), tx, ty, { solid: 5, blockR: 0 });
  }
  addProp(m, 'statueGuardian', 60, 43, { solid: 9, blockR: 1 });
  // rune chambers
  addInteract(m, { type: 'rune', id: 'dp_r1', x: 28 * 16, y: 64 * 16 });
  addInteract(m, { type: 'rune', id: 'dp_r2', x: 92 * 16, y: 64 * 16 });
  addInteract(m, { type: 'rune', id: 'dp_r3', x: 60 * 16, y: 34 * 16 });
  // gate + boss arena
  addInteract(m, { type: 'runeGate', id: 'dp_gate', x: 60 * 16, y: 68 * 16, require: ['rune:dp_r1', 'rune:dp_r2', 'rune:dp_r3'] });
  addProp(m, 'wall0', 55, 68, { solid: 12, blockR: 0 });
  addProp(m, 'wall1', 65, 68, { solid: 12, blockR: 0 });
  circle(m, 60, 84, 13, 10, T.CRYSTAL_FLOOR);
  circle(m, 60, 84, 11, 8, T.BRICK);
  circle(m, 60, 84, 9, 6, T.CRYSTAL_FLOOR);
  addInteract(m, { type: 'altar', id: 'dp_altar', x: 60 * 16, y: 90 * 16 });
  addInteract(m, { type: 'monument', id: 'depths', x: 60 * 16, y: 76 * 16, sub: 'The Heart of the Echo' });
  // crystal clusters
  for (const [tx, ty] of [[40, 30], [78, 32], [18, 52], [100, 50], [46, 78], [74, 78], [34, 44], [86, 44], [108, 70], [12, 74], [60, 24]]) {
    addProp(m, 'crystalBig' + (tx % 2), tx, ty, { solid: 8, blockR: 1 });
    addInteract(m, { type: 'crystal', id: 'dp_cr_' + tx, x: tx * 16, y: (ty + 1) * 16 });
  }
  // mushrooms
  scatterDecor(m, { x0: 4, y0: 4, x1: 115, y1: 95, kinds: ['glowMushroom0', 'glowMushroom1', 'glowMushroom0', 'mushroom0'], density: 0.05, seed: 108 });
  // chests & lore
  addInteract(m, { type: 'chest', id: 'dp_c1', x: 18 * 16, y: 56 * 16, rarity: 'epic' });
  addInteract(m, { type: 'chest', id: 'dp_c2', x: 102 * 16, y: 72 * 16, rarity: 'rare' });
  addInteract(m, { type: 'chest', id: 'dp_c3', x: 40 * 16, y: 82 * 16, rarity: 'legendary' });
  addInteract(m, { type: 'lore', id: 'dp1', x: 50 * 16, y: 44 * 16, title: 'Chiseled Below', text: 'The first Aetherians did not build on the surface. They built down, where the world\'s pulse was loudest. We mistook the echo for a voice of god.' });
  addInteract(m, { type: 'lore', id: 'dp2', x: 94 * 16, y: 62 * 16, title: 'Rune Tablet', text: 'Three notes hold the deep door: root, crown, frost. Strike them together and the Chorus will wake. Strike them apart and it will only dream.' });
  addInteract(m, { type: 'lore', id: 'dp3', x: 30 * 16, y: 88 * 16, title: 'Last Words of a Delver', text: 'We thought it was singing to us. It was singing us. Every one of us has a verse. Mine is almost finished.' });
  addInteract(m, { type: 'sign', id: 'dp_sign', x: 62 * 16, y: 12 * 16, text: 'The three runes are scattered through the caverns. The Chorus waits below.' });
  // enemies
  const es = [
    ['crawler', 44, 26], ['crawler', 74, 28], ['wisp', 52, 38], ['crawler', 36, 52],
    ['revenant', 18, 60], ['crawler', 24, 72], ['wisp', 32, 78], ['crawler', 82, 52],
    ['revenant', 100, 58], ['wisp', 92, 74], ['crawler', 108, 70], ['wisp', 78, 40],
    ['crawler', 56, 60], ['wisp', 66, 58], ['revenant', 44, 84], ['crawler', 76, 86],
    ['wisp', 60, 72], ['crawler', 12, 44], ['revenant', 112, 46],
  ];
  for (const [type, tx, ty] of es) m.enemies.push({ type, x: tx * 16, y: ty * 16 });
  m.enemies.push({ type: 'chorus', x: 60 * 16, y: 84 * 16, boss: 'chorus', home: { x: 60 * 16, y: 84 * 16 } });
  m.arena = { x: 60 * 16, y: 84 * 16, r: 12 * 16, boss: 'chorus', trigger: 13 * 16, flag: 'boss:chorus' };
  // portal back up
  addPortal(m, { x: 57 * 16, y: 2 * 16, w: 6 * 16, h: 2 * 16 }, 'sanctuary', { x: 26, y: 26 }, { label: 'Sanctuary Well' });
  finalize(m);
  return m;
}

/* ---------------- collision queries ---------------- */
export function collidesStatic(m, x, y, r = 5) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const nx = tx + ox, ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) return true;
    if (m.solid[ny * m.w + nx]) return true;
  }
  const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
  for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
    const k = gx + ',' + gy;
    const cs = m.gridCircles.get(k);
    if (cs) for (const c of cs) {
      const dx = x - c.x, dy = y - c.y;
      if (dx * dx + dy * dy < (c.r + r) * (c.r + r)) return true;
    }
    const rs = m.gridRects.get(k);
    if (rs) for (const c of rs) {
      if (x + r > c.x && x - r < c.x + c.w && y + r * 0.5 > c.y && y - r * 0.5 < c.y + c.h) return true;
    }
  }
  return false;
}

export function tileInfoAt(m, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return { t: tileAt(m, tx, ty), tx, ty };
}

export function isWaterAt(m, x, y) {
  return WATER_TILES.has(tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)));
}

/* ---------------- world assembly ---------------- */
export const MAP_BUILDERS = {
  sanctuary: buildSanctuary,
  greenfall: buildGreenfall,
  kingdom: buildKingdom,
  frost: buildFrost,
  depths: buildDepths,
};

export const world = { maps: {}, playerMap: 'sanctuary' };

export function getMap(id) {
  if (!world.maps[id]) world.maps[id] = MAP_BUILDERS[id]();
  return world.maps[id];
}

export function regionInfo(id) {
  return REGIONS.find(r => r.id === id);
}
