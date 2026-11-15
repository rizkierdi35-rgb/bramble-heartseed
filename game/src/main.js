// Bootstrap and the frame loop. Owns the screen state machine (title, play,
// level-up, pause, game over, victory) and, in screenshot mode, stages one
// deterministic scene instead of playing.
import { VIEW, STEP } from './config.js';
import { World, EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Effects } from './particles.js';
import {
  draw, levelupLayout,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'bramble-best-score';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (error) {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch (error) {
    // Storage is a nicety, never a failure.
  }
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1) || 1;

const world = new World(seed);
const input = new Input();
const sound = new Sound();
const fx = new Effects();
let screen = SCREEN_TITLE;
let best = loadBest();
let shotMode = params.get('shot') || '';

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
  const ox = (rect.width - VIEW.width * scale) / 2;
  const oy = (rect.height - VIEW.height * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

input.attach(canvas, toLogical);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('pointerdown', () => sound.ensure(), { once: false });
window.addEventListener('keydown', () => sound.ensure(), { once: false });

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startGame() {
  world.reset();
  screen = SCREEN_PLAY;
  announce('The blight approaches. Defend the Heartseed.');
}

function restart() {
  startGame();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = STEP;

  if (!shotMode) {
    // --- Input handling per screen ---
    const click = input.takeClick();
    if (screen === SCREEN_TITLE) {
      if (click || input.wasPressed('Enter')) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        screen = SCREEN_PAUSE;
      }
    } else if (screen === SCREEN_PAUSE) {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || click) {
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_LEVELUP) {
      let choice = -1;
      if (input.wasPressed('Digit1')) choice = 0;
      else if (input.wasPressed('Digit2')) choice = 1;
      else if (input.wasPressed('Digit3')) choice = 2;
      else if (click) {
        const cards = levelupLayout();
        for (let i = 0; i < cards.length; i += 1) {
          const c = cards[i];
          if (click.x >= c.x && click.x <= c.x + c.w && click.y >= c.y && click.y <= c.y + c.h) {
            choice = i;
            break;
          }
        }
      }
      if (choice >= 0 && world.draft && choice < world.draft.length) {
        world.chooseUpgrade(choice, sound);
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (click || input.wasPressed('KeyR') || input.wasPressed('Enter')) restart();
    }

    // --- Simulation ---
    if (screen === SCREEN_PLAY) {
      const events = world.step(dt, input, sound, fx);
      if (events & EVENT_LEVELUP) {
        screen = SCREEN_LEVELUP;
        announce(`Level ${world.player.level}. Choose a boon.`);
      } else if (events & EVENT_OVER) {
        screen = SCREEN_OVER;
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
        sound.lose();
        announce(`Game over. ${world.overReason} Score ${world.score}.`);
      } else if (events & EVENT_WIN) {
        screen = SCREEN_WIN;
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
        sound.win();
        announce(`Victory! The Heartseed blooms. Score ${world.score}.`);
      }
      sound.music(dt, true);
    }
    fx.update(dt);
    input.endFrame();
  }

  // --- Draw ---
  const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  const ox = (canvas.width - VIEW.width * scale) / 2;
  const oy = (canvas.height - VIEW.height * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0f08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  draw(ctx, world, screen, fx, best);
}

// Screenshot mode: stage one deterministic scene and freeze it.
if (shotMode) {
  const staged = stageShot(shotMode, world, fx);
  screen = staged.screen;
  best = staged.best;
  fx.update(0);
}

requestAnimationFrame(frame);
