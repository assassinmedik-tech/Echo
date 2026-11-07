/* ============================================================
   ECHOES OF THE FALLEN — procedural characters, creatures & FX
   ============================================================ */
import { cv, rng, blob, rect, px, line, trap, PAL, makePortrait } from './art.js';

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export const OUTFITS = [
  { id: 'wanderer', name: 'Wanderer', cloak: '#2f6f6a', cloakDark: '#1c4744', cloakLight: '#4a938a', tunic: '#2a3238', tunicLight: '#414d50', trim: '#c9a45c', hair: '#3a3029', hairLight: '#57473a', skin: '#e2b58d', skinShade: '#c4946c', boots: '#3a2d22', accent: '#7fe3d2' },
  { id: 'ember', name: 'Ember', cloak: '#8a4433', cloakDark: '#5f2c22', cloakLight: '#b56748', tunic: '#332a2a', tunicLight: '#4a3c39', trim: '#e0a85e', hair: '#4a2c22', hairLight: '#6b4432', skin: '#dba47c', skinShade: '#b9815c', boots: '#3d2a1e', accent: '#ffb072' },
  { id: 'frost', name: 'Frost', cloak: '#3f6685', cloakDark: '#28445c', cloakLight: '#6a99b8', tunic: '#2b3540', tunicLight: '#445362', trim: '#cfe4ef', hair: '#c9d8e0', hairLight: '#e8f3f8', skin: '#e7c3a4', skinShade: '#c9a07c', boots: '#31404d', accent: '#a8e8ff' },
  { id: 'royal', name: 'Royal', cloak: '#544070', cloakDark: '#362849', cloakLight: '#7c62a0', tunic: '#2c2632', tunicLight: '#463d50', trim: '#e0c477', hair: '#241d2a', hairLight: '#3d3348', skin: '#d9a880', skinShade: '#b9855f', boots: '#332838', accent: '#c8a6ff' },
  { id: 'moss', name: 'Mosscloak', cloak: '#41643a', cloakDark: '#2b4527', cloakLight: '#608a52', tunic: '#3a3326', tunicLight: '#524a36', trim: '#b9a066', hair: '#5a3e28', hairLight: '#7a5838', skin: '#d7a67f', skinShade: '#b4825a', boots: '#3b2e20', accent: '#b8d98a' },
  { id: 'ivory', name: 'Ivory', cloak: '#b9ae94', cloakDark: '#8d8268', cloakLight: '#dcd3ba', tunic: '#45403a', tunicLight: '#5e574c', trim: '#d8b774', hair: '#d6c7a6', hairLight: '#efe6cf', skin: '#e3b791', skinShade: '#c4966f', boots: '#4a4032', accent: '#ffe6a8' },
];

export const ACCESSORIES = [
  { id: 'hood', name: 'Wayfarer Hood' },
  { id: 'scarf', name: 'Echo Scarf' },
  { id: 'circlet', name: 'Monument Circlet' },
  { id: 'none', name: 'Bare' },
];

/* ---------------- player ---------------- */
function drawPlayerFrame(o, dir, state, f) {
  const c = cv(44, 46), x = c.getContext('2d');
  const P = o.outfit;
  const cx = 22, foot = 41;
  const isSide = dir === 'side';
  const isUp = dir === 'up';
  let bob = 0, legA = 0, legB = 0, armA = 0, armB = 0, lean = 0, crouch = 0;
  const ph = (f / 6) * Math.PI * 2;

  if (state === 'idle') {
    bob = [0, -1, 0, 0][f] || 0;
    armA = [0, 1, 0, -1][f] || 0;
  } else if (state === 'walk' || state === 'run') {
    const amp = state === 'run' ? 1.5 : 1;
    bob = Math.abs(Math.sin(ph)) * -1;
    legA = Math.sin(ph) * 2.4 * amp;
    legB = -Math.sin(ph) * 2.4 * amp;
    armA = -Math.sin(ph) * 1.6 * amp;
    armB = Math.sin(ph) * 1.6 * amp;
    lean = state === 'run' ? 1 : 0;
  } else if (state === 'attack') {
    lean = [ -1, 2, 2, 0 ][f] || 0;
    armA = [ -2, 6, 5, 1 ][f] || 0;
    legA = f > 0 ? 2 : -1;
    legB = f > 0 ? -2 : 1;
  } else if (state === 'cast') {
    lean = -1;
    armA = -4 - f; armB = 4 + f;
    bob = [0, -1, -1, 0][f] || 0;
  } else if (state === 'block') {
    lean = 1; crouch = 1;
  } else if (state === 'hurt') {
    lean = -2;
  } else if (state === 'dodge') {
    crouch = 4; bob = 2;
  }

  const by = foot + bob + crouch;
  const topY = by - 34;

  // ground glow / rune aura (accent)
  if (state === 'cast') {
    const g = x.createRadialGradient(cx, by - 14, 1, cx, by - 14, 18);
    g.addColorStop(0, 'rgba(127,227,210,.16)');
    g.addColorStop(1, 'transparent');
    x.fillStyle = g; x.fillRect(0, 0, 44, 46);
  }

  if (state === 'dodge') {
    // rolling ball of cloak
    const r = rng(f * 91 + 7);
    blob(x, cx, by - 10, 11, 9, P.cloakDark);
    blob(x, cx - 1, by - 11, 10, 8, P.cloak);
    blob(x, cx - 3, by - 13, 6, 5, P.cloakLight);
    for (let i = 0; i < 6; i++) px(x, cx - 8 + r() * 16, by - 16 + r() * 10, P.trim);
    // boot peeking
    rect(x, cx + 5, by - 8, 4, 3, P.boots);
    return c;
  }

  // cloak behind
  const sway = state === 'idle' ? Math.sin((f / 4) * Math.PI * 2) * 0.8 : Math.sin(ph) * 1.5;
  if (!isSide || dir === 'side') {
    if (isUp) {
      // large back cape
      x.fillStyle = P.cloakDark;
      for (let j = 0; j < 20; j++) {
        const w = 7 + j * 0.35 + sway * (j / 20);
        x.fillRect(Math.round(cx - w), Math.round(topY + 12 + j), Math.round(w * 2), 1);
      }
      x.fillStyle = P.cloak;
      for (let j = 0; j < 17; j++) {
        const w = 5.5 + j * 0.32;
        x.fillRect(Math.round(cx - w + 0.8), Math.round(topY + 13 + j), Math.round(w * 2), 1);
      }
      x.fillStyle = P.cloakLight;
      x.fillRect(cx - 1, topY + 19, 2, 10);
    } else {
      // side cape hanging back
      x.fillStyle = P.cloakDark;
      for (let j = 0; j < 17; j++) {
        const w = 5 + j * 0.25;
        x.fillRect(Math.round(cx - w + 1), Math.round(topY + 13 + j), Math.round(w * 2), 1);
      }
      x.fillStyle = P.cloak;
      for (let j = 0; j < 14; j++) {
        const w = 3.5 + j * 0.22;
        x.fillRect(Math.round(cx - w + 1.5), Math.round(topY + 14 + j), Math.round(w * 2), 1);
      }
    }
  }

  // legs
  const legY = by - 10;
  const lx = isSide ? cx - 1 : cx - 4;
  const rx = isSide ? cx + 1 : cx + 1;
  // back leg
  rect(x, lx + (isSide ? -2 : 0), legY, 3, 8 + Math.abs(legB) * 0.3, P.tunic);
  rect(x, lx + (isSide ? -2 : 0), legY + 6, 3, 3, P.boots);
  // front leg
  rect(x, rx + (isSide ? 2 : 0), legY + (isSide ? 0 : Math.abs(legA) * 0.5), 3, 8 + Math.abs(legA) * 0.3, P.tunicLight);
  rect(x, rx + (isSide ? 2 : 0), legY + 6 + (isSide ? 0 : Math.abs(legA) * 0.5), 3, 3, P.boots);
  if (!isSide) {
    px(x, cx - 4, by - 1, '#1a1512'); px(x, cx + 3, by - 1, '#1a1512');
  } else {
    px(x, cx + 5, by - 1, '#1a1512');
  }

  // torso
  const tw = isSide ? 9 : 11;
  const tx = Math.round(cx - tw / 2 + lean);
  rect(x, tx, topY + 11, tw, 12, P.tunic);
  rect(x, tx, topY + 11, tw, 3, P.tunicLight);
  rect(x, tx, topY + 20, tw, 3, P.cloakDark);
  // belt
  rect(x, tx, topY + 20, tw, 2, P.trim);
  px(x, cx, topY + 20, '#fff0c8');
  // tunic trim
  if (!isUp) {
    rect(x, cx - 1 + lean, topY + 13, 1, 7, P.trim);
  }
  // scarf accessory
  if (o.accessory === 'scarf') {
    rect(x, tx - 1, topY + 11, tw + 2, 3, P.accent);
    if (!isUp) {
      for (let i = 0; i < 8; i++) {
        px(x, tx - 2 - i * (isSide ? -1 : 0.3), topY + 14 + i, i > 4 ? P.cloakLight : P.accent);
      }
    }
    rect(x, tx + tw - 2, topY + 13, 2, 6, P.accent);
  }

  // arms
  const ay = topY + 13;
  if (state === 'cast') {
    // raised arms
    line(x, cx - 6, ay, cx - 8, ay - 7, P.tunicLight);
    line(x, cx + 6, ay, cx + 8, ay - 7, P.tunicLight);
    blob(x, cx - 8, ay - 8, 2, 2, P.accent);
    blob(x, cx + 8, ay - 8, 2, 2, P.accent);
    px(x, cx - 8, ay - 9, '#ffffff'); px(x, cx + 8, ay - 9, '#ffffff');
  } else if (state === 'attack') {
    // weapon arm forward
    const dirSign = isSide ? 1 : (dir === 'down' ? 0 : 0);
    line(x, cx + 4, ay, cx + 7 + armA, ay + 4, P.tunicLight);
    const hx = cx + 7 + armA, hy = ay + 4;
    blob(x, hx, hy, 2, 2, P.skin);
    // blade
    const tips = [[-1, -9], [9, -2], [8, 2], [1, 2]][f] || [8, 0];
    line(x, hx, hy, hx + tips[0], hy + tips[1], '#cfd8d4');
    line(x, hx, hy, hx + tips[0] - 1, hy + tips[1] + 1, '#8b9797');
    px(x, hx + tips[0], hy + tips[1], '#f5ffff');
  } else {
    // back arm
    rect(x, isSide ? cx - 7 : cx - 7, ay + armB, 2, 7, P.tunicLight);
    blob(x, isSide ? cx - 6 : cx - 6, ay + 7 + armB, 1.5, 1.5, P.skin);
    // front arm
    rect(x, isSide ? cx + 5 : cx + 5, ay + armA, 2, 7, P.tunic);
    blob(x, isSide ? cx + 6 : cx + 6, ay + 7 + armA, 1.5, 1.5, P.skin);
    // idle weapon held low
    line(x, cx + 6, ay + 6 + armA, cx + 9, ay + 12 + armA, '#aeb9b5');
    px(x, cx + 9, ay + 12 + armA, '#edf7f4');
  }

  if (state === 'block') {
    // shield
    const sx = cx + 7, sy = topY + 14;
    blob(x, sx, sy + 4, 4, 6, '#6a6150');
    blob(x, sx, sy + 4, 3, 5, '#8a7f66');
    blob(x, sx, sy + 4, 1, 3, '#c9a45c');
    rect(x, sx - 3, sy + 2, 7, 1, '#5a5344');
  }

  // head
  const headY = topY + 4;
  if (isUp) {
    blob(x, cx, headY + 3, 5, 5, P.hair);
    blob(x, cx - 1, headY + 2, 4, 4, P.hairLight);
    rect(x, cx - 5, headY + 5, 10, 4, P.hair);
    if (o.accessory === 'hood') {
      blob(x, cx, headY + 2, 7, 7, P.cloak);
      blob(x, cx, headY + 4, 5, 5, P.cloakDark);
    }
  } else {
    // face
    blob(x, cx + lean, headY + 3, 4.5, 5, P.skin);
    blob(x, cx + lean - 1, headY + 2, 3, 3, P.skinShade);
    // hair
    blob(x, cx + lean, headY, 5, 4, P.hair);
    rect(x, cx - 5 + lean, headY + 1, 10, 3, P.hair);
    if (!isUp) {
      rect(x, cx - 4 + lean, headY, 8, 1, P.hairLight);
      rect(x, cx - 5 + lean, headY + 1, 2, 4, P.hair);
      if (isSide) rect(x, cx + 3 + lean, headY + 1, 2, 2, P.hairLight);
    }
    // eyes
    if (state === 'hurt') {
      px(x, cx - 2 + lean, headY + 3, '#4a3428'); px(x, cx + 2 + lean, headY + 3, '#4a3428');
    } else if (isSide) {
      px(x, cx + 2 + lean, headY + 3, '#181410');
      px(x, cx + 3 + lean, headY + 3, '#f0e2c0');
    } else {
      px(x, cx - 2 + lean, headY + 3, '#181410'); px(x, cx + 2 + lean, headY + 3, '#181410');
      px(x, cx - 2 + lean, headY + 2, '#2e2620'); px(x, cx + 2 + lean, headY + 2, '#2e2620');
    }
    // mouth hint
    if (state === 'cast' || state === 'attack') px(x, cx + lean, headY + 6, '#8a5a4a');
    // scarf/neck
    rect(x, cx - 3 + lean, headY + 7, 6, 2, o.accessory === 'scarf' ? P.accent : P.cloakDark);
    if (o.accessory === 'hood') {
      blob(x, cx + lean, headY, 7, 7, P.cloak);
      // cut face hole
      x.globalCompositeOperation = 'destination-out';
      blob(x, cx + lean, headY + 3, 4, 4.5, '#000');
      x.globalCompositeOperation = 'source-over';
      // redraw face inside hood
      blob(x, cx + lean, headY + 3, 4, 4.5, P.skinShade);
      blob(x, cx + lean, headY + 3, 3, 3, P.skin);
      px(x, cx - 2 + lean, headY + 3, '#181410'); px(x, cx + 2 + lean, headY + 3, '#181410');
      rect(x, cx - 4 + lean, headY, 8, 2, P.hair);
      rect(x, cx - 4 + lean, headY + 1, 8, 1, P.hairLight);
    }
    if (o.accessory === 'circlet') {
      rect(x, cx - 4 + lean, headY, 8, 1, '#d8b774');
      px(x, cx + lean, headY - 1, P.accent);
      px(x, cx - 2 + lean, headY - 1, '#f2dca6'); px(x, cx + 2 + lean, headY - 1, '#f2dca6');
    }
  }
  // pauldron accent
  if (o.accessory === 'circlet' || o.accessory === 'hood') {
    rect(x, tx - 1, topY + 11, 3, 3, P.trim);
    rect(x, tx + tw - 2, topY + 11, 3, 3, P.trim);
  }
  return c;
}

export const playerSkinCache = new Map();

export function getPlayerFrame(outfitIdx, accessory, dir, state, frame) {
  const key = `p:${outfitIdx}:${accessory}:${dir}:${state}:${frame}`;
  return cached(key, () => drawPlayerFrame({ outfit: OUTFITS[outfitIdx % OUTFITS.length], accessory }, dir, state, frame));
}

export const PLAYER_ANIM = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 6, fps: 11, loop: true },
  run: { frames: 6, fps: 14, loop: true },
  attack: { frames: 4, fps: 16, loop: false },
  cast: { frames: 4, fps: 12, loop: false },
  dodge: { frames: 3, fps: 16, loop: false },
  block: { frames: 1, fps: 1, loop: true },
  hurt: { frames: 1, fps: 1, loop: false },
};

/* ---------------- NPCs ---------------- */
const NPC_DEFS = {
  maelin: { outfit: { cloak: '#3a4a5c', cloakDark: '#26333f', cloakLight: '#526880', tunic: '#3c3a36', tunicLight: '#55524a', trim: '#c9a45c', hair: '#d8d2c2', hairLight: '#f0ece0', skin: '#d8b08c', skinShade: '#b98f6c', boots: '#3b332a', accent: '#7fe3d2' }, accessory: 'hood', beard: true, staff: true, scale: 1, accent: '#6fd9c8' },
  brann: { outfit: { cloak: '#5a4530', cloakDark: '#3d2f20', cloakLight: '#7a5e40', tunic: '#5c4a38', tunicLight: '#7a634b', trim: '#8a7a5a', hair: '#5a3f28', hairLight: '#7a5838', skin: '#d7a67f', skinShade: '#b4825a', boots: '#33261a', accent: '#e0a85e' }, accessory: 'none', beard: true, hammer: true, scale: 1.12, accent: '#e0a85e' },
  sera: { outfit: { cloak: '#3f6a4a', cloakDark: '#2a4a32', cloakLight: '#5c8c64', tunic: '#4a5a3e', tunicLight: '#63754f', trim: '#c8b884', hair: '#6b4a2e', hairLight: '#8a633f', skin: '#e0b48f', skinShade: '#c4946c', boots: '#3a2e20', accent: '#a8e0b0' }, accessory: 'scarf', scale: 0.97, accent: '#9fe0b0', basket: true },
  ilse: { outfit: { cloak: '#4a4158', cloakDark: '#332c40', cloakLight: '#675a7a', tunic: '#3c3844', tunicLight: '#554f60', trim: '#b8a878', hair: '#9a9a9a', hairLight: '#c4c4c4', skin: '#d7ae8c', skinShade: '#b98f6c', boots: '#332c30', accent: '#b8a6e0' }, accessory: 'none', scale: 0.99, accent: '#b8a6e0' },
  pip: { outfit: { cloak: '#8a6a3a', cloakDark: '#5f4728', cloakLight: '#b08a50', tunic: '#5a4a3a', tunicLight: '#75624c', trim: '#e0c477', hair: '#6b4a2e', hairLight: '#8a633f', skin: '#e2b58d', skinShade: '#c4946c', boots: '#3a2d22', accent: '#ffcf7a' }, accessory: 'scarf', scale: 0.72, accent: '#ffcf7a' },
  garrick: { outfit: { cloak: '#6e3d3d', cloakDark: '#4c2828', cloakLight: '#8f5550', tunic: '#5a5e5c', tunicLight: '#737872', trim: '#c9a45c', hair: '#4a3a2a', hairLight: '#6a5540', skin: '#d7a67f', skinShade: '#b4825a', boots: '#3a332a', accent: '#d8b774' }, accessory: 'circlet', scale: 1.08, accent: '#d8b774', sword: true },
  mira: { outfit: { cloak: '#7a5a45', cloakDark: '#55402f', cloakLight: '#9c785c', tunic: '#6a5540', tunicLight: '#87705a', trim: '#c8b884', hair: '#7a4a2e', hairLight: '#a06a42', skin: '#e2b58d', skinShade: '#c4946c', boots: '#3a2d22', accent: '#e0b080' }, accessory: 'none', scale: 0.94, accent: '#e0b080', ponytail: true },
  rook: { outfit: { cloak: '#3a5c40', cloakDark: '#263f2c', cloakLight: '#547a58', tunic: '#3a4034', tunicLight: '#525a48', trim: '#9a8a5a', hair: '#3a2e24', hairLight: '#5a4634', skin: '#d7a67f', skinShade: '#b4825a', boots: '#332a1e', accent: '#a8d98a' }, accessory: 'hood', scale: 1.02, accent: '#a8d98a', bow: true },
  vela: { outfit: { cloak: '#5a4a70', cloakDark: '#3e3350', cloakLight: '#7a6494', tunic: '#454058', tunicLight: '#5e5872', trim: '#c9a45c', hair: '#3a2e3a', hairLight: '#5a4858', skin: '#d7ae8c', skinShade: '#b98f6c', boots: '#302a36', accent: '#c8a6ff' }, accessory: 'none', scale: 0.95, accent: '#c8a6ff', glasses: true },
  ysra: { outfit: { cloak: '#6a7a8a', cloakDark: '#4a5866', cloakLight: '#8fa4b4', tunic: '#4a5560', tunicLight: '#66727e', trim: '#cfe4ef', hair: '#e0e8ee', hairLight: '#ffffff', skin: '#d8b08c', skinShade: '#b98f6c', boots: '#3a424a', accent: '#a8e8ff' }, accessory: 'hood', scale: 0.92, accent: '#a8e8ff', staff: true },
  orin: { outfit: { cloak: '#4a5a3a', cloakDark: '#323f28', cloakLight: '#6a7c52', tunic: '#3a4030', tunicLight: '#535a42', trim: '#a89a6a', hair: '#7a7a6a', hairLight: '#9a9a88', skin: '#d7ae8c', skinShade: '#b98f6c', boots: '#332e22', accent: '#c8d98a' }, accessory: 'hood', scale: 0.96, accent: '#c8d98a', staff: true, beard: true },
};

function drawNPC(def, f = 0) {
  const P = def.outfit;
  const c = cv(48, 50), x = c.getContext('2d');
  const cx = 24, foot = 45;
  const bob = Math.sin((f / 2) * Math.PI) * 0.7;
  const topY = foot - 34 + bob;
  // robe / body
  const isRobe = !!def.staff;
  const cape = def.accessory !== 'none' && def.accessory === 'hood';
  // shadow included at runtime
  // legs
  if (!isRobe) {
    rect(x, cx - 4, foot - 9, 3, 8, P.tunic);
    rect(x, cx + 1, foot - 9, 3, 8, P.tunicLight);
    rect(x, cx - 4, foot - 2, 3, 2, P.boots);
    rect(x, cx + 1, foot - 2, 3, 2, P.boots);
  } else {
    trap(x, cx, topY + 20, topY, 9, 16, 20 + (foot - topY - 20), P.tunic);
    rect(x, cx - 7, foot - 2, 14, 2, P.cloakDark);
  }
  // cloak
  x.fillStyle = P.cloakDark;
  for (let j = 0; j < 20; j++) {
    const w = 6 + j * 0.28;
    x.fillRect(Math.round(cx - w), Math.round(topY + 12 + j), Math.round(w * 2), 1);
  }
  x.fillStyle = P.cloak;
  for (let j = 0; j < 16; j++) {
    const w = 4.5 + j * 0.25;
    x.fillRect(Math.round(cx - w), Math.round(topY + 13 + j), Math.round(w * 2), 1);
  }
  // torso
  rect(x, cx - 5, topY + 11, 10, 12, P.tunic);
  rect(x, cx - 5, topY + 11, 10, 3, P.tunicLight);
  rect(x, cx - 5, topY + 20, 10, 2, P.trim);
  // arms
  rect(x, cx - 8, topY + 13, 2, 9, P.tunicLight);
  rect(x, cx + 6, topY + 13, 2, 9, P.tunic);
  blob(x, cx - 7, topY + 22, 2, 2, P.skin);
  blob(x, cx + 7, topY + 22, 2, 2, P.skin);
  // head
  const hy = topY + 3;
  blob(x, cx, hy + 3, 5, 5, P.skin);
  blob(x, cx - 1, hy + 2, 3, 3, P.skinShade);
  blob(x, cx, hy, 5, 4, P.hair);
  rect(x, cx - 5, hy + 1, 10, 3, P.hair);
  rect(x, cx - 4, hy, 8, 1, P.hairLight);
  px(x, cx - 2, hy + 3, '#1b1712'); px(x, cx + 2, hy + 3, '#1b1712');
  px(x, cx - 2, hy + 4, '#e8e0d0'); px(x, cx + 2, hy + 4, '#e8e0d0');
  if (def.beard) {
    blob(x, cx, hy + 7, 4, 4, P.hairLight);
    rect(x, cx - 3, hy + 8, 6, 5, P.hair);
    px(x, cx - 2, hy + 8, '#f2ede2'); px(x, cx + 1, hy + 8, '#f2ede2');
  }
  if (def.glasses) {
    rect(x, cx - 4, hy + 3, 8, 1, '#b8a888');
  }
  if (def.ponytail) {
    rect(x, cx + 4, hy + 1, 2, 8, P.hair);
    px(x, cx + 5, hy + 8, P.hairLight);
  }
  if (cape) {
    blob(x, cx, hy + 1, 7, 7, P.cloak);
    x.globalCompositeOperation = 'destination-out';
    blob(x, cx, hy + 4, 4, 4.5, '#000');
    x.globalCompositeOperation = 'source-over';
    blob(x, cx, hy + 4, 4, 4, P.skinShade);
    blob(x, cx, hy + 4, 3, 3, P.skin);
    px(x, cx - 2, hy + 3, '#1b1712'); px(x, cx + 2, hy + 3, '#1b1712');
    rect(x, cx - 4, hy, 8, 2, P.hair);
    if (def.beard) rect(x, cx - 3, hy + 8, 6, 5, P.hair);
  }
  if (def.accessory === 'scarf') {
    rect(x, cx - 5, topY + 11, 10, 2, P.accent);
    rect(x, cx + 4, topY + 13, 2, 7, P.accent);
  }
  // held items
  if (def.staff) {
    line(x, cx + 8, foot, cx + 8, hy - 10, '#4a3a2a');
    px(x, cx + 8, hy - 10, '#5a4a34');
    blob(x, cx + 8, hy - 12, 3, 3, P.accent);
    blob(x, cx + 8, hy - 12, 1, 1, '#ffffff');
    px(x, cx + 7, hy - 13, P.accent);
  }
  if (def.hammer) {
    line(x, cx + 8, foot - 2, cx + 8, hy - 2, '#4a3a2a');
    rect(x, cx + 4, hy - 6, 9, 5, '#6a6a66');
    rect(x, cx + 4, hy - 6, 9, 1, '#8a8a84');
    rect(x, cx + 7, hy - 4, 3, 2, '#9a9a94');
  }
  if (def.sword) {
    line(x, cx - 9, foot - 4, cx - 9, hy - 4, '#4a3a2a');
    line(x, cx - 10, hy - 2, cx - 8, hy - 8, '#c9d2ce');
    px(x, cx - 9, hy - 9, '#f0fbf8');
  }
  if (def.bow) {
    line(x, cx + 9, foot - 2, cx + 12, foot - 14, '#5a4028');
    line(x, cx + 12, foot - 14, cx + 9, foot - 26, '#5a4028');
    line(x, cx + 10, foot - 24, cx + 10, foot - 4, '#cfc6ab');
  }
  if (def.basket) {
    blob(x, cx - 10, foot - 8, 4, 3, '#7a5e38');
    rect(x, cx - 14, foot - 9, 8, 4, '#8a6a40');
    px(x, cx - 12, foot - 9, '#a8e0b0'); px(x, cx - 9, foot - 9, '#e0a85e');
  }
  // tint / scale via draw at runtime
  return c;
}

export function getNPC(key, frame = 0) {
  const def = NPC_DEFS[key];
  if (!def) return cached('npc:fallback', () => drawNPC(NPC_DEFS.maelin, 0));
  return cached('npc:' + key + ':' + frame, () => drawNPC(def, frame));
}

export function getNPCDef(key) { return NPC_DEFS[key]; }

const portraitCache = new Map();
export function getPortrait(key) {
  if (!portraitCache.has(key)) {
    const def = NPC_DEFS[key];
    const sprite = getNPC(key, 0);
    portraitCache.set(key, makePortrait(sprite, def ? def.accent : '#6fd9c8'));
  }
  return portraitCache.get(key);
}
export function getPlayerPortrait(outfitIdx, accessory, accent = '#6fd9c8') {
  const k = 'pp:' + outfitIdx + ':' + accessory;
  if (!portraitCache.has(k)) {
    portraitCache.set(k, makePortrait(getPlayerFrame(outfitIdx, accessory, 'down', 'idle', 0), accent));
  }
  return portraitCache.get(k);
}

/* ---------------- enemies ---------------- */
const ENEMY_DRAW = {
  thornling(x, f, state, P) {
    const c = cv(34, 34), g = c.getContext('2d');
    const bob = state === 'walk' ? Math.abs(Math.sin((f / 4) * Math.PI * 2)) * -3 : [0, -1, 0, 0][f % 4] || 0;
    const by = 30 + bob;
    // root feet
    for (let i = -1; i <= 1; i += 2) {
      line(g, 17 + i * 4, by - 3, 17 + i * 6, by + 2, '#3a4a2a');
    }
    // body
    blob(g, 17, by - 8, 9, 8, '#2c4a2f');
    blob(g, 16, by - 9, 7, 6, '#3f6339');
    blob(g, 14, by - 11, 4, 3, '#5a8247');
    // leaf/thorn crown
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.9 + i * 0.45;
      line(g, 17, by - 14, 17 + Math.cos(ang) * 8, by - 14 + Math.sin(ang) * 8, i % 2 ? '#6a8f4a' : '#405f32');
      px(g, 17 + Math.cos(ang) * 9, by - 14 + Math.sin(ang) * 9, '#8aa85a');
    }
    // eyes
    if (state === 'windup' || state === 'attack' || state === 'chase') {
      blob(g, 14, by - 9, 2, 2, '#e8b04a'); blob(g, 20, by - 9, 2, 2, '#e8b04a');
      px(g, 14, by - 9, '#3a1a08'); px(g, 20, by - 9, '#3a1a08');
    } else {
      px(g, 14, by - 9, '#d8c060'); px(g, 20, by - 9, '#d8c060');
    }
    // mouth
    if (state === 'attack' || state === 'windup') {
      rect(g, 15, by - 5, 4, 3, '#1a0e08');
      px(g, 15, by - 5, '#e8e0c8'); px(g, 18, by - 5, '#e8e0c8');
    } else {
      px(g, 16, by - 5, '#1a0e08'); px(g, 17, by - 5, '#1a0e08');
    }
    // thorns on body
    for (let i = 0; i < 4; i++) px(g, 9 + i * 2, by - 14 + (i % 2), '#8a7a4a');
    return c;
  },
  wolf(x, f, state, P) {
    const c = cv(48, 34), g = c.getContext('2d');
    const running = state === 'walk' || state === 'chase' || state === 'run';
    const ph = (f / 6) * Math.PI * 2;
    const bob = running ? Math.abs(Math.sin(ph)) * -1.5 : 0;
    const by = 28 + bob;
    // shadow drawn at runtime
    // legs
    const legs = [[10, 0], [16, Math.PI], [30, Math.PI], [36, 0]];
    for (let i = 0; i < legs.length; i++) {
      const lx = legs[i][0];
      const off = running ? Math.sin(ph + legs[i][1] + (i > 1 ? Math.PI : 0)) * 3 : 0;
      rect(g, lx + off * 0.4, by - 8, 3, 9, '#2e2a28');
      rect(g, lx + off * 0.4, by - 1, 3, 2, '#1a1816');
    }
    // tail
    const tailWag = running ? Math.sin(ph) * 3 : Math.sin(f) * 1;
    line(g, 9, by - 15, 2, by - 20 + tailWag, '#33302c');
    line(g, 3, by - 21 + tailWag, 1, by - 17 + tailWag, '#4a443e');
    // body
    blob(g, 25, by - 12, 14, 7, '#32302b');
    blob(g, 24, by - 13, 12, 6, '#3e3c35');
    blob(g, 30, by - 16, 7, 4, '#4a4740');
    // fur tufts
    for (let i = 0; i < 8; i++) px(g, 14 + i * 2.5, by - 19 + (i % 2), i % 3 ? '#4a4740' : '#2a2824');
    // head
    const hx = 38;
    blob(g, hx, by - 16, 6, 5, '#35322d');
    blob(g, hx + 2, by - 16, 5, 4, '#43403a');
    // ears
    line(g, hx - 3, by - 21, hx - 2, by - 25, '#2e2b26');
    line(g, hx + 3, by - 21, hx + 4, by - 25, '#2e2b26');
    // snout
    rect(g, hx + 5, by - 16, 5, 4, '#3c3833');
    px(g, hx + 9, by - 15, '#1a1816');
    // eye
    const angry = state !== 'walk';
    px(g, hx + 2, by - 18, '#e0a03a');
    px(g, hx + 3, by - 18, '#ffd07a');
    // jaw
    if (state === 'attack' || state === 'windup') {
      const open = state === 'attack' ? 3 : 1;
      rect(g, hx + 4, by - 13, 6, 1 + open, '#1a0e0c');
      px(g, hx + 5, by - 13, '#e8e0c8'); px(g, hx + 7, by - 13, '#e8e0c8');
      px(g, hx + 9, by - 13 + open, '#e8e0c8');
    }
    // scar/red marks
    px(g, 26, by - 15, '#7a4038'); px(g, 28, by - 14, '#7a4038');
    return c;
  },
  knight(x, f, state, P) {
    const c = cv(40, 50), g = c.getContext('2d');
    const ph = (f / 4) * Math.PI * 2;
    const bob = state === 'walk' ? Math.abs(Math.sin(ph)) * -1 : 0;
    const by = 45 + bob;
    const top = by - 38;
    // cape
    g.fillStyle = '#41262c';
    for (let j = 0; j < 20; j++) g.fillRect(16 - Math.round(3 + j * 0.2), top + 10 + j, 12 + Math.round(j * 0.4), 1);
    // legs
    rect(g, 16, by - 10, 4, 9, '#3d4247');
    rect(g, 20, by - 10, 4, 9, '#4a5056');
    rect(g, 16, by - 2, 4, 2, '#26292c'); rect(g, 20, by - 2, 4, 2, '#26292c');
    // torso armor
    rect(g, 13, top + 11, 14, 14, '#4a5056');
    rect(g, 13, top + 11, 14, 3, '#5e666e');
    rect(g, 13, top + 17, 14, 1, '#363b40');
    rect(g, 18, top + 12, 4, 10, '#5a626a');
    // belt
    rect(g, 13, top + 23, 14, 2, '#2e2a26');
    px(g, 20, top + 23, '#b0904a');
    // pauldrons
    blob(g, 12, top + 13, 4, 4, '#5e666e');
    blob(g, 28, top + 13, 4, 4, '#5e666e');
    // head/helm
    blob(g, 20, top + 6, 6, 6, '#4a5056');
    rect(g, 14, top + 6, 12, 4, '#363b40');
    px(g, 17, top + 7, '#e07a5a'); px(g, 23, top + 7, '#e07a5a');
    rect(g, 19, top + 2, 2, 4, '#8a3a3a');
    rect(g, 14, top + 3, 12, 1, '#5e666e');
    // shield
    const dx = state === 'block' ? 3 : 7;
    blob(g, dx, top + 18, 5, 7, '#5a5244');
    blob(g, dx, top + 18, 4, 6, '#746a56');
    blob(g, dx, top + 18, 2, 3, '#b0904a');
    rect(g, dx - 4, top + 16, 9, 1, '#3f3a2e');
    // sword
    const raise = state === 'windup' ? -8 : state === 'attack' ? 8 : 2;
    line(g, 29, top + 20, 36, top + 8 + raise, '#b8c4c2');
    line(g, 29, top + 20, 37, top + 8 + raise, '#7a8a88');
    px(g, 36, top + 8 + raise, '#f0ffff');
    rect(g, 28, top + 19, 5, 2, '#8a7a4a');
    return c;
  },
  wisp(x, f, state, P) {
    const c = cv(36, 42), g = c.getContext('2d');
    const bob = Math.sin((f / 4) * Math.PI * 2) * 2;
    const cy = 20 + bob;
    // outer glow
    const grd = g.createRadialGradient(18, cy, 2, 18, cy, 17);
    grd.addColorStop(0, 'rgba(130,110,220,.25)'); grd.addColorStop(1, 'transparent');
    g.fillStyle = grd; g.fillRect(0, 0, 36, 42);
    // tattered cloak / tendrils
    for (let i = 0; i < 5; i++) {
      const w = 3 + i;
      g.fillStyle = i % 2 ? '#3a3358' : '#4c4372';
      for (let j = 0; j < 10 + i * 2; j++) {
        const yy = cy + 6 + j;
        g.fillRect(18 - w + Math.sin(j * 0.4 + i + f) * 1.5, yy, w * 2, 1);
      }
    }
    // body orb
    const bg = g.createRadialGradient(16, cy - 3, 1, 18, cy, 10);
    bg.addColorStop(0, '#e0d8ff'); bg.addColorStop(.45, '#8f7ade'); bg.addColorStop(1, '#3c3266');
    g.fillStyle = bg; blob(g, 18, cy, 8, 8, '#3c3266');
    g.fillStyle = bg; blob(g, 18, cy, 7, 7, '#5a4ca0');
    blob(g, 16, cy - 2, 4, 4, '#8f7ade');
    blob(g, 15, cy - 3, 2, 2, '#e8e2ff');
    // mask
    rect(g, 15, cy - 2, 7, 3, '#241f3a');
    px(g, 16, cy - 1, state === 'windup' || state === 'attack' ? '#ffcf6a' : '#a8e8ff');
    px(g, 20, cy - 1, state === 'windup' || state === 'attack' ? '#ffcf6a' : '#a8e8ff');
    // hands
    const handY = cy + 4;
    blob(g, 6, handY + 2, 2, 2, '#5a4ca0');
    blob(g, 30, handY + 2, 2, 2, '#5a4ca0');
    if (state === 'windup' || state === 'attack') {
      blob(g, 18, cy - 1, 4, 4, 'rgba(180,160,255,.25)');
    }
    return c;
  },
  crawler(x, f, state, P) {
    const c = cv(48, 34), g = c.getContext('2d');
    const ph = (f / 4) * Math.PI * 2;
    const by = 28;
    // legs
    for (let i = 0; i < 4; i++) {
      const lx = 10 + i * 7;
      const sgn = i % 2 ? 1 : -1;
      line(g, lx, by - 10, lx + sgn * 5, by - 2 + Math.sin(ph + i) * 1.5, '#2a3a44');
      line(g, lx + sgn * 5, by - 2 + Math.sin(ph + i) * 1.5, lx + sgn * 8, by, '#1e2a32');
    }
    // body
    blob(g, 24, by - 12, 14, 7, '#232d3a');
    blob(g, 23, by - 13, 12, 6, '#2f3f50');
    blob(g, 22, by - 15, 8, 3, '#3f5666');
    // crystal shards on back
    for (let i = 0; i < 4; i++) {
      const sx = 16 + i * 5;
      const hh = 5 + (i % 2) * 3;
      trap(g, sx, by - 17 - hh, by - 17, 1, 4, hh, '#63d7cc');
      px(g, sx, by - 17 - hh, '#b8fff2');
    }
    // head
    blob(g, 38, by - 11, 6, 5, '#2c3a46');
    px(g, 39, by - 12, '#7fe3dc'); px(g, 42, by - 12, '#7fe3dc');
    // glow
    blob(g, 24, by - 17, 10, 5, 'rgba(99,215,204,.10)');
    // mandibles
    line(g, 42, by - 9, 46, by - 6, '#5a7a80');
    line(g, 42, by - 8, 46, by - 10, '#5a7a80');
    return c;
  },
  revenant(x, f, state, P) {
    const c = cv(42, 52), g = c.getContext('2d');
    const ph = (f / 4) * Math.PI * 2;
    const bob = Math.sin(ph) * 1.5;
    const by = 47 + bob;
    const top = by - 38;
    // ghostly aura
    const grd = g.createRadialGradient(21, by - 18, 4, 21, by - 18, 22);
    grd.addColorStop(0, 'rgba(140,220,240,.13)'); grd.addColorStop(1, 'transparent');
    g.fillStyle = grd; g.fillRect(0, 0, 42, 52);
    // tattered lower
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? 'rgba(80,140,160,.75)' : 'rgba(60,110,130,.7)';
      for (let j = 0; j < 12; j++) {
        const w = 4 + i;
        g.fillRect(21 - w + Math.sin(j * 0.5 + i) * 1.5, top + 24 + j, w * 2, 1);
      }
    }
    // armor
    rect(g, 14, top + 12, 14, 14, '#3f5a66');
    rect(g, 14, top + 12, 14, 3, '#587686');
    rect(g, 20, top + 12, 2, 12, '#7a9aa8');
    rect(g, 13, top + 23, 16, 2, '#2c434c');
    // pauldrons + spikes
    blob(g, 12, top + 14, 4, 4, '#587686');
    blob(g, 30, top + 14, 4, 4, '#587686');
    line(g, 9, top + 12, 6, top + 7, '#a8d8e4');
    line(g, 33, top + 12, 36, top + 7, '#a8d8e4');
    // head
    blob(g, 21, top + 6, 5, 6, '#5a7886');
    rect(g, 16, top + 4, 10, 3, '#3f5a66');
    px(g, 18, top + 7, '#bff4ff'); px(g, 23, top + 7, '#bff4ff');
    // crown icicles
    for (let i = 0; i < 3; i++) {
      trap(g, 17 + i * 4, top - 1, top + 2, 1, 3, 4, '#a8d8e4');
    }
    // spear
    line(g, 32, by - 2, 34, top - 2, '#4a6a76');
    line(g, 33, top, 35, top - 10, '#cfeff8');
    px(g, 35, top - 11, '#ffffff');
    return c;
  },
  grove(x, f, state, P, phase) {
    const c = cv(104, 120), g = c.getContext('2d');
    const ph = (f / 4) * Math.PI * 2;
    const bob = Math.sin(ph) * 1.5;
    const by = 114 + bob;
    const rage = phase === 2;
    const bark = rage ? ['#3f2f26', '#54402f', '#2a1f19', '#6a5138'] : ['#3a3024', '#51412c', '#2a2118', '#66543a'];
    // shadow
    g.fillStyle = 'rgba(0,0,0,.3)';
    for (let j = -5; j <= 5; j++) g.fillRect(52 - Math.round(32 * Math.sqrt(1 - j * j / 25)), by + 2 + j, Math.round(64 * Math.sqrt(1 - j * j / 25)), 1);
    // roots
    for (let i = -1; i <= 1; i += 2) {
      line(g, 52, by - 8, 52 + i * 26, by + 1, bark[0]);
      line(g, 52, by - 6, 52 + i * 20, by + 4, bark[2]);
      line(g, 52 + i * 12, by - 4, 52 + i * 32, by + 2, bark[1]);
    }
    // legs
    trap(g, 40, by - 34, by, 10, 14, 34, bark[0]);
    trap(g, 64, by - 34, by, 10, 14, 34, bark[1]);
    // body
    trap(g, 52, by - 70, by - 20, 26, 38, 50, bark[0]);
    trap(g, 52, by - 70, by - 24, 16, 26, 46, bark[1]);
    // mossy chest
    blob(g, 48, by - 48, 16, 15, '#2b4a2e');
    blob(g, 46, by - 52, 12, 10, '#3f6339');
    // core
    const coreCol = rage ? ['#ff6a4a', '#ffd08a'] : ['#63e0c8', '#d8fff8'];
    const cg = g.createRadialGradient(52, by - 50, 1, 52, by - 50, 16);
    cg.addColorStop(0, coreCol[1]); cg.addColorStop(.35, coreCol[0]); cg.addColorStop(1, 'rgba(80,220,200,0)');
    g.fillStyle = cg; blob(g, 52, by - 50, 15, 13, 'rgba(0,0,0,0)');
    blob(g, 52, by - 50, 6, 6, coreCol[0]);
    blob(g, 51, by - 51, 3, 3, coreCol[1]);
    // arms
    const armY = by - 58;
    const swing = state === 'attack' ? (f % 2 ? 20 : -6) : state === 'windup' ? -12 : Math.sin(ph) * 3;
    line(g, 38, armY, 20, armY + 18 + swing, bark[0]);
    line(g, 38, armY, 18, armY + 20 + swing, bark[2]);
    line(g, 66, armY, 84, armY + 16 - swing, bark[1]);
    line(g, 66, armY, 86, armY + 18 - swing, bark[2]);
    // hands / claws
    for (let side = -1; side <= 1; side += 2) {
      const hx = 52 + side * 33, hy = armY + 18 + (side < 0 ? swing : -swing);
      blob(g, hx, hy, 6, 5, bark[1]);
      for (let i = 0; i < 3; i++) line(g, hx, hy, hx + side * 4, hy + 8 + i * 2, bark[2]);
    }
    // head
    blob(g, 52, by - 76, 13, 12, bark[1]);
    blob(g, 50, by - 78, 9, 8, bark[3]);
    // antlers
    for (let i = -1; i <= 1; i += 2) {
      line(g, 52 + i * 8, by - 85, 52 + i * 18, by - 100, bark[1]);
      line(g, 52 + i * 13, by - 93, 52 + i * 22, by - 95, bark[0]);
      line(g, 52 + i * 16, by - 98, 52 + i * 20, by - 106, bark[1]);
    }
    // face
    const ec = rage ? '#ffb04a' : '#9ff5e0';
    px(g, 47, by - 78, ec); px(g, 48, by - 78, ec);
    px(g, 56, by - 78, ec); px(g, 57, by - 78, ec);
    if (state === 'windup' || state === 'attack') {
      rect(g, 47, by - 71, 10, 5, '#1a120e');
      for (let i = 0; i < 4; i++) px(g, 48 + i * 2, by - 71, '#d8c8a8');
    }
    // moss highlights
    for (let i = 0; i < 20; i++) {
      const hx = 30 + (i * 37) % 46, hy = by - 80 + (i * 53) % 60;
      px(g, hx, hy, i % 3 ? '#3f6339' : '#5a8a4a');
    }
    // leaves
    if (rage) {
      for (let i = 0; i < 6; i++) px(g, 20 + i * 12, by - 95 + (i * 13) % 30, i % 2 ? '#8a3a2a' : '#b05a3a');
    }
    return c;
  },
  hollowking(x, f, state, P, phase) {
    const c = cv(76, 96), g = c.getContext('2d');
    const ph = (f / 4) * Math.PI * 2;
    const rage = phase === 2;
    const by = 92;
    const top = by - 74;
    // cape
    g.fillStyle = rage ? '#3a1d26' : '#2a2333';
    for (let j = 0; j < 40; j++) {
      const w = 14 + j * 0.55;
      g.fillRect(Math.round(38 - w + Math.sin(j * 0.12 + f) * 1.5), top + 12 + j, Math.round(w * 2), 1);
    }
    g.fillStyle = rage ? '#552a34' : '#3e3350';
    for (let j = 0; j < 34; j++) {
      const w = 8 + j * 0.45;
      g.fillRect(Math.round(38 - w), top + 14 + j, Math.round(w * 2), 1);
    }
    // legs
    rect(g, 32, by - 20, 6, 18, '#3a3a44');
    rect(g, 40, by - 20, 6, 18, '#474752');
    rect(g, 30, by - 3, 12, 3, '#26262e');
    rect(g, 42, by - 3, 10, 3, '#26262e');
    // torso
    rect(g, 27, top + 20, 22, 26, '#4a4a56');
    rect(g, 27, top + 20, 22, 4, '#62626e');
    rect(g, 36, top + 22, 5, 22, '#6a6a76');
    rect(g, 25, top + 34, 26, 3, '#2e2a34');
    // ribs
    for (let i = 0; i < 3; i++) rect(g, 29, top + 28 + i * 4, 18, 1, '#3a3a44');
    // pauldrons / spikes
    blob(g, 24, top + 24, 6, 6, '#5a5a66');
    blob(g, 52, top + 24, 6, 6, '#5a5a66');
    line(g, 20, top + 22, 14, top + 14, '#7a7a86');
    line(g, 56, top + 22, 62, top + 14, '#7a7a86');
    // head / skull
    blob(g, 38, top + 10, 8, 8, '#b8b2a2');
    blob(g, 37, top + 9, 6, 6, '#d0caba');
    rect(g, 32, top + 8, 12, 5, '#2a2830');
    px(g, 35, top + 10, rage ? '#ff6a4a' : '#6fd9c8'); px(g, 36, top + 10, '#ffffff');
    px(g, 40, top + 10, rage ? '#ff6a4a' : '#6fd9c8'); px(g, 41, top + 10, '#ffffff');
    rect(g, 36, top + 14, 4, 2, '#3a3830');
    // crown
    for (let i = 0; i < 5; i++) {
      trap(g, 29 + i * 5, top - 2, top + 3, 1, 4, 7, '#c9a45c');
      px(g, 29 + i * 5, top - 3, '#f2dca6');
      px(g, 29 + i * 5, top, i % 2 ? '#b04a5a' : '#63d7cc');
    }
    rect(g, 28, top + 3, 20, 2, '#d8b774');
    // sword
    const raise = state === 'windup' ? -12 : state === 'attack' ? 12 : 0;
    line(g, 57, top + 34, 66, top + 8 + raise, '#5a5a66');
    line(g, 58, top + 34, 68, top + 8 + raise, '#b8c4c2');
    px(g, 68, top + 8 + raise, '#f0ffff');
    rect(g, 54, top + 33, 8, 3, '#8a7a4a');
    // runes on blade
    px(g, 63, top + 18 + raise, rage ? '#ff8a6a' : '#7fe3d2');
    // floating shards
    if (rage) {
      for (let i = 0; i < 4; i++) {
        const ang = f * 0.6 + i * Math.PI / 2;
        px(g, 38 + Math.cos(ang) * (26 + i * 2), top + 26 + Math.sin(ang) * 20, '#ff7a5a');
      }
    }
    return c;
  },
  chorus(x, f, state, P, phase) {
    const c = cv(104, 104), g = c.getContext('2d');
    const cx = 52, cy = 52;
    const rage = phase === 2;
    const pulse = Math.sin(f * 0.9) * 2;
    // aura
    const grd = g.createRadialGradient(cx, cy, 4, cx, cy, 50);
    grd.addColorStop(0, rage ? 'rgba(255,110,90,.18)' : 'rgba(110,220,230,.16)');
    grd.addColorStop(1, 'transparent');
    g.fillStyle = grd; g.fillRect(0, 0, 104, 104);
    // tendrils
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + Math.sin(f * 0.05 + i) * 0.2;
      for (let j = 8; j < 34; j += 2) {
        const wob = Math.sin(f * 0.3 + j * 0.4 + i) * 3;
        px(g, cx + Math.cos(ang) * j + wob, cy + Math.sin(ang) * j, j < 20 ? '#2e5a66' : '#3f7a84');
      }
    }
    // outer ring shards
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + f * 0.08;
      const rx = 35 + Math.sin(f * 0.15 + i) * 3, ry = 35 + Math.cos(f * 0.15 + i) * 3;
      const sx = cx + Math.cos(ang) * rx, sy = cy + Math.sin(ang) * ry;
      trap(g, sx, sy - 8, sy, 2, 6, 12, rage ? '#c05a4a' : '#4a9aa8');
      px(g, sx, sy - 9, rage ? '#ffb08a' : '#b8fff2');
    }
    // core crystal
    blob(g, cx, cy, 23, 20, '#1e3a44');
    blob(g, cx, cy, 21, 18, '#2c5a66');
    blob(g, cx, cy, 16 + pulse, 14 + pulse, '#3f8a96');
    blob(g, cx, cy, 10, 9, rage ? '#d06a52' : '#7fe6d8');
    blob(g, cx - 2, cy - 2, 5, 4, rage ? '#ffcf9a' : '#e0fff9');
    // eye
    const eyeOpen = state === 'windup' || state === 'attack' ? 8 : 5;
    g.fillStyle = '#0a1216';
    for (let j = -eyeOpen; j <= eyeOpen; j++) {
      const w = Math.round((16 + pulse) * Math.sqrt(1 - (j * j) / (eyeOpen * eyeOpen)));
      g.fillRect(cx - w, cy - 1 + j, w * 2, 1);
    }
    blob(g, cx, cy, 9, eyeOpen - 2, rage ? '#ffb04a' : '#a8fff2');
    blob(g, cx, cy, 4, Math.max(2, eyeOpen - 4), '#0a1216');
    px(g, cx - 3, cy - 2, '#ffffff');
    // crown of crystal
    for (let i = 0; i < 5; i++) {
      line(g, cx - 16 + i * 8, cy - 18, cx - 20 + i * 9, cy - 30, rage ? '#c05a4a' : '#4a9aa8');
    }
    return c;
  },
};

export function getEnemySprite(type, frame = 0, state = 'idle', phase = 1) {
  const key = `e:${type}:${frame}:${state}:${phase}`;
  return cached(key, () => {
    const fn = ENEMY_DRAW[type] || ENEMY_DRAW.thornling;
    return fn(0, frame, state, {}, phase);
  });
}

/* ---------------- effects ---------------- */
function slashCanvas(heavy, tint) {
  const W = heavy ? 88 : 64;
  const c = cv(W, W), x = c.getContext('2d');
  const cx = W / 2, cy = W / 2;
  const start = -Math.PI * 0.68, end = Math.PI * 0.68;
  const cols = tint === 'frost' ? ['#d8f7ff', '#7fd8ee', '#3f9ab8']
    : tint === 'red' ? ['#ffd8c8', '#ff7f6a', '#b03a3a']
      : tint === 'gold' ? ['#fff2c8', '#f0c26a', '#a87a32']
        : ['#f4fffb', '#9fe8dd', '#4aa89f'];
  for (let i = 0; i < 3; i++) {
    const radius = cx - 7 - i * 5;
    for (let a = start; a <= end; a += 0.035) {
      const w = 1.6 - i * 0.4;
      x.fillStyle = cols[i];
      x.globalAlpha = 0.85 - i * 0.2;
      x.fillRect(Math.round(cx + Math.cos(a) * radius), Math.round(cy + Math.sin(a) * radius), Math.ceil(w), Math.ceil(w));
      x.globalAlpha = 1;
    }
  }
  // bright leading tip
  const tipA = end;
  for (let i = 0; i < 6; i++) {
    px(x, cx + Math.cos(tipA) * (cx - 4 - i), cy + Math.sin(tipA) * (cx - 4 - i), i % 2 ? '#ffffff' : cols[0]);
  }
  return c;
}

export function getSlash(heavy = false, tint = 'teal') {
  return cached('slash:' + heavy + ':' + tint, () => slashCanvas(heavy, tint));
}

function orbFrames(colors, size, spikes) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const c = cv(size, size), x = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const pulse = Math.sin((f / 4) * Math.PI * 2) * 1.5;
    const g = x.createRadialGradient(cx, cy, 1, cx, cy, size * 0.45);
    g.addColorStop(0, colors[0]); g.addColorStop(.4, colors[1]); g.addColorStop(1, 'transparent');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    blob(x, cx, cy, size * 0.22 + pulse, size * 0.22 + pulse, colors[1]);
    blob(x, cx, cy, size * 0.15, size * 0.15, colors[0]);
    if (spikes) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + f * 0.4;
        px(x, cx + Math.cos(a) * (size * 0.3), cy + Math.sin(a) * (size * 0.3), colors[2]);
      }
    }
    frames.push(c);
  }
  return frames;
}

export function getOrbs() {
  return {
    arcane: cached('orb:arcane', () => orbFrames(['#ffffff', '#7fe3d2', '#b8fff2'], 20, true)),
    fire: cached('orb:fire', () => orbFrames(['#fff0c8', '#f0a25a', '#c05a3a'], 20, true)),
    shadow: cached('orb:shadow', () => orbFrames(['#e8d8ff', '#8a6ad0', '#c8a6ff'], 18, false)),
    frost: cached('orb:frost', () => orbFrames(['#ffffff', '#a8e8ff', '#5a9ac8'], 18, true)),
    echo: cached('orb:echo', () => orbFrames(['#ffffff', '#ffe6a8', '#d8b774'], 24, true)),
    poison: cached('orb:poison', () => orbFrames(['#e0ffb8', '#8ac05a', '#4a7a3a'], 16, true)),
  };
}

export function getNova(tint = 'teal') {
  return cached('nova:' + tint, () => {
    const frames = [];
    const cols = tint === 'frost' ? ['#a8e8ff', '#5ab8e0', '#2a6a8a'] : ['#b8fff2', '#63d7cc', '#2a8a80'];
    for (let f = 0; f < 6; f++) {
      const c = cv(160, 160), x = c.getContext('2d');
      const cx = 80, cy = 80;
      const r = 12 + f * 13;
      for (let a = 0; a < Math.PI * 2; a += 0.03) {
        const wob = Math.sin(a * 8 + f) * 3;
        const rr = r + wob;
        x.globalAlpha = Math.max(0.05, 0.9 - f * 0.13);
        x.fillStyle = cols[f % 2 ? 0 : 1];
        x.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 3, 3);
      }
      x.globalAlpha = 1;
      frames.push(c);
    }
    return frames;
  });
}

export function getExplosion(tint = 'teal') {
  return cached('expl:' + tint, () => {
    const frames = [];
    const cols = tint === 'red' ? [['#fff0d0', '#ff9a6a', '#b03a2a'], ['#ffd0a0', '#b04030', '#3a1a14']]
      : tint === 'frost' ? [['#f0ffff', '#a8e8ff', '#4a8ab0'], ['#d0f8ff', '#6ac0e0', '#2a5a7a']]
        : [['#f0fff8', '#8ff0e0', '#3a9a90'], ['#c8fff4', '#4ac0b0', '#1a5a54']];
    for (let i = 0; i < 6; i++) {
      const c = cv(72, 72), x = c.getContext('2d');
      const r = 8 + i * 7;
      const pal = cols[i < 3 ? 0 : 1];
      blob(x, 36, 36, r, r, pal[1]);
      blob(x, 36, 36, Math.max(2, r - 5), Math.max(2, r - 5), pal[0]);
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI * 2;
        const rr = r + 4;
        px(x, 36 + Math.cos(a) * rr, 36 + Math.sin(a) * rr, pal[2]);
      }
      frames.push(c);
    }
    return frames;
  });
}

export function getSpark(tint = 'teal') {
  return cached('spark:' + tint, () => {
    const frames = [];
    const col = tint === 'red' ? '#ff8a6a' : tint === 'frost' ? '#b8f0ff' : '#ffe6b8';
    for (let f = 0; f < 5; f++) {
      const c = cv(28, 28), x = c.getContext('2d');
      const r = 3 + f * 2.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + f * 0.2;
        const rr = r * (0.6 + Math.random() * 0.5);
        px(x, 14 + Math.cos(a) * rr, 14 + Math.sin(a) * rr, col);
      }
      blob(x, 14, 14, Math.max(1, 4 - f * 0.7), Math.max(1, 4 - f * 0.7), '#ffffff');
      frames.push(c);
    }
    return frames;
  });
}

export function getHealFX() {
  return cached('heal', () => {
    const frames = [];
    for (let f = 0; f < 5; f++) {
      const c = cv(48, 56), x = c.getContext('2d');
      for (let i = 0; i < 12; i++) {
        const xx = 8 + (i * 37) % 32;
        const yy = 46 - ((f * 8 + i * 9) % 46);
        px(x, xx + Math.sin(i + f) * 2, yy, i % 2 ? '#a8f0c0' : '#e0fff0');
        if (i % 3 === 0) px(x, xx - 1, yy + 1, '#63d9a0');
      }
      frames.push(c);
    }
    return frames;
  });
}

export function getRuneCircle(tint = 'teal') {
  return cached('rune:' + tint, () => {
    const frames = [];
    const col = tint === 'red' ? '#ff8a6a' : tint === 'frost' ? '#b8f0ff' : '#8ff0e0';
    for (let f = 0; f < 4; f++) {
      const c = cv(72, 72), x = c.getContext('2d');
      const cx = 36, cy = 36;
      x.globalAlpha = 0.55;
      for (let a = 0; a < Math.PI * 2; a += 0.08) {
        const r = 30 + Math.sin(a * 6 + f) * 1;
        px(x, cx + Math.cos(a) * r, cy + Math.sin(a) * r, col);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + f * 0.12;
        px(x, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, col);
        px(x, cx + Math.cos(a) * 23, cy + Math.sin(a) * 23, col);
      }
      x.globalAlpha = 1;
      frames.push(c);
    }
    return frames;
  });
}

export function getWindStreak() {
  return cached('wind', () => {
    const c = cv(64, 12), x = c.getContext('2d');
    for (let i = 0; i < 10; i++) {
      x.fillStyle = `rgba(220,255,250,${0.1 + (i % 3) * 0.08})`;
      x.fillRect((i * 13) % 60, i % 3 === 0 ? 3 : 7, 10 + (i % 4) * 5, 1);
    }
    return c;
  });
}

export function getBossSlash(tint = 'red') {
  const W = 150;
  const c = cv(W, W), x = c.getContext('2d');
  const cx = W / 2, cy = W / 2;
  const cols = tint === 'red' ? ['#ffd8c0', '#ff7a5a', '#8a2a20'] : ['#fff0c8', '#6fd9c8', '#2a8a80'];
  for (let i = 0; i < 3; i++) {
    const r = 68 - i * 8;
    for (let a = -0.9; a < 0.9; a += 0.02) {
      x.globalAlpha = 0.7 - i * 0.15;
      x.fillStyle = cols[i];
      x.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 3, 3);
    }
  }
  x.globalAlpha = 1;
  return cached('bossSlash:' + tint, () => c);
}

/* item icon generation */
const iconCache = new Map();
export function getItemIcon(type, tint = '#c9a45c') {
  const key = type + ':' + tint;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = cv(26, 26), x = c.getContext('2d');
  const cx = 13;
  if (type === 'sword' || type === 'greatsword' || type === 'dagger') {
    const len = type === 'dagger' ? 12 : 17;
    line(x, cx - 4, 21, cx + 4, 21 - len, '#cfd8d4');
    line(x, cx - 5, 21, cx + 3, 21 - len, '#8b9797');
    line(x, cx + 1, 21 - len + 1, cx + 4, 21 - len + 2, tint);
    rect(x, cx - 7, 19, 9, 2, tint);
    rect(x, cx - 2, 21, 3, 5, '#4a3626');
    px(x, cx - 2, 24, tint);
    if (type === 'greatsword') {
      line(x, cx - 6, 19, cx + 2, 20 - len, '#b8c4c2');
      line(x, cx - 3, 20, cx + 5, 19 - len, '#8b9797');
      rect(x, cx - 8, 18, 11, 2, tint);
    }
  } else if (type === 'staff') {
    line(x, cx + 1, 24, cx + 1, 8, '#5a4128');
    line(x, cx + 2, 24, cx + 2, 8, '#7a5a38');
    blob(x, cx + 1, 6, 4, 4, tint);
    blob(x, cx, 5, 2, 2, '#ffffff');
    for (let i = 0; i < 3; i++) px(x, cx - 5 + i * 5, 12, tint);
  } else if (type === 'axe') {
    line(x, cx, 24, cx + 3, 5, '#5a4128');
    rect(x, cx - 6, 5, 12, 8, '#8a9a96');
    rect(x, cx - 6, 5, 12, 2, '#c8d8d4');
    px(x, cx + 6, 9, tint);
    px(x, cx - 7, 10, tint);
  } else if (type === 'armor' || type === 'robe') {
    trap(x, cx, 7, 21, 14, 18, 14, '#5a626a');
    trap(x, cx, 7, 19, 10, 13, 12, tint);
    rect(x, cx - 9, 7, 5, 6, '#6a727a');
    rect(x, cx + 4, 7, 5, 6, '#6a727a');
    rect(x, cx, 10, 1, 11, '#3a424a');
    if (type === 'robe') {
      trap(x, cx, 12, 24, 12, 20, 12, 'rgba(0,0,0,.15)');
      line(x, cx - 4, 21, cx + 4, 21, tint);
    }
  } else if (type === 'charm' || type === 'ring') {
    if (type === 'ring') {
      blob(x, cx, 15, 7, 7, '#8a7a4a');
      blob(x, cx, 15, 5, 5, '#0a0d10');
      blob(x, cx, 14, 3, 3, tint);
      px(x, cx - 1, 13, '#ffffff');
    } else {
      line(x, cx - 7, 6, cx + 7, 6, '#8a7a4a');
      line(x, cx - 2, 7, cx, 11, '#8a7a4a');
      line(x, cx + 2, 7, cx, 11, '#8a7a4a');
      blob(x, cx, 16, 5, 5, tint);
      blob(x, cx, 15, 3, 3, '#ffffff');
      px(x, cx + 5, 16, tint);
    }
  } else if (type === 'potion') {
    blob(x, cx, 18, 5, 5, '#bfe3e0');
    rect(x, cx - 2, 7, 4, 6, '#d8e8e0');
    blob(x, cx, 18, 3.5, 3.5, tint);
    rect(x, cx - 2, 6, 4, 2, '#8a7a4a');
    px(x, cx - 2, 15, 'rgba(255,255,255,.6)');
  } else if (type === 'crystal' || type === 'shard') {
    line(x, cx, 4, cx + 6, 14, tint);
    line(x, cx, 4, cx - 6, 14, tint);
    line(x, cx - 6, 14, cx, 24, tint);
    line(x, cx + 6, 14, cx, 24, tint);
    line(x, cx, 4, cx, 24, '#ffffff');
    blob(x, cx - 2, 13, 2, 6, 'rgba(255,255,255,.25)');
    px(x, cx + 1, 9, '#ffffff');
  } else if (type === 'relic') {
    rect(x, cx - 7, 12, 14, 9, '#6a5a3a');
    rect(x, cx - 7, 12, 14, 2, '#8a7a4a');
    blob(x, cx, 11, 6, 5, tint);
    blob(x, cx, 11, 3, 3, '#f0fff8');
    px(x, cx - 3, 8, '#ffffff');
  } else if (type === 'tome') {
    rect(x, cx - 7, 5, 14, 18, '#5a3a2a');
    rect(x, cx - 5, 6, 11, 16, '#d8c8a0');
    rect(x, cx - 1, 6, 2, 16, '#8a7a5a');
    rect(x, cx - 4, 9, 7, 1, '#6a5a3a');
    rect(x, cx - 4, 12, 7, 1, '#6a5a3a');
    blob(x, cx + 3, 18, 2, 2, tint);
  } else if (type === 'material') {
    blob(x, cx, 17, 8, 6, '#4a4a4e');
    blob(x, cx - 2, 15, 5, 4, '#6a6a6e');
    blob(x, cx, 18, 4, 3, tint);
    px(x, cx - 3, 14, '#9a9a9e');
    px(x, cx + 4, 21, tint);
  } else if (type === 'key') {
    blob(x, cx - 4, 9, 4, 4, tint);
    blob(x, cx - 4, 9, 2, 2, '#0a0d10');
    rect(x, cx - 5, 12, 2, 10, tint);
    rect(x, cx - 5, 19, 6, 2, tint);
    rect(x, cx - 5, 22, 4, 2, tint);
  } else {
    blob(x, cx, 16, 7, 6, tint);
    blob(x, cx, 15, 4, 4, '#e0fff8');
  }
  const out = c.toDataURL();
  iconCache.set(key, out);
  return out;
}

export function getAbilityIcon(id) {
  const key = 'abi:' + id;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = cv(40, 40), x = c.getContext('2d');
  const cx = 20, cy = 20;
  const g = x.createRadialGradient(cx, cy, 1, cx, cy, 19);
  g.addColorStop(0, 'rgba(111,217,200,.18)'); g.addColorStop(1, 'transparent');
  x.fillStyle = g; x.fillRect(0, 0, 40, 40);
  x.strokeStyle = '#7fdccd'; x.lineWidth = 1;
  if (id === 'burst') {
    blob(x, cx, cy, 6, 6, '#b8fff2');
    blob(x, cx, cy, 3, 3, '#ffffff');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      line(x, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, '#63d7cc');
    }
  } else if (id === 'blink') {
    for (let i = 0; i < 3; i++) {
      const off = i * 5;
      x.strokeStyle = i === 2 ? '#d8fff8' : 'rgba(111,217,200,.4)';
      x.beginPath(); x.moveTo(8 + off, 27); x.lineTo(18 + off, 20); x.lineTo(8 + off, 13); x.stroke();
    }
    px(x, 31, 12, '#ffffff'); px(x, 33, 11, '#b8fff2');
  } else if (id === 'nova') {
    for (let i = 0; i < 3; i++) {
      x.strokeStyle = i % 2 ? '#b8fff2' : 'rgba(111,217,200,.5)';
      x.beginPath(); x.arc(cx, cy, 6 + i * 5, 0, Math.PI * 2); x.stroke();
    }
    blob(x, cx, cy, 4, 4, '#d8fff8');
  } else if (id === 'frost') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      line(x, cx - Math.cos(a) * 13, cy - Math.sin(a) * 13, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, '#a8e8ff');
    }
    px(x, 20, 6, '#ffffff'); px(x, 20, 33, '#ffffff');
    blob(x, cx, cy, 4, 4, '#d8f8ff');
  } else if (id === 'echo') {
    for (let i = 0; i < 3; i++) {
      x.strokeStyle = ['#ffe6a8', '#d8b774', 'rgba(255,230,168,.4)'][i];
      x.beginPath(); x.arc(cx, cy, 5 + i * 5, -0.7, 0.7); x.stroke();
      x.beginPath(); x.arc(cx, cy, 5 + i * 5, Math.PI - 0.7, Math.PI + 0.7); x.stroke();
    }
    blob(x, cx, cy, 5, 5, '#fff0c8');
    blob(x, cx, cy, 2, 2, '#ffffff');
  } else {
    x.beginPath(); x.arc(cx, cy, 12, 0, Math.PI * 2); x.stroke();
    line(x, cx - 6, cy, cx + 6, cy, '#5a6a68');
    line(x, cx, cy - 6, cx, cy + 6, '#5a6a68');
  }
  const out = c.toDataURL();
  iconCache.set(key, out);
  return out;
}

export const ENEMY_DIMS = {
  thornling: { w: 20, h: 18, ox: 17, oy: 30 },
  wolf: { w: 22, h: 15, ox: 24, oy: 28 },
  knight: { w: 18, h: 22, ox: 20, oy: 45 },
  wisp: { w: 16, h: 18, ox: 18, oy: 28 },
  crawler: { w: 24, h: 16, ox: 24, oy: 28 },
  revenant: { w: 18, h: 24, ox: 21, oy: 46 },
  grove: { w: 42, h: 44, ox: 52, oy: 114 },
  hollowking: { w: 24, h: 34, ox: 38, oy: 91 },
  chorus: { w: 40, h: 40, ox: 52, oy: 52 },
};

export function getShadowSprite(w, h, alpha = 0.3) {
  return cached('shadow:' + w + ':' + h, () => {
    const c = cv(w + 2, h + 2), x = c.getContext('2d');
    blob(x, w / 2 + 1, h / 2 + 1, w / 2, h / 2, `rgba(3,7,8,${alpha})`);
    return c;
  });
}
