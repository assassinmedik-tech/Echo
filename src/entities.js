/* ============================================================
   ECHOES OF THE FALLEN — player, enemies, projectiles, loot
   ============================================================ */
import { BASE_STATS, ABILITIES, ENEMY_TYPES, BOSSES, xpToNext, makeNamedEquipment, makeConsumable } from './items.js';
import { PLAYER_ANIM, OUTFITS, ACCESSORIES, ENEMY_DIMS } from './sprites.js';
import { collidesStatic, isWaterAt } from './world.js';
import { clamp, rand, pick, chance, angleTo, dist, dirFromVec, TAU, lerp } from './util.js';

const REGION_LEVEL = { sanctuary: 1, greenfall: 2, kingdom: 5, frost: 7, depths: 9 };
const SKILL_KEYS = ['abilityDmg', 'abilityCost', 'burstDmg', 'burstPierce', 'echoDmg', 'echoRadius',
  'speed', 'blinkCd', 'iframes', 'dodgeCost', 'staminaRegen', 'maxHp', 'blockDmg', 'blockStamina',
  'heavyDmg', 'revive'];

/* ================= PLAYER ================= */
export class Player {
  constructor(game) {
    this.game = game;
    this.x = 34 * 16;
    this.y = 46 * 16;
    this.r = 7;
    this.level = 1;
    this.xp = 0;
    this.skillPoints = 0;
    this.skills = new Set();
    this.resources = { gold: 40, crystals: 0, shards: 0 };
    this.inventory = new Array(24).fill(null);
    this.equipment = { weapon: null, armor: null, charm: null };
    this.outfit = 0;
    this.accessory = 0;
    this.unlockedOutfits = [0];
    this.unlockedAccessories = [0, 1, 3];
    this.hp = 100; this.energy = 100; this.stamina = 100;
    this.maxHp = 100; this.maxEnergy = 100; this.maxStamina = 100;
    this.atk = 10; this.def = 0; this.speed = 150; this.crit = 5;
    this.energyRegen = 10; this.staminaRegen = 26; this.lifesteal = 0;
    this.abilityDmgMult = 1; this.abilityCostMult = 1; this.heavyDmgMult = 1;
    this.blockDmgMult = 0.25; this.dodgeCostMult = 1; this.iframeBonus = 0;
    this.hasRevive = false; this.reviveTimer = 0;
    this.cooldowns = { burst: 0, blink: 0, nova: 0, frost: 0, echo: 0 };
    this.abilities = {};
    this.staminaDelay = 0; this.energyDelay = 0;
    this.aimAngle = Math.PI / 2;
    this.facing = 'down';
    this.flip = false;
    this.moving = false;
    this.state = 'idle';
    this.animTime = 0; this.frame = 0;
    this.invuln = 0; this.hurtTimer = 0; this.hitFlash = 0;
    this.attack = null; this.comboStep = 0; this.comboWindow = 0;
    this.castTimer = 0;
    this.dodge = null;
    this.blocking = false;
    this.dead = false;
    this.knockX = 0; this.knockY = 0;
    this.stepTimer = 0;
    this.lastSafe = { map: 'sanctuary', x: this.x, y: this.y };
    this.recalc(true);
    this.hp = this.maxHp; this.energy = this.maxEnergy; this.stamina = this.maxStamina;
    // starter kit
    const blade = makeNamedEquipment('rusted_blade', 1, 'common');
    const cloak = makeNamedEquipment('travelers_cloak', 1, 'common');
    if (blade) this.equipment.weapon = blade;
    if (cloak) this.equipment.armor = cloak;
    this.inventory[0] = makeConsumable('health_potion', 2);
    this.inventory[1] = makeConsumable('energy_potion', 1);
    this.recalc(true);
    this.hp = this.maxHp;
  }

  recalc(full = false) {
    const oldMax = this.maxHp;
    let maxHp = 100 + (this.level - 1) * 14;
    let maxEnergy = 100 + (this.level - 1) * 7;
    let maxStamina = 100 + (this.level - 1) * 4;
    let atk = 10 + (this.level - 1) * 2.4;
    let def = (this.level - 1) * 0.7;
    let speed = BASE_STATS.speed;
    let crit = BASE_STATS.crit;
    let energyRegen = BASE_STATS.energyRegen + (this.level - 1) * 0.25;
    let staminaRegen = BASE_STATS.staminaRegen;
    let lifesteal = 0;
    for (const slot of ['weapon', 'armor', 'charm']) {
      const it = this.equipment[slot];
      if (!it || !it.stats) continue;
      const s = it.stats;
      maxHp += s.hp || 0; maxEnergy += s.energy || 0;
      atk += s.atk || 0; def += s.def || 0; speed += s.speed || 0;
      crit += s.crit || 0; energyRegen += s.regen || 0; lifesteal += s.lifesteal || 0;
    }
    const sk = k => this.game.skillEffect(k);
    maxHp += sk('maxHp');
    speed *= 1 + sk('speed');
    staminaRegen *= 1 + sk('staminaRegen');
    this.maxHp = Math.round(maxHp);
    this.maxEnergy = Math.round(maxEnergy);
    this.maxStamina = Math.round(maxStamina);
    this.atk = Math.round(atk * 10) / 10;
    this.def = Math.round(def * 10) / 10;
    this.speed = speed;
    this.crit = Math.min(60, crit);
    this.energyRegen = energyRegen;
    this.staminaRegen = staminaRegen;
    this.lifesteal = Math.min(0.3, lifesteal);
    this.abilityDmgMult = 1 + sk('abilityDmg');
    this.abilityCostMult = Math.max(0.5, 1 + sk('abilityCost'));
    this.heavyDmgMult = 1 + sk('heavyDmg');
    this.blockDmgMult = Math.max(0.08, 0.25 - sk('blockDmg'));
    this.dodgeCostMult = Math.max(0.5, 1 + (sk('dodgeCost') || 0));
    this.iframeBonus = sk('iframes') || 0;
    this.hasRevive = !!this.game.hasSkill('second_wind');
    for (const [id, ab] of Object.entries(ABILITIES)) {
      this.abilities[id] = this.level >= ab.unlockLevel;
    }
    if (full) { this.hp = this.maxHp; this.energy = this.maxEnergy; this.stamina = this.maxStamina; }
    else {
      this.hp = Math.min(this.hp, this.maxHp);
      if (this.maxHp > oldMax && this.hp > 0) this.hp += this.maxHp - oldMax;
      this.hp = Math.min(this.hp, this.maxHp);
      this.energy = Math.min(this.energy, this.maxEnergy);
      this.stamina = Math.min(this.stamina, this.maxStamina);
    }
  }

  addXp(amount) {
    if (!amount || amount <= 0) return;
    this.xp += Math.round(amount);
    let leveled = false;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.skillPoints++;
      leveled = true;
      for (const [id, ab] of Object.entries(ABILITIES)) {
        if (this.level === ab.unlockLevel) {
          this.game.ui.toast(`New ability unlocked — ${ab.name}`, 'good');
        }
      }
    }
    if (leveled) {
      this.recalc();
      this.hp = this.maxHp;
      this.energy = this.maxEnergy;
      this.stamina = this.maxStamina;
      this.game.ui.levelUp(this.level);
      this.game.audio.sfx('levelup');
      this.game.addEffect({ type: 'levelup', x: this.x, y: this.y - 18, t: 0, max: 1.6 });
      this.game.burst(this.x, this.y - 12, 34, '#ffe6a8', { speed: 100, life: 1, size: 2, glow: true });
    }
    this.game.ui.refreshAbilities();
  }

  unlockedAbilities() { return Object.keys(ABILITIES).filter(id => this.abilities[id]); }

  addItem(item, silent = false) {
    if (!item) return false;
    if (item.stack || item.qty != null) {
      for (const slot of this.inventory) {
        if (slot && slot.id === item.id && (slot.qty || 0) < 99) {
          slot.qty = (slot.qty || 1) + (item.qty || 1);
          if (!silent) this.game.ui.toast(`${item.name}${item.qty > 1 ? ' ×' + item.qty : ''}`, 'loot', item.rarity);
          return true;
        }
      }
    }
    const idx = this.inventory.findIndex(s => !s);
    if (idx < 0) {
      this.game.dropItem(item, this.x, this.y);
      this.game.ui.toast('Inventory full — item dropped', 'bad');
      return false;
    }
    this.inventory[idx] = item;
    if (!silent) {
      this.game.ui.toast(`${item.name}${item.qty > 1 ? ' ×' + item.qty : ''}`, 'loot', item.rarity);
      this.game.audio.sfx('pickup');
    }
    return true;
  }

  removeItem(uid, qty = 1) {
    const idx = this.inventory.findIndex(s => s && s.uid === uid);
    if (idx < 0) return null;
    const item = this.inventory[idx];
    if ((item.qty || 1) > qty) { item.qty -= qty; return item; }
    this.inventory[idx] = null;
    return item;
  }

  useConsumable(uid) {
    const idx = this.inventory.findIndex(s => s && s.uid === uid);
    if (idx < 0) return;
    const item = this.inventory[idx];
    if (item.category !== 'consumable' || !item.use) return;
    let used = false;
    if (item.use.hp) {
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + item.use.hp);
      if (this.hp > before) used = true;
      this.game.addDamageNumber(this.x, this.y - 28, `+${Math.round(this.hp - before)}`, '#8fd6a0', false);
    }
    if (item.use.energy) {
      const before = this.energy;
      this.energy = Math.min(this.maxEnergy, this.energy + item.use.energy);
      if (this.energy > before) used = true;
    }
    if (item.use.flee) {
      used = true;
      for (const e of this.game.enemies) if (!e.dead) { e.aggro = false; e.attackCd = 2.5; e.stun(1.4); }
      this.game.burst(this.x, this.y, 26, '#c8c8d8', { speed: 60, life: .7, size: 3 });
    }
    if (!used) { this.game.ui.toast('Already at full strength', 'bad'); return; }
    this.hp = Math.min(this.maxHp, this.hp);
    this.energy = Math.min(this.maxEnergy, this.energy);
    item.qty--;
    if (item.qty <= 0) this.inventory[idx] = null;
    this.game.audio.sfx('heal');
    this.game.addEffect({ type: 'heal', x: this.x, y: this.y - 6, t: 0, max: .8 });
    this.game.ui.refreshInventoryIfOpen();
  }

  equip(uid) {
    const item = this.inventory.find(s => s && s.uid === uid);
    if (!item || item.category !== 'equipment') return;
    const slot = item.type;
    const old = this.equipment[slot];
    this.equipment[slot] = item;
    this.inventory[this.inventory.indexOf(item)] = old || null;
    this.recalc();
    this.game.audio.sfx('ui');
    this.game.ui.toast(`${item.name} equipped`, 'good', item.rarity);
    this.game.ui.refreshInventoryIfOpen();
  }

  unequip(slot) {
    const item = this.equipment[slot];
    if (!item) return;
    const idx = this.inventory.findIndex(s => !s);
    if (idx < 0) { this.game.ui.toast('Inventory full', 'bad'); return; }
    this.inventory[idx] = item;
    this.equipment[slot] = null;
    this.recalc();
    this.game.ui.refreshInventoryIfOpen();
  }

  spendEnergy(cost) {
    if (this.energy < cost) return false;
    this.energy -= cost; this.energyDelay = 0.6; return true;
  }
  spendStamina(cost) {
    if (this.stamina < cost) return false;
    this.stamina -= cost; this.staminaDelay = 0.5; return true;
  }

  startAttack(heavy = false) {
    if (this.dead || this.dodge || this.castTimer > 0 || this.hurtTimer > 0.18 || this.blocking) return false;
    if (this.attack && this.attack.t < this.attack.dur * 0.62) return false;
    const cost = heavy ? 22 : 8;
    if (!this.spendStamina(cost)) { this.game.ui.toast('Out of stamina', 'bad'); return false; }
    if (!heavy) this.comboStep = this.comboWindow > 0 ? (this.comboStep + 1) % 3 : 0;
    else this.comboStep = 0;
    this.comboWindow = 0;
    const dur = heavy ? 0.44 : 0.25 + this.comboStep * 0.02;
    this.attack = { heavy, t: 0, dur, hit: false, combo: this.comboStep };
    this.state = 'attack';
    this.facing = this.facingFromAim();
    const lunge = heavy ? 90 : 48;
    this.knockX = Math.cos(this.aimAngle) * lunge;
    this.knockY = Math.sin(this.aimAngle) * lunge;
    this.game.audio.sfx(heavy ? 'heavy' : 'swing');
    this.game.addEffect({
      type: 'slash', x: this.x + Math.cos(this.aimAngle) * 16, y: this.y - 8 + Math.sin(this.aimAngle) * 12,
      angle: this.aimAngle, t: 0, max: heavy ? .34 : .24, heavy, tint: this.game.weaponTint(),
    });
    return true;
  }

  startDodge() {
    if (this.dead || this.dodge || this.hurtTimer > 0.2) return false;
    const cost = 28 * this.dodgeCostMult;
    if (!this.spendStamina(cost)) { this.game.ui.toast('Not enough stamina', 'bad'); return false; }
    let ax = this.game.input.moveX, ay = this.game.input.moveY;
    if (Math.abs(ax) + Math.abs(ay) < 0.1) { ax = Math.cos(this.aimAngle); ay = Math.sin(this.aimAngle); }
    const len = Math.hypot(ax, ay) || 1;
    this.dodge = { t: 0, dur: .3, x: ax / len, y: ay / len };
    this.invuln = Math.max(this.invuln, .26 + this.iframeBonus);
    this.state = 'dodge';
    this.game.audio.sfx('dodge');
    this.game.burst(this.x, this.y - 8, 8, '#b8ddd4', { speed: 50, life: .4, size: 2, gravity: -20 });
    return true;
  }

  startCast(dur = .32) {
    this.castTimer = dur;
    this.state = 'cast';
    this.facing = this.facingFromAim();
  }

  facingFromAim() {
    const a = this.aimAngle;
    this.flip = Math.cos(a) < 0;
    if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) return 'side';
    return Math.sin(a) > 0 ? 'down' : 'up';
  }

  update(dt) {
    if (this.dead) return;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.castTimer = Math.max(0, this.castTimer - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.reviveTimer = Math.max(0, this.reviveTimer - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);
    this.energyDelay = Math.max(0, this.energyDelay - dt);
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);

    if (this.energyDelay <= 0) this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);
    if (this.staminaDelay <= 0 && !this.attack && !this.dodge) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
    }

    // applied knockback / lunge
    if (Math.abs(this.knockX) + Math.abs(this.knockY) > 2) {
      this.game.moveEntity(this, this.knockX * dt, this.knockY * dt, 0.55);
      this.knockX *= Math.pow(0.0008, dt);
      this.knockY *= Math.pow(0.0008, dt);
    } else { this.knockX = this.knockY = 0; }

    // aim
    if (this.game.mouseActive) {
      const m = this.game.aimWorld;
      this.aimAngle = angleTo(this.x, this.y - 8, m.x, m.y);
    } else if (Math.abs(this.game.input.moveX) + Math.abs(this.game.input.moveY) > .15 && !this.attack) {
      this.aimAngle = angleTo(0, 0, this.game.input.moveX, this.game.input.moveY);
    }
    this.facing = this.facingFromAim();

    // dodge
    if (this.dodge) {
      this.dodge.t += dt;
      const k = 1 - Math.pow(this.dodge.t / this.dodge.dur, 2);
      const spd = 520 * (0.5 + k * 0.5);
      this.game.moveEntity(this, this.dodge.x * spd * dt, this.dodge.y * spd * dt, 1);
      if (Math.random() < .6) this.game.burst(this.x, this.y - 6, 1, '#9fd8cc', { speed: 12, life: .28, size: 2 });
      if (this.dodge.t >= this.dodge.dur) { this.dodge = null; this.state = 'idle'; }
      this.animTime += dt;
      this.frame = Math.min(2, (this.animTime * 16) | 0);
      return;
    }

    // attack progression
    if (this.attack) {
      const a = this.attack;
      a.t += dt;
      if (!a.hit && a.t >= (a.heavy ? .15 : .09)) {
        a.hit = true;
        this.game.playerMelee(a.heavy, a.combo);
      }
      if (a.t >= a.dur) {
        this.attack = null;
        this.state = 'idle';
        if (!a.heavy) this.comboWindow = .45;
      } else {
        this.animTime += dt;
        const anim = PLAYER_ANIM.attack;
        this.frame = Math.min(anim.frames - 1, (a.t / a.dur * anim.frames) | 0);
        return;
      }
    }

    if (this.castTimer > 0) {
      this.animTime += dt;
      this.frame = Math.min(3, ((.32 - this.castTimer) / .32 * 4) | 0);
      return;
    }

    // block
    const wantBlock = this.game.input.block && this.hurtTimer <= 0 && this.stamina > 4;
    this.blocking = wantBlock && this.game.playerCanAct();
    if (this.blocking) {
      this.state = 'block';
      this.stamina = Math.max(0, this.stamina - 4 * dt);
      this.staminaDelay = .2;
      this.frame = 0;
      this.moving = false;
      return;
    }

    // movement
    let mx = this.game.input.moveX, my = this.game.input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.moving = len > .12 && this.hurtTimer <= .18;
    if (this.moving) {
      const sprint = this.game.input.sprint && this.stamina > 2 ? 1.36 : 1;
      if (sprint > 1) { this.stamina = Math.max(0, this.stamina - 7 * dt); this.staminaDelay = .25; }
      const spd = this.speed * (this.hurtTimer > 0 ? .45 : 1) * sprint;
      this.game.moveEntity(this, mx * spd * dt, my * spd * dt, 1);
      this.state = sprint > 1 ? 'run' : 'walk';
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = sprint > 1 ? .27 : .36; this.game.audio.sfx('step'); }
    } else if (this.hurtTimer > 0) {
      this.state = 'hurt';
    } else {
      this.state = 'idle';
    }
    if (!this.game.map.discovered) this.game.map.discovered = true;
    if (this.moving) this.game.markExplored(this.x, this.y);
    this.animTime += dt;
    const anim = PLAYER_ANIM[this.state] || PLAYER_ANIM.idle;
    const fps = anim.fps * (this.state === 'walk' ? (this.game.input.sprint ? 1.1 : 1) : 1);
    this.frame = anim.loop ? ((this.animTime * fps) | 0) % anim.frames : Math.min(anim.frames - 1, (this.animTime * fps) | 0);
    if (this.state === 'idle' || this.state === 'walk' || this.state === 'run') {
      if (!this.game.inCombat()) this.lastSafe = { map: this.game.mapId, x: this.x, y: this.y };
    }
  }

  damage(amount, opts = {}) {
    if (this.dead) return 0;
    if (this.invuln > 0 || (this.dodge && this.dodge.t < this.dodge.dur * .8)) return 0;
    let dmg = Math.max(1, amount);
    dmg *= 1 - clamp(this.def / (this.def + 70), 0, .55);
    let blocked = false;
    if (this.blocking && !opts.unblockable) {
      let facingHit = true;
      if (opts.source) {
        const a = angleTo(this.x, this.y, opts.source.x, opts.source.y);
        let d = Math.abs(((a - this.aimAngle + Math.PI * 3) % TAU) - Math.PI);
        facingHit = d < 1.45;
      }
      if (facingHit) {
        blocked = true;
        dmg *= this.blockDmgMult;
        this.stamina -= 16;
        if (this.stamina < 0) { this.stamina = 0; this.stunPlayer(.5); }
        this.game.audio.sfx('block');
        this.game.burst(this.x + Math.cos(this.aimAngle) * 13, this.y - 10 + Math.sin(this.aimAngle) * 10, 8, '#ffe6a8', { speed: 80, life: .35, size: 1.5 });
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    if (this.hasRevive && this.hp - dmg <= 0 && this.reviveTimer <= 0) {
      this.hp = Math.max(1, Math.round(this.maxHp * .25));
      this.invuln = 1.6; this.reviveTimer = 45;
      blocked = false;
      this.game.ui.toast('Second Wind — you cling to life', 'good');
      this.game.addEffect({ type: 'heal', x: this.x, y: this.y - 6, t: 0, max: 1.1 });
    } else {
      this.hp -= dmg;
    }
    this.hurtTimer = .32;
    this.invuln = .76;
    this.attack = null;
    this.castTimer = 0;
    this.blocking = false;
    this.hitFlash = .16;
    if (opts.knockback) {
      const a = opts.source ? angleTo(opts.source.x, opts.source.y, this.x, this.y) : this.aimAngle + Math.PI;
      this.knockX = Math.cos(a) * opts.knockback;
      this.knockY = Math.sin(a) * opts.knockback;
    }
    this.game.onPlayerHurt(dmg, blocked);
    this.game.audio.sfx(blocked ? 'block' : 'hurt');
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    return dmg;
  }

  stunPlayer(t) { this.hurtTimer = Math.max(this.hurtTimer, t); this.attack = null; }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'hurt';
    this.game.audio.sfx('death');
    this.game.burst(this.x, this.y - 10, 24, '#c2515d', { speed: 70, life: .9, size: 2, gravity: 30 });
    this.game.onPlayerDeath();
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.game.addDamageNumber(this.x, this.y - 30, `+${Math.round(n)}`, '#8fd6a0', false);
  }
}

/* ================= ENEMY ================= */
export class Enemy {
  constructor(game, type, x, y, opts = {}) {
    this.game = game;
    this.type = type;
    this.spriteType = type;
    this.bossKey = opts.boss || null;
    this.isBoss = !!this.bossKey;
    this.elite = !!opts.elite;
    this.home = opts.home ? { ...opts.home } : { x, y };
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 10;
    this.name = '';
    this.level = REGION_LEVEL[game.mapId] || 1;
    this.phase = 1;
    this.dead = false; this.deathTimer = 0;
    this.aggro = false; this.alerted = false;
    this.attackCd = rand(.3, 1.4);
    this.stagger = 0; this.hitFlash = 0; this.slowTimer = 0;
    this.animTime = rand(0, 4); this.frame = 0; this.animState = 'idle';
    this.state = 'idle'; this.windup = 0; this.recover = 0; this.dash = null;
    this.telegraph = null; this.facing = 1;
    this.action = null; this.actionT = 0; this.bossCd = 2; this.patternIndex = 0;
    this.phaseAnnounced = false;
    this.spawnBlink = .4;
    this.setupStats();
    this.hp = this.maxHp;
  }

  setupStats() {
    if (this.isBoss) {
      const d = BOSSES[this.bossKey];
      this.name = d.name; this.title = d.title;
      this.maxHp = Math.round(d.hp * (1 + (this.level - 1) * .08));
      this.dmg = Math.round(d.dmg * (1 + (this.level - 1) * .06));
      this.speed = d.speed;
      this.r = d.radius;
      this.xp = d.xp; this.goldRange = d.gold; this.shardChance = 1; this.shards = d.shards;
      this.radius = d.radius;
      this.scale = d.scale || 1;
      this.phase2 = d.phase2 || .5;
      this.bossLoot = true;
      this.spriteType = d.type;
      this.detect = 500;
      this.attackRange = 60;
      return;
    }
    const d = ENEMY_TYPES[this.type] || ENEMY_TYPES.thornling;
    this.name = d.name;
    const lvlScale = 1 + (this.level - 1) * .18;
    this.maxHp = Math.round(d.hp * lvlScale * (this.elite ? d.eliteScale : 1));
    this.dmg = Math.round(d.dmg * (1 + (this.level - 1) * .12) * (this.elite ? 1.32 : 1));
    this.speed = d.speed * (this.elite ? 1.06 : 1);
    this.r = d.radius * (this.elite ? 1.28 : 1);
    this.xp = Math.round(d.xp * (this.elite ? 2.1 : 1));
    this.goldRange = d.gold;
    this.shardChance = d.shards;
    this.shards = 0;
    this.detect = d.detect;
    this.attackRange = d.attackRange;
    this.attackCdBase = d.attackCd;
    this.windupBase = d.windup;
    this.behavior = d.behavior;
    this.ranged = !!d.ranged;
    this.projectile = d.projectile || 'shadow';
    this.projSpeed = d.projSpeed || 180;
    this.scale = this.elite ? 1.22 : 1;
    this.slowResist = 0;
  }

  update(dt) {
    if (this.dead) { this.deathTimer += dt; return; }
    this.animTime += dt;
    if (Math.abs(this.knockX || 0) + Math.abs(this.knockY || 0) > 2) {
      this.game.moveEntity(this, this.knockX * dt, this.knockY * dt, .4);
      this.knockX *= Math.pow(.0005, dt); this.knockY *= Math.pow(.0005, dt);
    } else { this.knockX = this.knockY = 0; }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.spawnBlink = Math.max(0, this.spawnBlink - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.frame = ((this.animTime * (this.animState === 'walk' ? 7 : 4)) | 0) % 4;
    const p = this.game.player;
    const d = dist(this, p);
    const ang = angleTo(this.x, this.y, p.x, p.y);
    this.facing = Math.cos(ang) >= 0 ? 1 : -1;
    if (this.isBoss) { this.bossUpdate(dt, d, ang); return; }
    if (p.dead) { this.aggro = false; this.animState = 'idle'; return; }

    if (!this.aggro && d < this.detect) this.aggro = true;
    if (this.aggro && d > this.detect * 2.1 && !this.alerted) {
      this.aggro = false;
      this.moveToward(this.home.x, this.home.y, dt, .45);
      return;
    }
    if (!this.aggro) {
      // lazy wander
      this.animState = 'idle';
      if (this.spawnBlink <= 0 && chance(dt * .25)) {
        this.wanderT = rand(.5, 1.4);
        this.wanderA = rand(0, TAU);
      }
      if (this.wanderT > 0) {
        this.wanderT -= dt;
        this.moveToward(this.x + Math.cos(this.wanderA) * 20, this.y + Math.sin(this.wanderA) * 20, dt, .35);
        this.animState = 'walk';
      }
      return;
    }

    if (this.stagger > 0) { this.animState = 'hurt'; return; }
    if (this.dash) {
      this.dash.t += dt;
      const spd = this.speed * (this.behavior === 'charger' ? 5.6 : 4.2);
      this.game.moveEntity(this, this.dash.x * spd * dt, this.dash.y * spd * dt, 1);
      this.animState = 'attack';
      if (!this.dash.hit && d < this.r + p.r + 10) {
        this.dash.hit = true;
        p.damage(this.dmg, { source: this, knockback: 220 });
        this.game.burst(p.x, p.y - 8, 5, '#c2515d', { speed: 55, life: .4, size: 2 });
      }
      if (this.dash.t > this.dash.dur) { this.dash = null; this.state = 'recover'; this.recover = .45; }
      return;
    }
    if (this.windup > 0) {
      this.windup -= dt;
      this.animState = 'windup';
      if (this.windup <= 0) this.resolveAttack(d, ang);
      return;
    }
    if (this.recover > 0) { this.recover -= dt; this.animState = 'idle'; return; }

    const slow = this.slowTimer > 0 ? .45 : 1;
    const atkRange = this.attackRange + this.r;
    if (this.attackCd <= 0 && d < atkRange) {
      this.beginAttack(d, ang);
      return;
    }
    if (this.ranged) {
      const ideal = this.attackRange * .68;
      if (d < ideal - 26) this.moveToward(p.x, p.y, dt, -this.speed * slow * .8);
      else if (d > this.attackRange * .94) this.moveToward(p.x, p.y, dt, this.speed * .85 * slow);
      else { this.animState = 'idle'; this.strafe(dt, ang); }
    } else {
      const desired = Math.max(4, atkRange - 12);
      if (d > desired) {
        const hop = this.behavior === 'hopper' ? .72 + Math.abs(Math.sin(this.animTime * 5)) * .68 : 1;
        this.moveToward(p.x, p.y, dt, this.speed * slow * hop);
        this.animState = 'walk';
      } else if (d < desired - 14 && this.behavior === 'caster') {
        this.moveToward(p.x, p.y, dt, -this.speed * .6);
        this.animState = 'walk';
      } else {
        this.animState = 'idle';
      }
    }
  }

  strafe(dt, ang) {
    const s = Math.sin(this.animTime * 1.5) > 0 ? 1 : -1;
    this.game.moveEntity(this, Math.cos(ang + Math.PI / 2 * s) * this.speed * .25 * dt, Math.sin(ang + Math.PI / 2 * s) * this.speed * .25 * dt, 1);
  }

  moveToward(tx, ty, dt, spd) {
    const a = angleTo(this.x, this.y, tx, ty);
    this.game.moveEntity(this, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, 1);
    this.animState = 'walk';
    if (Math.abs(spd) > 4) this.animState = 'walk';
  }

  beginAttack(d, ang) {
    this.state = 'windup';
    this.aggro = true; this.alerted = true;
    this.animState = 'windup';
    this.windup = this.windupBase || .5;
    this.attackDir = ang;
    this.telegraph = { x: this.x, y: this.y, angle: ang, range: this.attackRange + this.r + 6, type: this.ranged ? 'cast' : 'melee' };
    if (this.behavior === 'lunger' || this.behavior === 'charger') {
      this.telegraph = { x: this.x, y: this.y, angle: ang, range: this.attackRange + 20, type: 'dash' };
    }
  }

  resolveAttack(d, ang) {
    this.telegraph = null;
    this.windup = 0;
    const p = this.game.player;
    if (this.ranged) {
      const n = this.type === 'revenant' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const a = ang + (i - (n - 1) / 2) * .16;
        this.game.spawnEnemyProjectile(this.x, this.y - 10, a, this.projSpeed, this.dmg, this.projectile, this);
      }
      this.game.audio.sfx('cast');
      this.animState = 'attack';
    } else if (this.behavior === 'lunger' || this.behavior === 'charger') {
      this.dash = { t: 0, dur: this.behavior === 'charger' ? .38 : .27, x: Math.cos(ang), y: Math.sin(ang), hit: false };
      this.game.audio.sfx('heavy');
    } else {
      if (d < this.attackRange + this.r + 18) {
        p.damage(this.dmg, { source: this, knockback: this.elite ? 200 : 130 });
        this.game.audio.sfx('hit');
      }
      this.game.addEffect({ type: 'slash', x: this.x + Math.cos(ang) * 14, y: this.y - 8 + Math.sin(ang) * 12, angle: ang, t: 0, max: .22, heavy: this.elite, tint: 'red' });
      this.game.shake(3);
      this.animState = 'attack';
    }
    this.attackCd = this.attackCdBase || 1.5;
    this.state = 'recover'; this.recover = .4;
  }

  stun(t) { this.stagger = Math.max(this.stagger, t); this.windup = 0; this.dash = null; this.telegraph = null; this.animState = 'hurt'; }

  slow(t, amount = .5) {
    this.slowTimer = Math.max(this.slowTimer, t);
    this.slowPower = amount;
  }

  hurt(amount, opts = {}) {
    if (this.dead) return 0;
    let dmg = amount;
    if (this.armored && opts.source === 'melee' && !opts.heavy) dmg *= .68;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.hitFlash = .12;
    this.aggro = true; this.alerted = true;
    const source = opts.from || this.game.player;
    const a = angleTo(source.x, source.y, this.x, this.y);
    const kb = this.isBoss ? 0 : (opts.heavy ? 120 : 55);
    if (!this.isBoss) {
      this.knockX = Math.cos(a) * kb; this.knockY = Math.sin(a) * kb;
    }
    const resist = this.isBoss ? 4 : 1;
    this.stagger = Math.max(this.stagger, (opts.heavy ? .3 : .12) * (this.isBoss ? .12 : 1) * resist);
    if (this.hp <= 0) this.die();
    return dmg;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = 0;
    this.hp = 0;
    this.telegraph = null;
    this.game.onEnemyKilled(this);
  }

  /* ---------------- bosses ---------------- */
  bossUpdate(dt, d, ang) {
    const p = this.game.player;
    if (p.dead) return;
    if (this.stagger > 0) { this.animState = 'hurt'; return; }
    if (this.hp / this.maxHp <= this.phase2 && this.phase === 1) {
      this.phase = 2;
      this.game.audio.sfx('roar');
      this.game.shake(12);
      this.game.ui.toast(`${this.name} — second phase`, 'bad');
      this.game.burst(this.x, this.y - 20, 36, '#ff9a6a', { speed: 130, life: 1, size: 2.5, glow: true });
    }
    if (!this.aggro) {
      if (d < this.detect) { this.aggro = true; this.game.startBossFight(this); }
      this.animState = 'idle';
      return;
    }
    if (this.action) {
      this.actionT += dt;
      this.runBossAction(this.action, this.actionT, dt, d, ang);
      if (this.actionT >= this.action.dur) { this.action = null; this.actionT = 0; this.bossCd = rand(1.1, 2.1) * (this.phase === 2 ? .68 : 1); }
      return;
    }
    this.bossCd -= dt;
    const slow = this.slowTimer > 0 ? .5 : 1;
    if (this.bossCd > 0 || this.spawnBlink > 0) {
      if (d > 55) this.moveToward(p.x, p.y, dt, this.speed * slow);
      else { this.animState = 'idle'; this.strafe(dt, ang); }
      return;
    }
    this.pickBossAction(d);
  }

  pickBossAction(d) {
    this.patternIndex++;
    const b = this.bossKey;
    const phase2 = this.phase === 2;
    let name;
    if (b === 'grove') {
      name = ['slam', 'roots', 'charge', phase2 && this.patternIndex % 3 === 0 ? 'summon' : 'slam'][this.patternIndex % 4];
    } else if (b === 'hollowking') {
      name = ['blink', 'fan', phase2 && this.patternIndex % 3 === 0 ? 'summon' : 'dash'][this.patternIndex % 4];
    } else if (b === 'frostwarden') {
      name = ['fan', 'ring', 'blink', phase2 ? 'blizzard' : 'ring'][this.patternIndex % 4];
    } else {
      name = ['ring', 'fan', 'summon', phase2 ? 'beam' : 'ring'][this.patternIndex % 4];
    }
    this.action = { name, dur: name === 'ring' ? 1.5 : name === 'summon' ? 1.4 : 1.25, fired: false, fired2: false, targets: null };
    this.actionT = 0;
    this.game.audio.sfx('roar');
  }

  runBossAction(a, t, dt, d, ang) {
    const p = this.game.player;
    const name = a.name;
    if (name === 'slam') {
      if (!a.fired) {
        a.fired = true;
        this.game.addZone({ x: p.x, y: p.y, r: 62, warn: .9, dmg: this.dmg * 1.15, color: '#b8d06a', owner: this });
        this.game.addEffect({ type: 'raise', x: this.x, y: this.y, t: 0, max: .8, color: '#9fc46a' });
      }
      this.animState = 'windup';
      if (t > .9 && !a.fired2) {
        a.fired2 = true;
        this.game.audio.sfx('heavy'); this.game.shake(10);
        this.game.burst(p.x, p.y, 24, '#9fc46a', { speed: 100, life: .7, size: 2.4, gravity: 50 });
      }
    } else if (name === 'roots') {
      if (!a.fired) {
        a.fired = true;
        for (let i = -2; i <= 2; i++) {
          const aa = ang + i * .3;
          this.game.addZone({ x: p.x + Math.cos(aa) * (i * 28), y: p.y + Math.sin(aa) * (i * 28), r: 30, warn: .8, dmg: this.dmg * .8, color: '#6fd9a8', owner: this, root: true });
        }
        this.game.addEffect({ type: 'raise', x: this.x, y: this.y, t: 0, max: .7, color: '#6fd9a8' });
      }
      this.animState = 'cast';
    } else if (name === 'charge') {
      if (!a.fired) { a.fired = true; this.dash = { t: 0, dur: .62, x: Math.cos(ang), y: Math.sin(ang), hit: false }; this.game.audio.sfx('heavy'); }
      if (this.dash) {
        this.dash.t += dt;
        const spd = this.speed * 5.6;
        this.game.moveEntity(this, this.dash.x * spd * dt, this.dash.y * spd * dt, 1);
        this.animState = 'attack';
        if (!this.dash.hit && d < this.r + p.r + 12) {
          this.dash.hit = true; p.damage(this.dmg, { source: this, knockback: 260 });
          this.game.shake(9);
        }
        if (this.dash.t >= this.dash.dur) this.dash = null;
      }
    } else if (name === 'summon') {
      if (!a.fired) {
        a.fired = true;
        const pool = this.bossKey === 'hollowking' ? ['knight', 'knight'] : this.bossKey === 'chorus' ? ['wisp', 'wisp'] : ['thornling', 'thornling', 'wolf'];
        for (let i = 0; i < 2 + (this.phase === 2 ? 1 : 0); i++) {
          const aa = rand(0, TAU), rr = rand(50, 100);
          this.game.spawnMinion(pool[i % pool.length], this.x + Math.cos(aa) * rr, this.y + Math.sin(aa) * rr);
        }
        this.game.audio.sfx('seal');
        this.game.burst(this.x, this.y - 20, 20, '#c8a6ff', { speed: 90, life: .8, size: 2, glow: true });
      }
      this.animState = 'cast';
    } else if (name === 'blink') {
      if (!a.fired) {
        a.fired = true;
        this.game.burst(this.x, this.y - 16, 18, this.bossKey === 'hollowking' ? '#c8a6ff' : '#a8e8ff', { speed: 70, life: .6, size: 2, glow: true });
        const a2 = rand(0, TAU);
        const nx = clamp(p.x + Math.cos(a2) * 58, 30, this.game.map.w * 16 - 30);
        const ny = clamp(p.y + Math.sin(a2) * 58, 30, this.game.map.h * 16 - 30);
        if (!collidesStatic(this.game.map, nx, ny, this.r)) { this.x = nx; this.y = ny; }
        this.game.burst(this.x, this.y - 16, 18, '#c8a6ff', { speed: 70, life: .6, size: 2, glow: true });
        this.game.audio.sfx('blink');
      }
      if (t > .42 && !a.fired2) {
        a.fired2 = true;
        for (let i = 0; i < 3; i++) {
          const aa = ang + (i - 1) * .5;
          this.game.addZone({ x: this.x + Math.cos(aa) * 35, y: this.y + Math.sin(aa) * 30, r: 36, warn: .42, dmg: this.dmg, color: '#c8a6ff', owner: this });
        }
        this.game.shake(6);
      }
      this.animState = 'attack';
    } else if (name === 'fan') {
      if (t > .3 && !a.fired) {
        a.fired = true;
        const n = this.phase === 2 ? 9 : 6;
        for (let i = 0; i < n; i++) {
          const aa = ang + (i - (n - 1) / 2) * .18;
          this.game.spawnEnemyProjectile(this.x, this.y - 14, aa, this.bossKey === 'frostwarden' ? 250 : 220, this.dmg * .8, this.bossKey === 'frostwarden' ? 'frost' : 'shadow', this);
        }
        this.game.audio.sfx('cast');
      }
      this.animState = 'cast';
    } else if (name === 'ring') {
      if (t > .35 && !a.fired) {
        a.fired = true;
        const n = this.bossKey === 'chorus' ? 24 : 16;
        const off = rand(0, TAU);
        for (let i = 0; i < n; i++) {
          const aa = off + i / n * TAU;
          this.game.spawnEnemyProjectile(this.x, this.y - 12, aa, 175, this.dmg * .72, this.bossKey === 'chorus' ? 'song' : 'frost', this);
        }
        this.game.audio.sfx('nova');
        this.game.addEffect({ type: 'ring', x: this.x, y: this.y - 10, t: 0, max: .7, color: this.bossKey === 'chorus' ? '#c8a6ff' : '#a8e8ff', radius: 90 });
      }
      this.animState = 'cast';
    } else if (name === 'blizzard') {
      if (!a.fired) {
        a.fired = true;
        for (let i = 0; i < 5; i++) {
          const aa = rand(0, TAU), rr = rand(40, 170);
          this.game.addZone({ x: p.x + Math.cos(aa) * rr, y: p.y + Math.sin(aa) * rr, r: 42, warn: 1.1, dmg: this.dmg * .8, color: '#a8e8ff', owner: this });
        }
      }
      this.animState = 'cast';
    } else if (name === 'beam') {
      if (t > .4 && !a.fired) {
        a.fired = true;
        this.game.addZone({ type: 'line', x: this.x, y: this.y - 12, angle: ang, length: 300, width: 36, warn: .75, dmg: this.dmg * 1.2, color: '#ff9a8a', owner: this });
        this.game.audio.sfx('echo');
        this.game.shake(8);
      }
      this.animState = 'cast';
    }
  }
}

/* ================= PROJECTILE ================= */
export class Projectile {
  constructor(game, opts) {
    this.game = game;
    Object.assign(this, {
      x: opts.x, y: opts.y, vx: 0, vy: 0, r: opts.r || 6,
      dmg: opts.dmg || 1, life: opts.life || 2, maxLife: opts.life || 2,
      friendly: !!opts.friendly, color: opts.color || '#7fe3d2',
      kind: opts.kind || 'orb', pierce: opts.pierce || 0, owner: opts.owner || null,
      homing: opts.homing || 0, hitSet: new Set(), dead: false, trail: 0,
      angle: opts.angle || 0, spin: opts.spin || 0, speed: opts.speed || 300,
      gravity: opts.gravity || 0, wobble: opts.wobble || 0,
    });
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.spinT = 0;
  }

  update(dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.kill(false); return; }
    this.spinT += dt;
    if (this.homing) {
      const target = this.friendly ? this.game.nearestEnemy(this.x, this.y) : this.game.player;
      if (target && !target.dead) {
        const want = angleTo(this.x, this.y, target.x, target.y);
        const cur = Math.atan2(this.vy, this.vx);
        let diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
        const na = cur + clamp(diff, -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(na) * this.speed; this.vy = Math.sin(na) * this.speed;
      }
    }
    if (this.wobble) {
      const p = this.spinT * 10;
      this.x += Math.cos(p) * this.wobble * dt;
      this.y += Math.sin(p) * this.wobble * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = .04;
      this.game.spawnParticle({
        x: this.x + rand(-2, 2), y: this.y + rand(-2, 2), vx: -this.vx * .06, vy: -this.vy * .06,
        life: .35, max: .35, size: rand(1, 2.4), color: this.color, glow: true, drag: 2,
      });
    }
    if (collidesStatic(this.game.map, this.x, this.y, 3)) {
      this.game.burst(this.x, this.y, 6, this.color, { speed: 60, life: .35, size: 1.5, glow: true });
      this.kill(true);
      return;
    }
    this.angle = Math.atan2(this.vy, this.vx);
    if (this.friendly) {
      for (const e of this.game.enemies) {
        if (e.dead || this.hitSet.has(e)) continue;
        if (dist(this, e) < this.r + e.r) {
          this.hitSet.add(e);
          const crit = chance(this.game.player.crit / 100);
          const dmg = e.hurt(this.dmg * (crit ? 1.8 : 1), { from: this.game.player, source: 'ability', heavy: false });
          this.game.showHit(e, dmg, crit, '#9fe8dd');
          this.game.audio.sfx(crit ? 'crit' : 'hit');
          this.game.burst(this.x, this.y, 6, this.color, { speed: 70, life: .3, size: 1.5, glow: true });
          if (this.pierce <= 0) { this.kill(true); return; }
          this.pierce--;
        }
      }
      if (this.game.activeBoss && !this.hitSet.has(this.game.activeBoss) && dist(this, this.game.activeBoss) < this.r + this.game.activeBoss.r) {
        const e = this.game.activeBoss;
        if (!e.dead) {
          this.hitSet.add(e);
          const dmg = e.hurt(this.dmg, { from: this.game.player, source: 'ability' });
          this.game.showHit(e, dmg, false, '#9fe8dd');
          this.game.audio.sfx('hit');
          if (this.pierce <= 0) { this.kill(true); return; }
          this.pierce--;
        }
      }
    } else {
      const p = this.game.player;
      if (!p.dead && dist(this, p) < this.r + p.r) {
        p.damage(this.dmg, { source: { x: this.x - this.vx, y: this.y - this.vy }, knockback: 100 });
        this.kill(true);
        return;
      }
    }
  }

  kill(hit) {
    if (this.dead) return;
    this.dead = true;
    if (hit) this.game.burst(this.x, this.y, 8, this.color, { speed: 75, life: .4, size: 1.6, glow: true });
  }
}

/* ================= DROPS ================= */
export class Drop {
  constructor(game, x, y, kind, opts = {}) {
    this.game = game;
    this.x = x; this.y = y;
    this.vx = rand(-70, 70); this.vy = rand(-40, 40);
    this.z = opts.z ?? rand(8, 26);
    this.vz = rand(60, 120);
    this.kind = kind;
    this.amount = opts.amount || 1;
    this.item = opts.item || null;
    this.life = opts.life || 22;
    this.dead = false;
    this.magnet = false;
    this.bob = rand(0, TAU);
    this.r = opts.r || 8;
  }

  update(dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.bob += dt * 3;
    const p = this.game.player;
    const d = dist(this, p);
    if (d < 74 && !p.dead) this.magnet = true;
    if (this.magnet) {
      const a = angleTo(this.x, this.y, p.x, p.y);
      const spd = 290 + (74 - Math.min(74, d)) * 4;
      this.x += Math.cos(a) * spd * dt;
      this.y += Math.sin(a) * spd * dt;
      this.z = Math.max(2, this.z - 40 * dt);
    } else {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= Math.pow(.001, dt); this.vy *= Math.pow(.001, dt);
      this.vz -= 420 * dt;
      this.z += this.vz * dt;
      if (this.z < 0) { this.z = 0; this.vz *= -.42; if (Math.abs(this.vz) < 14) this.vz = 0; }
    }
    if (d < p.r + this.r + 5 && this.z < 14) {
      this.dead = true;
      this.game.collectDrop(this);
    }
  }
}
