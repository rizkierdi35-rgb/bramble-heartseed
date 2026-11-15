// The blight: everything that crawls out of the dark to eat the Heartseed.
// Each kind has one job: mites swarm, spitters shoot from range, brutes soak
// hits, and the Hollow Root (wave 10) does all three at once.
import { rand, randInt } from './random.js';
import { VIEW } from './config.js';

export const ENEMY = {
  mite: {
    radius: 12, hp: 14, speed: 108, damage: 5, score: 10, xp: 1,
    color: '#e07a4e', dark: '#8a3b1e', eye: '#ffe9a8',
  },
  spitter: {
    radius: 15, hp: 26, speed: 62, damage: 6, score: 25, xp: 2,
    color: '#b388ff', dark: '#5e35b1', eye: '#e1bee7',
    ranged: true, range: 330, shotCd: 2.4,
  },
  brute: {
    radius: 24, hp: 72, speed: 46, damage: 14, score: 40, xp: 3,
    color: '#a1887f', dark: '#5d4037', eye: '#ff8a65',
  },
  boss: {
    radius: 44, hp: 950, speed: 44, damage: 22, score: 500, xp: 0,
    color: '#6d4c41', dark: '#3e2723', eye: '#ff5252',
    ranged: true, range: 420, shotCd: 3.2,
  },
};

export function makeEnemy(kind, x, y, rng) {
  const def = ENEMY[kind];
  return {
    kind,
    x, y,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed * rand(rng, 0.9, 1.1),
    damage: def.damage,
    score: def.score,
    xp: def.xp,
    attackCd: 0,
    shotCd: rand(rng, 0.8, def.shotCd || 2),
    flash: 0,
    phase: rng() * Math.PI * 2,
    wobble: rand(rng, 0.6, 1.4),
    // Boss-only timers.
    summonCd: 6,
    burstCd: 5,
    chargeCd: 8,
    charging: 0,
    chargeX: 0,
    chargeY: 0,
    telegraph: 0,
  };
}

/** A point just outside the field edge, on a random side. */
export function edgeSpawn(rng) {
  const side = randInt(rng, 0, 3);
  const m = 30;
  if (side === 0) return { x: rand(rng, 0, VIEW.width), y: -m };
  if (side === 1) return { x: VIEW.width + m, y: rand(rng, 0, VIEW.height) };
  if (side === 2) return { x: rand(rng, 0, VIEW.width), y: VIEW.height + m };
  return { x: -m, y: rand(rng, 0, VIEW.height) };
}
