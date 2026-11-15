// Deterministic randomness: every roll in the simulation comes from a seeded
// generator, so the same seed always replays the same game (and the same
// screenshot). Visual-only effects use the same stream too.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function rand(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max]. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of `items`, uniformly. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** Fisher-Yates shuffle, in place, using the seeded generator. */
export function shuffle(rng, items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}
