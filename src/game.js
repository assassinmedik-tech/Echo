/* ============================================================
   ECHOES OF THE FALLEN — game orchestration
   ============================================================ */
import { getMap, REGIONS, TILE, collidesStatic, isWaterAt, regionInfo } from './world.js';
import {
  ABILITIES, SKILL_BRANCHES, ENEMY_TYPES, BOSSES, makeEquipment,
  makeConsumable, makeQuestItem, priceOf, resetItemUID, xpToNext, SHOP_STOCK,
} from './items.js';
import { QUESTS as QUEST_DATA, NPCS } from './story.js';
import { Player, Enemy, Projectile, Drop } from './entities.js';
import { audio } from './audio.js';
import { clamp, lerp, rand, pick, chance, dist, angleTo, TAU, bytesToB64, b64ToBytes, circleRect, fmt } from './util.js';
import { UI } from './ui.js';
import { Renderer } from './render.js';

const SAVE_KEY = 'eotf_save_v1';
const SETTINGS_KEY = 'eotf_settings_v1';

const hugeColor = (heavy, crit) => crit ? '#ffe6a8' : heavy ? '#ffd2a2' : '#f4e7d0';

const DEFAULT_SETTINGS = {
  quality: 'medium', particles: true, lighting: true, shake: true,
  zoom: 'normal', music: 0.5, sfx: 0.7, muted: false, tutorial: true,
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = this.loadSettings();
    this.audio = audio;
    this.state = 'boot';
    this.mapId = 'sanctuary';
    this.map = getMap('sanctuary');
    this.flags = {};
    this.quests = {};
    this.trackedQuest = 'main';
    this.questStepSeen = {};
    this.exploredSaved = {};
    this.discoveredRegions = new Set(['sanctuary']);
    this.playtime = 0;
    this.time = 0;
    this.paused = false;
    this.panelOpen = false;
    this.dialogueOpen = false;
    this.dialogueNpc = null;
    this.mouseActive = false;
    this.lastMouse = { x: 0, y: 0 };
    this.aimWorld = { x: 0, y: 0 };
    this.input = {
      moveX: 0, moveY: 0, up: false, down: false, left: false, right: false,
      sprint: false, block: false, joyX: 0, joyY: 0, joyActive: false,
    };
    this.keys = new Set();
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.particles = [];
    this.effects = [];
    this.zones = [];
    this.damageNumbers = [];
    this.activeBoss = null;
    this.bossInfo = null;
    this.arenaLock = null;
    this.arenaWarning = 0;
    this.interactTarget = null;
    this.portalCooldown = 0;
    this.exploreTimer = 0;
    this.ambientTimer = 0;
    this.autosaveTimer = 0;
    this.deathTimer = 0;
    this.fade = { alpha: 0, dir: 0 };
    this.shakeAmt = 0;
    this.camera = { x: 34 * 16, y: 46 * 16, scale: 2 };
    this.player = new Player(this);
    this.player.x = 34 * 16; this.player.y = 46 * 16;
    this.ui = new UI(this);
    this.renderer = new Renderer(canvas, this);
    this.audio.setVolumes(this.settings.music, this.settings.sfx, this.settings.muted);
    this.setupTitle();
    this.resize();
  }

  /* ---------------- settings / persistence ---------------- */
  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { }
  }

  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
    if (key === 'quality') this.renderer.resize();
    if (key === 'music' || key === 'sfx' || key === 'muted') {
      this.audio.setVolumes(this.settings.music, this.settings.sfx, this.settings.muted);
    }
    this.ui.refreshSettingsIfOpen();
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  save(silent = true) {
    if (this.state === 'title' || this.state === 'boot') return false;
    try {
      const explored = {};
      for (const [id, m] of Object.entries(this.worldMaps || {})) {
        if (m.explored.some(v => v)) explored[id] = bytesToB64(m.explored);
      }
      if (this.map && !explored[this.mapId]) explored[this.mapId] = bytesToB64(this.map.explored);
      const p = this.player;
      const data = {
        v: 1, timestamp: Date.now(), map: this.mapId,
        player: {
          x: Math.round(p.x), y: Math.round(p.y), level: p.level, xp: p.xp,
          skillPoints: p.skillPoints, skills: [...p.skills], resources: p.resources,
          inventory: p.inventory, equipment: p.equipment, outfit: p.outfit,
          accessory: p.accessory, unlockedOutfits: p.unlockedOutfits,
          unlockedAccessories: p.unlockedAccessories, hp: p.hp, energy: p.energy,
          stamina: p.stamina,
        },
        flags: this.flags, quests: this.quests, trackedQuest: this.trackedQuest,
        questStepSeen: this.questStepSeen, playtime: this.playtime,
        discovered: [...this.discoveredRegions], explored,
        lastSafe: p.lastSafe,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) this.ui.toast('Journey saved', 'good');
      return true;
    } catch (e) {
      console.warn('save failed', e);
      if (!silent) this.ui.toast('Could not save', 'bad');
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || !d.player) return false;
      this.flags = d.flags || {};
      this.quests = d.quests || {};
      this.trackedQuest = d.trackedQuest || 'main';
      this.questStepSeen = d.questStepSeen || {};
      this.playtime = d.playtime || 0;
      this.discoveredRegions = new Set(d.discovered || ['sanctuary']);
      this.exploredSaved = {};
      for (const [id, b64] of Object.entries(d.explored || {})) {
        const m = getMap(id);
        this.exploredSaved[id] = b64ToBytes(b64, m.explored.length);
      }
      const pd = d.player;
      this.player = new Player(this);
      Object.assign(this.player, {
        level: pd.level || 1, xp: pd.xp || 0, skillPoints: pd.skillPoints || 0,
        resources: pd.resources || { gold: 0, crystals: 0, shards: 0 },
        inventory: (pd.inventory || []).slice(0, 24),
        equipment: pd.equipment || { weapon: null, armor: null, charm: null },
        outfit: pd.outfit || 0, accessory: pd.accessory || 0,
        unlockedOutfits: pd.unlockedOutfits || [0],
        unlockedAccessories: pd.unlockedAccessories || [0, 1, 3],
        skills: new Set(pd.skills || []), lastSafe: pd.lastSafe || { map: 'sanctuary', x: 34 * 16, y: 46 * 16 },
      });
      while (this.player.inventory.length < 24) this.player.inventory.push(null);
      let maxUid = 1;
      for (const it of this.player.inventory) if (it && it.uid > maxUid) maxUid = it.uid;
      for (const it of Object.values(this.player.equipment)) if (it && it.uid > maxUid) maxUid = it.uid;
      resetItemUID(maxUid + 1);
      this.player.recalc();
      this.player.hp = clamp(pd.hp || this.player.maxHp, 1, this.player.maxHp);
      this.player.energy = clamp(pd.energy || this.player.maxEnergy, 0, this.player.maxEnergy);
      this.player.stamina = clamp(pd.stamina || this.player.maxStamina, 0, this.player.maxStamina);
      this.ui.bindPlayer();
      this.state = 'playing';
      this.ui.showGame();
      this.loadMap(d.map || 'sanctuary', { px: true, x: pd.x, y: pd.y });
      this.ui.toast('The echo remembers you', 'good');
      this.ui.refreshObjective();
      this.audio.init();
      return true;
    } catch (e) {
      console.warn('load failed', e);
      return false;
    }
  }

  deleteSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { }
  }

  /* ---------------- lifecycle ---------------- */
  setupTitle() {
    this.state = 'title';
    this.map = getMap('sanctuary');
    this.mapId = 'sanctuary';
    this.player.x = 34 * 16;
    this.player.y = 44 * 16;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y - 40;
    this.ui.showTitle();
    try { this.audio.setTrack('sanctuary'); } catch { }
  }

  newGame() {
    this.audio.init();
    this.flags = {};
    this.quests = {};
    this.trackedQuest = 'main';
    this.questStepSeen = {};
    this.exploredSaved = {};
    this.discoveredRegions = new Set(['sanctuary']);
    this.playtime = 0;
    this.player = new Player(this);
    this.ui.bindPlayer();
    this.state = 'playing';
    this.deathTimer = 0;
    this.activeBoss = null; this.bossInfo = null; this.arenaLock = null;
    this.ui.showGame();
    this.ui.hideTitle();
    this.loadMap('sanctuary', { x: 34, y: 46 }, { intro: true });
    this.ui.toast('Speak with Elder Maelin by the sanctuary steps', 'good');
    this.ui.refreshObjective();
    this.save();
  }

  continueGame() {
    this.audio.init();
    if (!this.load()) this.newGame();
    else this.ui.hideTitle();
    return true;
  }

  returnToTitle() {
    this.save(true);
    this.panelOpen = false; this.dialogueOpen = false;
    this.ui.closeAll();
    this.setupTitle();
    this.ui.showTitle();
    this.audio.setTrack('sanctuary');
  }

  resize() {
    if (this.renderer) this.renderer.resize();
  }

  /* ---------------- map loading ---------------- */
  loadMap(id, spawn = null, opts = {}) {
    this.mapId = id;
    this.map = getMap(id);
    this.map.discovered = true;
    this.discoveredRegions.add(id);
    this.worldMaps = this.worldMaps || {};
    this.worldMaps[id] = this.map;
    if (this.exploredSaved[id] && this.exploredSaved[id].length === this.map.explored.length) {
      this.map.explored.set(this.exploredSaved[id]);
    }
    const p = this.player;
    if (spawn) {
      if (spawn.px) { p.x = spawn.x; p.y = spawn.y; }
      else { p.x = spawn.x * TILE; p.y = spawn.y * TILE; }
    } else {
      p.x = this.map.spawnPx.x; p.y = this.map.spawnPx.y;
    }
    p.lastSafe = { map: id, x: p.x, y: p.y };
    p.dead = false; p.hp = p.maxHp; p.energy = p.maxEnergy; p.stamina = p.maxStamina;
    p.invuln = 1.4; p.attack = null; p.dodge = null; p.castTimer = 0; p.hurtTimer = 0;
    p.cooldowns = { burst: 0, blink: 0, nova: 0, frost: 0, echo: 0 };
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.zones = [];
    this.effects = [];
    this.particles = [];
    this.damageNumbers = [];
    this.activeBoss = null; this.bossInfo = null; this.arenaLock = null;
    this.interactTarget = null;
    this.portalCooldown = 1.2;
    this.shakeAmt = 0;
    this.spawnMapEnemies();
    this.markExplored(p.x, p.y, 9);
    this.audio.setTrack(this.map.music);
    this.ui.setRegion(this.map);
    this.ui.regionBanner(this.map.name, this.map.sub);
    this.ui.hideBossbar();
    this.ui.refreshObjective();
    this.ui.refreshAbilities();
    if (id === 'depths') this.flags.enteredDepths = true;
    if (id === 'greenfall') this.flags.visitedGreenfall = true;
    if (id === 'kingdom') this.flags.visitedKingdom = true;
    if (id === 'frost') this.flags.visitedFrost = true;
    this.camera.x = p.x; this.camera.y = p.y - 30;
    this.save(true);
    if (opts.intro) {
      this.fade = { alpha: 1, dir: -1 };
      if (!this.settings.tutorial) return;
      setTimeout(() => {
        if (this.state === 'playing') this.ui.toast('WASD move · J attack · K heavy · Space dodge · C block', 'good');
      }, 1400);
    }
  }

  spawnMapEnemies() {
    const level = this.mapLevel();
    for (const tpl of this.map.enemies) {
      if (tpl.boss && this.flags['boss:' + tpl.boss]) continue;
      if (tpl.guardian && this.flags['boss:' + (tpl.boss || 'frostwarden')]) continue;
      const e = new Enemy(this, tpl.type, tpl.x, tpl.y, {
        elite: tpl.elite, boss: tpl.boss, home: tpl.home, level,
      });
      this.enemies.push(e);
      if (tpl.boss) this.arenaBoss = e;
    }
    // ensure the arena boss exists if flagged as not defeated but template missing
  }

  mapLevel() {
    const lvls = { sanctuary: 1, greenfall: 2, kingdom: 5, frost: 7, depths: 9 };
    return lvls[this.mapId] || 1;
  }

  /* ---------------- main loop ---------------- */
  update(dt) {
    this.time += dt;
    if (this.state === 'title' || this.state === 'boot') {
      this.updateAmbient(dt);
      this.updateParticles(dt);
      this.ui.updateTitle(dt);
      return;
    }
    if (this.state === 'dead') {
      this.deathTimer += dt;
      this.updateParticles(dt);
      this.ui.update(dt);
      return;
    }
    if (this.state === 'ending') {
      this.updateParticles(dt);
      this.ui.update(dt);
      return;
    }
    if (this.paused || this.panelOpen || this.dialogueOpen) {
      this.updateParticles(dt * .35);
      this.ui.update(dt);
      return;
    }
    this.playtime += dt;
    this.updateInput();
    this.player.update(dt);
    if (!this.player.dead) {
      for (const e of this.enemies) e.update(dt);
      this.separateEnemies();
      this.updateProjectiles(dt);
      this.updateDrops(dt);
      this.updateZones(dt);
      this.updateBoss(dt);
      this.checkPortals();
      this.checkArenaTrigger();
      this.updateInteraction();
      this.markExplored(this.player.x, this.player.y);
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    }
    this.enemies = this.enemies.filter(e => !(e.dead && e.deathTimer > 1.4));
    this.updateParticles(dt);
    this.updateEffects(dt);
    this.updateDamageNumbers(dt);
    this.updateAmbient(dt);
    this.cameraFollow(dt);
    this.shakeAmt *= Math.pow(.02, dt);
    this.exploreTimer -= dt;
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 25) { this.autosaveTimer = 0; this.save(true); }
    this.ui.update(dt);
  }

  updateInput() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    const i = this.input;
    i.left = x < 0; i.right = x > 0; i.up = y < 0; i.down = y > 0;
    i.sprint = k.has('shift');
    i.block = k.has('c');
    if (i.joyActive) { x = i.joyX; y = i.joyY; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    i.moveX = x; i.moveY = y;
    if (this.mouseActive) {
      const m = this.renderer.screenToWorld(this.lastMouse.x, this.lastMouse.y);
      this.aimWorld.x = m.x; this.aimWorld.y = m.y;
    }
  }

  playerCanAct() {
    return this.state === 'playing' && !this.panelOpen && !this.dialogueOpen && !this.player.dead && !this.paused;
  }

  inCombat() {
    return !!this.activeBoss || this.enemies.some(e => !e.dead && e.aggro && dist(e, this.player) < 240);
  }

  moveEntity(ent, dx, dy, collisionR = 1) {
    const r = (ent.r || 6) * (collisionR || 1);
    if (dx) {
      const nx = ent.x + dx;
      if (!this.collides(nx, ent.y, r)) ent.x = nx;
      else if (ent === this.player) { ent.knockX = 0; }
    }
    if (dy) {
      const ny = ent.y + dy;
      if (!this.collides(ent.x, ny, r)) ent.y = ny;
      else if (ent === this.player) { ent.knockY = 0; }
    }
    ent.x = clamp(ent.x, r + 4, this.map.w * TILE - r - 4);
    ent.y = clamp(ent.y, r + 4, this.map.h * TILE - r - 4);
    if (ent === this.player && this.arenaLock) {
      const a = this.arenaLock;
      const d = Math.hypot(ent.x - a.x, ent.y - a.y);
      const max = a.r - 10;
      if (d > max) {
        const ang = Math.atan2(ent.y - a.y, ent.x - a.x);
        ent.x = a.x + Math.cos(ang) * max;
        ent.y = a.y + Math.sin(ang) * max;
      }
    }
  }

  collides(x, y, r = 6) {
    if (collidesStatic(this.map, x, y, r)) return true;
    for (const it of this.map.interactables) {
      if (it.type !== 'runeGate') continue;
      if (this.gateOpen(it)) continue;
      const gr = it.id === 'dp_gate' ? 34 : 26;
      if (Math.hypot(x - it.x, y - it.y) < gr + r) return true;
    }
    return false;
  }

  gateOpen(inter) {
    if (!inter || !inter.require) return true;
    return inter.require.every(f => !!this.flags[f]);
  }

  separateEnemies() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(e, p);
      if (d < e.r + p.r - 2) {
        const a = angleTo(p.x, p.y, e.x, e.y);
        const push = (e.r + p.r - d) * .5;
        e.x += Math.cos(a) * push; e.y += Math.sin(a) * push;
      }
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.dead) continue;
        const d = dist(a, b);
        const min = a.r + b.r;
        if (d > .01 && d < min) {
          const ang = angleTo(a.x, a.y, b.x, b.y);
          const push = (min - d) * .35;
          a.x -= Math.cos(ang) * push; a.y -= Math.sin(ang) * push;
          b.x += Math.cos(ang) * push; b.y += Math.sin(ang) * push;
        }
      }
    }
  }

  cameraFollow(dt) {
    const p = this.player;
    let tx = p.x, ty = p.y - 14;
    if (this.mouseActive && !this.activeBoss) {
      tx += clamp((this.aimWorld.x - p.x) * .12, -50, 50);
      ty += clamp((this.aimWorld.y - p.y) * .12, -40, 40);
    }
    const k = 1 - Math.pow(.0015, dt);
    this.camera.x = lerp(this.camera.x, tx, k);
    this.camera.y = lerp(this.camera.y, ty, k);
  }

  markExplored(x, y, radius = 5) {
    if (!this.map) return;
    if (!this.exploreTimer || radius > 8) this.exploreTimer = .16;
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        if (ox * ox + oy * oy > radius * radius + 2) continue;
        const tx = cx + ox, ty = cy + oy;
        if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) continue;
        this.map.explored[ty * this.map.w + tx] = 1;
      }
    }
  }

  /* ---------------- input events ---------------- */
  onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (e.repeat) {
      if (e.key === ' ' || key === 'e' || key === 'enter') e.preventDefault();
      return;
    }
    this.keys.add(key);
    if (this.state === 'title') return;
    if (this.panelOpen) {
      if (this.ui.handlePanelKey(key)) { e.preventDefault(); return; }
    }
    if (this.dialogueOpen) {
      if (['e', 'enter', ' ', '1', '2', '3', '4'].includes(key)) {
        e.preventDefault();
        this.ui.advanceDialogue(key);
      }
      if (key === 'escape') this.ui.closeDialogue();
      return;
    }
    if (this.state === 'dead') {
      if (key === 'enter' || key === ' ') { e.preventDefault(); this.respawn(); }
      return;
    }
    if (this.state !== 'playing') return;
    if (key === 'escape' || key === 'p') { e.preventDefault(); this.ui.openPause(); return; }
    if (key === 'i' || key === 'tab') { e.preventDefault(); this.ui.openPanel('inventory'); return; }
    if (key === 'm') { e.preventDefault(); this.ui.openPanel('map'); return; }
    if (key === 'q') { e.preventDefault(); this.ui.openPanel('quests'); return; }
    if (key === 'j') { this.player.startAttack(false); return; }
    if (key === 'k') { this.player.startAttack(true); return; }
    if (key === ' ') { e.preventDefault(); this.player.startDodge(); return; }
    if (key === 'e' || key === 'f') { e.preventDefault(); this.interact(); return; }
    if (key === '1') { this.useAbility('burst'); return; }
    if (key === '2') { this.useAbility('blink'); return; }
    if (key === '3') { this.useAbility('nova'); return; }
    if (key === '4') { this.useAbility('frost'); return; }
    if (key === '5') { this.useAbility('echo'); return; }
  }

  onKeyUp(e) { this.keys.delete(e.key.toLowerCase()); }

  onMouseMove(sx, sy) {
    this.lastMouse.x = sx; this.lastMouse.y = sy; this.mouseActive = true;
  }

  onMouseDown(button) {
    if (!this.playerCanAct()) return;
    if (button === 0) this.player.startAttack(false);
    if (button === 2) this.player.startAttack(true);
  }

  setJoystick(x, y, active) {
    this.input.joyX = x; this.input.joyY = y; this.input.joyActive = active;
    this.mouseActive = false;
  }

  /* ---------------- audio / ui helpers ---------------- */
  finishFade() { this.fade.alpha = 0; this.fade.dir = 0; }

  /* ============================================================
     COMBAT
     ============================================================ */
  skillEffect(key) {
    let total = 0;
    for (const branch of SKILL_BRANCHES) for (const node of branch.nodes) {
      if (this.player && this.player.skills.has(node.id) && node.effect[key] != null) {
        total += node.effect[key];
      }
    }
    return total;
  }

  hasSkill(id) { return !!(this.player && this.player.skills.has(id)); }

  weaponTint() {
    const w = this.player.equipment.weapon;
    if (!w) return 'teal';
    if (w.rarity === 'legendary') return 'gold';
    if (w.kind === 'greatsword' || w.kind === 'axe') return 'gold';
    if (w.baseId === 'frostfall_sword') return 'frost';
    if (w.rarity === 'epic') return 'gold';
    return 'teal';
  }

  playerMelee(heavy, combo) {
    const p = this.player;
    const range = heavy ? 50 : 40;
    const arc = heavy ? 2.6 : 1.9;
    const baseMult = heavy ? 2.2 : [1, 1.08, 1.5][combo] || 1;
    let hits = 0;
    const targets = [...this.enemies];
    for (const e of targets) {
      if (e.dead || e.spawnBlink > 0) continue;
      const d = dist(p, e);
      if (d > range + e.r + 6) continue;
      const a = angleTo(p.x, p.y, e.x, e.y);
      let diff = Math.abs(((a - p.aimAngle + Math.PI * 3) % TAU) - Math.PI);
      if (diff > arc / 2 && d > 18) continue;
      const crit = chance(p.crit / 100);
      let dmg = p.atk * baseMult * (heavy ? p.heavyDmgMult : 1) * (crit ? 1.8 : 1);
      if (e.armored && !heavy) dmg *= .68;
      dmg = e.hurt(dmg, { from: p, source: 'melee', heavy });
      this.showHit(e, dmg, crit, hugeColor(heavy, crit));
      hits++;
      if (p.lifesteal > 0) p.heal(p.lifesteal * dmg);
      this.burst(e.x, e.y - 12, heavy ? 12 : 6, heavy ? '#ffe0a8' : '#dffcf5', { speed: heavy ? 110 : 75, life: .35, size: 1.8, glow: true });
      if (heavy) e.stun(.55);
    }
    // interactive training dummies? none
    if (hits) {
      this.audio.sfx('hit');
      this.shake(heavy ? 7 : 2.6);
      this.hitStop = heavy ? .055 : .02;
    } else this.shake(heavy ? 2 : .5);
  }

  showHit(e, dmg, crit, color) {
    this.addDamageNumber(e.x + rand(-6, 6), e.y - (e.r * 1.9) - 8, `${crit ? '✧' : ''}${Math.round(dmg)}`, crit ? '#ffe6a8' : color || '#f4e7d0', crit, crit || dmg > 40);
    if (crit) this.audio.sfx('crit'); else this.audio.sfx('hit');
  }

  useAbility(id) {
    const p = this.player;
    if (!this.playerCanAct()) return false;
    const ab = ABILITIES[id];
    if (!ab || !p.abilities[id]) { this.ui.toast('Ability not yet awakened', 'bad'); return false; }
    if (this.paused || this.dialogueOpen) return false;
    if (p.cooldowns[id] > 0) { this.audio.sfx('error'); return false; }
    if (p.dodge || p.attack || p.castTimer > 0) return false;
    const cost = Math.round(ab.cost * p.abilityCostMult);
    if (p.energy < cost) { this.ui.toast('Not enough energy', 'bad'); this.audio.sfx('error'); return false; }
    p.spendEnergy(cost);
    let cd = ab.cd;
    if (id === 'blink') cd *= 1 + this.skillEffect('blinkCd');
    p.cooldowns[id] = cd;
    p.startCast(id === 'echo' ? .48 : .3);
    this.audio.sfx('cast');
    const ang = p.aimAngle;
    const dmgMult = p.abilityDmgMult;
    if (id === 'burst') {
      const dmg = (ab.damage + p.atk * .9) * dmgMult * (1 + this.skillEffect('burstDmg'));
      const pierce = (ab.pierce || 0) + this.skillEffect('burstPierce');
      this.projectiles.push(new Projectile(this, {
        x: p.x + Math.cos(ang) * 18, y: p.y - 10 + Math.sin(ang) * 14,
        angle: ang, speed: ab.speed, dmg, friendly: true, r: 7, pierce,
        color: ab.color, kind: 'burst', life: 1.1, owner: p,
      }));
      this.burst(p.x + Math.cos(ang) * 18, p.y - 10 + Math.sin(ang) * 14, 7, ab.color, { speed: 45, life: .3, size: 2, glow: true });
      this.audio.sfx('orb');
    } else if (id === 'blink') {
      const maxD = ab.distance;
      let tx = p.x, ty = p.y;
      for (let s = 8; s <= maxD; s += 8) {
        const nx = p.x + Math.cos(ang) * s, ny = p.y + Math.sin(ang) * s;
        if (this.collides(nx, ny, p.r)) break;
        tx = nx; ty = ny;
      }
      this.effects.push({ type: 'afterimage', x: p.x, y: p.y, t: 0, max: .5, dir: p.facing, flip: p.flip, outfit: p.outfit, accessory: p.accessory });
      p.x = tx; p.y = ty; p.invuln = Math.max(p.invuln, .55);
      this.effects.push({ type: 'ring', x: tx, y: ty - 8, t: 0, max: .55, color: ab.color, radius: 44 });
      this.burst(tx, ty - 8, 14, ab.color, { speed: 95, life: .5, size: 2, glow: true });
      this.audio.sfx('blink');
    } else if (id === 'nova') {
      const dmg = (ab.damage + p.atk * 1.2) * dmgMult;
      this.aoeDamage(p.x, p.y, ab.radius, dmg, { knockback: 240, color: ab.color, stun: .45 });
      this.effects.push({ type: 'ring', x: p.x, y: p.y - 6, t: 0, max: .55, color: ab.color, radius: ab.radius, thick: true });
      this.burst(p.x, p.y - 6, 30, ab.color, { speed: 170, life: .65, size: 2.6, glow: true });
      this.shake(9);
      this.audio.sfx('nova');
    } else if (id === 'frost') {
      const dmg = (ab.damage + p.atk * .8) * dmgMult;
      this.aoeDamage(p.x, p.y, ab.radius, dmg, { color: ab.color, slow: ab.slow || 4, stun: .2 });
      this.effects.push({ type: 'ring', x: p.x, y: p.y - 6, t: 0, max: .9, color: ab.color, radius: ab.radius, frost: true });
      this.burst(p.x, p.y - 6, 28, ab.color, { speed: 130, life: 1.1, size: 2.2, glow: true, gravity: -8 });
      this.audio.sfx('frost');
    } else if (id === 'echo') {
      const radius = ab.radius * (1 + this.skillEffect('echoRadius'));
      const dmg = (ab.damage + p.atk * 2) * dmgMult * (1 + this.skillEffect('echoDmg'));
      this.aoeDamage(p.x, p.y, radius, dmg, { knockback: 300, stun: 1.1, heavy: true });
      this.effects.push({ type: 'ring', x: p.x, y: p.y - 6, t: 0, max: 1, color: ab.color, radius, thick: true, echo: true });
      this.effects.push({ type: 'echoWave', x: p.x, y: p.y - 6, t: 0, max: 1.1, color: ab.color, radius });
      this.burst(p.x, p.y - 8, 50, ab.color, { speed: 220, life: 1.2, size: 3, glow: true });
      this.shake(16);
      this.audio.sfx('echo');
    }
    this.ui.refreshAbilities();
    return true;
  }

  aoeDamage(x, y, radius, dmg, opts = {}) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > radius + e.r) continue;
      const falloff = 1 - clamp((d - radius * .4) / radius, 0, .55);
      const crit = chance(this.player.crit / 100);
      const dealt = e.hurt(dmg * falloff * (crit ? 1.7 : 1), { from: this.player, source: 'ability', heavy: !!opts.heavy });
      this.showHit(e, dealt, crit, opts.color);
      if (e.knockX != null) {
        const a = angleTo(x, y, e.x, e.y);
        e.knockX = Math.cos(a) * (opts.knockback || 120);
        e.knockY = Math.sin(a) * (opts.knockback || 120);
      }
      if (opts.slow) e.slow(opts.slow, .5);
      if (opts.stun) e.stun(opts.stun);
    }
  }

  spawnEnemyProjectile(x, y, angle, speed, dmg, kind = 'shadow', owner = null) {
    const colors = {
      shadow: '#a88ae8', frost: '#a8e8ff', song: '#d0a8ff', fire: '#ff9a6a', thorn: '#9fc46a',
    };
    this.projectiles.push(new Projectile(this, {
      x, y, angle, speed, dmg, friendly: false, r: kind === 'frost' ? 7 : 7,
      color: colors[kind] || '#a88ae8', kind, life: 3, owner, homing: kind === 'song' ? 1.2 : 0,
    }));
  }

  addZone(opts) {
    this.zones.push({
      type: opts.type || 'circle', x: opts.x, y: opts.y, r: opts.r || 40,
      angle: opts.angle || 0, length: opts.length || 160, width: opts.width || 30,
      warn: opts.warn ?? .8, dmg: opts.dmg || 10, color: opts.color || '#c2515d',
      owner: opts.owner || null, root: !!opts.root, t: 0, hit: false, post: .45,
    });
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt;
      if (!z.hit && z.t >= z.warn) {
        z.hit = true;
        const p = this.player;
        let hit = false;
        if (z.type === 'line') {
          const dx = Math.cos(z.angle), dy = Math.sin(z.angle);
          const rx = p.x - z.x, ry = p.y - z.y;
          const proj = rx * dx + ry * dy;
          if (proj > -10 && proj < z.length) {
            const px0 = z.x + dx * proj, py0 = z.y + dy * proj;
            if (Math.hypot(p.x - px0, p.y - py0) < z.width / 2 + p.r) hit = true;
          }
        } else {
          if (Math.hypot(p.x - z.x, p.y - z.y) < z.r + p.r) hit = true;
        }
        if (hit) p.damage(z.dmg, { source: { x: z.x, y: z.y }, knockback: z.type === 'line' ? 180 : 120 });
        this.effects.push({ type: 'zoneBurst', x: z.x, y: z.y, t: 0, max: .5, color: z.color, r: z.r, angle: z.angle, length: z.length, width: z.width, line: z.type === 'line', root: z.root });
        this.burst(z.x, z.y, 14, z.color, { speed: 120, life: .6, size: 2.4, glow: true, gravity: z.root ? -50 : 0 });
        this.shake(4);
        this.audio.sfx(z.root ? 'seal' : 'hit');
      }
    }
    this.zones = this.zones.filter(z => z.t < z.warn + z.post);
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  updateDrops(dt) {
    for (const d of this.drops) d.update(dt);
    this.drops = this.drops.filter(d => !d.dead);
  }

  dropItem(item, x, y) {
    this.drops.push(new Drop(this, x + rand(-8, 8), y + rand(-8, 8), 'item', { item, life: 90, r: 10 }));
  }

  collectDrop(d) {
    const p = this.player;
    if (d.kind === 'gold') {
      p.resources.gold += d.amount;
      this.addDamageNumber(d.x, d.y - 12, `+${d.amount}`, '#f0d9a4', false);
      this.audio.sfx('gold');
    } else if (d.kind === 'crystal') {
      p.resources.crystals += d.amount;
      this.addDamageNumber(d.x, d.y - 12, `+${d.amount} crystal`, '#7fe3d2', false);
      this.audio.sfx('pickup');
      if (this.quests.crystals && this.quests.crystals.status === 'active' && p.resources.crystals >= 8) {
        this.ui.toast('You have enough crystals — return to Keeper Ilse', 'good');
      }
    } else if (d.kind === 'shard') {
      p.resources.shards += d.amount;
      this.addDamageNumber(d.x, d.y - 12, `+${d.amount} shard`, '#c8a6ff', false);
      this.audio.sfx('pickup');
    } else if (d.kind === 'heal') {
      p.heal(d.amount);
      this.audio.sfx('heal');
    } else if (d.kind === 'energy') {
      p.energy = Math.min(p.maxEnergy, p.energy + d.amount);
      this.addDamageNumber(d.x, d.y - 12, `+${d.amount}`, '#7dd0e8', false);
      this.audio.sfx('pickup');
    } else if (d.kind === 'item' && d.item) {
      p.addItem(d.item);
    }
    this.ui.refreshInventoryIfOpen();
  }

  onEnemyKilled(e) {
    const p = this.player;
    p.addXp(e.xp);
    const gold = Math.round(rand(e.goldRange[0], e.goldRange[1]));
    this.drops.push(new Drop(this, e.x, e.y, 'gold', { amount: gold }));
    if (e.elite || e.isBoss) this.drops.push(new Drop(this, e.x, e.y, 'crystal', { amount: e.isBoss ? 2 : 1 }));
    if (chance(e.shardChance || 0)) this.drops.push(new Drop(this, e.x, e.y, 'shard', { amount: e.isBoss ? e.shards || 3 : 1 }));
    if (chance(0.14)) this.drops.push(new Drop(this, e.x, e.y, 'heal', { amount: 24 }));
    if (chance(0.1)) this.drops.push(new Drop(this, e.x, e.y, 'energy', { amount: 22 }));
    if (e.isBoss) {
      this.bossDefeated(e);
      return;
    }
    if (e.elite) {
      const item = makeEquipment(Math.max(3, p.level + 2), chance(.4) ? 'epic' : 'rare', null, 2);
      this.drops.push(new Drop(this, e.x, e.y, 'item', { item, life: 90, r: 11 }));
    } else if (chance(0.16)) {
      const item = makeEquipment(Math.max(2, p.level + 1), null, null, .4);
      this.drops.push(new Drop(this, e.x, e.y, 'item', { item, life: 70, r: 10 }));
    }
    if (e.type === 'wolf' && this.quests.wolves && this.quests.wolves.status === 'active' && this.quests.wolves.progress < 6) {
      this.quests.wolves.progress = (this.quests.wolves.progress || 0) + 1;
      if (this.quests.wolves.progress >= 6) {
        this.ui.toast('The pack is thinned — return to Rook', 'good');
        this.audio.sfx('quest');
      }
      this.ui.refreshObjective();
    }
    this.burst(e.x, e.y - 8, e.elite ? 22 : 10, e.elite ? '#c8a6ff' : '#d8c9a8', { speed: 90, life: .6, size: 2, gravity: 20 });
    this.ui.refreshObjective();
    this.save(true);
  }

  bossDefeated(e) {
    const key = e.bossKey;
    this.flags['boss:' + key] = true;
    this.activeBoss = null; this.arenaLock = null; this.bossInfo = null;
    this.ui.hideBossbar();
    this.audio.setTrack(this.map.music);
    this.audio.sfx('bossdie');
    this.shake(20);
    this.addEffect({ type: 'levelup', x: e.x, y: e.y - 30, t: 0, max: 2 });
    this.burst(e.x, e.y - 20, 70, '#ffe6a8', { speed: 230, life: 1.6, size: 3.2, glow: true, gravity: 20 });
    const p = this.player;
    p.resources.gold += Math.round(rand(e.goldRange[0], e.goldRange[1]));
    p.resources.shards += e.shards || 3;
    p.resources.crystals += 2;
    if (this.map.arena) this.markExplored(e.x, e.y, 12);
    // guaranteed boss loot
    for (let i = 0; i < 2; i++) {
      const rarity = i === 0 ? 'epic' : chance(.45) ? 'legendary' : 'epic';
      const item = makeEquipment(p.level + 4, rarity, null, 3);
      this.drops.push(new Drop(this, e.x + rand(-20, 20), e.y + rand(-14, 14), 'item', { item, life: 120, r: 12 }));
    }
    this.drops.push(new Drop(this, e.x, e.y, 'shard', { amount: e.shards || 3 }));
    const b = BOSSES[key];
    const sub = key === 'chorus' ? 'THE UNDERWORLD IS QUIET' : key === 'hollowking' ? 'THE CROWN IS QUIET' : key === 'frostwarden' ? 'THE PEAK IS QUIET' : 'THE ROOT IS QUIET';
    this.ui.regionBanner((b ? b.name : 'Guardian') + ' FALLS', sub);
    this.ui.toast(`${b ? b.name : 'Guardian'} defeated`, 'good');
    if (key === 'grove') this.ui.toast('The Root Monument can now be awakened', 'good');
    if (key === 'hollowking') this.ui.toast('The Crown Monument can now be awakened', 'good');
    if (key === 'frostwarden') this.ui.toast('The Peak Monument can now be awakened', 'good');
    if (key === 'chorus') this.ui.toast('The Heart of the Echo waits at the altar', 'good');
    this.audio.sfx('quest');
    this.ui.refreshObjective();
    this.save(true);
  }

  startBossFight(boss) {
    if (this.activeBoss || this.flags['boss:' + boss.bossKey]) return;
    this.activeBoss = boss;
    const a = this.map.arena;
    this.arenaLock = a ? { x: a.x, y: a.y, r: a.r + 26 } : null;
    this.bossInfo = { name: boss.name, title: boss.title, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase };
    this.audio.setTrack('boss');
    this.audio.sfx('roar');
    this.shake(12);
    this.ui.showBossbar(boss);
    this.ui.toast(`${boss.name} awakens`, 'bad');
    this.burst(boss.x, boss.y - 20, 40, boss.phase === 2 ? '#ff8a6a' : '#b8d98a', { speed: 180, life: 1.2, size: 3, glow: true });
    this.effects.push({ type: 'ring', x: boss.x, y: boss.y - 10, t: 0, max: 1, color: '#ff9a7a', radius: 110 });
    this.save(true);
  }

  updateBoss(dt) {
    if (!this.activeBoss) return;
    const b = this.activeBoss;
    if (b.dead) { if (!this.flags['boss:' + b.bossKey]) this.bossDefeated(b); return; }
    this.bossInfo.hp = b.hp;
    this.bossInfo.maxHp = b.maxHp;
    this.bossInfo.phase = b.phase;
    this.ui.updateBossbar(this.bossInfo, b);
    if (this.arenaLock && !this.player.dead) {
      const d = Math.hypot(this.player.x - this.arenaLock.x, this.player.y - this.arenaLock.y);
      if (d > this.arenaLock.r - 14) this.arenaWarning = .5;
    }
    this.arenaWarning = Math.max(0, this.arenaWarning - dt);
  }

  checkArenaTrigger() {
    if (!this.map.arena || this.activeBoss || this.flags['boss:' + this.map.arena.flag.replace('boss:', '')]) return;
    const a = this.map.arena;
    const boss = this.enemies.find(e => e.isBoss && e.bossKey === a.boss && !e.dead);
    if (!boss) return;
    if (Math.hypot(this.player.x - a.x, this.player.y - a.y) < a.trigger) {
      this.startBossFight(boss);
    }
  }

  spawnMinion(type, x, y) {
    if (this.enemies.filter(e => !e.dead && !e.isBoss).length > 16) return;
    const e = new Enemy(this, type, x, y, { level: this.mapLevel() });
    e.aggro = true; e.alerted = true;
    this.enemies.push(e);
    this.burst(x, y - 8, 12, '#c8a6ff', { speed: 80, life: .6, size: 2, glow: true });
  }

  nearestEnemy(x, y) {
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ---------------- particles / fx ---------------- */
  spawnParticle(p) {
    if (!this.settings.particles) return;
    if (this.particles.length > (this.settings.quality === 'low' ? 260 : 720)) return;
    this.particles.push({
      x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0,
      life: p.life || .6, max: p.max || p.life || .6,
      size: p.size || 2, color: p.color || '#e8e0cc', glow: !!p.glow,
      gravity: p.gravity || 0, drag: p.drag ?? 1.4, shape: p.shape || 'square',
      rot: p.rot || 0, vr: p.vr || 0,
    });
  }

  burst(x, y, n, color, opts = {}) {
    if (!this.settings.particles) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = opts.angle != null ? opts.angle + rand(-.5, .5) : rand(0, TAU);
      const spd = rand(.25, 1) * (opts.speed || 80);
      this.spawnParticle({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - (opts.gravity ? 0 : 10),
        life: rand(.55, 1.15) * (opts.life || .6), size: rand(.7, 1.5) * (opts.size || 2),
        color: Array.isArray(color) ? pick(color) : color, glow: opts.glow ?? true,
        gravity: opts.gravity || 0, drag: opts.drag ?? 2, shape: opts.shape || (opts.glow ? 'spark' : 'square'),
        vr: rand(-6, 6),
      });
    }
  }

  addEffect(e) { this.effects.push({ t: 0, max: 1, ...e }); }

  updateEffects(dt) {
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < e.max);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += (p.gravity || 0) * dt;
      p.vx *= Math.pow(.05, dt * (p.drag || 1)); p.vy *= Math.pow(.08, dt * (p.drag || 1));
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  updateDamageNumbers(dt) {
    for (const d of this.damageNumbers) { d.t += dt; d.y -= (d.rise || 34) * dt; }
    this.damageNumbers = this.damageNumbers.filter(d => d.t < d.max);
  }

  addDamageNumber(x, y, text, color = '#f4e7d0', crit = false, big = false) {
    this.damageNumbers.push({ x, y, text: String(text), color, crit, big, t: 0, max: crit || big ? 1.05 : .8, rise: 34, vx: rand(-12, 12) });
    if (this.damageNumbers.length > 40) this.damageNumbers.shift();
  }

  updateAmbient(dt) {
    if (!this.settings.particles) return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = this.map.weather === 'snow' ? .06 : .12;
    const wx = this.camera.x + rand(-420, 420);
    const wy = this.camera.y + rand(-300, 300);
    const w = this.map.weather;
    if (w === 'leaves') {
      this.spawnParticle({ x: wx, y: wy - 180, vx: rand(-16, 10), vy: rand(18, 32), life: rand(3, 5), size: rand(1.4, 3), color: pick(['#9fbf6a', '#c8b46a', '#6f9a54']), drag: .2, vr: rand(-2, 2), shape: 'leaf' });
    } else if (w === 'snow') {
      this.spawnParticle({ x: wx, y: wy - 220, vx: rand(-10, 20), vy: rand(22, 42), life: rand(4, 7), size: rand(1.2, 2.8), color: '#e8f2f8', drag: .05, shape: 'dot' });
    } else if (w === 'ash') {
      this.spawnParticle({ x: wx, y: wy - 200, vx: rand(-8, 8), vy: rand(12, 25), life: rand(3, 5), size: rand(1, 2.2), color: pick(['#b8b0a8', '#8a827a', '#d8cfc4']), drag: .1, shape: 'dot' });
    } else if (w === 'motes') {
      this.spawnParticle({ x: wx, y: wy + rand(-40, 140), vx: rand(-6, 6), vy: rand(-14, -4), life: rand(2.5, 4.5), size: rand(1, 2.6), color: pick(['#6fd9c8', '#b8a6ff', '#a8e8ff']), glow: true, drag: .3, shape: 'dot' });
    } else if (w === 'day' && chance(.18)) {
      this.spawnParticle({ x: wx, y: wy + rand(-80, 80), vx: rand(-4, 4), vy: rand(-8, -2), life: rand(2, 4), size: rand(.8, 1.8), color: '#e8d8a0', glow: true, drag: .2, shape: 'dot' });
    }
  }

  shake(n) { if (this.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, n); }

  /* ---------------- player consequences ---------------- */
  onPlayerHurt(dmg, blocked) {
    this.ui.hurtFlash(blocked ? .45 : 1);
    this.shake(blocked ? 2 : 5);
    this.addDamageNumber(this.player.x, this.player.y - 32, `-${Math.round(dmg)}`, blocked ? '#f0d9a4' : '#ff8a8a', false);
    this.burst(this.player.x, this.player.y - 12, blocked ? 10 : 7, blocked ? '#ffe6a8' : '#c2515d', { speed: 90, life: .5, size: 2, glow: true });
    if (!blocked && dmg >= 30) this.ui.toast('That one will leave a mark', 'bad');
  }

  onPlayerDeath() {
    this.state = 'dead';
    this.deathTimer = 0;
    this.keys.clear();
    this.player.blocking = false;
    this.player.dead = true;
    this.ui.showDeath();
    this.save(true);
  }

  respawn() {
    const p = this.player;
    const lost = Math.round(p.resources.gold * .1);
    p.resources.gold = Math.max(0, p.resources.gold - lost);
    this.state = 'playing';
    this.ui.hideDeath();
    this.player.dead = false;
    this.player.hp = this.player.maxHp;
    this.player.energy = this.player.maxEnergy;
    this.player.stamina = this.player.maxStamina;
    this.player.hurtTimer = 0;
    this.player.invuln = 2;
    this.activeBoss = null; this.bossInfo = null; this.arenaLock = null;
    this.ui.hideBossbar();
    const safe = this.player.lastSafe;
    let spawn = null;
    if (safe && safe.map === this.mapId && !this.map.arena) spawn = { px: true, x: safe.x, y: safe.y };
    this.loadMap(this.mapId, spawn);
    this.fade = { alpha: 1, dir: -1 };
    this.ui.toast(lost > 0 ? `You awaken at the last hearth — ${lost} gold lost` : 'You awaken at the last hearth', 'bad');
  }

  /* ---------------- exploration / triggers ---------------- */
  updateInteraction() {
    const p = this.player;
    let best = null, bd = 1e9;
    for (const npc of this.map.npcs) {
      const d = Math.hypot(npc.x - p.x, npc.y - p.y);
      if (d < 54 && d < bd) { bd = d; best = { kind: 'npc', obj: npc, label: `Talk to ${npc.name}` }; }
    }
    for (const it of this.map.interactables) {
      if (it.type === 'npc') continue;
      if (it.type === 'chest' && this.flags['chest:' + it.id]) continue;
      if (it.type === 'crystal' && this.flags['crystal:' + it.id]) continue;
      if (it.type === 'locket' && this.flags.locketFound) continue;
      if (it.type === 'tome' && this.flags.tomeFound) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < (it.r || 42) && d < bd) {
        bd = d;
        best = { kind: 'interact', obj: it, label: this.interactLabel(it) };
      }
    }
    this.interactTarget = best;
    this.ui.setPrompt(best ? best.label : null);
  }

  interactLabel(it) {
    switch (it.type) {
      case 'chest': return 'Open the chest';
      case 'crystal': return 'Gather echo crystal';
      case 'lore': return 'Read';
      case 'sign': return 'Read signpost';
      case 'monument': return `Awaken the ${it.id === 'sanctuary' ? 'Heart' : it.id[0].toUpperCase() + it.id.slice(1)} Monument`;
      case 'brazier': return this.flags['brazier:' + it.id] ? 'The flame burns' : 'Light the brazier';
      case 'rune': return this.flags['rune:' + it.id] ? 'The rune glows' : 'Touch the rune';
      case 'runeGate': return this.gateOpen(it) ? 'The seal is broken' : 'Examine the seal';
      case 'depthWell': return this.flags.depthsOpen ? 'Descend into the Sunken Depths' : 'Examine the old well';
      case 'altar': return 'Touch the Heart of the Echo';
      case 'locket': return 'Take the locket';
      case 'tome': return 'Take the grey ledger';
      default: return 'Interact';
    }
  }

  interact() {
    if (!this.playerCanAct()) return;
    const t = this.interactTarget;
    if (!t) return;
    if (t.kind === 'npc') return this.talkTo(t.obj);
    const it = t.obj;
    switch (it.type) {
      case 'chest': return this.openChest(it);
      case 'crystal': return this.takeCrystal(it);
      case 'lore': return this.readLore(it);
      case 'sign': return this.readSign(it);
      case 'monument': return this.useMonument(it);
      case 'brazier': return this.lightBrazier(it);
      case 'rune': return this.touchRune(it);
      case 'runeGate': return this.examineGate(it);
      case 'depthWell': return this.useWell(it);
      case 'altar': return this.useAltar(it);
      case 'locket': return this.takeLocket(it);
      case 'tome': return this.takeTome(it);
    }
  }

  talkTo(npc) {
    const def = NPCS[npc.key] || NPCS[npc.id];
    if (!def) { this.ui.toast(`${npc.name} has nothing to say`, 'bad'); return; }
    this.dialogueNpc = npc;
    this.dialogueOpen = true;
    this.flags['talked:' + npc.id] = true;
    this.audio.sfx('uiopen');
    const node = def.talk(this);
    this.ui.openDialogue(npc, def, node);
    this.player.moving = false;
  }

  /* ============================================================
     INTERACTABLES
     ============================================================ */
  openChest(it) {
    if (this.flags['chest:' + it.id]) return;
    this.flags['chest:' + it.id] = true;
    const p = this.player;
    const rarity = it.rarity || 'common';
    const item = makeEquipment(Math.max(3, p.level + 3), rarity, null, { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }[rarity] || 0);
    const gold = Math.round(rand(18, 55) * (1 + p.level * .12));
    p.resources.gold += gold;
    if (item) p.addItem(item);
    this.addDamageNumber(it.x, it.y - 24, `+${gold} gold`, '#f0d9a4', false);
    this.burst(it.x, it.y - 12, 18, ['#ffe6a8', '#7fe3d2', '#f0d9a4'], { speed: 120, life: .9, size: 2.2, glow: true, gravity: 25 });
    this.addEffect({ type: 'ring', x: it.x, y: it.y - 10, t: 0, max: .6, color: '#ffe6a8', radius: 42 });
    this.audio.sfx('chest');
    this.ui.toast(`Chest opened — ${gold} gold${item ? ' · ' + item.name : ''}`, 'loot', item ? item.rarity : null);
    this.ui.refreshInventoryIfOpen();
    this.save(true);
  }

  takeCrystal(it) {
    if (this.flags['crystal:' + it.id]) return;
    this.flags['crystal:' + it.id] = true;
    this.player.resources.crystals++;
    this.burst(it.x, it.y - 8, 16, '#7fe3d2', { speed: 90, life: .8, size: 2, glow: true, gravity: -25 });
    this.audio.sfx('pickup');
    this.ui.toast('Echo crystal gathered', 'good');
    if (this.quests.crystals && this.quests.crystals.status === 'active') {
      const need = 8 - this.player.resources.crystals;
      if (need > 0) this.ui.toast(`${need} more crystal${need === 1 ? '' : 's'} for Ilse`, 'good');
      else this.ui.toast('Elise has all she needs — return to her', 'good');
    }
    this.save(true);
  }

  readLore(it) {
    this.flags['lore:' + it.id] = true;
    this.audio.sfx('uiopen');
    this.ui.showLore(it.title || 'A weathered record', it.text || 'The words have worn away.');
  }

  readSign(it) {
    this.audio.sfx('uiopen');
    this.ui.showLore('Road Marker', it.text || 'The paint has faded.');
  }

  useMonument(it) {
    if (it.id === 'sanctuary') {
      this.ui.showLore('The Silent Heart', 'The sanctuary monument does not glow. It is not dead — it is waiting. Somewhere below, something sings against its roots.');
      return;
    }
    if (it.id === 'depths') {
      this.ui.showLore('The Heart of the Echo', 'A stone shaped like a listening ear. The Chorus sleeps beneath it. Touch it when the song has ended.');
      return;
    }
    const req = { greenfall: 'boss:grove', kingdom: 'boss:hollowking', frost: 'boss:frostwarden' }[it.id];
    if (req && !this.flags[req]) {
      this.ui.toast('The monument is dark. Its guardian still holds the way.', 'bad');
      this.audio.sfx('error');
      return;
    }
    if (this.flags['monument:' + it.id]) {
      this.ui.toast('The monument already remembers', 'good');
      return;
    }
    this.flags['monument:' + it.id] = true;
    this.audio.sfx('seal');
    this.audio.sfx('quest');
    this.shake(8);
    this.addEffect({ type: 'levelup', x: it.x, y: it.y - 30, t: 0, max: 2 });
    this.burst(it.x, it.y - 20, 60, ['#7fe3d2', '#ffe6a8', '#b8f5e8'], { speed: 190, life: 1.6, size: 3, glow: true, gravity: -20 });
    const names = { greenfall: 'Root', kingdom: 'Crown', frost: 'Peak' };
    this.ui.toast(`The ${names[it.id]} Monument awakens`, 'good');
    const count = ['greenfall', 'kingdom', 'frost'].filter(k => this.flags['monument:' + k]).length;
    if (count === 3) {
      setTimeout(() => {
        if (this.state === 'playing') {
          this.ui.regionBanner('THREE ECHOES WAKE', 'Return to Elder Maelin at the Sanctuary');
          this.ui.toast('All three monuments are awake — return to Maelin', 'good');
        }
      }, 900);
    } else if (count === 1) {
      this.ui.toast('Two monuments remain', 'good');
    }
    this.refreshObjective();
    this.save(true);
  }

  lightBrazier(it) {
    const key = 'brazier:' + it.id;
    if (this.flags[key]) { this.ui.toast('The flame already burns', 'good'); return; }
    this.flags[key] = true;
    this.audio.sfx('brazier');
    this.burst(it.x, it.y - 18, 22, ['#ffb04a', '#ff7a3a', '#ffe6a8'], { speed: 80, life: .8, size: 2.4, glow: true, gravity: -40 });
    this.addEffect({ type: 'ring', x: it.x, y: it.y - 10, t: 0, max: .5, color: '#ffb04a', radius: 32 });
    this.ui.toast('The brazier catches', 'good');
    const req = this.map.interactables.find(i => i.type === 'runeGate' && i.require && i.require.includes(key));
    if (req && this.gateOpen(req)) {
      setTimeout(() => this.ui.toast('The mountain lock releases', 'good'), 500);
      this.audio.sfx('seal');
    }
    this.save(true);
  }

  touchRune(it) {
    const key = 'rune:' + it.id;
    if (this.flags[key]) { this.ui.toast('The rune already glows', 'good'); return; }
    this.flags[key] = true;
    this.audio.sfx('seal');
    this.burst(it.x, it.y - 10, 18, ['#7fe3d2', '#b8a6ff', '#e0fff9'], { speed: 100, life: .9, size: 2.2, glow: true });
    this.ui.toast('A rune answers your touch', 'good');
    const gate = this.map.interactables.find(i => i.type === 'runeGate' && i.require && i.require.includes(key));
    if (gate && this.gateOpen(gate)) setTimeout(() => this.ui.toast('The deep door opens', 'good'), 500);
    this.save(true);
  }

  examineGate(it) {
    if (this.gateOpen(it)) {
      this.ui.toast('The seal is broken — the way is open', 'good');
    } else {
      const missing = (it.require || []).filter(f => !this.flags[f]).length;
      this.ui.toast(`The seal holds. ${missing} ward${missing === 1 ? '' : 's'} still sleep.`, 'bad');
      this.audio.sfx('error');
    }
  }

  useWell() {
    if (!this.flags.depthsOpen) {
      this.ui.showLore('The Old Well', 'A cold draft rises from the well. Three deep chimes echo up from below — one for root, one for crown, one for frost. The way is not open yet.');
      return;
    }
    this.audio.sfx('portal');
    this.fade = { alpha: 1, dir: -1 };
    this.loadMap('depths', { x: 60, y: 6 });
    this.flags.enteredDepths = true;
    this.ui.regionBanner('THE SUNKEN DEPTHS', 'Beneath the world, something sings');
    this.save(true);
  }

  useAltar() {
    if (!this.flags['boss:chorus']) {
      this.ui.showLore('The Heart of the Echo', 'The altar is cold and still. Somewhere below, the Chorus is still singing. Silence it first.');
      return;
    }
    if (this.flags.endingSeen) {
      this.ui.showLore('The Heart of the Echo', 'The Heart is quiet now. Aetheria remembers, slowly, the way a person remembers a dream.');
      return;
    }
    this.flags.endingSeen = true;
    this.flags.mainComplete = true;
    this.completeQuest('main', true);
    this.state = 'ending';
    this.audio.setTrack('sanctuary');
    this.audio.sfx('echo');
    this.shake(14);
    this.burst(this.player.x, this.player.y - 12, 80, ['#ffe6a8', '#7fe3d2', '#e0fff9'], { speed: 220, life: 2, size: 3, glow: true, gravity: -20 });
    this.addEffect({ type: 'ring', x: this.player.x, y: this.player.y - 8, t: 0, max: 1.4, color: '#ffe6a8', radius: 190, thick: true });
    this.save(true);
    this.ui.showEnding();
  }

  takeLocket(it) {
    if (this.flags.locketFound) return;
    this.flags.locketFound = true;
    this.audio.sfx('pickup');
    this.burst(it.x, it.y - 8, 14, '#e0b080', { speed: 80, life: .8, size: 2, glow: true });
    this.ui.toast('You found a root-shaped locket', 'good');
    this.ui.showLore('A Locket Lost', 'The clasp is shaped like a tiny door. Inside, a faded portrait of a woman who is not quite smiling. It smells faintly of rosemary.');
    this.refreshObjective();
    this.save(true);
  }

  takeTome(it) {
    if (this.flags.tomeFound) return;
    this.flags.tomeFound = true;
    this.audio.sfx('pickup');
    this.burst(it.x, it.y - 8, 14, '#c8a6ff', { speed: 80, life: .8, size: 2, glow: true });
    this.ui.toast('You found the grey ledger', 'good');
    this.ui.showLore('The Keeper\'s Ledger', 'The last entry is written in a hand that is forgetting how to be a hand: "The monuments turned away because we asked them to hold too much. Tell the keeper the well is a lid, not a door."');
    this.refreshObjective();
    this.save(true);
  }

  checkPortals() {
    if (this.portalCooldown > 0 || this.player.dead) return;
    const p = this.player;
    for (const portal of this.map.portals) {
      const r = portal.rect;
      if (p.x > r.x && p.x < r.x + r.w && p.y > r.y - 4 && p.y < r.y + r.h + 8) {
        if (portal.require && !portal.require.every(f => this.flags[f])) {
          this.ui.toast(portal.lockedText || 'Sealed', 'bad');
          this.portalCooldown = 2;
          return;
        }
        this.portalCooldown = 2;
        this.audio.sfx('portal');
        this.fade = { alpha: 1, dir: -1 };
        this.loadMap(portal.target, portal.spawn);
        if (portal.target === 'depths') this.flags.enteredDepths = true;
        return;
      }
    }
  }

  /* ============================================================
     QUESTS
     ============================================================ */
  startQuest(id) {
    if (this.quests[id]) return false;
    const def = QUEST_DATA[id];
    if (!def) return false;
    this.quests[id] = { id, status: 'active', progress: 0, acceptedAt: Date.now() };
    if (id === 'main') this.flags.mainStarted = true;
    this.audio.sfx('quest');
    this.ui.toast(`Quest started — ${def.name}`, 'good');
    this.ui.refreshObjective();
    this.save(true);
    return true;
  }

  completeQuest(id, silent = false) {
    const q = this.quests[id];
    const def = QUEST_DATA[id];
    if (!def) return false;
    if (q && q.status === 'done') return false;
    this.quests[id] = { ...(q || {}), id, status: 'done', progress: q ? q.progress : 0, completedAt: Date.now() };
    const r = def.rewards || {};
    const p = this.player;
    if (id === 'crystals') p.resources.crystals = Math.max(0, p.resources.crystals - 8);
    if (r.xp) p.addXp(r.xp);
    if (r.gold) p.resources.gold += r.gold;
    if (r.shards) p.resources.shards += r.shards;
    if (r.skillPoints) p.skillPoints += r.skillPoints;
    if (r.item) {
      const item = makeQuestItem(r.item);
      if (item) p.addItem(item);
    }
    if (id === 'main') this.flags.mainComplete = true;
    this.audio.sfx('quest');
    if (!silent) this.ui.toast(`Quest complete — ${def.name}`, 'good');
    this.ui.refreshObjective();
    this.save(true);
    return true;
  }

  questStep(id) {
    const def = QUEST_DATA[id];
    if (!def) return null;
    const q = this.quests[id];
    if (!q || q.status === 'done') return null;
    for (let i = 0; i < def.steps.length; i++) {
      const step = def.steps[i];
      let done = false;
      try { done = step.done(this); } catch { done = false; }
      if (!done) {
        const text = typeof step.text === 'function' ? step.text(this) : step.text;
        return { index: i, step, text, marker: step.marker };
      }
    }
    return null;
  }

  refreshObjective() {
    const active = Object.values(this.quests).filter(q => q.status === 'active');
    const tracked = this.trackedQuest && this.quests[this.trackedQuest] && this.quests[this.trackedQuest].status === 'active'
      ? this.trackedQuest : null;
    const main = this.quests.main && this.quests.main.status === 'active' ? 'main' : null;
    const id = tracked || main || (active[0] && active[0].id);
    if (!id) {
      if (this.flags.endingSeen) {
        this.ui.setObjective('Aetheria Reborn', 'The echo is quiet — walk where you wish');
        this.objectiveMarker = null;
      } else if (this.flags.mainComplete) {
        this.ui.setObjective('Main Quest', 'The echo is at rest');
        this.objectiveMarker = null;
      } else {
        this.ui.setObjective('Main Quest', 'Speak with Elder Maelin in the Sanctuary');
        this.objectiveMarker = { map: 'sanctuary', x: 34 * 16, y: 20 * 16 };
      }
      return;
    }
    const def = QUEST_DATA[id];
    const step = this.questStep(id);
    if (step) {
      this.ui.setObjective(def.name, step.text);
      this.objectiveMarker = step.marker ? { ...step.marker } : null;
      const seen = this.questStepSeen[id];
      if (seen !== step.step.id) {
        this.questStepSeen[id] = step.step.id;
        if (seen) { this.ui.toast(`Objective updated — ${step.text}`, 'good'); this.audio.sfx('ui'); }
      }
    } else {
      this.ui.setObjective(def.name, 'Return to the quest giver');
      this.objectiveMarker = null;
    }
  }

  openDepths() {
    if (this.flags.depthsOpen) return;
    this.flags.depthsOpen = true;
    this.flags.mainReturned = true;
    this.audio.sfx('seal');
    this.audio.sfx('portal');
    this.ui.toast('The old well opens its eye', 'good');
    this.ui.regionBanner('THE WELL OPENS', 'Descend when you are ready');
    this.burst(25 * 16, 23 * 16, 40, ['#7fe3d2', '#b8a6ff', '#ffe6a8'], { speed: 130, life: 1.4, size: 2.6, glow: true, gravity: -30 });
    this.refreshObjective();
    this.save(true);
  }

  /* ============================================================
     SHOP / FORGE / SKILLS
     ============================================================ */
  openShop(id) {
    this.ui.closeDialogue();
    this.ui.openPanel('shop', { shop: id });
  }

  openForge() {
    this.ui.closeDialogue();
    this.ui.openPanel('forge');
  }

  buyItem(shopId, uid) {
    const stock = SHOP_STOCK[shopId] || [];
    const item = stock.find(i => i.uid === uid);
    if (!item) return false;
    const p = this.player;
    const price = priceOf(item);
    if (p.resources.gold < price) { this.ui.toast('Not enough gold', 'bad'); this.audio.sfx('error'); return false; }
    p.resources.gold -= price;
    let bought;
    if (item.stack) {
      bought = { ...item, uid: undefined, qty: 1 };
      bought.uid = Math.max(1, Math.floor(Math.random() * 1e9));
      item.qty = (item.qty || 1) - 1;
      if (item.qty <= 0) stock.splice(stock.indexOf(item), 1);
      p.addItem(bought, true);
      this.ui.toast(`${item.name} purchased`, 'good');
    } else {
      stock.splice(stock.indexOf(item), 1);
      p.addItem(item, true);
      this.ui.toast(`${item.name} purchased`, 'loot', item.rarity);
    }
    this.audio.sfx('gold');
    this.ui.refreshPanel();
    this.save(true);
    return true;
  }

  sellItem(uid) {
    const idx = this.player.inventory.findIndex(s => s && s.uid === uid);
    if (idx < 0) return false;
    const item = this.player.inventory[idx];
    const price = Math.max(1, Math.round((item.value || 10) * .5));
    if ((item.qty || 1) > 1) item.qty -= 1; else this.player.inventory[idx] = null;
    this.player.resources.gold += price;
    this.ui.toast(`Sold ${item.name} for ${price} gold`, 'good');
    this.audio.sfx('gold');
    this.ui.refreshPanel();
    this.save(true);
    return true;
  }

  forgeUpgrade(slot) {
    const item = this.player.equipment[slot];
    if (!item) { this.ui.toast('Nothing equipped there', 'bad'); return; }
    const lvl = item.upgrade || 0;
    if (lvl >= 5) { this.ui.toast('This item is fully awakened', 'bad'); return; }
    const shardCost = 2 + lvl;
    const goldCost = 40 + lvl * 55 + item.level * 8;
    if (this.player.resources.shards < shardCost || this.player.resources.gold < goldCost) {
      this.ui.toast(`Requires ${shardCost} shards and ${goldCost} gold`, 'bad');
      this.audio.sfx('error');
      return;
    }
    this.player.resources.shards -= shardCost;
    this.player.resources.gold -= goldCost;
    item.upgrade = lvl + 1;
    if (!item.stats) item.stats = {};
    for (const k of Object.keys(item.stats)) {
      if (k === 'lifesteal') item.stats[k] = Math.round((item.stats[k] + .01) * 100) / 100;
      else if (k === 'speed' || k === 'crit') item.stats[k] = Math.round(item.stats[k] + 1);
      else item.stats[k] = Math.round(item.stats[k] * 1.12 + 1);
    }
    item.name = item.name.replace(/ \+\d+$/, '') + ` +${lvl + 1}`;
    this.player.recalc();
    this.audio.sfx('seal');
    this.ui.toast(`${item.name} grows stronger`, 'good');
    this.ui.refreshPanel();
    this.save(true);
  }

  unlockSkill(nodeId) {
    const p = this.player;
    if (p.skills.has(nodeId)) return;
    let node = null, branch = null;
    for (const b of SKILL_BRANCHES) for (const n of b.nodes) if (n.id === nodeId) { node = n; branch = b; }
    if (!node) return;
    if (node.req && !p.skills.has(node.req)) { this.ui.toast('Requires an earlier skill', 'bad'); this.audio.sfx('error'); return; }
    if (p.skillPoints < node.cost) { this.ui.toast('Not enough skill points', 'bad'); this.audio.sfx('error'); return; }
    p.skillPoints -= node.cost;
    p.skills.add(nodeId);
    p.recalc();
    this.audio.sfx('levelup');
    this.ui.toast(`Skill learned — ${node.name}`, 'good');
    this.ui.refreshPanel();
    this.save(true);
  }

  setOutfit(i) {
    if (!this.player.unlockedOutfits.includes(i)) {
      this.ui.toast('Outfit not yet unlocked', 'bad');
      return;
    }
    this.player.outfit = i;
    this.audio.sfx('ui');
    this.ui.refreshPanel();
    this.save(true);
  }

  setAccessory(i) {
    if (!this.player.unlockedAccessories.includes(i)) { this.ui.toast('Accessory not unlocked', 'bad'); return; }
    this.player.accessory = i;
    this.audio.sfx('ui');
    this.ui.refreshPanel();
    this.save(true);
  }

  applyCosmetic(item) {
    if (!item || item.category !== 'cosmetic') return;
    if (item.outfit != null && !this.player.unlockedOutfits.includes(item.outfit)) {
      this.player.unlockedOutfits.push(item.outfit);
      this.player.removeItem(item.uid);
      this.ui.toast(`${OUTFIT_UNLOCK_NAMES[item.outfit] || 'New outfit'} unlocked`, 'good');
      this.audio.sfx('levelup');
      this.ui.refreshPanel();
      this.save(true);
    }
  }

  handleDialogueAction(action, node, npc, def) {
    if (!action) return;
    if (action.action === 'close') { this.ui.closeDialogue(); return; }
    if (action.action === 'node') { this.ui.setDialogueNode(action.next, def, npc); return; }
    if (action.action === 'startQuest') {
      this.startQuest(action.quest);
      if (action.reply) this.ui.setDialogueNode(action.reply, def, npc);
      else this.ui.closeDialogue();
      return;
    }
    if (action.action === 'completeQuest') {
      const ok = this.completeQuest(action.quest);
      this.ui.closeDialogue();
      if (ok) {
        const qdef = QUEST_DATA[action.quest];
        if (qdef && qdef.id === 'main') this.ui.showEnding();
      }
      return;
    }
    if (action.action === 'shop') { this.openShop(action.shop); return; }
    if (action.action === 'forge') { this.openForge(); return; }
    if (action.action === 'action') {
      if (action.do === 'openDepths') {
        this.openDepths();
        if (action.reply) this.ui.setDialogueNode(action.reply, def, npc);
        else this.ui.closeDialogue();
      }
      return;
    }
  }
}

const OUTFIT_UNLOCK_NAMES = ['Wanderer', 'Ember', 'Frost', 'Royal', 'Mosscloak', 'Ivory'];

