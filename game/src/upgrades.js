// Level-up draft: when the warden gathers enough dew, the garden offers
// three boons. Each boon has a cap; the draft only offers boons below it.
export const UPGRADES = [
  {
    id: 'damage', name: 'Thornbite', icon: '🌿', max: 5,
    desc: '+25% thorn damage',
    apply(p) { p.damage *= 1.25; },
  },
  {
    id: 'rate', name: 'Quickroot', icon: '⚡', max: 5,
    desc: '+20% fire rate',
    apply(p) { p.fireRate *= 1.2; },
  },
  {
    id: 'multi', name: 'Splitseed', icon: '✦', max: 3,
    desc: '+1 thorn per shot',
    apply(p) { p.shots += 1; },
  },
  {
    id: 'speed', name: 'Swiftpetal', icon: '🍃', max: 4,
    desc: '+12% move speed',
    apply(p) { p.speed *= 1.12; },
  },
  {
    id: 'vitality', name: 'Deep Roots', icon: '🌱', max: 4,
    desc: '+20 max HP and heal 25',
    apply(p) { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet', name: 'Dewlure', icon: '💧', max: 3,
    desc: '+70% dew pickup radius',
    apply(p) { p.magnet *= 1.7; },
  },
  {
    id: 'crit', name: 'Keen Thorn', icon: '🎯', max: 4,
    desc: '+10% critical chance (x2 damage)',
    apply(p) { p.crit += 0.1; },
  },
  {
    id: 'nova', name: 'Bloom Nova', icon: '🌸', max: 3,
    desc: 'A ring of thorns bursts out every 6s',
    apply(p) { p.nova = (p.nova || 0) + 1; },
  },
  {
    id: 'mend', name: 'Heartmend', icon: '💛', max: 3,
    desc: 'Restore 30 Heartseed HP',
    apply(p, world) { world.heart.hp = Math.min(world.heart.maxHp, world.heart.hp + 30); },
  },
  {
    id: 'dash', name: 'Windstep', icon: '💨', max: 3,
    desc: 'Dash recharges 30% faster',
    apply(p) { p.dashCooldown *= 0.7; },
  },
];

/** Three distinct boons the player has not maxed out yet. */
export function rollDraft(rng, counts) {
  const available = UPGRADES.filter((u) => (counts[u.id] || 0) < u.max);
  const draft = [];
  while (draft.length < 3 && available.length > 0) {
    const index = Math.floor(rng() * available.length);
    draft.push(available.splice(index, 1)[0]);
  }
  return draft;
}
