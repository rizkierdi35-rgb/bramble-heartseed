// Deterministic screenshot scenes: each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by an autopilot,
// so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { STEP, VIEW } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const BOSS_SECONDS = 14;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** A fake input the autopilot drives instead of a keyboard and mouse. */
class PilotInput {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.mouse = { x: 640, y: 300 };
    this.wantDash = false;
  }

  axis() {
    return this.move;
  }

  dashPressed() {
    const d = this.wantDash;
    this.wantDash = false;
    return d;
  }
}

function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return { enemy: best, dist: bestD };
}

function nearestGem(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const g of world.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return { gem: best, dist: bestD };
}

/**
 * Steer the pilot: kite away from anything too close, chase dew, otherwise
 * close to firing range of the nearest blight. `style` 'bold' plays to win;
 * 'reckless' stands still and is overrun.
 */
function autopilot(world, pilot, style) {
  const p = world.player;
  if (style === 'reckless') {
    pilot.move = { x: 0, y: 0 };
    const near = nearestEnemy(world);
    if (near.enemy) {
      pilot.mouse = { x: near.enemy.x, y: near.enemy.y };
    }
    return;
  }
  const near = nearestEnemy(world);
  const gem = nearestGem(world);
  let tx = p.x;
  let ty = p.y;
  if (near.enemy && near.dist < 95) {
    // Kite away, and dash if it is right on top of us.
    const a = Math.atan2(p.y - near.enemy.y, p.x - near.enemy.x);
    tx = p.x + Math.cos(a) * 200;
    ty = p.y + Math.sin(a) * 200;
    if (near.dist < 60 && p.dashCd <= 0) pilot.wantDash = true;
  } else if (gem.gem && gem.dist < 320) {
    tx = gem.gem.x;
    ty = gem.gem.y;
  } else if (near.enemy) {
    // Close to a firing distance of about 240.
    const a = Math.atan2(near.enemy.y - p.y, near.enemy.x - p.x);
    const want = Math.max(0, near.dist - 240);
    tx = p.x + Math.cos(a) * Math.min(want, 120);
    ty = p.y + Math.sin(a) * Math.min(want, 120);
  }
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy);
  pilot.move = len > 6 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
  if (near.enemy) {
    pilot.mouse = { x: near.enemy.x, y: near.enemy.y };
  } else {
    pilot.mouse = { x: 640, y: 300 };
  }
}

/** Run the world forward with the autopilot for `seconds` (or until it ends). */
function simulate(world, pilot, seconds, style, sound, fx) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    autopilot(world, pilot, style);
    const events = world.step(STEP, pilot, sound, fx);
    if (world.draft) {
      // The pilot takes the first boon on offer and keeps playing.
      world.chooseUpgrade(0, sound);
    }
    if (world.over || world.won) break;
  }
}

const SILENT = {
  shoot() {}, hit() {}, die() {}, gem() {}, hurt() {}, dash() {},
  levelup() {}, wave() {}, boss() {}, win() {}, lose() {}, tone() {},
  music() {}, ensure() {},
};

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: start (title over a live garden), play (mid-fight), boss (the
 * wave-10 fight), end (a real game over).
 */
export function stageShot(name, world, fx) {
  const pilot = new PilotInput();
  world.reset();
  if (name === 'play') {
    simulate(world, pilot, PLAY_SECONDS, 'bold', SILENT, fx);
    return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
  }
  if (name === 'boss') {
    world.startWave(10);
    // The boss leads the queue; bring it in at once for the shot.
    world.spawnNext();
    world.spawnTimer = 0.4;
    simulate(world, pilot, BOSS_SECONDS, 'bold', SILENT, fx);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    simulate(world, pilot, END_LIMIT_SECONDS, 'reckless', SILENT, fx);
    if (!world.over) {
      // The garden should have fallen; force the ending honestly.
      world.player.hp = 0;
      world.over = true;
      world.overReason = 'The warden has fallen.';
    }
    return { screen: SCREEN_OVER, best: world.score };
  }
  // start (and anything else): a short live demo behind the title.
  simulate(world, pilot, START_SECONDS, 'bold', SILENT, fx);
  return { screen: SCREEN_TITLE, best: 0 };
}
