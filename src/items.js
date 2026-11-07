/* ============================================================
   ECHOES OF THE FALLEN — items, loot, abilities, skills
   ============================================================ */
import { getItemIcon } from './sprites.js';

export const RARITY = {
  common: { name: 'Common', color: '#a8b2a8', mult: 1, weight: 42 },
  uncommon: { name: 'Uncommon', color: '#74c46f', mult: 1.35, weight: 28 },
  rare: { name: 'Rare', color: '#63a8e8', mult: 1.8, weight: 18 },
  epic: { name: 'Epic', color: '#b784e8', mult: 2.5, weight: 9 },
  legendary: { name: 'Legendary', color: '#f0a84a', mult: 3.4, weight: 3 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const WEAPONS = [
  { id: 'rusted_blade', name: 'Rusted Blade', icon: 'sword', kind: 'sword', atk: 4, desc: 'A pitted blade from a forgotten watchtower. It still remembers how to cut.', tier: 1 },
  { id: 'wanderers_edge', name: "Wanderer's Edge", icon: 'sword', kind: 'sword', atk: 7, crit: 3, desc: 'Balanced, plain, and faithful. The blade of someone who kept walking.', tier: 2 },
  { id: 'verdant_saber', name: 'Verdant Saber', icon: 'sword', kind: 'sword', atk: 10, crit: 5, desc: 'Green light runs along the fuller when the forest is near.', tier: 2 },
  { id: 'frostfall_sword', name: 'Frostfall Sword', icon: 'sword', kind: 'sword', atk: 11, energy: 12, desc: 'Cold enough to make the air speak. The hilt never freezes.', tier: 3 },
  { id: 'kings_legacy', name: "King's Legacy", icon: 'greatsword', kind: 'greatsword', atk: 16, crit: 4, desc: 'Too heavy for a throne. The old kings carried their crowns in their hands.', tier: 3, slow: true },
  { id: 'echo_fang', name: 'Echo Fang', icon: 'sword', kind: 'sword', atk: 21, crit: 9, lifesteal: 0.08, desc: 'A blade grown, not forged. It hums with every wound it remembers.', tier: 4 },
  { id: 'apprentice_staff', name: 'Apprentice Staff', icon: 'staff', kind: 'staff', atk: 5, energy: 10, desc: 'Ash wood and a splinter of crystal. Smells faintly of rain.', tier: 1 },
  { id: 'sunless_scepter', name: 'Sunless Scepter', icon: 'staff', kind: 'staff', atk: 13, energy: 24, desc: 'Taken from the deep places. The crystal turns toward sound.', tier: 3 },
  { id: 'thornhook', name: 'Thornhook', icon: 'dagger', kind: 'dagger', atk: 8, crit: 12, spd: 0.08, desc: 'A hunter\'s tool that grew opinions. Quick, cruel, honest.', tier: 2 },
  { id: 'monument_axe', name: 'Monument Axe', icon: 'axe', kind: 'axe', atk: 18, desc: 'Its edge is carved with three marks: root, crown, and frost.', tier: 3, slow: true },
];
const ARMORS = [
  { id: 'travelers_cloak', name: "Traveler's Cloak", icon: 'robe', kind: 'robe', def: 2, speed: 4, desc: 'Waxed cloth and stubborn stitching. Has seen worse weather.', tier: 1 },
  { id: 'thornweave_vest', name: 'Thornweave Vest', icon: 'armor', kind: 'armor', def: 4, hp: 10, desc: 'Woven from greenfall briars. It prickles when danger is close.', tier: 2 },
  { id: 'knights_plate', name: "Knight's Plate", icon: 'armor', kind: 'armor', def: 7, hp: 18, speed: -2, desc: 'Dented at the shoulder. Whoever wore it last did not run.', tier: 3 },
  { id: 'frostguard_mantle', name: 'Frostguard Mantle', icon: 'robe', kind: 'robe', def: 6, hp: 22, energy: 10, desc: 'The fur is white as a held breath. Warmth clings to it like a rumor.', tier: 3 },
  { id: 'echoheart_aegis', name: 'Echoheart Aegis', icon: 'armor', kind: 'armor', def: 11, hp: 34, desc: 'A heart-shaped plate that beats once when its wearer is struck.', tier: 4 },
];
const CHARMS = [
  { id: 'copper_band', name: 'Copper Band', icon: 'ring', kind: 'ring', energy: 8, desc: 'Cheap metal, warm with a stranger\'s memory.', tier: 1 },
  { id: 'wolf_fang', name: 'Wolf Fang Charm', icon: 'charm', kind: 'charm', crit: 7, desc: 'It still points toward the last thing the wolf caught.', tier: 2 },
  { id: 'deep_lantern', name: 'Deep Lantern', icon: 'charm', kind: 'charm', energy: 15, regen: 2, desc: 'A shard of living crystal in a brass cage. It does not need a wick.', tier: 2 },
  { id: 'monument_sigil', name: 'Monument Sigil', icon: 'charm', kind: 'charm', def: 4, atk: 3, energy: 12, desc: 'Three lines cut into a palm-sized stone. One of them is still warm.', tier: 4 },
  { id: 'orins_locket', name: 'Orin\'s Locket', icon: 'charm', kind: 'charm', hp: 12, speed: 5, desc: 'A root-shaped locket on a leather cord. The clasp is a tiny door.', tier: 2 },
];

const PREFIXES = {
  uncommon: ['Keen', 'Sturdy', 'Honed', 'Mossy'],
  rare: ['Verdant', 'Sunken', 'Silvered', 'Runed', 'Warden\'s'],
  epic: ['Archivist\'s', 'Crownforged', 'Echoing', 'Frostbitten'],
  legendary: ['Aetherial', 'Firstborn', 'Monument-Bound', 'Worldsorrow'],
};
const SUFFIXES = {
  common: [],
  uncommon: ['of the Trail', 'of Thorns'],
  rare: ['of Root and Stone', 'of the Deep Chorus', 'of Silent Bells'],
  epic: ['of the Forgotten Court', 'of Frozen Vows', 'of Hollow Light'],
  legendary: ['of the Last Echo', 'of Aetheria\'s Dawn'],
};

function pickRarity(bias = 0) {
  const roll = Math.random() * 100;
  const boost = bias * 10;
  let acc = 0;
  const adjusted = {
    common: Math.max(8, 42 - boost * 2),
    uncommon: 28,
    rare: 18 + boost,
    epic: 9 + boost * 0.7,
    legendary: 3 + boost * 0.45,
  };
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  const target = roll / 100 * total;
  for (const r of RARITY_ORDER) { acc += adjusted[r]; if (target <= acc) return r; }
  return 'common';
}

let itemUID = 1;
export function resetItemUID(v = 1) { itemUID = v; }
export function nextItemUID() { return itemUID++; }

export function makeEquipment(level = 1, rarity = null, forceKind = null, rarityBias = 0) {
  if (!rarity) rarity = pickRarity(rarityBias);
  const kind = forceKind || ['weapon', 'weapon', 'armor', 'charm'][(Math.random() * 4) | 0];
  let base;
  if (kind === 'weapon') {
    const pool = WEAPONS.filter(w => w.tier <= Math.max(1, Math.floor(level / 2.5) + 1));
    base = pool[(Math.random() * pool.length) | 0] || WEAPONS[0];
  } else if (kind === 'armor') {
    const pool = ARMORS.filter(w => w.tier <= Math.max(1, Math.floor(level / 2.5) + 1));
    base = pool[(Math.random() * pool.length) | 0] || ARMORS[0];
  } else {
    const pool = CHARMS.filter(w => w.tier <= Math.max(1, Math.floor(level / 2.2) + 1));
    base = pool[(Math.random() * pool.length) | 0] || CHARMS[0];
  }
  const mult = RARITY[rarity].mult;
  const stats = {};
  const scale = 1 + (level - 1) * 0.16;
  if (base.atk) stats.atk = Math.round(base.atk * scale * mult * 0.85 + (mult - 1) * 2);
  if (base.def) stats.def = Math.round(base.def * scale * mult * 0.8);
  if (base.hp) stats.hp = Math.round(base.hp * scale * mult);
  if (base.energy) stats.energy = Math.round(base.energy * scale * mult * 0.8);
  if (base.crit) stats.crit = Math.round(base.crit * mult * 0.8);
  if (base.speed) stats.speed = Math.round(base.speed);
  if (base.regen) stats.regen = base.regen;
  if (base.lifesteal) stats.lifesteal = base.lifesteal;
  // rarity random affix
  const affix = ['hp', 'energy', 'crit', 'speed', 'def', 'atk'][(Math.random() * 6) | 0];
  const affixVal = Math.ceil(2 + level * 0.4 * mult);
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx >= 1 && !stats[affix]) stats[affix] = affixVal;
  let name = base.name;
  if (rarity !== 'common' && Math.random() < 0.6) {
    const pre = PREFIXES[rarity] ? PREFIXES[rarity][(Math.random() * PREFIXES[rarity].length) | 0] : null;
    if (pre && !name.includes(pre)) name = pre + ' ' + name;
  }
  if ((rarity === 'epic' || rarity === 'legendary') && Math.random() < 0.5) {
    const suf = SUFFIXES[rarity][(Math.random() * SUFFIXES[rarity].length) | 0];
    name = name + ' ' + suf;
  }
  const slot = kind === 'armor' ? 'armor' : kind === 'charm' ? 'charm' : 'weapon';
  return {
    uid: nextItemUID(),
    baseId: base.id,
    name, type: slot, kind: base.kind, icon: base.icon,
    rarity, level, stats,
    slow: !!base.slow,
    desc: base.desc,
    value: Math.round((8 + level * 5) * mult * (slot === 'weapon' ? 1.2 : 1)),
    category: 'equipment',
    iconUrl: getItemIcon(base.icon, RARITY[rarity].color),
  };
}

export const CONSUMABLES = {
  health_potion: { id: 'health_potion', name: 'Health Draught', icon: 'potion', tint: '#c2515d', category: 'consumable', stack: true, desc: 'A bitter red tonic. Restores 50 health.', use: { hp: 50 }, value: 18 },
  energy_potion: { id: 'energy_potion', name: 'Ether Phial', icon: 'potion', tint: '#5aa9d6', category: 'consumable', stack: true, desc: 'Cool blue liquid that tastes of winter air. Restores 45 energy.', use: { energy: 45 }, value: 20 },
  elixir: { id: 'elixir', name: 'Echo Elixir', icon: 'potion', tint: '#c9a45c', category: 'consumable', stack: true, desc: 'Distilled monument dew. Restores 60 health and energy.', use: { hp: 60, energy: 60 }, value: 45 },
  smoke_bomb: { id: 'smoke_bomb', name: 'Veil Bomb', icon: 'material', tint: '#7a7a8a', category: 'consumable', stack: true, desc: 'A clay sphere of blinding dust. Nearby foes lose track of you.', use: { flee: true }, value: 26 },
};
export const MATERIALS = {
  echo_shard: { id: 'echo_shard', name: 'Echo Shard', icon: 'crystal', tint: '#6fd9c8', category: 'material', stack: true, desc: 'A splinter of monument light. The Echo Forge hungers for these.', value: 30 },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', icon: 'material', tint: '#9aa0a4', category: 'material', stack: true, desc: 'Heavy, honest, useful. Smiths will pay for it.', value: 12 },
};
export const COSMETICS = {
  dye_ember: { id: 'dye_ember', name: 'Ember Dye', icon: 'relic', tint: '#ffb072', category: 'cosmetic', stack: true, desc: 'A pigment of crushed emberleaf. Unlocks the Ember outfit at the wardrobe.', outfit: 1, value: 80 },
  dye_frost: { id: 'dye_frost', name: 'Frost Dye', icon: 'relic', tint: '#a8e8ff', category: 'cosmetic', stack: true, desc: 'Ground glacier pollen that never thaws. Unlocks the Frost outfit.', outfit: 2, value: 80 },
  dye_royal: { id: 'dye_royal', name: 'Royal Dye', icon: 'relic', tint: '#c8a6ff', category: 'cosmetic', stack: true, desc: 'A purple pigment recovered from the forgotten court. Unlocks the Royal outfit.', outfit: 3, value: 110 },
  dye_moss: { id: 'dye_moss', name: 'Moss Dye', icon: 'relic', tint: '#b8d98a', category: 'cosmetic', stack: true, desc: 'Squeezed from ancient bark and patient shade. Unlocks the Mosscloak outfit.', outfit: 4, value: 80 },
  dye_ivory: { id: 'dye_ivory', name: 'Ivory Dye', icon: 'relic', tint: '#ffe6a8', category: 'cosmetic', stack: true, desc: 'Pale as a monument before the fall. Unlocks the Ivory outfit.', outfit: 5, value: 150 },
};

export function makeConsumable(id, qty = 1) {
  const def = CONSUMABLES[id] || CONSUMABLES.health_potion;
  return { uid: nextItemUID(), ...def, qty, iconUrl: getItemIcon(def.icon, def.tint) };
}
export function makeMaterial(id, qty = 1) {
  const def = MATERIALS[id] || MATERIALS.iron_ore;
  return { uid: nextItemUID(), ...def, qty, iconUrl: getItemIcon(def.icon, def.tint) };
}
export function makeCosmetic(id, qty = 1) {
  const def = COSMETICS[id] || COSMETICS.dye_moss;
  return { uid: nextItemUID(), ...def, qty, iconUrl: getItemIcon(def.icon, def.tint) };
}

/* A named reward item, used by quests, shops and set loot. */
export function makeNamedEquipment(baseId, level = 3, rarity = 'rare') {
  const weapon = WEAPONS.find(w => w.id === baseId);
  const armor = ARMORS.find(a => a.id === baseId);
  const charm = CHARMS.find(c => c.id === baseId);
  const base = weapon || armor || charm;
  if (!base) return null;
  const slot = weapon ? 'weapon' : armor ? 'armor' : 'charm';
  const mult = RARITY[rarity] ? RARITY[rarity].mult : 1;
  const stats = {};
  for (const key of ['atk', 'def', 'hp', 'energy', 'crit', 'speed', 'regen', 'lifesteal']) {
    if (base[key]) stats[key] = base[key];
  }
  return {
    uid: nextItemUID(), baseId: base.id, name: base.name, type: slot,
    kind: base.kind, icon: base.icon, rarity, level, stats,
    slow: !!base.slow, desc: base.desc, category: 'equipment',
    value: Math.round((10 + level * 6) * mult),
    iconUrl: getItemIcon(base.icon, RARITY[rarity].color),
  };
}

export function makeQuestItem(id) {
  if (CONSUMABLES[id]) return makeConsumable(id, 1);
  if (MATERIALS[id]) return makeMaterial(id, 1);
  if (COSMETICS[id]) return makeCosmetic(id, 1);
  return makeNamedEquipment(id, 4, id === 'echo_fang' ? 'legendary' : 'rare');
}

export function randomConsumable(level = 1, bias = 0) {
  const r = Math.random();
  if (r < 0.52) return makeConsumable('health_potion');
  if (r < 0.86) return makeConsumable('energy_potion');
  if (r < 0.95) return makeConsumable('elixir');
  return makeConsumable('smoke_bomb');
}

/* ---------------- ability definitions ---------------- */
export const ABILITIES = {
  burst: {
    id: 'burst', name: 'Arcane Burst', glyph: '✦', key: '1', unlockLevel: 1,
    cost: 12, cd: 0.7, desc: 'Hurl a fast bolt of echo-light. Pierces one foe.',
    color: '#7fe3d2', damage: 16, speed: 430, pierce: 1,
  },
  blink: {
    id: 'blink', name: 'Blink', glyph: '⇢', key: '2', unlockLevel: 2,
    cost: 16, cd: 3.2, desc: 'Tear a short seam through space. Invulnerable while crossing.',
    color: '#a8b8ff', damage: 0, distance: 108,
  },
  nova: {
    id: 'nova', name: 'Nova', glyph: '◉', key: '3', unlockLevel: 4,
    cost: 28, cd: 6.5, desc: 'Release a ring of force around you, staggering nearby foes.',
    color: '#8ff0e0', damage: 30, radius: 84,
  },
  frost: {
    id: 'frost', name: 'Frost Bind', glyph: '❄', key: '4', unlockLevel: 6,
    cost: 24, cd: 8, desc: 'Freeze the ground. Nearby enemies are slowed and chilled.',
    color: '#a8e8ff', damage: 14, radius: 96, slow: 4,
  },
  echo: {
    id: 'echo', name: 'Echo Strike', glyph: '❖', key: '5', unlockLevel: 8,
    cost: 44, cd: 13, desc: 'Unleash the stored echo in a devastating wave of light.',
    color: '#ffe6a8', damage: 78, radius: 130,
  },
};

/* ---------------- skill tree ---------------- */
export const SKILL_BRANCHES = [
  {
    id: 'arcane', name: 'Arcane', sub: 'The voice of the echo', color: '#8f8ae8', icon: '✦',
    nodes: [
      { id: 'arcane_might', name: 'Arcane Might', desc: 'Ability damage +18%.', cost: 1, icon: '✦', tier: 1, effect: { abilityDmg: 0.18 } },
      { id: 'arcane_flow', name: 'Flowing Focus', desc: 'Ability energy cost -18%.', cost: 1, icon: '∼', tier: 2, req: 'arcane_might', effect: { abilityCost: -0.18 } },
      { id: 'burst_master', name: 'Burst Mastery', desc: 'Arcane Burst damage +35%, pierces +1.', cost: 2, icon: '✧', tier: 3, req: 'arcane_flow', effect: { burstDmg: 0.35, burstPierce: 1 } },
      { id: 'echo_resonance', name: 'Resonance', desc: 'Echo Strike damage +50%, radius +25%.', cost: 2, icon: '❖', tier: 4, req: 'arcane_might', effect: { echoDmg: 0.5, echoRadius: 0.25 } },
    ],
  },
  {
    id: 'mobility', name: 'Mobility', sub: 'The shape of a breath', color: '#6fd9a8', icon: '⇢',
    nodes: [
      { id: 'fleetfoot', name: 'Fleetfoot', desc: 'Movement speed +8%.', cost: 1, icon: '≫', tier: 1, effect: { speed: 0.08 } },
      { id: 'shadowstep', name: 'Shadowstep', desc: 'Blink cooldown -30%.', cost: 1, icon: '⇢', tier: 2, req: 'fleetfoot', effect: { blinkCd: -0.3 } },
      { id: 'evasion', name: 'Evasion', desc: 'Dodge invulnerability +30%, cost -20%.', cost: 2, icon: '◌', tier: 3, req: 'fleetfoot', effect: { iframes: 0.3, dodgeCost: -0.2 } },
      { id: 'windrunner', name: 'Windrunner', desc: 'Stamina regeneration +40%.', cost: 2, icon: '≋', tier: 4, req: 'shadowstep', effect: { staminaRegen: 0.4 } },
    ],
  },
  {
    id: 'guardian', name: 'Guardian', sub: 'The weight of a promise', color: '#d8a45c', icon: '◈',
    nodes: [
      { id: 'ironhide', name: 'Ironhide', desc: 'Maximum health +25.', cost: 1, icon: '◈', tier: 1, effect: { maxHp: 25 } },
      { id: 'bulwark', name: 'Bulwark', desc: 'Block reduces 15% more damage; blocked hits restore stamina.', cost: 1, icon: '▣', tier: 2, req: 'ironhide', effect: { blockDmg: 0.15, blockStamina: 8 } },
      { id: 'counter', name: 'Counterweight', desc: 'Heavy attacks +35% damage; heavy attacks stagger.', cost: 2, icon: '⚔', tier: 3, req: 'ironhide', effect: { heavyDmg: 0.35 } },
      { id: 'second_wind', name: 'Second Wind', desc: 'Once per 45s, survive a lethal blow at 25% health.', cost: 2, icon: '✧', tier: 4, req: 'bulwark', effect: { revive: true } },
    ],
  },
];

/* ---------------- enemy definitions ---------------- */
export const ENEMY_TYPES = {
  thornling: {
    name: 'Thornling', hp: 34, dmg: 8, speed: 62, radius: 9, xp: 14, gold: [2, 6], shards: 0.04,
    detect: 150, attackRange: 30, attackCd: 1.4, windup: 0.45, behavior: 'hopper', stagger: 0.22,
    loot: 0.22, color: '#6a9a52', eliteScale: 1.9,
  },
  wolf: {
    name: 'Bramble Wolf', hp: 48, dmg: 11, speed: 108, radius: 10, xp: 20, gold: [3, 8], shards: 0.06,
    detect: 210, attackRange: 36, attackCd: 1.2, windup: 0.32, behavior: 'lunger', stagger: 0.2,
    loot: 0.18, color: '#7a7060', eliteScale: 1.8,
  },
  knight: {
    name: 'Hollow Knight', hp: 105, dmg: 17, speed: 58, radius: 11, xp: 38, gold: [6, 14], shards: 0.16,
    detect: 180, attackRange: 44, attackCd: 1.8, windup: 0.62, behavior: 'guardian', stagger: 0.12,
    loot: 0.3, color: '#8a9098', eliteScale: 1.7,
  },
  wisp: {
    name: 'Wisp Warden', hp: 44, dmg: 10, speed: 70, radius: 9, xp: 26, gold: [4, 10], shards: 0.2,
    detect: 260, attackRange: 210, attackCd: 2.1, windup: 0.7, behavior: 'caster', stagger: 0.25,
    loot: 0.22, color: '#9a8ae0', ranged: true, projectile: 'shadow', projSpeed: 190, eliteScale: 1.8,
  },
  crawler: {
    name: 'Crystal Crawler', hp: 82, dmg: 15, speed: 92, radius: 11, xp: 36, gold: [6, 12], shards: 0.24,
    detect: 220, attackRange: 40, attackCd: 1.5, windup: 0.4, behavior: 'charger', stagger: 0.15,
    loot: 0.26, color: '#63d7cc', eliteScale: 1.8,
  },
  revenant: {
    name: 'Frost Revenant', hp: 128, dmg: 19, speed: 66, radius: 11, xp: 50, gold: [8, 16], shards: 0.3,
    detect: 240, attackRange: 60, attackCd: 1.9, windup: 0.55, behavior: 'caster', stagger: 0.14,
    loot: 0.32, color: '#8fc8e0', ranged: true, projectile: 'frost', projSpeed: 210, eliteScale: 1.7, melee: true,
  },
};

export const BOSSES = {
  grove: {
    name: 'The Grove Warden', title: 'GUARDIAN OF THE GREENFALL', type: 'grove',
    hp: 950, dmg: 24, speed: 52, radius: 28, xp: 550, gold: [80, 120], shards: 3,
    scale: 1, arena: 'greenfall', phase2: 0.55, music: 'boss',
  },
  hollowking: {
    name: 'Sir Aldric, the Hollow King', title: 'THE CROWN THAT WAITED', type: 'hollowking',
    hp: 1350, dmg: 28, speed: 74, radius: 20, xp: 850, gold: [120, 180], shards: 4,
    scale: 1, arena: 'kingdom', phase2: 0.6, music: 'boss',
  },
  frostwarden: {
    name: 'Warden of the Frozen Vow', title: 'THE PEAK\'S LAST OATH', type: 'revenant',
    hp: 720, dmg: 25, speed: 84, radius: 16, xp: 650, gold: [90, 130], shards: 3,
    scale: 1.35, arena: 'frost', phase2: 0.5, music: 'boss',
  },
  chorus: {
    name: 'The Deep Chorus', title: 'THE VOICE BENEATH THE WORLD', type: 'chorus',
    hp: 1900, dmg: 30, speed: 44, radius: 34, xp: 1500, gold: [220, 300], shards: 6,
    scale: 1, arena: 'depths', phase2: 0.5, music: 'boss',
  },
};

/* ---------------- player baseline ---------------- */
export const BASE_STATS = {
  maxHp: 100, maxEnergy: 100, maxStamina: 100,
  atk: 10, def: 0, speed: 150, crit: 5,
  energyRegen: 7, staminaRegen: 24,
  lifesteal: 0,
};

export function xpToNext(level) {
  return Math.round(55 * Math.pow(level, 1.42) + 35 * level);
}

export const SHOP_STOCK = {
  brann: [
    makeEquipment(3, 'uncommon', 'weapon'),
    makeEquipment(3, 'uncommon', 'armor'),
    makeEquipment(4, 'rare', 'weapon'),
    makeEquipment(2, 'uncommon', 'charm'),
    makeEquipment(4, 'rare', 'armor'),
  ],
  sera: [
    makeConsumable('health_potion', 3),
    makeConsumable('energy_potion', 3),
    makeConsumable('elixir', 1),
    makeConsumable('smoke_bomb', 1),
  ],
};

export function priceOf(item) {
  if (item.category === 'consumable') return Math.round((item.value || 20) * 1.5);
  return Math.round((item.value || 20) * 2.2);
}

export function itemStatLines(item) {
  if (!item || !item.stats) return [];
  const labels = { atk: 'Attack', def: 'Defense', hp: 'Health', energy: 'Energy', crit: 'Critical', speed: 'Speed', regen: 'Energy Regen', lifesteal: 'Life Steal' };
  return Object.entries(item.stats).map(([k, v]) => {
    if (k === 'lifesteal') return [labels[k], Math.round(v * 100) + '%'];
    if (k === 'speed' || k === 'crit' || k === 'regen') return [labels[k] || k, (v > 0 ? '+' : '') + v];
    return [labels[k] || k, (v > 0 ? '+' : '') + v];
  });
}
