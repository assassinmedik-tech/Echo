/* ============================================================
   ECHOES OF THE FALLEN — interface controller
   ============================================================ */
import {
  ABILITIES, SKILL_BRANCHES, RARITY, itemStatLines, priceOf, SHOP_STOCK,
} from './items.js';
import { QUESTS } from './story.js';
import { REGIONS } from './world.js';
import { OUTFITS, ACCESSORIES, getPortrait, getItemIcon } from './sprites.js';
import { audio } from './audio.js';
import { clamp, fmt } from './util.js';

const $ = id => document.getElementById(id);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const num = n => Math.round(Number(n) || 0).toLocaleString();
const rarityColor = r => (RARITY[r] && RARITY[r].color) || '#a8b2a8';
const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
};
const pretty = s => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const ITEM_NAMES = {
  orins_locket: "Orin's Locket", verdant_saber: 'Verdant Saber',
  frostguard_mantle: 'Frostguard Mantle', elixir: 'Echo Elixir',
};

const PANEL_DEFS = {
  inventory: { title: 'Satchel', sub: 'Relics, remedies and the weight you carry' },
  character: { title: 'Wanderer', sub: 'A shape the echo remembers' },
  skills: { title: 'Echo Paths', sub: 'Three ways of listening' },
  quests: { title: 'Journal', sub: 'What the road has asked of you' },
  map: { title: 'Aetheria', sub: 'The shattered realm and its five echoes' },
  settings: { title: 'Settings', sub: 'Audio · Graphics · Controls' },
  controls: { title: 'How to Play', sub: 'Combat · Exploration · Survival' },
};

export class UI {
  constructor(game) {
    this.game = game;
    this.player = game.player;
    this.panelMode = null;
    this.panelData = null;
    this.displayMode = null;
    this.invSel = null;
    this.questSel = 'main';
    this.settingsTab = 'audio';
    this.shopId = null;

    this.el = {
      canvas: $('game'),
      hud: $('hud'),
      minimap: $('minimap'),
      regionLabel: $('regionLabel'),
      objQuest: $('objQuest'),
      objText: $('objText'),
      levelNum: $('levelNum'),
      hpFill: $('hpFill'), hpTxt: $('hpTxt'),
      enFill: $('enFill'), enTxt: $('enTxt'),
      stFill: $('stFill'),
      xpFill: $('xpFill'),
      abilities: $('abilities'),
      bossbar: $('bossbar'), bossName: $('bossName'), bossFill: $('bossFill'), bossPhase: $('bossPhase'),
      toasts: $('toasts'),
      interactPrompt: $('interactPrompt'), interactText: $('interactText'),
      perfStats: $('perfStats'),
      touch: $('touch'), stickZone: $('stickZone'), stickBase: $('stickBase'), stickKnob: $('stickKnob'),
      touchButtons: $('touchButtons'),
      dialogueWrap: $('dialogueWrap'), dialogueBox: $('dialogueBox'),
      dlgPortrait: $('dlgPortrait'), dlgName: $('dlgName'), dlgText: $('dlgText'),
      dlgChoices: $('dlgChoices'), dlgHint: $('dlgHint'),
      overlayWrap: $('overlayWrap'), overlay: $('overlay'),
      regionBanner: $('regionBanner'), regionName: $('regionName'), regionSub: $('regionSub'),
      titleScreen: $('titleScreen'), btnContinue: $('btnContinue'),
      loading: $('loading'), fade: $('fade'), hurtFlash: $('hurtFlash'),
      touchTop: $('touchTop'), rotateHint: $('rotateHint'),
    };

    this.abSlots = {};
    this.bannerTimer = 0;
    this.toastCount = 0;
    this._regionId = null;
    this._abReady = false;
    this._lastFps = 0;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this._settingLive = false;
    this._deathShown = false;

    this.typeFull = '';
    this.typeIndex = 0;
    this.typeAcc = 0;
    this.typing = false;
    this.dlgNode = null;
    this.dlgDef = null;
    this.dlgNpc = null;

    this.dialogueTimer = null;
    this.bannerTimeout = null;
    this.hurtTimeout = null;

    this.touchEnabled = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    this.bindTitle();
    this.bindOverlay();
    this.bindDialogue();
    this.bindTouch();

    this.buildAbilities(true);
    this.updateTitle();
    this.showGameHud(false);
  }

  /* ============================================================
     HUD / title
     ============================================================ */
  bindPlayer() {
    this.player = this.game.player;
    this._abReady = false;
    this.buildAbilities(true);
    this.updateHUD(true);
    this.refreshAbilities();
  }

  showGameHud(show = true) {
    if (!this.el.hud) return;
    this.el.hud.classList.toggle('hidden', !show);
    if (this.el.touch) {
      this.el.touch.classList.toggle('hidden', !(show && this.touchEnabled));
    }
  }

  showGame() {
    this.showGameHud(true);
    if (this.el.titleScreen) this.el.titleScreen.classList.add('gone');
    if (this.el.loading) this.el.loading.classList.add('gone');
    this.game.state = 'playing';
    this.updateHUD(true);
  }

  hideTitle() {
    if (this.el.titleScreen) this.el.titleScreen.classList.add('gone');
  }

  showTitle() {
    this.closeAll();
    this.closeDialogue(true);
    this.showGameHud(false);
    if (this.el.titleScreen) this.el.titleScreen.classList.remove('gone');
    if (this.el.dialogueWrap) this.el.dialogueWrap.classList.add('hidden');
    this.updateTitle();
  }

  updateTitle() {
    const has = this.game.hasSave();
    if (this.el.btnContinue) {
      this.el.btnContinue.disabled = !has;
      this.el.btnContinue.classList.toggle('no-save', !has);
    }
  }

  bindTitle() {
    document.querySelectorAll('[data-title]').forEach(btn => {
      btn.addEventListener('click', () => {
        const what = btn.dataset.title;
        audio.init();
        if (what === 'continue') {
          if (!this.game.hasSave()) { this.toast('No journey has been saved yet', 'bad'); return; }
          audio.sfx('ui');
          if (!this.game.continueGame()) this.game.newGame();
          this.showGame();
          this.updateTitle();
        } else if (what === 'new') {
          if (this.game.hasSave() && !window.confirm('Begin a new journey? Your saved journey will be overwritten when it autosaves.')) return;
          audio.sfx('quest');
          this.game.newGame();
          this.showGame();
          this.updateTitle();
        } else if (what === 'settings') {
          audio.sfx('uiopen');
          this.openPanel('settings');
        } else if (what === 'controls') {
          audio.sfx('uiopen');
          this.openPanel('controls');
        }
      });
    });
  }

  /* ============================================================
     per-frame HUD
     ============================================================ */
  update(dt) {
    if (this.player !== this.game.player) this.bindPlayer();
    const p = this.player, g = this.game;
    if (!p) return;

    if (this._regionId !== g.mapId) {
      this._regionId = g.mapId;
      this.setRegion(g.map);
    }

    const hpPct = clamp(p.hp / Math.max(1, p.maxHp), 0, 1) * 100;
    const enPct = clamp(p.energy / Math.max(1, p.maxEnergy), 0, 1) * 100;
    const stPct = clamp(p.stamina / Math.max(1, p.maxStamina), 0, 1) * 100;
    const xpNeed = this.xpNeed ? this.xpNeed() : 1;
    const xpPct = clamp(p.xp / Math.max(1, xpNeed), 0, 1) * 100;

    if (this.el.hpFill) this.el.hpFill.style.width = hpPct + '%';
    if (this.el.hpTxt) this.el.hpTxt.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    if (this.el.enFill) this.el.enFill.style.width = enPct + '%';
    if (this.el.enTxt) this.el.enTxt.textContent = `${Math.floor(p.energy)}`;
    if (this.el.stFill) this.el.stFill.style.width = stPct + '%';
    if (this.el.xpFill) this.el.xpFill.style.width = xpPct + '%';
    if (this.el.levelNum && this.el.levelNum.textContent !== String(p.level)) this.el.levelNum.textContent = p.level;

    this.updateAbilities();
    this.updateTypewriter(dt);
    this.updateTouchAbilityStates();

    const blocked = this.panelOpen || g.dialogueOpen || g.state !== 'playing' || p.dead;
    if (this.el.interactPrompt) {
      if (blocked || !g.interactTarget) this.el.interactPrompt.classList.add('hidden');
      else {
        this.el.interactPrompt.classList.remove('hidden');
        if (this.el.interactText) this.el.interactText.textContent = g.interactTarget.label || 'Interact';
      }
    }

    if (this.el.perfStats) {
      this._fpsAcc += dt; this._fpsFrames++;
      if (this._fpsAcc > .6) {
        const fps = Math.round(this._fpsFrames / this._fpsAcc);
        this.el.perfStats.textContent = `${fps} FPS · ${g.map ? g.map.name : ''}`;
        this._fpsAcc = 0; this._fpsFrames = 0;
      }
    }
  }

  updateHUD() {
    if (!this.player) return;
    this.update(0);
  }

  xpNeed() {
    // keep the HUD independent of a circular import; mirrors items.xpToNext.
    const l = this.player.level;
    return Math.round(55 * Math.pow(l, 1.42) + 35 * l) || 90;
  }

  setRegion(map) {
    if (!map) return;
    if (this.el.regionLabel) this.el.regionLabel.textContent = map.name;
    this.el.regionLabel?.setAttribute('title', map.sub || '');
  }

  setObjective(quest, text) {
    if (this.el.objQuest) this.el.objQuest.textContent = quest || 'Objective';
    if (this.el.objText) this.el.objText.textContent = text || '';
    const obj = $('objective');
    if (obj) {
      obj.classList.remove('pulse');
      void obj.offsetWidth;
      obj.classList.add('pulse');
    }
  }

  refreshObjective() { this.game.refreshObjective(); }

  toast(text, kind = '', rarity = null) {
    if (!this.el.toasts) return;
    if (this.toastCount > 5) {
      const first = this.el.toasts.firstElementChild;
      if (first) first.remove();
      this.toastCount--;
    }
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = text;
    if (rarity) t.style.setProperty('--rarity', rarityColor(rarity));
    this.el.toasts.appendChild(t);
    this.toastCount++;
    setTimeout(() => {
      if (t.parentNode) t.parentNode.removeChild(t);
      this.toastCount = Math.max(0, this.toastCount - 1);
    }, 3100);
  }

  levelUp(level) {
    const hud = this.el.hud;
    if (!hud) return;
    const d = document.createElement('div');
    d.className = 'levelup-banner';
    d.innerHTML = `<span>LEVEL</span><b>${level}</b><i>+1 SKILL POINT</i>`;
    hud.appendChild(d);
    setTimeout(() => d.remove(), 2400);
  }

  regionBanner(name, sub) {
    if (!this.el.regionBanner) return;
    if (this.el.regionName) this.el.regionName.textContent = name || '';
    if (this.el.regionSub) this.el.regionSub.textContent = sub || '';
    this.el.regionBanner.classList.add('on');
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => this.el.regionBanner.classList.remove('on'), 3600);
  }

  setPrompt(label) {
    if (!this.el.interactPrompt) return;
    if (!label || this.panelOpen || this.game.dialogueOpen) {
      this.el.interactPrompt.classList.add('hidden');
      return;
    }
    if (this.el.interactText) this.el.interactText.textContent = label;
    this.el.interactPrompt.classList.remove('hidden');
  }

  hurtFlash(strength = 1) {
    const h = this.el.hurtFlash;
    if (!h) return;
    clearTimeout(this.hurtTimeout);
    h.style.transition = 'none';
    h.style.opacity = String(clamp(strength, 0, 1) * .9);
    this.hurtTimeout = setTimeout(() => {
      h.style.transition = 'opacity .38s ease';
      h.style.opacity = '0';
    }, 55);
  }

  /* ---------------- abilities ---------------- */
  buildAbilities(force = false) {
    if (!this.el.abilities) return;
    if (this._abReady && !force) return;
    this.el.abilities.innerHTML = '';
    this.abSlots = {};
    for (const [id, ab] of Object.entries(ABILITIES)) {
      const slot = document.createElement('div');
      slot.className = 'ab-slot';
      slot.dataset.ab = id;
      slot.title = `${ab.name} — ${ab.desc}`;
      slot.innerHTML = `
        <span class="key">${ab.key}</span>
        <span class="glyph">${ab.glyph}</span>
        <span class="cost">${ab.cost}</span>
        <div class="cd"></div>
        <div class="cdtxt"></div>`;
      slot.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        this.game.useAbility(id);
      });
      this.el.abilities.appendChild(slot);
      this.abSlots[id] = slot;
    }
    this._abReady = true;
  }

  refreshAbilities() {
    this.updateAbilities();
  }

  updateAbilities() {
    if (!this.player || !this.abSlots) return;
    const p = this.player;
    for (const [id, ab] of Object.entries(ABILITIES)) {
      const slot = this.abSlots[id];
      if (!slot) continue;
      const unlocked = !!p.abilities[id];
      const cd = p.cooldowns[id] || 0;
      const cooling = cd > 0;
      const cdEl = slot.querySelector('.cd');
      const txt = slot.querySelector('.cdtxt');
      const costEl = slot.querySelector('.cost');
      if (costEl) costEl.textContent = Math.round(ab.cost * p.abilityCostMult);
      slot.classList.toggle('locked', !unlocked);
      slot.classList.toggle('cooling', cooling);
      slot.classList.toggle('noenergy', unlocked && !cooling && p.energy < ab.cost * p.abilityCostMult);
      slot.classList.toggle('ready', unlocked && !cooling && p.energy >= ab.cost * p.abilityCostMult);
      if (cdEl) cdEl.style.transform = `scaleY(${cooling ? clamp(cd / Math.max(.01, ab.cd), 0, 1) : 0})`;
      if (txt) txt.textContent = cooling && cd >= .1 ? cd.toFixed(cd < 1 ? 1 : 0) : '';
    }
  }

  /* ---------------- boss bar ---------------- */
  showBossbar(boss) {
    if (!this.el.bossbar) return;
    this.el.bossbar.classList.remove('hidden', 'enraged');
    if (this.el.bossName) this.el.bossName.textContent = boss.name || 'Guardian';
    if (this.el.bossPhase) this.el.bossPhase.textContent = boss.title || 'GUARDIAN';
    if (this.el.bossFill) this.el.bossFill.style.width = '100%';
  }

  hideBossbar() {
    this.el.bossbar?.classList.add('hidden');
    this.el.bossbar?.classList.remove('enraged');
  }

  updateBossbar(info, boss) {
    if (!this.el.bossbar || !info) return;
    const pct = clamp(info.hp / Math.max(1, info.maxHp), 0, 1) * 100;
    if (this.el.bossFill) this.el.bossFill.style.width = pct + '%';
    const phase = boss ? boss.phase : info.phase;
    this.el.bossbar.classList.toggle('enraged', phase >= 2);
    if (this.el.bossPhase) {
      this.el.bossPhase.textContent = (info.title || 'GUARDIAN') + (phase >= 2 ? ' · PHASE II' : '');
    }
  }

  /* ============================================================
     panels
     ============================================================ */
  openPanel(mode, data = null) {
    if (!mode) return;
    this.panelMode = mode;
    this.panelData = data || this.panelData;
    this.displayMode = 'panel';
    this.game.panelOpen = true;
    if (mode === 'shop') this.shopId = data && data.shop ? data.shop : this.shopId;
    if (mode === 'settings' && data && data.tab) this.settingsTab = data.tab;
    this.renderOverlay();
    this.el.overlayWrap.classList.remove('hidden');
    this.el.touch?.classList.add('hidden');
    audio.sfx('uiopen');
  }

  refreshPanel() {
    if (!this.panelMode || this.displayMode !== 'panel') return;
    this.renderOverlay();
  }

  refreshSettingsIfOpen() {
    if (this._settingLive) return;
    if (this.panelMode === 'settings') this.refreshPanel();
  }

  refreshInventoryIfOpen() {
    if (['inventory', 'character', 'forge', 'shop'].includes(this.panelMode)) this.refreshPanel();
  }

  closeAll() {
    this.panelMode = null;
    this.panelData = null;
    this.displayMode = null;
    this.game.panelOpen = false;
    this.game.paused = false;
    this._deathShown = false;
    if (this.el.overlayWrap) this.el.overlayWrap.classList.add('hidden');
    if (this.el.overlay) this.el.overlay.innerHTML = '';
    if (this.touchEnabled) this.el.touch?.classList.remove('hidden');
  }

  renderOverlay() {
    if (!this.el.overlay) return;
    let html = '';
    switch (this.panelMode) {
      case 'inventory': html = this.renderInventory(); break;
      case 'character': html = this.renderCharacter(); break;
      case 'skills': html = this.renderSkills(); break;
      case 'quests': html = this.renderQuests(); break;
      case 'map': html = this.renderMap(); break;
      case 'settings': html = this.renderSettings(); break;
      case 'controls': html = this.renderControls(); break;
      case 'shop': html = this.renderShop(); break;
      case 'forge': html = this.renderForge(); break;
      case 'lore': html = this.renderLore(); break;
      case 'pause': html = this.renderPause(); break;
      default: html = `<div class="panel"><div class="panel-head"><h2>Echoes</h2></div></div>`;
    }
    this.el.overlay.innerHTML = html;
    this.postRenderOverlay();
  }

  postRenderOverlay() {
    if (this.panelMode === 'map') {
      const c = $('mapCanvas');
      if (c && this.game.renderer) this.game.renderer.renderWorldMap(c);
    }
    if (this.panelMode === 'character') {
      const c = $('charCanvas');
      if (c && this.game.renderer) this.game.renderer.drawCharacter(c, this.player.outfit, this.player.accessory, 3);
    }
  }

  panelHead(title, sub, right = '') {
    const gold = this.player ? this.player.resources.gold : 0;
    return `<div class="panel-head">
      <div><h2>${esc(title)}</h2>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
      <div class="gold">${num(gold)}</div>
      <button class="panel-close" data-action="close" title="Close">✕</button>
    </div>`;
  }

  panelTabs(active) {
    const tabs = [['inventory', 'Satchel'], ['character', 'Character'], ['skills', 'Skills'], ['quests', 'Journal'], ['map', 'Map'], ['settings', 'Settings']];
    return `<div class="panel-tabs">${tabs.map(([id, label]) =>
      `<button data-panel="${id}" class="${active === id ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  }

  panelFoot(left, right = '') {
    return `<div class="panel-foot"><span>${left}</span><span>${right || 'ESC · close'}</span></div>`;
  }

  /* ---------------- inventory ---------------- */
  getSelectedItem() {
    const inv = this.player.inventory;
    let item = inv.find(i => i && i.uid === this.invSel);
    if (!item) {
      item = inv.find(Boolean) || null;
      this.invSel = item ? item.uid : null;
    }
    return item;
  }

  iconFor(item) {
    if (!item) return '';
    if (item.iconUrl) return item.iconUrl;
    try { return getItemIcon(item.icon || 'material', item.tint || rarityColor(item.rarity)); } catch { return ''; }
  }

  itemDetail(item) {
    if (!item) {
      return `<div class="inv-detail"><div class="qd-empty">Select an item from your satchel.</div></div>`;
    }
    const color = item.category === 'equipment' ? rarityColor(item.rarity) : (item.tint || '#d8b774');
    const stats = itemStatLines(item);
    const equipped = item.category === 'equipment' && this.player.equipment[item.type];
    const eq = equipped && equipped.uid !== item.uid ? equipped : null;
    const eqLines = eq ? itemStatLines(eq) : [];
    const actions = [];
    if (item.category === 'equipment') {
      actions.push(`<button class="btn gold" data-action="equip" data-uid="${item.uid}">Equip</button>`);
    } else if (item.category === 'consumable') {
      actions.push(`<button class="btn gold" data-action="use" data-uid="${item.uid}">Use</button>`);
    } else if (item.category === 'cosmetic') {
      actions.push(`<button class="btn gold" data-action="apply" data-uid="${item.uid}">Apply</button>`);
    }
    if (this.panelMode === 'shop') {
      const price = Math.max(1, Math.round((item.value || 10) * .5));
      actions.push(`<button class="btn" data-action="sell" data-uid="${item.uid}">Sell · ${price}g</button>`);
    }
    return `<div class="inv-detail">
      <div class="id-head">
        <div class="id-icon"><img src="${this.iconFor(item)}" alt=""></div>
        <div><h3 style="color:${color}">${esc(item.name)}</h3>
          <div class="id-type">${esc(item.category === 'equipment' ? (item.rarity || 'common') + ' · ' + (item.kind || item.type) : item.category)}${item.level ? ` · Lv ${item.level}` : ''}</div>
        </div>
      </div>
      <div class="id-desc">${esc(item.desc || '')}</div>
      ${stats.length ? `<div class="id-stats">${stats.map(([k, v]) => `<div class="id-stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
      ${eq ? `<div class="compare">Equipped: <b>${esc(eq.name)}</b><br>${eqLines.map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ') || 'No bonuses'}</div>` : ''}
      <div class="id-actions">${actions.join('')}</div>
    </div>`;
  }

  renderInventory() {
    const inv = this.player.inventory;
    const item = this.getSelectedItem();
    const used = inv.filter(Boolean).length;
    let slots = '';
    for (let i = 0; i < 24; i++) {
      const it = inv[i];
      if (!it) { slots += `<div class="slot empty"></div>`; continue; }
      const sel = item && it.uid === item.uid ? ' sel' : '';
      slots += `<div class="slot${sel}" data-uid="${it.uid}" title="${esc(it.name)}">
        <i class="rarity-bar" style="background:${rarityColor(it.rarity)}"></i>
        <img src="${this.iconFor(it)}" alt="">
        ${(it.qty || 1) > 1 ? `<span class="qty">${it.qty}</span>` : ''}
      </div>`;
    }
    const eqSlots = ['weapon', 'armor', 'charm'].map(slot => {
      const it = this.player.equipment[slot];
      return `<div class="equip-slot" ${it ? `data-action="unequip" data-slot="${slot}" title="Unequip ${esc(it.name)}"` : ''}>
        <div class="es-ic">${it ? `<img src="${this.iconFor(it)}" alt="">` : '<span class="es-empty">—</span>'}</div>
        <div><div class="es-name" style="${it ? `color:${rarityColor(it.rarity)}` : ''}">${it ? esc(it.name) : 'Empty'}</div>
        <div class="es-type">${slot}</div></div>
      </div>`;
    }).join('');
    const p = this.player;
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.inventory.title, PANEL_DEFS.inventory.sub)}
      ${this.panelTabs('inventory')}
      <div class="panel-body"><div class="inv-layout">
        <div class="inv-left">
          <div class="inv-toolbar"><span class="cap">Satchel <b>${used}/24</b></span>
            <span class="cap">✦ <b>${num(p.resources.gold)}</b> gold</span>
            <span class="cap">◆ <b>${num(p.resources.crystals)}</b> crystals</span>
            <span class="cap">✧ <b>${num(p.resources.shards)}</b> shards</span>
          </div>
          <div class="slots scroll">${slots}</div>
        </div>
        <div class="inv-right">
          <div class="equip-col"><div class="equip-title">Equipped</div>${eqSlots}</div>
          ${this.itemDetail(item)}
        </div>
      </div></div>
      ${this.panelFoot('Click an item to inspect · click equipment to unequip')}
    </div>`;
  }

  /* ---------------- character ---------------- */
  renderCharacter() {
    const p = this.player;
    const outfit = OUTFITS[p.outfit] || OUTFITS[0];
    const dots = OUTFITS.map((o, i) => {
      const unlocked = p.unlockedOutfits.includes(i);
      return `<button class="pal-dot ${p.outfit === i ? 'on' : ''} ${unlocked ? '' : 'locked'}" data-outfit="${i}"
        style="background:linear-gradient(135deg,${o.cloak},${o.cloakLight})" title="${esc(o.name)}${unlocked ? '' : ' — locked'}"></button>`;
    }).join('');
    const accs = ACCESSORIES.map((a, i) => {
      const unlocked = p.unlockedAccessories.includes(i);
      return `<button class="btn ${p.accessory === i ? 'gold' : ''} ${unlocked ? '' : 'is-locked'}" data-accessory="${i}">${esc(a.name)}</button>`;
    }).join('');
    const stats = [
      ['Level', p.level], ['Experience', `${num(p.xp)} / ${num(this.xpNeed())}`],
      ['Health', `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`], ['Energy', `${Math.floor(p.energy)} / ${Math.round(p.maxEnergy)}`],
      ['Stamina', `${Math.floor(p.stamina)} / ${Math.round(p.maxStamina)}`],
      ['Attack', p.atk], ['Defense', p.def], ['Critical', `${p.crit}%`],
      ['Speed', Math.round(p.speed)], ['Life Steal', `${Math.round(p.lifesteal * 100)}%`],
      ['Skill Points', p.skillPoints], ['Gold', num(p.resources.gold)],
    ];
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.character.title, PANEL_DEFS.character.sub)}
      ${this.panelTabs('character')}
      <div class="panel-body"><div class="char-layout">
        <div class="char-preview">
          <div class="char-stage"><canvas id="charCanvas" width="150" height="182"></canvas></div>
          <div class="char-name">The Wanderer</div>
          <div class="char-title">${esc(outfit.name)} · ${esc((ACCESSORIES[p.accessory] || ACCESSORIES[0]).name)}</div>
          <div><div class="equip-title" style="text-align:center;margin-bottom:6px">Outfits</div>
            <div class="palette-row">${dots}</div></div>
          <div><div class="equip-title" style="text-align:center;margin-bottom:6px">Accessory</div>
            <div class="palette-row acc-row">${accs}</div></div>
        </div>
        <div class="char-stats scroll">
          ${p.skillPoints > 0 ? `<div class="pts-banner"><span>Unspent skill points</span><b>${p.skillPoints}</b></div>` : ''}
          <h3>Attributes</h3>
          <div class="stat-grid">${stats.map(([k, v]) => `<div class="stat-line"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
          <h3>Gear</h3>
          <div class="stat-block">
            ${['weapon', 'armor', 'charm'].map(slot => {
              const it = p.equipment[slot];
              return `<span>${slot}</span><b style="${it ? `color:${rarityColor(it.rarity)}` : ''}">${it ? esc(it.name) : '—'}</b>`;
            }).join('')}
          </div>
          <div class="pal-note">Outfits are unlocked by dyes found in the world and sold by merchants.</div>
        </div>
      </div></div>
      ${this.panelFoot('Your shape changes nothing — your choices do.')}
    </div>`;
  }

  /* ---------------- skills ---------------- */
  renderSkills() {
    const p = this.player;
    const branches = SKILL_BRANCHES.map(b => {
      const nodes = b.nodes.map(n => {
        const owned = p.skills.has(n.id);
        const reqOk = !n.req || p.skills.has(n.req);
        const can = !owned && reqOk && p.skillPoints >= n.cost;
        const cls = owned ? 'owned' : (can ? '' : 'locked');
        return `<div class="skill-node ${cls}" data-skill="${n.id}" style="--bc:${b.color}">
          <div class="sn-ic">${n.icon}</div>
          <div class="sn-body"><div class="sn-name">${esc(n.name)}</div>
            <div class="sn-desc">${esc(n.desc)}</div>
            <div class="sn-cost">${owned ? 'Learned' : `${n.cost} point${n.cost > 1 ? 's' : ''}${reqOk ? '' : ' · requires ' + esc(n.req)}`}</div>
          </div><span class="sn-tier">${n.tier}</span>
        </div><div class="skill-connector"></div>`;
      }).join('');
      return `<div class="branch">
        <div class="branch-head" style="--bc:${b.color}">
          <div class="branch-icon">${b.icon}</div>
          <div class="branch-name" style="color:${b.color}">${esc(b.name)}</div>
          <div class="branch-sub">${esc(b.sub)}</div>
        </div>
        ${nodes}
      </div>`;
    }).join('');
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.skills.title, PANEL_DEFS.skills.sub)}
      ${this.panelTabs('skills')}
      <div class="panel-body"><div class="skill-wrap">
        <div class="skill-head"><span class="equip-title">Unspent points</span><b style="color:var(--gold-2);font-size:16px">${p.skillPoints}</b>
          <span class="set-note" style="margin:0">Skills are permanent. Spend carefully.</span></div>
        <div class="skill-tree">${branches}</div>
      </div></div>
      ${this.panelFoot('Click a skill to learn it · requires the earlier node')}
    </div>`;
  }

  /* ---------------- quests ---------------- */
  activeQuestIds() {
    return Object.keys(QUESTS).filter(id => id === 'main' || this.game.quests[id]);
  }

  renderQuests() {
    const ids = this.activeQuestIds();
    if (!ids.includes(this.questSel)) this.questSel = ids[0] || 'main';
    const list = ids.map(id => {
      const def = QUESTS[id];
      const state = this.game.quests[id];
      const status = state ? state.status : 'unavailable';
      return `<div class="quest-item ${id === this.questSel ? 'on' : ''} ${def.type === 'side' ? 'side' : ''} ${status === 'done' ? 'done' : ''}" data-quest="${id}">
        <div class="qg">${def.type === 'main' ? 'Main Quest' : 'Side Quest'}${status === 'done' ? ' · Complete' : ''}</div>
        <div class="qn">${esc(def.name)}</div>
      </div>`;
    }).join('') || '<div class="qd-empty">No quests yet.</div>';
    const def = QUESTS[this.questSel];
    let detail = '<div class="qd-empty">Your journal is empty. Speak to the people of Aetheria.</div>';
    if (def) {
      const state = this.game.quests[this.questSel];
      const status = state ? state.status : 'unavailable';
      const steps = def.steps.map((s, i) => {
        let done = false;
        try { done = !!s.done(this.game); } catch { done = false; }
        const text = typeof s.text === 'function' ? s.text(this.game) : s.text;
        const current = !done && status === 'active';
        return `<div class="qd-obj ${done ? 'done' : ''} ${current ? 'current' : ''}"><span class="box"></span><span>${esc(text)}</span></div>`;
      }).join('');
      const rw = def.rewards || {};
      const chips = [
        rw.xp ? `${rw.xp} XP` : null,
        rw.gold ? `${rw.gold} gold` : null,
        rw.shards ? `${rw.shards} shards` : null,
        rw.skillPoints ? `${rw.skillPoints} skill point${rw.skillPoints > 1 ? 's' : ''}` : null,
        rw.item ? (ITEM_NAMES[rw.item] || pretty(rw.item)) : null,
      ].filter(Boolean).map(x => `<span class="reward-chip">${esc(x)}</span>`).join('');
      detail = `<div class="quest-detail">
        <h2>${esc(def.name)}</h2>
        <div class="qd-type">${def.type === 'main' ? 'Main Quest' : 'Side Quest'} · ${status === 'done' ? 'Complete' : status === 'active' ? 'In Progress' : 'Not yet accepted'}</div>
        <div class="qd-desc">${esc(def.desc)}</div>
        <div class="qd-objectives">${steps}</div>
        ${chips ? `<div class="equip-title">Rewards</div><div class="qd-rewards">${chips}</div>` : ''}
        ${status === 'active' ? `<div class="quest-track"><button class="btn gold" data-action="track" data-quest="${def.id}">${this.game.trackedQuest === def.id ? 'Tracking' : 'Track this quest'}</button></div>` : ''}
      </div>`;
    }
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.quests.title, PANEL_DEFS.quests.sub)}
      ${this.panelTabs('quests')}
      <div class="panel-body"><div class="quest-layout">
        <div class="quest-list scroll">${list}</div>
        <div class="quest-detail scroll">${detail}</div>
      </div></div>
      ${this.panelFoot('Tracked objectives appear on the minimap and world map')}
    </div>`;
  }

  /* ---------------- map ---------------- */
  renderMap() {
    const p = this.player, g = this.game;
    const rows = REGIONS.map(r => {
      const found = g.discoveredRegions.has(r.id);
      const here = g.mapId === r.id;
      return `<div class="region-row ${found ? 'found' : ''}">
        <i class="dot"></i>
        <div><div class="rn">${found ? esc(r.name) : '???'}</div><div class="rs">${found ? esc(r.sub) : 'undiscovered'}</div></div>
        <div class="rstat">${here ? '◆ here' : found ? `${r.icon}` : '—'}</div>
      </div>`;
    }).join('');
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.map.title, PANEL_DEFS.map.sub)}
      ${this.panelTabs('map')}
      <div class="panel-body"><div class="map-wrap"><canvas id="mapCanvas" width="820" height="480"></canvas></div>
        <div class="map-side">
          <div class="equip-title">Known Regions</div>
          <div class="scroll">${rows}</div>
          <div class="map-note"><span class="diamond"></span>${esc(g.objectiveMarker ? 'An objective waits in ' + (REGIONS.find(r => r.id === g.objectiveMarker.map)?.name || 'the world') : 'Speak with the people of Aetheria')}</div>
          <div class="stat-block" style="margin-top:auto">
            <span>Level</span><b>${p.level}</b>
            <span>Gold</span><b>${num(p.resources.gold)}</b>
            <span>Crystals</span><b>${num(p.resources.crystals)}</b>
            <span>Playtime</span><b>${fmtTime(g.playtime)}</b>
          </div>
        </div>
      </div></div>
      ${this.panelFoot('◆ you are here · travel through portals at the Sanctuary')}
    </div>`;
  }

  /* ---------------- settings ---------------- */
  seg(setting, value, options) {
    return `<div class="seg">${options.map(([v, label]) =>
      `<button data-setting="${setting}" data-value="${v}" class="${String(value) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  }

  toggle(setting, label, desc, value) {
    return `<div class="set-row"><div class="sl"><b>${label}</b><span>${desc}</span></div>${this.seg(setting, value, [['true', 'On'], ['false', 'Off']])}</div>`;
  }

  range(setting, label, desc, value) {
    const v = Math.round(clamp(Number(value) || 0, 0, 1) * 100);
    return `<div class="set-row"><div class="sl"><b>${label}</b><span>${desc}</span></div>
      <div class="set-controls"><input type="range" min="0" max="100" value="${v}" data-setting="${setting}">
      <span class="slider-val" data-val-for="${setting}">${v}%</span></div></div>`;
  }

  renderSettings() {
    const s = this.game.settings;
    const tabs = [['audio', 'Audio'], ['graphics', 'Graphics'], ['controls', 'Controls'], ['game', 'Game']];
    let body = '';
    if (this.settingsTab === 'audio') {
      body = `<div class="set-group"><h4>Sound</h4>
        ${this.range('music', 'Music', 'Procedural score for each region', s.music)}
        ${this.range('sfx', 'Effects', 'Combat, UI and the small sounds of the world', s.sfx)}
        ${this.toggle('muted', 'Mute all', 'Silence the world entirely', s.muted)}
        <div class="set-note">Audio begins after your first interaction, as browsers require.</div>
      </div>`;
    } else if (this.settingsTab === 'graphics') {
      body = `<div class="set-group"><h4>Display</h4>
        <div class="set-row"><div class="sl"><b>Quality</b><span>Lower settings run better on integrated graphics.</span></div>${this.seg('quality', s.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}</div>
        <div class="set-row"><div class="sl"><b>Camera zoom</b><span>See more of Aetheria or stand closer to it.</span></div>${this.seg('zoom', s.zoom, [['close', 'Close'], ['normal', 'Normal'], ['wide', 'Wide']])}</div>
        ${this.toggle('lighting', 'Dynamic lighting', 'Torches, crystals and the deep dark', s.lighting)}
        ${this.toggle('particles', 'Particles & weather', 'Leaves, snow, embers and spellwork', s.particles)}
        ${this.toggle('shake', 'Screen shake', 'Impact feedback on heavy blows', s.shake)}
      </div>`;
    } else if (this.settingsTab === 'controls') {
      body = `<div class="set-group"><h4>Keyboard</h4>
        <div class="ctrl-grid">
          <div><kbd>W A S D</kbd><span>Move</span></div>
          <div><kbd>J</kbd><span>Light attack / combo</span></div>
          <div><kbd>K</kbd><span>Heavy attack</span></div>
          <div><kbd>SPACE</kbd><span>Dodge — invulnerable</span></div>
          <div><kbd>C</kbd><span>Hold to block</span></div>
          <div><kbd>SHIFT</kbd><span>Sprint</span></div>
          <div><kbd>1 – 5</kbd><span>Echo abilities</span></div>
          <div><kbd>E</kbd><span>Interact / continue</span></div>
          <div><kbd>I</kbd><span>Satchel</span></div>
          <div><kbd>Q</kbd><span>Journal</span></div>
          <div><kbd>M</kbd><span>World map</span></div>
          <div><kbd>ESC</kbd><span>Pause / close</span></div>
        </div></div>
        <div class="set-group"><h4>Touch</h4>
          <div class="set-note">Use the left stick to move. The round buttons attack, dodge, block and cast. The top-right buttons open the satchel, map and pause menu. Hold C / BLOCK to guard.</div>
        </div>`;
    } else {
      body = `<div class="set-group"><h4>Journey</h4>
        ${this.toggle('tutorial', 'Hints & tutorial', 'Small reminders when you arrive somewhere new', s.tutorial)}
        <div class="set-row"><div class="sl"><b>Autosave</b><span>Your journey saves to this browser every 25 seconds and at important moments.</span></div><span class="reward-chip">Local</span></div>
        <div class="set-row"><div class="sl"><b>Delete save</b><span>Erase this journey from the browser. This cannot be undone.</span></div><button class="btn danger" data-action="delete-save">Delete</button></div>
      </div>`;
    }
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.settings.title, PANEL_DEFS.settings.sub)}
      <div class="panel-body"><div class="settings-layout">
        <div class="settings-nav">${tabs.map(([id, label]) =>
          `<button data-stab="${id}" class="${this.settingsTab === id ? 'on' : ''}">${label}</button>`).join('')}</div>
        <div class="settings-pane scroll">${body}</div>
      </div></div>
      ${this.panelFoot(`Saved locally · v1.0`, 'ESC · close')}
    </div>`;
  }

  renderControls() {
    return `<div class="panel">
      ${this.panelHead(PANEL_DEFS.controls.title, PANEL_DEFS.controls.sub)}
      <div class="panel-body"><div class="settings-pane scroll" style="max-width:none">
        <div class="set-group"><h4>The Loop</h4>
          <div class="qd-desc" style="margin-bottom:6px">Wake the three Echo Monuments — Root, Crown and Peak — then return to Elder Maelin. Beneath the Sanctuary, the old well waits. What sleeps there remembers your name.</div>
        </div>
        <div class="set-group"><h4>Combat</h4>
          <div class="ctrl-grid">
            <div><kbd>J</kbd><span>Three-hit light combo</span></div>
            <div><kbd>K</kbd><span>Heavy attack — breaks guards</span></div>
            <div><kbd>SPACE</kbd><span>Dodge through attacks</span></div>
            <div><kbd>C</kbd><span>Block — drains stamina</span></div>
            <div><kbd>SHIFT</kbd><span>Sprint — drains stamina</span></div>
          </div>
        </div>
        <div class="set-group"><h4>Abilities</h4>
          <div class="ability-help">${Object.values(ABILITIES).map(a => `<div class="ah-row"><span class="ah-key">${a.key}</span><div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div><span class="ah-cost">${a.cost} EN</span></div>`).join('')}</div>
        </div>
        <div class="set-group"><h4>Exploration</h4>
          <div class="set-note">Talk to everyone. Read what the dead left behind. Chests, crystals and secrets are marked on the minimap once you are close. Portals in the Sanctuary connect the five regions; some are sealed until their guardian falls.</div>
        </div>
      </div></div>
      ${this.panelFoot('Press ESC to return')}
    </div>`;
  }

  /* ---------------- shop ---------------- */
  renderShop() {
    const stock = SHOP_STOCK[this.shopId] || [];
    const p = this.player;
    const names = { brann: ["Brann's Forge", 'Steel and echo shards'], sera: ["Sera's Remedies", 'Green things, red things, blue things'] };
    const info = names[this.shopId] || ['Merchant', 'Wares'];
    const stockRows = stock.map(it => {
      const price = priceOf(it);
      const afford = p.resources.gold >= price;
      return `<div class="shop-item">
        <div class="shop-ic"><img src="${this.iconFor(it)}" alt=""></div>
        <div class="shop-info"><div class="shop-name" style="color:${it.category === 'equipment' ? rarityColor(it.rarity) : (it.tint || '#e7e2d3')}">${esc(it.name)}${(it.qty || 1) > 1 ? ` ×${it.qty}` : ''}</div>
          <div class="shop-sub">${esc(it.category === 'equipment' ? `${it.rarity} ${it.kind}` : it.category)}${it.level ? ` · Lv ${it.level}` : ''}</div>
          <div class="shop-desc">${esc(it.desc || '')}</div></div>
        <button class="btn ${afford ? 'gold' : ''}" data-action="buy" data-uid="${it.uid}" ${afford ? '' : 'disabled'}>✦ ${price}</button>
      </div>`;
    }).join('') || '<div class="qd-empty">Sold out. Come back after a long road.</div>';
    const sellRows = p.inventory.filter(Boolean).map(it => {
      const price = Math.max(1, Math.round((it.value || 10) * .5));
      return `<div class="shop-item compact">
        <div class="shop-ic"><img src="${this.iconFor(it)}" alt=""></div>
        <div class="shop-info"><div class="shop-name">${esc(it.name)}${(it.qty || 1) > 1 ? ` ×${it.qty}` : ''}</div><div class="shop-sub">${esc(it.category)}</div></div>
        <button class="btn" data-action="sell" data-uid="${it.uid}">Sell ${price}</button>
      </div>`;
    }).join('') || '<div class="qd-empty">Nothing to sell.</div>';
    return `<div class="panel">
      ${this.panelHead(info[0], info[1])}
      <div class="panel-body"><div class="shop-layout">
        <div class="shop-left"><div class="equip-title">For sale</div><div class="shop-list scroll">${stockRows}</div></div>
        <div class="shop-right"><div class="equip-title">Sell from satchel</div><div class="shop-list scroll">${sellRows}</div></div>
      </div></div>
      ${this.panelFoot(`Gold: ${num(p.resources.gold)} · goods are bought and sold in gold`)}
    </div>`;
  }

  /* ---------------- forge ---------------- */
  renderForge() {
    const p = this.player;
    const slots = ['weapon', 'armor', 'charm'].map(slot => {
      const it = p.equipment[slot];
      if (!it) return `<div class="forge-slot empty"><div class="equip-title">${slot}</div><div class="qd-empty">Nothing equipped</div></div>`;
      const lvl = it.upgrade || 0;
      const maxed = lvl >= 5;
      const shardCost = 2 + lvl, goldCost = 40 + lvl * 55 + it.level * 8;
      const can = !maxed && p.resources.shards >= shardCost && p.resources.gold >= goldCost;
      const lines = itemStatLines(it).map(([k, v]) => `<div class="id-stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
      return `<div class="forge-slot">
        <div class="id-head"><div class="id-icon"><img src="${this.iconFor(it)}" alt=""></div>
          <div><h3 style="color:${rarityColor(it.rarity)}">${esc(it.name)}</h3><div class="id-type">${slot} · awakening ${lvl}/5</div></div></div>
        <div class="id-stats">${lines}</div>
        <button class="btn ${can ? 'gold' : ''}" data-action="forge" data-slot="${slot}" ${maxed || !can ? 'disabled' : ''}>
          ${maxed ? 'Fully awakened' : `Awaken · ${shardCost} shards · ${goldCost}g`}
        </button>
      </div>`;
    }).join('');
    return `<div class="panel">
      ${this.panelHead('The Echo Forge', 'Metal remembers. Give it a reason.')}
      <div class="panel-body"><div class="forge-layout scroll">
        <div class="forge-note">Every awakening strengthens the item's existing virtues. The forge asks for echo shards and gold; it does not ask what you intend to do with the result.</div>
        <div class="forge-grid">${slots}</div>
        <div class="stat-block" style="max-width:320px"><span>Echo shards</span><b>${num(p.resources.shards)}</b><span>Gold</span><b>${num(p.resources.gold)}</b></div>
      </div></div>
      ${this.panelFoot('Awakened gear keeps its name and grows sharper')}
    </div>`;
  }

  /* ---------------- lore ---------------- */
  renderLore() {
    const d = this.panelData || {};
    return `<div class="panel lore-panel">
      ${this.panelHead(d.title || 'A Record', 'Words left in the world')}
      <div class="panel-body"><div class="lore-body scroll">
        <span class="lore-mark">✦</span>
        <p>${esc(d.text || '').replace(/\n/g, '</p><p>')}</p>
        <div class="lore-rule"></div>
        <button class="btn gold" data-action="close">Close</button>
      </div></div>
      ${this.panelFoot('Some things are only remembered by being read')}
    </div>`;
  }

  /* ---------------- pause ---------------- */
  renderPause() {
    const p = this.player, g = this.game;
    return `<div class="panel pause-panel">
      <div class="pause-kicker">THE ECHO WAITS</div>
      <h2>PAUSED</h2>
      <div class="pause-sub">${esc(g.map ? g.map.name : 'Aetheria')} · Level ${p.level}</div>
      <div class="pause-menu">
        <button data-action="resume">Resume Journey</button>
        <button data-action="save">Save Now</button>
        <button data-action="pause-settings">Settings</button>
        <button data-action="pause-help">How to Play</button>
        <button class="quit" data-action="title">Return to Title</button>
      </div>
      <div class="pause-meta">${fmtTime(g.playtime)} · ${num(p.resources.gold)} gold · ${num(p.resources.crystals)} crystals<br>
        Autosaves locally · ${g.hasSave() ? 'journey recorded' : 'no save yet'}</div>
    </div>`;
  }

  openPause() {
    if (this.game.dialogueOpen) return;
    this.game.paused = true;
    this.game.panelOpen = true;
    this.panelMode = 'pause';
    this.displayMode = 'pause';
    this.renderOverlay();
    this.el.overlayWrap.classList.remove('hidden');
    this.el.touch?.classList.add('hidden');
    audio.sfx('uiopen');
  }

  /* ============================================================
     panel keyboard
     ============================================================ */
  handlePanelKey(key) {
    if (!this.game.panelOpen) return false;
    if (key === 'escape' || key === 'p') {
      this.closeAll();
      return true;
    }
    if (key === 'i' || key === 'tab') { this.openPanel('inventory'); return true; }
    if (key === 'c') { this.openPanel('character'); return true; }
    if (key === 'k') { this.openPanel('skills'); return true; }
    if (key === 'q') { this.openPanel('quests'); return true; }
    if (key === 'm') { this.openPanel('map'); return true; }
    return true;
  }

  /* ============================================================
     dialogue
     ============================================================ */
  bindDialogue() {
    if (!this.el.dialogueWrap) return;
    this.el.dialogueWrap.addEventListener('pointerdown', e => {
      if (e.target.closest('#dlgChoices')) return;
      if (e.target.closest('button')) return;
      this.advanceDialogue('e');
    });
  }

  openDialogue(npc, def, node) {
    if (!this.el.dialogueWrap) return;
    this.dlgNpc = npc;
    this.dlgDef = def;
    this.game.dialogueOpen = true;
    this.el.dialogueWrap.classList.remove('hidden');
    this.el.touch?.classList.add('hidden');
    if (this.el.dlgPortrait) {
      this.el.dlgPortrait.innerHTML = '';
      try {
        const p = getPortrait(npc.key || npc.id);
        if (p) this.el.dlgPortrait.appendChild(p);
      } catch { }
    }
    audio.sfx('uiopen');
    this.setDialogueNode(node, def, npc);
  }

  setDialogueNode(node, def = this.dlgDef, npc = this.dlgNpc) {
    if (!node) { this.closeDialogue(); return; }
    this.dlgNode = node;
    this.dlgDef = def;
    this.dlgNpc = npc;
    const name = node.name || (def && def.name) || (npc && npc.name) || 'Aetheria';
    if (this.el.dlgName) this.el.dlgName.textContent = name;
    this.dlgFull = node.text || '';
    this.typeIndex = 0;
    this.typeAcc = 0;
    this.typing = this.dlgFull.length > 0;
    if (this.el.dlgText) this.el.dlgText.textContent = '';
    if (this.el.dlgChoices) this.el.dlgChoices.innerHTML = '';
    if (this.el.dlgHint) this.el.dlgHint.textContent = this.typing ? 'E · continue' : (node.choices && node.choices.length ? '1–4 · choose' : 'E · close');
    if (!this.typing) this.buildChoices();
  }

  buildChoices() {
    if (!this.el.dlgChoices || !this.dlgNode) return;
    const choices = this.dlgNode.choices || [];
    this.el.dlgChoices.innerHTML = '';
    choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${i + 1}. ${esc(c.label || 'Continue')}`;
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        this.choose(i);
      });
      this.el.dlgChoices.appendChild(b);
    });
    if (this.el.dlgHint) this.el.dlgHint.textContent = choices.length ? '1–4 · choose' : 'E · close';
  }

  finishTyping() {
    if (!this.typing) return;
    this.typing = false;
    this.typeIndex = this.dlgFull.length;
    if (this.el.dlgText) this.el.dlgText.textContent = this.dlgFull;
    this.buildChoices();
  }

  updateTypewriter(dt) {
    if (!this.typing) return;
    this.typeAcc += dt;
    const target = Math.min(this.dlgFull.length, Math.floor(this.typeAcc * 62));
    if (target > this.typeIndex) {
      this.typeIndex = target;
      if (this.el.dlgText) this.el.dlgText.textContent = this.dlgFull.slice(0, this.typeIndex);
    }
    if (this.typeIndex >= this.dlgFull.length) this.finishTyping();
  }

  advanceDialogue(key) {
    if (!this.game.dialogueOpen) return;
    if (this.typing) { this.finishTyping(); return; }
    const node = this.dlgNode;
    if (!node) { this.closeDialogue(); return; }
    const choices = node.choices || [];
    if (key && /^[1-4]$/.test(key)) {
      const i = Number(key) - 1;
      if (choices[i]) this.choose(i);
      return;
    }
    if (choices.length === 1) { this.choose(0); return; }
    if (choices.length === 0) { this.closeDialogue(); return; }
    // More than one choice: wait for an explicit selection.
    if (this.el.dlgChoices) {
      this.el.dlgChoices.classList.remove('nudge');
      void this.el.dlgChoices.offsetWidth;
      this.el.dlgChoices.classList.add('nudge');
    }
  }

  choose(i) {
    const node = this.dlgNode;
    if (!node) return;
    const c = (node.choices || [])[i];
    if (!c) return;
    audio.sfx('ui');
    if (c.action === 'node') {
      this.setDialogueNode(c.next, this.dlgDef, this.dlgNpc);
      return;
    }
    if (c.action === 'close' || !c.action) {
      if (c.next) this.setDialogueNode(c.next, this.dlgDef, this.dlgNpc);
      else this.closeDialogue();
      return;
    }
    this.game.handleDialogueAction(c, node, this.dlgNpc, this.dlgDef);
  }

  closeDialogue(silent = false) {
    if (!this.el.dialogueWrap) return;
    this.el.dialogueWrap.classList.add('hidden');
    this.game.dialogueOpen = false;
    this.game.dialogueNpc = null;
    this.typing = false;
    this.dlgNode = null;
    if (this.el.dlgChoices) this.el.dlgChoices.innerHTML = '';
    if (this.touchEnabled && this.game.state !== 'title') this.el.touch?.classList.remove('hidden');
    if (!silent) audio.sfx('ui');
  }

  /* ============================================================
     lore, death, ending
     ============================================================ */
  showLore(title, text) {
    this.openPanel('lore', { title, text });
  }

  showDeath() {
    this._deathShown = true;
    this.displayMode = 'death';
    this.panelMode = null;
    this.game.panelOpen = false;
    this.el.overlayWrap.classList.remove('hidden');
    this.el.touch?.classList.add('hidden');
    const p = this.player;
    const lost = Math.round((p.resources.gold || 0) * .1);
    this.el.overlay.innerHTML = `<div class="panel death-panel">
      <div class="death-mark">✦</div>
      <div class="death-kicker">THE ECHO REMEMBERS</div>
      <h2>YOU HAVE FALLEN</h2>
      <div class="death-sub">The road is not finished with you.</div>
      <div class="death-meta">${lost > 0 ? `${num(lost)} gold will be lost to the dark.` : 'You carried nothing the dark wanted.'}</div>
      <div class="pause-menu" style="max-width:340px;margin:0 auto 20px">
        <button data-action="respawn">Rise at the Last Hearth</button>
        <button class="quit" data-action="title">Return to Title</button>
      </div>
      <div class="pause-meta">Level ${p.level} · ${this.game.map ? esc(this.game.map.name) : ''}</div>
    </div>`;
    audio.sfx('uiopen');
  }

  hideDeath() {
    this._deathShown = false;
    if (this.displayMode === 'death') {
      this.displayMode = null;
      this.el.overlayWrap.classList.add('hidden');
      this.el.overlay.innerHTML = '';
    }
    if (this.touchEnabled && this.game.state !== 'title') this.el.touch?.classList.remove('hidden');
  }

  showEnding() {
    this.displayMode = 'ending';
    this.panelMode = null;
    this.el.overlayWrap.classList.remove('hidden');
    this.el.touch?.classList.add('hidden');
    const p = this.player, g = this.game;
    const done = Object.values(g.quests).filter(q => q.status === 'done').length;
    this.el.overlay.innerHTML = `<div class="panel ending-panel">
      <div class="ending-rules"></div>
      <div class="ending-kicker">THE FOURTH MONUMENT</div>
      <h2>THE ECHO IS QUIET</h2>
      <div class="ending-body scroll">
        <p>The Chorus has stopped. Not died — stopped, the way a held breath is finally let go.</p>
        <p>Beneath your feet the Heart of the Echo cools to something like stone. Above, the roots of the world are still. You can hear them now: not singing, just growing.</p>
        <p>Maelin will keep the fire. Ilse will catalogue the silence. Somewhere in Greenfall a locket is still ticking, and somewhere in the frost a promise is still being kept by a mountain that has forgotten why.</p>
        <p class="ending-final">Aetheria remembers, slowly, the way a person remembers a dream.</p>
      </div>
      <div class="ending-stats">
        <div><span>LEVEL</span><b>${p.level}</b></div>
        <div><span>QUESTS</span><b>${done}</b></div>
        <div><span>JOURNEY</span><b>${fmtTime(g.playtime)}</b></div>
      </div>
      <div class="pause-menu" style="max-width:340px;margin:0 auto">
        <button data-action="ending-continue">Walk the Quiet World</button>
        <button class="quit" data-action="title">Return to Title</button>
      </div>
    </div>`;
  }

  /* ============================================================
     overlay events
     ============================================================ */
  bindOverlay() {
    if (!this.el.overlay) return;
    this.el.overlay.addEventListener('click', e => this.onOverlayClick(e));
    this.el.overlay.addEventListener('input', e => {
      const r = e.target.closest('input[type=range][data-setting]');
      if (!r) return;
      const key = r.dataset.setting;
      const val = Number(r.value) / 100;
      const label = this.el.overlay.querySelector(`[data-val-for="${key}"]`);
      if (label) label.textContent = r.value + '%';
      this._settingLive = true;
      this.game.setSetting(key, val);
      this._settingLive = false;
    });
    this.el.overlay.addEventListener('change', e => {
      const r = e.target.closest('input[type=range][data-setting]');
      if (!r) return;
      this.game.saveSettings();
    });
  }

  onOverlayClick(e) {
    const nav = e.target.closest('[data-panel]');
    if (nav) {
      audio.sfx('ui');
      this.openPanel(nav.dataset.panel);
      return;
    }
    const stab = e.target.closest('[data-stab]');
    if (stab) {
      this.settingsTab = stab.dataset.stab;
      audio.sfx('ui');
      this.refreshPanel();
      return;
    }
    const seg = e.target.closest('.seg button[data-setting]');
    if (seg) {
      const key = seg.dataset.setting;
      let val = seg.dataset.value;
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      audio.sfx('ui');
      this.game.setSetting(key, val);
      this.refreshPanel();
      return;
    }
    const skill = e.target.closest('[data-skill]');
    if (skill) {
      this.game.unlockSkill(skill.dataset.skill);
      return;
    }
    const outfit = e.target.closest('[data-outfit]');
    if (outfit) {
      this.game.setOutfit(Number(outfit.dataset.outfit));
      return;
    }
    const acc = e.target.closest('[data-accessory]');
    if (acc) {
      this.game.setAccessory(Number(acc.dataset.accessory));
      return;
    }
    const quest = e.target.closest('[data-quest]');
    if (quest && !e.target.closest('[data-action]')) {
      this.questSel = quest.dataset.quest;
      audio.sfx('ui');
      this.refreshPanel();
      return;
    }
    const slot = e.target.closest('.slot[data-uid]');
    if (slot && !e.target.closest('[data-action]')) {
      this.invSel = Number(slot.dataset.uid);
      audio.sfx('ui');
      this.refreshPanel();
      return;
    }
    const act = e.target.closest('[data-action]');
    if (act) this.runAction(act.dataset.action, act);
  }

  runAction(action, el) {
    const g = this.game;
    switch (action) {
      case 'close':
        this.closeAll();
        audio.sfx('ui');
        break;
      case 'resume':
        this.closeAll();
        audio.sfx('ui');
        break;
      case 'save':
        g.save(false);
        this.refreshPanel();
        break;
      case 'pause-settings':
        this.openPanel('settings');
        break;
      case 'pause-help':
        this.openPanel('controls');
        break;
      case 'title':
        g.returnToTitle();
        break;
      case 'respawn':
        g.respawn();
        break;
      case 'ending-continue':
        this.closeAll();
        g.state = 'playing';
        g.refreshObjective();
        g.save(true);
        this.toast('The world is quiet. Walk where you wish.', 'good');
        break;
      case 'delete-save':
        if (window.confirm('Delete your saved journey? This cannot be undone.')) {
          g.deleteSave();
          this.toast('Journey deleted', 'bad');
          this.updateTitle();
          this.refreshPanel();
        }
        break;
      case 'track':
        g.trackedQuest = el.dataset.quest || 'main';
        g.refreshObjective();
        this.toast('Quest tracked', 'good');
        this.refreshPanel();
        break;
      case 'equip':
        this.player.equip(Number(el.dataset.uid));
        break;
      case 'unequip':
        if (el.dataset.slot) this.player.unequip(el.dataset.slot);
        break;
      case 'use':
        this.player.useConsumable(Number(el.dataset.uid));
        this.refreshPanel();
        break;
      case 'apply': {
        const item = this.player.inventory.find(i => i && i.uid === Number(el.dataset.uid));
        if (item) g.applyCosmetic(item);
        break;
      }
      case 'buy':
        g.buyItem(this.shopId, Number(el.dataset.uid));
        break;
      case 'sell':
        g.sellItem(Number(el.dataset.uid));
        break;
      case 'forge':
        g.forgeUpgrade(el.dataset.slot);
        break;
      default:
        break;
    }
  }

  /* ============================================================
     touch controls
     ============================================================ */
  bindTouch() {
    if (!this.el.touch) return;

    // Echo ability and heavy/block are added here so every control exists on touch.
    if (this.el.touchButtons) {
      const add = (act, html, cls = 'tbtn ab') => {
        if (this.el.touchButtons.querySelector(`[data-act="${act}"]`)) return;
        const d = document.createElement('div');
        d.className = cls;
        d.dataset.act = act;
        if (ABILITIES[act]) d.dataset.ability = act;
        d.innerHTML = html;
        this.el.touchButtons.appendChild(d);
      };
      add('echo', '<span class="ab-key">5</span>', 'tbtn ab');
      add('heavy', '⚔<span>HEAVY</span>');
      add('block', '▣<span>BLOCK</span>');
    }

    const zone = this.el.stickZone;
    if (zone) {
      let pid = null, cx = 0, cy = 0;
      const max = 52;
      const start = e => {
        pid = e.pointerId;
        const r = zone.getBoundingClientRect();
        cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        try { zone.setPointerCapture(pid); } catch { }
        move(e);
      };
      const move = e => {
        if (pid === null || e.pointerId !== pid) return;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx *= max / d; dy *= max / d; }
        const nx = dx / max, ny = dy / max;
        this.game.setJoystick(Math.abs(nx) < .12 ? 0 : nx, Math.abs(ny) < .12 ? 0 : ny, true);
        if (this.el.stickKnob) this.el.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      };
      const end = e => {
        if (pid !== null && e.pointerId !== pid) return;
        pid = null;
        this.game.setJoystick(0, 0, false);
        if (this.el.stickKnob) this.el.stickKnob.style.transform = 'translate(-50%, -50%)';
      };
      zone.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); start(e); });
      zone.addEventListener('pointermove', move);
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('pointerleave', e => { if (pid !== null) end(e); });
    }

    this.el.touchButtons?.addEventListener('pointerdown', e => {
      const btn = e.target.closest('.tbtn, .tmini');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const act = btn.dataset.act;
      btn.classList.add('press');
      setTimeout(() => btn.classList.remove('press'), 120);
      this.touchAction(act, btn, e);
    });
    // Hold block behaves like the C key.
    this.el.touchButtons?.addEventListener('pointerup', e => {
      const btn = e.target.closest('.tbtn[data-act="block"]');
      if (btn) this.game.keys.delete('c');
    });
    this.el.touchButtons?.addEventListener('pointercancel', () => this.game.keys.delete('c'));

    this.el.touchTop?.addEventListener('pointerdown', e => {
      const btn = e.target.closest('.tmini');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      this.touchAction(btn.dataset.act, btn, e);
    });
  }

  touchAction(act, btn, e) {
    const g = this.game;
    if (!g.playerCanAct() && !['inventory', 'map', 'pause'].includes(act)) return;
    switch (act) {
      case 'attack': g.player.startAttack(false); break;
      case 'heavy': g.player.startAttack(true); break;
      case 'dodge': g.player.startDodge(); break;
      case 'interact': g.interact(); break;
      case 'block':
        g.keys.add('c');
        break;
      case 'inventory': this.openPanel('inventory'); break;
      case 'map': this.openPanel('map'); break;
      case 'pause': this.openPause(); break;
      case 'burst': case 'blink': case 'nova': case 'frost': case 'echo':
        g.useAbility(act);
        break;
      default: break;
    }
  }

  updateTouchAbilityStates() {
    if (!this.el.touchButtons || !this.player) return;
    const p = this.player;
    for (const btn of this.el.touchButtons.querySelectorAll('.tbtn.ab')) {
      const id = btn.dataset.ability;
      if (!id || !ABILITIES[id]) continue;
      btn.classList.toggle('cool', !p.abilities[id] || p.cooldowns[id] > 0);
    }
  }
}
