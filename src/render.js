/* ============================================================
   ECHOES OF THE FALLEN — canvas renderer
   ============================================================ */
import {
  getTile, getWaterFrames, PROPS, BUILDINGS, tintCanvas,
} from './art.js';
import {
  getPlayerFrame, getNPC, getEnemySprite, getSlash, getOrbs, getShadowSprite,
  ENEMY_DIMS, OUTFITS,
} from './sprites.js';
import { TILE, TILE_KIND, T, MINI_COLORS, tileAt } from './world.js';
import { REGIONS } from './world.js';
import { clamp, lerp, rand, dist } from './util.js';

const TILE_IMAGES = {};
function imageFromUrl(url) {
  if (!url) return null;
  if (TILE_IMAGES[url]) return TILE_IMAGES[url];
  const img = new Image();
  img.src = url;
  TILE_IMAGES[url] = img;
  return img;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.dpr = 1;
    this.vw = 1280; this.vh = 720;
    this.cam = { x: game.player.x, y: game.player.y, scale: 2 };
    this.terrain = null;
    this.terrainId = null;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.minimap = document.getElementById('minimap');
    this.minimapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.minimapTimer = 0;
    this.titleDrift = 0;
    this.resize();
    this.cam.x = game.player.x;
    this.cam.y = game.player.y - 20;
  }

  resize() {
    const q = this.game.settings.quality;
    this.dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.4 : 1);
    this.vw = Math.max(320, window.innerWidth);
    this.vh = Math.max(240, window.innerHeight);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
    this.lightCanvas.width = Math.max(160, Math.round(this.vw * .55));
    this.lightCanvas.height = Math.max(120, Math.round(this.vh * .55));
    if (this.terrain) this.terrain = null;
  }

  screenToWorld(sx, sy) {
    const s = this.cam.scale || 2;
    return {
      x: this.cam.x + (sx - this.vw / 2) / s,
      y: this.cam.y + (sy - this.vh / 2) / s,
    };
  }

  getTerrain(map) {
    if (this.terrain && this.terrainId === map.id) return this.terrain;
    const c = document.createElement('canvas');
    c.width = map.w * TILE; c.height = map.h * TILE;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const i = ty * map.w + tx;
        const t = map.tiles[i];
        const kind = TILE_KIND[t] || 'grass';
        const v = map.variants[i] & 3;
        let tile = null;
        try { tile = getTile(kind, v)[v & 3]; } catch { tile = null; }
        if (tile) x.drawImage(tile, tx * TILE, ty * TILE);
        else { x.fillStyle = '#1a2420'; x.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
        // soft edge on paths next to grass
        if ((t === T.PATH || t === T.SNOWPATH || t === T.PAVE) && (tx > 0 || ty > 0)) {
          const above = ty > 0 ? map.tiles[i - map.w] : t;
          if (above === T.GRASS || above === T.GRASS_DARK || above === T.SNOW) {
            x.fillStyle = 'rgba(20,30,20,.18)';
            x.fillRect(tx * TILE, ty * TILE, TILE, 2);
          }
        }
      }
    }
    this.terrain = c;
    this.terrainId = map.id;
    return c;
  }

  computeScale() {
    const z = this.game.settings.zoom || 'normal';
    const heights = { normal: 370, wide: 480, close: 285 };
    let target = heights[z] || heights.normal;
    if (this.vw < 700) target *= .84;
    if (this.vw > 1800) target *= .92;
    let s = this.vh / target;
    s = clamp(s, .85, 3.4);
    return s;
  }

  render(dt = 1 / 60) {
    const g = this.game;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#070b0a';
    ctx.fillRect(0, 0, this.vw, this.vh);

    const title = g.state === 'title' || g.state === 'boot';
    const map = g.map;
    const scale = title ? clamp(this.vh / 420, 1, 2.6) : this.computeScale();
    let targetX, targetY;
    if (title) {
      this.titleDrift += dt;
      targetX = 34 * TILE + Math.sin(this.titleDrift * .16) * 70;
      targetY = 22 * TILE + Math.cos(this.titleDrift * .1) * 36;
      this.cam.x = lerp(this.cam.x, targetX, 1 - Math.pow(.34, dt));
      this.cam.y = lerp(this.cam.y, targetY, 1 - Math.pow(.34, dt));
    } else {
      this.cam.x = lerp(this.cam.x, g.camera.x, 1 - Math.pow(.0009, dt));
      this.cam.y = lerp(this.cam.y, g.camera.y, 1 - Math.pow(.0009, dt));
    }
    this.cam.scale = lerp(this.cam.scale || scale, scale, 1 - Math.pow(.02, dt));
    const s = this.cam.scale;

    // camera bounds
    const halfW = this.vw / (2 * s), halfH = this.vh / (2 * s);
    const mw = map.w * TILE, mh = map.h * TILE;
    let cx = this.cam.x, cy = this.cam.y;
    cx = mw > halfW * 2 ? clamp(cx, halfW, mw - halfW) : mw / 2;
    cy = mh > halfH * 2 ? clamp(cy, halfH, mh - halfH) : mh / 2;
    this.cam.x = cx; this.cam.y = cy;
    const shakeX = (Math.random() - .5) * g.shakeAmt * 2;
    const shakeY = (Math.random() - .5) * g.shakeAmt * 2;

    ctx.save();
    ctx.translate(this.vw / 2 + shakeX, this.vh / 2 + shakeY);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);

    const view = {
      x0: cx - halfW - 90, y0: cy - halfH - 120,
      x1: cx + halfW + 90, y1: cy + halfH + 150,
    };

    const terrain = this.getTerrain(map);
    const sx = Math.max(0, Math.floor(view.x0)), sy = Math.max(0, Math.floor(view.y0));
    const sw = Math.min(mw - sx, Math.ceil(view.x1 - view.x0)), sh = Math.min(mh - sy, Math.ceil(view.y1 - view.y0));
    if (sw > 0 && sh > 0) ctx.drawImage(terrain, sx, sy, sw, sh, sx, sy, sw, sh);

    // water shimmer
    if (!title || true) {
      const wf = getWaterFrames();
      const frame = wf[(g.time * 4 | 0) % wf.length];
      const tx0 = Math.max(0, Math.floor(view.x0 / TILE)), ty0 = Math.max(0, Math.floor(view.y0 / TILE));
      const tx1 = Math.min(map.w - 1, Math.ceil(view.x1 / TILE)), ty1 = Math.min(map.h - 1, Math.ceil(view.y1 / TILE));
      ctx.globalAlpha = .5;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = map.tiles[ty * map.w + tx];
          if (t === T.WATER || t === T.DEEP) {
            ctx.drawImage(frame, (tx * 7) % 48, (ty * 11) % 48, 16, 16, tx * TILE, ty * TILE, TILE, TILE);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // drawable collection
    const draws = [];
    for (const p of map.props) {
      if (p.img === PROPS.monumentOff) continue;
      if (p.x < view.x0 - 120 || p.x > view.x1 + 120 || p.y < view.y0 - 180 || p.y > view.y1 + 80) continue;
      draws.push({ y: p.sort != null ? p.sort : p.y, type: 'prop', o: p });
    }
    for (const npc of map.npcs) {
      if (npc.x < view.x0 - 60 || npc.x > view.x1 + 60 || npc.y < view.y0 - 70 || npc.y > view.y1 + 60) continue;
      draws.push({ y: npc.y, type: 'npc', o: npc });
    }
    for (const it of map.interactables) {
      if (it.x < view.x0 - 70 || it.x > view.x1 + 70 || it.y < view.y0 - 140 || it.y > view.y1 + 60) continue;
      draws.push({ y: it.y, type: 'interact', o: it });
    }
    for (const e of g.enemies) {
      if (e.x < view.x0 - 70 || e.x > view.x1 + 70 || e.y < view.y0 - 140 || e.y > view.y1 + 70) continue;
      draws.push({ y: e.y, type: 'enemy', o: e });
    }
    for (const d of g.drops) {
      if (d.x < view.x0 - 30 || d.x > view.x1 + 30 || d.y < view.y0 - 40 || d.y > view.y1 + 40) continue;
      draws.push({ y: d.y, type: 'drop', o: d });
    }
    if (!title && !g.player.dead) draws.push({ y: g.player.y, type: 'player', o: g.player });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) {
      if (d.type === 'prop') this.drawProp(ctx, d.o, g.time);
      else if (d.type === 'npc') this.drawNpc(ctx, d.o, g);
      else if (d.type === 'interact') this.drawInteract(ctx, d.o, g);
      else if (d.type === 'enemy') this.drawEnemy(ctx, d.o, g);
      else if (d.type === 'player') this.drawPlayer(ctx, d.o, g);
      else if (d.type === 'drop') this.drawDrop(ctx, d.o, g);
    }

    // target highlights
    if (g.interactTarget && !title) this.drawTargetRing(ctx, g.interactTarget, g.time);
    if (!title && g.objectiveMarker && g.objectiveMarker.map === g.mapId) this.drawObjectiveBeacon(ctx, g.objectiveMarker, g);
    if (!title) this.drawArena(ctx, g);
    this.drawZones(ctx, g);
    this.drawProjectiles(ctx, g);
    this.drawEffects(ctx, g);
    this.drawParticles(ctx, g);
    this.drawDamageNumbers(ctx, g);

    ctx.restore();

    // lighting
    if (g.settings.lighting && map.darkness > .03 && !title) this.drawLighting(ctx, g, map, s, cx, cy);
    else if (title) {
      const grd = ctx.createLinearGradient(0, 0, this.vw, this.vh);
      grd.addColorStop(0, 'rgba(4,8,11,.15)');
      grd.addColorStop(1, 'rgba(4,8,11,.35)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, this.vw, this.vh);
    }

    // fade
    if (g.fade && g.fade.alpha > 0) {
      ctx.fillStyle = `rgba(4,7,10,${g.fade.alpha})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
      if (g.fade.dir === -1) {
        g.fade.alpha -= dt * 2.2;
        if (g.fade.alpha <= 0) { g.fade.alpha = 0; g.fade.dir = 0; }
      }
    }

    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0 && !title) {
      this.minimapTimer = .1;
      this.drawMinimap(g);
    }
  }

  drawProp(ctx, p, time) {
    const img = p.img;
    if (!img) return;
    const w = img.width, h = img.height;
    const base = p.kind === 'building' ? 5 : 6;
    if (p.sway) {
      const sway = Math.sin(time * 1.1 + p.x * .013 + p.y * .01) * .008 * p.sway;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(sway);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(img, -w / 2, -h + base);
      ctx.restore();
    } else {
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h + base));
      ctx.globalAlpha = 1;
    }
  }

  drawNpc(ctx, npc, g) {
    const frame = ((g.time * 1.7 + npc.x * .01) | 0) % 2;
    const sprite = getNPC(npc.key, frame);
    this.shadow(ctx, npc.x, npc.y + 1, 11, 4, .28);
    ctx.drawImage(sprite, Math.round(npc.x - 24), Math.round(npc.y - 45));
    if (dist(npc, g.player) < 100 || g.state === 'title') {
      ctx.font = '7px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(5,8,10,.7)';
      const w = ctx.measureText(npc.name).width + 10;
      ctx.fillRect(npc.x - w / 2, npc.y - 62, w, 11);
      ctx.fillStyle = '#e9dfc8';
      ctx.fillText(npc.name, npc.x, npc.y - 54);
    }
    const mark = this.npcMarker(npc, g);
    if (mark) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px "Palatino Linotype", serif';
      const yy = npc.y - 72 + Math.sin(g.time * 3) * 2;
      ctx.fillStyle = mark === '!' ? '#f0d9a4' : '#7fe3d2';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(mark, npc.x, yy);
      ctx.fillText(mark, npc.x, yy);
    }
  }

  npcMarker(npc, g) {
    const id = npc.id || npc.key;
    const cfg = {
      maelin: () => {
        if (!g.flags.mainStarted) return '!';
        if (g.flags['monument:greenfall'] && g.flags['monument:kingdom'] && g.flags['monument:frost'] && !g.flags.mainReturned) return '?';
        if (g.flags.mainReturned && !g.flags['boss:chorus']) return '?';
        return null;
      },
      mira: () => {
        const q = g.quests.locket;
        if (!q) return '!';
        if (q.status === 'active' && g.flags.locketFound) return '?';
        return null;
      },
      rook: () => {
        const q = g.quests.wolves;
        if (!q) return '!';
        if (q.status === 'active' && (q.progress || 0) >= 6) return '?';
        return null;
      },
      vela: () => {
        const q = g.quests.tome;
        if (!q) return '!';
        if (q.status === 'active' && g.flags.tomeFound) return '?';
        return null;
      },
      ilse: () => {
        const q = g.quests.crystals;
        if (!q) return '!';
        if (q.status === 'active' && g.player.resources.crystals >= 8) return '?';
        return null;
      },
      brann: () => '·', sera: () => '·',
      ysra: () => null, garrick: () => null, pip: () => null, orin: () => null,
    };
    const fn = cfg[id];
    return fn ? fn() : null;
  }

  drawInteract(ctx, it, g) {
    const x = it.x, y = it.y;
    switch (it.type) {
      case 'chest': {
        const open = !!g.flags['chest:' + it.id];
        const img = open ? PROPS.chestOpen : PROPS.chest0;
        this.shadow(ctx, x, y + 1, 10, 3, .28);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 4));
        if (!open) this.sparkle(ctx, x, y - 12, g.time, it.rarity === 'legendary' ? '#f0a84a' : '#e0c88a');
        break;
      }
      case 'crystal': {
        if (g.flags['crystal:' + it.id]) break;
        const img = PROPS.crystal0;
        const bob = Math.sin(g.time * 2 + it.x) * 2;
        this.shadow(ctx, x, y + 1, 9, 3, .26);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 2 + bob));
        this.glow(ctx, x, y - 14 + bob, 18, '#6fd9c8', .22);
        this.sparkle(ctx, x, y - 22, g.time, '#b8fff2');
        break;
      }
      case 'lore': {
        ctx.globalAlpha = .8;
        this.runeGlyph(ctx, x, y - 10 + Math.sin(g.time * 2) * 1.5, '#d8b774', g.time);
        ctx.globalAlpha = 1;
        break;
      }
      case 'sign': {
        const img = PROPS.signpost;
        this.shadow(ctx, x, y + 1, 6, 2, .25);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 4));
        break;
      }
      case 'monument': {
        const active = !!g.flags['monument:' + it.id] || it.active;
        const img = active ? PROPS.monumentOn : PROPS.monumentOff;
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 6));
        if (active) {
          this.glow(ctx, x, y - 54, 60, '#7fe3d2', .13);
          for (let i = 0; i < 3; i++) {
            const yy = y - 20 - ((g.time * 13 + i * 23) % 50);
            ctx.globalAlpha = .5;
            ctx.fillStyle = '#c8fff6';
            ctx.fillRect(x - 3 + Math.sin(g.time + i) * 3, yy, 1.5, 4);
            ctx.globalAlpha = 1;
          }
        }
        break;
      }
      case 'brazier': {
        const lit = !!g.flags['brazier:' + it.id];
        const img = PROPS.brazier;
        this.shadow(ctx, x, y + 1, 7, 2, .25);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 4));
        if (lit) {
          this.glow(ctx, x, y - 18, 28, '#ffb04a', .3);
          for (let i = 0; i < 5; i++) {
            const t = g.time * 6 + i * 1.7;
            ctx.globalAlpha = .8 - i * .12;
            ctx.fillStyle = i % 2 ? '#ffd88a' : '#ff9a4a';
            ctx.fillRect(x - 3 + Math.sin(t) * 3, y - 18 - Math.abs(Math.cos(t)) * 6, 3, 5);
            ctx.globalAlpha = 1;
          }
        }
        break;
      }
      case 'rune': {
        const lit = !!g.flags['rune:' + it.id];
        this.runeGlyph(ctx, x, y - 6, lit ? '#b8fff2' : '#6f8f98', g.time, lit);
        if (lit) this.glow(ctx, x, y - 8, 30, '#7fe3d2', .18);
        break;
      }
      case 'runeGate': {
        const open = g.gateOpen(it);
        if (!open) {
          const r = it.id === 'dp_gate' ? 32 : 26;
          const pulse = .5 + Math.sin(g.time * 2) * .2;
          ctx.globalAlpha = pulse;
          const grd = ctx.createLinearGradient(x - r, y - 50, x + r, y + 10);
          grd.addColorStop(0, 'rgba(90,220,205,.1)');
          grd.addColorStop(.5, 'rgba(140,240,225,.35)');
          grd.addColorStop(1, 'rgba(90,160,220,.1)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.ellipse(x, y - 22, r, 38, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(160,255,240,.55)'; ctx.lineWidth = 1.5;
          ctx.stroke();
          for (let i = 0; i < 5; i++) {
            const a = g.time * .7 + i * 1.25;
            ctx.fillStyle = '#a8fff2';
            ctx.fillRect(x + Math.cos(a) * r * .7, y - 22 + Math.sin(a) * 26, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'altar': {
        this.runeGlyph(ctx, x, y - 4, '#c8a6ff', g.time, true);
        this.glow(ctx, x, y - 8, 40, '#c8a6ff', .18);
        break;
      }
      case 'locket': {
        if (g.flags.locketFound) break;
        const bob = Math.sin(g.time * 2.2) * 2;
        this.glow(ctx, x, y - 10 + bob, 20, '#e0b080', .24);
        ctx.fillStyle = '#c9a45c';
        ctx.beginPath(); ctx.arc(x, y - 12 + bob, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a5a30'; ctx.fillRect(x - 1, y - 15 + bob, 2, 6);
        break;
      }
      case 'tome': {
        if (g.flags.tomeFound) break;
        const bob = Math.sin(g.time * 2) * 1.5;
        this.glow(ctx, x, y - 11 + bob, 22, '#c8a6ff', .22);
        ctx.fillStyle = '#5a5468'; ctx.fillRect(x - 8, y - 16 + bob, 16, 11);
        ctx.fillStyle = '#c8b8a0'; ctx.fillRect(x - 6, y - 14 + bob, 12, 7);
        break;
      }
      case 'depthWell': break;
      default: break;
    }
  }

  drawEnemy(ctx, e, g) {
    const dims = ENEMY_DIMS[e.spriteType] || ENEMY_DIMS.thornling;
    const alpha = e.dead ? clamp(1 - e.deathTimer / 1.4, 0, 1) : (e.spawnBlink > 0 ? .4 + Math.sin(g.time * 30) * .3 : 1);
    if (alpha <= 0) return;
    const sprite = getEnemySprite(e.spriteType, e.frame, e.animState, e.phase);
    const sc = e.scale || 1;
    this.shadow(ctx, e.x, e.y + 1, dims.w * .55 * sc, dims.h * .24 * sc, .3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(e.x, e.y);
    if (e.facing < 0) ctx.scale(-1, 1);
    ctx.scale(sc, sc);
    ctx.drawImage(sprite, -dims.ox, -dims.oy);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = e.hitFlash * 4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(e.x, e.y);
      if (e.facing < 0) ctx.scale(-1, 1);
      ctx.scale(sc, sc);
      ctx.drawImage(sprite, -dims.ox, -dims.oy);
      ctx.restore();
    }
    if (!e.dead) {
      // windup telegraph
      if (e.windup > 0 && e.telegraph) this.drawEnemyTelegraph(ctx, e);
      if ((e.hp < e.maxHp || e.elite || e.isBoss) && !e.isBoss) {
        const w = Math.max(24, e.r * 2.4);
        const yy = e.y - dims.oy * sc + (e.elite ? 0 : -2);
        this.healthBar(ctx, e.x, yy, w, e.hp / e.maxHp, e.elite ? '#c8a6ff' : '#c2515d');
        if (e.elite) {
          ctx.font = 'bold 7px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = '#e0c8ff'; ctx.fillText('ELITE', e.x, yy - 5);
        }
      }
      if (e.isBoss) this.bossAura(ctx, e, g);
    }
  }

  drawEnemyTelegraph(ctx, e) {
    const t = e.telegraph;
    ctx.save();
    ctx.globalAlpha = .25 + Math.sin(this.game.time * 14) * .06;
    ctx.fillStyle = e.behavior === 'charger' || e.behavior === 'lunger' ? '#e08a6a' : '#c2515d';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 4);
    const a0 = t.angle - .38, a1 = t.angle + .38;
    ctx.arc(t.x, t.y - 4, t.range, a0, a1);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .5;
    ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(t.x, t.y - 4, t.range, a0, a1); ctx.stroke();
    ctx.restore();
  }

  bossAura(ctx, e, g) {
    const col = e.phase === 2 ? 'rgba(255,110,80,' : 'rgba(140,220,190,';
    ctx.save();
    ctx.globalAlpha = .14 + Math.sin(g.time * 2) * .04;
    ctx.fillStyle = col + '.22)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.9, e.r * .7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .4;
    ctx.strokeStyle = col + '.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.7, e.r * .6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  drawPlayer(ctx, p, g) {
    const alpha = p.invuln > 0 && p.hurtTimer > 0 ? (.55 + Math.sin(g.time * 30) * .3) : 1;
    const sprite = getPlayerFrame(p.outfit, p.accessory, p.facing, p.dead ? 'hurt' : p.state, p.frame);
    this.shadow(ctx, p.x, p.y + 1, 10, 4, .32);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    if (p.facing === 'side' && p.flip) ctx.scale(-1, 1);
    ctx.drawImage(sprite, -22, -41);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (p.blocking) {
      ctx.globalAlpha = .35;
      ctx.strokeStyle = '#c9f0e8'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y - 14, 17, -1.1, 1.1); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.hasRevive && p.reviveTimer > 0) {
      ctx.globalAlpha = .3; ctx.strokeStyle = '#c9a45c';
      ctx.beginPath(); ctx.arc(p.x, p.y - 12, 15, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  drawDrop(ctx, d, g) {
    const bob = Math.sin(g.time * 3 + d.bob) * 2;
    const y = d.y - d.z - 10 + bob;
    this.glow(ctx, d.x, y, d.kind === 'item' ? 18 : 12, d.kind === 'item' && d.item ? '#d8b774' : d.kind === 'crystal' ? '#6fd9c8' : d.kind === 'shard' ? '#c8a6ff' : '#f0d9a4', .2);
    if (d.kind === 'gold') {
      ctx.fillStyle = '#c9a45c'; ctx.beginPath(); ctx.arc(d.x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe6a8'; ctx.beginPath(); ctx.arc(d.x - 1, y - 1, 2, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'crystal') {
      ctx.fillStyle = '#5bd4c7';
      ctx.beginPath(); ctx.moveTo(d.x, y - 7); ctx.lineTo(d.x + 5, y); ctx.lineTo(d.x, y + 7); ctx.lineTo(d.x - 5, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6fff7'; ctx.fillRect(d.x - 1, y - 4, 2, 5);
    } else if (d.kind === 'shard') {
      ctx.fillStyle = '#a88ae8';
      ctx.beginPath(); ctx.moveTo(d.x, y - 8); ctx.lineTo(d.x + 4, y + 1); ctx.lineTo(d.x, y + 6); ctx.lineTo(d.x - 4, y + 1); ctx.closePath(); ctx.fill();
    } else if (d.kind === 'heal') {
      ctx.fillStyle = '#6fbf7e'; ctx.fillRect(d.x - 5, y - 2, 10, 4); ctx.fillRect(d.x - 2, y - 5, 4, 10);
    } else if (d.kind === 'energy') {
      ctx.fillStyle = '#5aa9d6';
      ctx.beginPath(); ctx.moveTo(d.x + 1, y - 7); ctx.lineTo(d.x - 5, y + 1); ctx.lineTo(d.x, y + 1); ctx.lineTo(d.x - 1, y + 7); ctx.lineTo(d.x + 6, y - 2); ctx.lineTo(d.x + 1, y - 2); ctx.closePath(); ctx.fill();
    } else if (d.kind === 'item' && d.item) {
      const img = imageFromUrl(d.item.iconUrl);
      if (img && img.complete) ctx.drawImage(img, d.x - 11, y - 11, 22, 22);
      else { ctx.fillStyle = '#d8b774'; ctx.fillRect(d.x - 5, y - 5, 10, 10); }
      ctx.strokeStyle = 'rgba(240,217,164,.6)'; ctx.lineWidth = 1;
      ctx.strokeRect(d.x - 12, y - 12, 24, 24);
    }
  }

  drawTargetRing(ctx, target, time) {
    const o = target.obj;
    const r = target.kind === 'npc' ? 20 : (o.type === 'monument' ? 22 : 15);
    ctx.save();
    ctx.globalAlpha = .35 + Math.sin(time * 4) * .12;
    ctx.strokeStyle = '#d8b774';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(o.x, o.y + 1, r, r * .42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  drawObjectiveBeacon(ctx, marker, g) {
    const x = marker.x, y = marker.y;
    const bob = Math.sin(g.time * 2.4) * 4;
    ctx.save();
    ctx.globalAlpha = .5;
    const grd = ctx.createLinearGradient(x, y - 80, x, y);
    grd.addColorStop(0, 'rgba(216,183,116,0)');
    grd.addColorStop(1, 'rgba(216,183,116,.35)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - 7, y - 80 + bob, 14, 80);
    ctx.globalAlpha = .9;
    ctx.fillStyle = '#f0d9a4';
    ctx.save(); ctx.translate(x, y - 84 + bob); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.restore();
  }

  drawArena(ctx, g) {
    if (!g.arenaLock) return;
    const a = g.arenaLock;
    const pulse = .18 + Math.sin(g.time * 3) * .06;
    ctx.save();
    ctx.strokeStyle = `rgba(200,70,70,${.3 + pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -g.time * 18;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(120,30,40,.4)'; ctx.lineWidth = 14;
    ctx.globalAlpha = .35;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  drawZones(ctx, g) {
    for (const z of g.zones) {
      const prog = clamp(z.t / z.warn, 0, 1);
      const a = z.t < z.warn ? .10 + prog * .22 + Math.sin(g.time * 12) * .03 : .35;
      ctx.save();
      ctx.fillStyle = hexA(z.color, a);
      ctx.strokeStyle = hexA(z.color, .75);
      ctx.lineWidth = 1.5;
      if (z.type === 'line') {
        ctx.translate(z.x, z.y);
        ctx.rotate(z.angle);
        ctx.fillRect(0, -z.width / 2, z.length, z.width);
        ctx.strokeRect(0, -z.width / 2, z.length, z.width);
      } else {
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * (.65 + prog * .35), z.r * .55 * (.65 + prog * .35), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = .5;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r * prog, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawProjectiles(ctx, g) {
    const orbs = getOrbs();
    for (const p of g.projectiles) {
      const frame = (g.time * 16 | 0) % 4;
      let set = orbs.arcane;
      if (p.kind === 'frost') set = orbs.frost;
      else if (p.kind === 'shadow' || p.kind === 'song') set = orbs.shadow;
      else if (p.color === '#ffe6a8') set = orbs.echo;
      const img = set[frame];
      const size = p.kind === 'song' ? 26 : 24;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
      ctx.globalAlpha = .95;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
      this.glow(ctx, p.x, p.y, 16, p.color, .18);
    }
  }

  drawEffects(ctx, g) {
    for (const e of g.effects) {
      const k = clamp(e.t / e.max, 0, 1);
      if (e.type === 'slash') {
        const img = getSlash(e.heavy, e.tint || 'teal');
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle + Math.PI / 4);
        ctx.globalAlpha = (1 - k) * .95;
        const sz = e.heavy ? 1.15 : .9;
        ctx.scale(sz, sz);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      } else if (e.type === 'ring') {
        const r = (e.radius || 60) * (.25 + k * .85);
        ctx.save();
        ctx.globalAlpha = (1 - k) * .85;
        ctx.strokeStyle = e.color || '#7fe3d2';
        ctx.lineWidth = e.thick ? 5 : 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
        if (e.frost) {
          for (let i = 0; i < 22; i++) {
            const a = i / 22 * Math.PI * 2;
            ctx.fillStyle = '#dff8ff';
            ctx.fillRect(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * .7, 2, 2);
          }
        }
        ctx.restore();
      } else if (e.type === 'zoneBurst') {
        ctx.save();
        ctx.globalAlpha = (1 - k) * .8;
        ctx.fillStyle = e.color || '#c2515d';
        if (e.line) {
          ctx.translate(e.x, e.y); ctx.rotate(e.angle);
          ctx.fillRect(0, -e.width / 2, e.length, e.width);
        } else {
          ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * (1 + k * .4), e.r * .6 * (1 + k * .4), 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } else if (e.type === 'levelup') {
        const grd = ctx.createLinearGradient(e.x, e.y - 90, e.x, e.y + 20);
        grd.addColorStop(0, 'rgba(255,230,168,0)');
        grd.addColorStop(.7, `rgba(255,230,168,${.28 * (1 - k)})`);
        grd.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(e.x - 26, e.y - 90, 52, 110);
      } else if (e.type === 'echoWave') {
        ctx.save();
        ctx.globalAlpha = (1 - k) * .6;
        ctx.strokeStyle = e.color || '#ffe6a8'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const r = (e.radius || 120) * (k + i * .18);
          ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      } else if (e.type === 'afterimage') {
        const sprite = getPlayerFrame(e.outfit, e.accessory, e.dir, 'idle', 0);
        ctx.save();
        ctx.globalAlpha = (1 - k) * .35;
        ctx.translate(e.x, e.y);
        if (e.dir === 'side' && e.flip) ctx.scale(-1, 1);
        ctx.drawImage(sprite, -22, -41);
        ctx.restore();
      } else if (e.type === 'raise') {
        ctx.save();
        ctx.globalAlpha = (1 - k) * .5;
        ctx.strokeStyle = e.color || '#9fc46a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const r = 20 + i * 16 + k * 20;
          ctx.beginPath(); ctx.ellipse(e.x, e.y, r, r * .45, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  drawParticles(ctx, g) {
    if (!g.settings.particles) return;
    ctx.save();
    for (const p of g.particles) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = k * .9;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      else ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = p.color;
      if (p.shape === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * .4, p.size * 2, p.size * .8); ctx.restore();
      } else if (p.shape === 'dot') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * .7, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  drawDamageNumbers(ctx, g) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const d of g.damageNumbers) {
      const k = d.t / d.max;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
      ctx.font = `${d.crit || d.big ? 'bold 13px' : 'bold 10px'} "Trebuchet MS", sans-serif`;
      ctx.strokeStyle = 'rgba(3,6,8,.85)'; ctx.lineWidth = 3;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawLighting(ctx, g, map, scale, cx, cy) {
    const lc = this.lightCtx;
    const W = this.lightCanvas.width, H = this.lightCanvas.height;
    const pxScale = W / this.vw;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    lc.fillStyle = `rgba(2,5,8,${map.darkness})`;
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    const lights = [];
    const add = (wx, wy, r, s = 1) => lights.push({ x: wx, y: wy, r, s });
    add(g.player.x, g.player.y - 10, 180, 1.2);
    for (const p of g.projectiles) add(p.x, p.y, 60, .7);
    for (const it of map.interactables) {
      if (it.type === 'brazier' && g.flags['brazier:' + it.id]) add(it.x, it.y - 14, 110, 1);
      else if (it.type === 'monument' && (g.flags['monument:' + it.id] || it.active)) add(it.x, it.y - 60, 160, 1.2);
      else if (it.type === 'crystal' && !g.flags['crystal:' + it.id]) add(it.x, it.y - 10, 50, .6);
      else if (it.type === 'rune' && g.flags['rune:' + it.id]) add(it.x, it.y - 8, 70, .7);
      else if (it.type === 'altar') add(it.x, it.y - 8, 90, .8);
      else if (it.type === 'depthWell' && g.flags.depthsOpen) add(it.x, it.y - 10, 90, .8);
    }
    for (const p of map.props) {
      if (p.x < cx - 700 || p.x > cx + 700 || p.y < cy - 500 || p.y > cy + 500) continue;
      if (p.img === PROPS.lamp) add(p.x, p.y - 36, 90, .8);
      if (p.img === PROPS.lampFrost) add(p.x, p.y - 36, 90, .7);
      if (p.img === PROPS.brazier) add(p.x, p.y - 16, 70, .7);
    }
    if (g.activeBoss) add(g.activeBoss.x, g.activeBoss.y - 20, 170, 1);
    for (const l of lights) {
      const sx = this.vw / 2 + (l.x - cx) * scale, sy = this.vh / 2 + (l.y - cy) * scale;
      const rr = l.r * scale * pxScale;
      const grd = lc.createRadialGradient(sx * pxScale, sy * pxScale, 0, sx * pxScale, sy * pxScale, rr);
      grd.addColorStop(0, `rgba(0,0,0,${.92 * l.s})`);
      grd.addColorStop(.55, `rgba(0,0,0,${.4 * l.s})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = grd;
      lc.beginPath(); lc.arc(sx * pxScale, sy * pxScale, rr, 0, Math.PI * 2); lc.fill();
    }
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.lightCanvas, 0, 0, this.vw, this.vh);
    // warm/cool additive glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pg = ctx.createRadialGradient(this.vw / 2, this.vh / 2, 10, this.vw / 2, this.vh / 2, this.vh * .55);
    pg.addColorStop(0, map.lightGlow || 'rgba(255,226,160,.06)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.restore();
  }

  drawMinimap(g) {
    if (!this.minimapCtx) return;
    const c = this.minimapCtx, W = this.minimap.width, H = this.minimap.height;
    const map = g.map, p = g.player;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(5,9,12,.92)';
    c.fillRect(0, 0, W, H);
    const range = 22;
    const px = p.x / TILE, py = p.y / TILE;
    const cell = W / (range * 2 + 1);
    for (let oy = -range; oy <= range; oy++) {
      for (let ox = -range; ox <= range; ox++) {
        const tx = Math.floor(px) + ox, ty = Math.floor(py) + oy;
        if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
        const i = ty * map.w + tx;
        if (!map.explored[i]) continue;
        const t = map.tiles[i];
        c.fillStyle = MINI_COLORS[t] || '#15201c';
        c.fillRect(W / 2 + ox * cell - cell / 2, H / 2 + oy * cell - cell / 2, cell + .5, cell + .5);
      }
    }
    // region features
    for (const npc of map.npcs) {
      const sx = W / 2 + (npc.x / TILE - px) * cell, sy = H / 2 + (npc.y / TILE - py) * cell;
      if (sx < 4 || sy < 4 || sx > W - 4 || sy > H - 4) continue;
      c.fillStyle = '#d8b774'; c.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
    for (const e of g.enemies) {
      if (e.dead && !e.isBoss) continue;
      const sx = W / 2 + (e.x / TILE - px) * cell, sy = H / 2 + (e.y / TILE - py) * cell;
      if (sx < 3 || sy < 3 || sx > W - 3 || sy > H - 3) continue;
      c.fillStyle = e.isBoss ? '#ff6a5a' : e.elite ? '#c8a6ff' : '#c2515d';
      c.fillRect(sx - 1, sy - 1, e.isBoss ? 5 : 2.5, e.isBoss ? 5 : 2.5);
    }
    for (const it of map.interactables) {
      if (it.type === 'chest' && !g.flags['chest:' + it.id]) {
        const sx = W / 2 + (it.x / TILE - px) * cell, sy = H / 2 + (it.y / TILE - py) * cell;
        if (sx > 2 && sy > 2 && sx < W - 2 && sy < H - 2) { c.fillStyle = '#f0d9a4'; c.fillRect(sx - 1, sy - 1, 2, 2); }
      }
    }
    // objective marker
    if (g.objectiveMarker && g.objectiveMarker.map === g.mapId) {
      const mx = W / 2 + (g.objectiveMarker.x / TILE - px) * cell;
      const my = H / 2 + (g.objectiveMarker.y / TILE - py) * cell;
      c.save();
      c.translate(clamp(mx, 8, W - 8), clamp(my, 8, H - 8));
      c.rotate(g.time * 1.2);
      c.fillStyle = '#f0d9a4';
      c.fillRect(-3, -3, 6, 6);
      c.restore();
    }
    // player arrow
    const ang = p.aimAngle;
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(ang + Math.PI / 2);
    c.fillStyle = '#7fe3d2';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
    // frame
    c.strokeStyle = 'rgba(216,183,116,.28)';
    c.strokeRect(.5, .5, W - 1, H - 1);
    // compass for off-map objective
    if (g.objectiveMarker && g.objectiveMarker.map !== g.mapId) {
      const reg = REGIONS.find(r => r.id === g.objectiveMarker.map);
      c.font = '8px "Trebuchet MS",sans-serif'; c.textAlign = 'center';
      c.fillStyle = 'rgba(240,217,164,.8)';
      c.fillText('◇ ' + (reg ? reg.name.split(' ')[0] : '?'), W / 2, H - 6);
    }
  }

  renderWorldMap(canvas) {
    const g = this.game;
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    const bg = c.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * .7);
    bg.addColorStop(0, '#16201d'); bg.addColorStop(1, '#080d10');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // faint grid / contour
    c.strokeStyle = 'rgba(216,183,116,.05)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const pos = id => {
      const r = REGIONS.find(x => x.id === id) || REGIONS[0];
      return { x: W * .08 + W * .84 * (r.mapX / 100), y: H * .12 + H * .76 * (r.mapY / 100) };
    };
    const links = [['sanctuary', 'greenfall'], ['sanctuary', 'kingdom'], ['sanctuary', 'frost'], ['sanctuary', 'depths'], ['greenfall', 'kingdom'], ['kingdom', 'frost']];
    c.strokeStyle = 'rgba(216,183,116,.18)'; c.lineWidth = 1.5; c.setLineDash([5, 6]);
    for (const [a, b] of links) {
      const p1 = pos(a), p2 = pos(b);
      c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
    }
    c.setLineDash([]);
    for (const r of REGIONS) {
      const p = pos(r.id);
      const found = g.discoveredRegions.has(r.id);
      c.save();
      c.translate(p.x, p.y);
      if (found) {
        c.fillStyle = r.color; c.globalAlpha = .18;
        c.beginPath(); c.arc(0, 0, 38, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
      c.rotate(Math.PI / 4);
      c.fillStyle = found ? r.color : '#1c2626';
      c.strokeStyle = found ? 'rgba(240,217,164,.8)' : 'rgba(120,130,120,.35)';
      c.lineWidth = found ? 2 : 1;
      c.fillRect(-7, -7, 14, 14); c.strokeRect(-7, -7, 14, 14);
      c.restore();
      c.textAlign = 'center';
      c.font = '11px "Palatino Linotype", serif';
      c.fillStyle = found ? '#f0e7d2' : '#5f6c68';
      c.fillText(found ? r.name : '???', p.x, p.y + 28);
      c.font = '7px "Trebuchet MS",sans-serif';
      c.fillStyle = found ? 'rgba(216,183,116,.7)' : 'rgba(100,110,106,.4)';
      c.fillText(found ? r.icon.toUpperCase() : 'UNDISCOVERED', p.x, p.y + 39);
      if (g.mapId === r.id) {
        c.fillStyle = '#7fe3d2';
        c.beginPath(); c.arc(p.x, p.y - 25, 3.5, 0, Math.PI * 2); c.fill();
      }
    }
    // objective marker
    if (g.objectiveMarker) {
      const reg = REGIONS.find(r => r.id === g.objectiveMarker.map);
      if (reg) {
        const p = pos(reg.id);
        c.save(); c.translate(p.x, p.y - 40); c.rotate(Math.PI / 4);
        c.fillStyle = '#f0d9a4'; c.fillRect(-4, -4, 8, 8);
        c.restore();
      }
    }
    c.textAlign = 'left';
    c.font = '9px "Trebuchet MS",sans-serif';
    c.fillStyle = 'rgba(200,190,166,.5)';
    c.fillText('AETHERIA — THE SHATTERED REALM', 20, 26);
    c.fillStyle = 'rgba(127,227,210,.6)';
    c.fillText('◆ you are here', 20, H - 18);
  }

  drawCharacter(canvas, outfit, accessory, scale = 3) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    const grd = c.createRadialGradient(canvas.width / 2, canvas.height * .7, 8, canvas.width / 2, canvas.height * .7, canvas.width * .5);
    grd.addColorStop(0, 'rgba(111,217,200,.15)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grd; c.fillRect(0, 0, canvas.width, canvas.height);
    const img = getPlayerFrame(outfit, accessory, 'down', 'idle', 0);
    const s = scale;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, canvas.width / 2 - 22 * s, canvas.height - 41 * s - 4, 44 * s, 46 * s);
  }

  /* ---------------- primitives ---------------- */
  shadow(ctx, x, y, rx, ry, alpha) {
    ctx.fillStyle = `rgba(3,7,8,${alpha})`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  glow(ctx, x, y, r, color, alpha) {
    const grd = ctx.createRadialGradient(x, y, 1, x, y, r);
    grd.addColorStop(0, hexA(color, alpha));
    grd.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  sparkle(ctx, x, y, t, color) {
    for (let i = 0; i < 2; i++) {
      const a = t * 1.4 + i * Math.PI;
      ctx.globalAlpha = .4 + Math.sin(t * 4 + i) * .3;
      ctx.fillStyle = color;
      ctx.fillRect(x + Math.cos(a) * 9, y + Math.sin(a) * 6, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  runeGlyph(ctx, x, y, color, t, lit = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = lit ? .9 : .6;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(t * .6);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, -2); ctx.lineTo(-3, -2); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  healthBar(ctx, x, y, w, pct, color) {
    ctx.fillStyle = 'rgba(4,7,9,.8)';
    ctx.fillRect(x - w / 2, y, w, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2 + .5, y + .5, Math.max(0, (w - 1) * pct), 3);
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y, w, 4);
  }
}

function hexA(hex, a) {
  if (!hex) return `rgba(200,200,200,${a})`;
  if (hex.startsWith('rgba')) return hex;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
