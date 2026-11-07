/* ============================================================
   ECHOES OF THE FALLEN — boot, main loop and input
   ============================================================ */
import { Game } from './game.js';
import { audio } from './audio.js';

const canvas = document.getElementById('game');
const app = document.getElementById('app');
const loading = document.getElementById('loading');
const loadFill = document.getElementById('loadFill');
const loadText = document.getElementById('loadText');
const rotateHint = document.getElementById('rotateHint');

let game = null;
let last = 0;
let started = false;
let lastGameState = null;

const wait = ms => new Promise(r => setTimeout(r, ms));
const frameWait = () => new Promise(r => requestAnimationFrame(() => r()));

function setLoad(pct, text) {
  if (loadFill) loadFill.style.width = Math.round(pct) + '%';
  if (loadText) loadText.textContent = text;
}

function updateLoadingLabel() {
  if (!game) return;
  if (loadText) loadText.textContent = 'The echo answers.';
}

async function boot() {
  setLoad(6, 'Opening the archive…');
  await frameWait();
  setLoad(18, 'Kindling the hearth…');
  await wait(80);
  setLoad(34, 'Raising the five regions…');
  await frameWait();

  try {
    game = new Game(canvas);
  } catch (err) {
    console.error('ECHOES boot failed', err);
    if (loadText) loadText.textContent = 'The echo could not be reached — see console.';
    if (loadFill) loadFill.style.background = '#b13d45';
    return;
  }

  // Exposed for debugging and for the project's browser capture workflow.
  window.game = game;
  window.__ECHO__ = game;

  setLoad(58, 'Waking the old roads…');
  await wait(120);
  setLoad(76, 'Teaching the guardians to remember…');
  await frameWait();
  setLoad(92, 'Tuning the echo…');
  await wait(160);
  setLoad(100, 'The echo answers.');
  await wait(240);

  if (loading) loading.classList.add('gone');
  updateTitleMenu();
  checkOrientation();

  bindInput();
  started = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

function updateTitleMenu() {
  if (!game) return;
  game.ui.updateTitle();
}

function loop(now) {
  if (!started) return;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try {
    game.update(dt);
    game.renderer.render(dt);
  } catch (err) {
    console.error('ECHOES frame error', err);
    started = false;
    if (loadText) {
      if (loading) loading.classList.remove('gone');
      loadText.textContent = 'A seam opened in the world — see console.';
    }
    return;
  }
  requestAnimationFrame(loop);
}

/* ---------------- input ---------------- */
function blockKeys(e) {
  const k = e.key.toLowerCase();
  return [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k);
}

function bindInput() {
  if (!game) return;

  window.addEventListener('keydown', e => {
    if (!game) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') { game.ui.closeAll(); e.preventDefault(); }
      return;
    }
    // Title panels are outside the in-game key router.
    if (game.state === 'title' && game.ui.panelOpen) {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        game.ui.closeAll();
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') { e.preventDefault(); return; }
    }
    if (blockKeys(e) && game.state !== 'title') e.preventDefault();
    game.onKeyDown(e);
  }, { passive: false });

  window.addEventListener('keyup', e => {
    if (game) game.onKeyUp(e);
  });

  canvas.addEventListener('mousemove', e => {
    if (game) game.onMouseMove(e.clientX, e.clientY);
  });

  canvas.addEventListener('mousedown', e => {
    if (!game) return;
    if (e.button === 0 || e.button === 2) {
      e.preventDefault();
      if (game.state === 'playing') game.onMouseDown(e.button);
    }
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  app.addEventListener('contextmenu', e => e.preventDefault());

  let resizeTimer = null;
  const onResize = () => {
    if (!game) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      game.resize();
      checkOrientation();
    }, 60);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 220));

  window.addEventListener('blur', () => {
    if (!game) return;
    game.keys.clear();
    game.input.joyActive = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (!game) return;
    if (document.hidden) {
      game.keys.clear();
      game.input.joyActive = false;
      game.save(true);
    } else {
      last = performance.now();
    }
  });

  // Browsers require a gesture before audio may begin.
  const wake = () => {
    audio.init();
    if (game) game.audio.setVolumes(game.settings.music, game.settings.sfx, game.settings.muted);
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
}

function checkOrientation() {
  if (!rotateHint || !game) return;
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
  const show = portrait && game.state === 'playing' && game.ui && game.ui.touchEnabled;
  rotateHint.classList.toggle('hidden', !show);
}

window.addEventListener('error', e => {
  console.error('ECHOES runtime error', e.error || e.message);
});

boot();
