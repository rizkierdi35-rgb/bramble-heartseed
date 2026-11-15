// Tuning for BRAMBLE: defend the Heartseed. All numbers live here so the
// game's feel can be tuned without touching the simulation.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 250,
  maxHp: 100,
  damage: 12,
  fireRate: 2.6, // thorn shots per second
  shots: 1,
  magnet: 90,
  crit: 0.05,
  dashSpeed: 720,
  dashTime: 0.16,
  dashCooldown: 2.0,
};

export const HEART = { x: 640, y: 360, radius: 26, maxHp: 120 };

export const COLORS = {
  soilTop: '#1c2b1a',
  soilBottom: '#10160d',
  grass: '#2e4a26',
  grassLight: '#3d6134',
  gold: '#ffd166',
  cream: '#f5f0dc',
  leaf: '#7dd069',
  leafDark: '#4caf50',
  thorn: '#a8e063',
  heartCore: '#ffe9a8',
  heartGlow: '#ffb703',
  mite: '#e07a4e',
  spitter: '#b388ff',
  brute: '#a1887f',
  boss: '#6d4c41',
  gem: '#8dff6e',
  danger: '#ff5d5d',
};

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level) {
  return 8 + (level - 1) * 6;
}

/** What each wave throws at the garden. Wave 10 is the boss. */
export function waveComp(wave) {
  return {
    mites: 3 + wave * 2,
    spitters: wave >= 2 ? Math.floor(wave / 2) : 0,
    brutes: wave >= 4 ? Math.floor((wave - 2) / 2) : 0,
    boss: wave === 10,
  };
}
