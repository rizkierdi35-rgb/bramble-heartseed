// The simulation: one fixed 1/60 s step, fully deterministic from its seed.
// It owns the player, the Heartseed, the blight, the waves and the level-up
// draft. Rendering and sound only read it; they never change it.
import { VIEW, PLAYER, HEART, waveComp, xpForLevel } from './config.js';
import { mulberry32, shuffle, rand } from './random.js';
import { ENEMY, makeEnemy, edgeSpawn } from './enemies.js';
import { rollDraft, UPGRADES } from './upgrades.js';

export const EVENT_NONE = 0;
export const EVENT_LEVELUP = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;

export class World {
  constructor(seed) {
    this.seed = seed === undefined ? 1 : seed;
    this.reset();
  }

  reset() {
    this.rng = mulberry32(this.seed);
    this.time = 0;
    this.wave = 0;
    this.waveState = 'banner'; // banner | fight | breather
    this.waveTimer = 1.6;
    this.bannerText = 'BRAMBLE';
    this.bannerSub = 'Defend the Heartseed';
    this.bannerTimer = 0;
    this.score = 0;
    this.kills = 0;
    this.player = {
      x: 640, y: 540,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      level: 1, xp: 0, xpNext: xpForLevel(1),
      speed: PLAYER.speed, damage: PLAYER.damage, fireRate: PLAYER.fireRate,
      shots: PLAYER.shots, magnet: PLAYER.magnet, crit: PLAYER.crit,
      dashCooldown: PLAYER.dashCooldown, dashCd: 0, dashTime: 0,
      aimX: 640, aimY: 300, fireTimer: 0.4, invuln: 0,
      nova: 0, novaTimer: 5, facing: -Math.PI / 2,
    };
    this.heart = { x: HEART.x, y: HEART.y, hp: HEART.maxHp, maxHp: HEART.maxHp, pulse: 0 };
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.gems = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.draft = null;
    this.draftCounts = {};
    this.over = false;
    this.won = false;
    this.overReason = '';
    this.boss = null;
    this.stats = { shotsFired: 0, hits: 0, gems: 0 };
    this.tufts = [];
    for (let i = 0; i < 70; i += 1) {
      this.tufts.push({
        x: this.rng() * VIEW.width, y: this.rng() * VIEW.height,
        s: 0.6 + this.rng() * 0.9, ph: this.rng() * Math.PI * 2,
      });
    }
    this.fireflies = [];
    for (let i = 0; i < 24; i += 1) {
      this.fireflies.push({
        x: this.rng() * VIEW.width, y: this.rng() * VIEW.height,
        ph: this.rng() * Math.PI * 2, sp: 0.3 + this.rng() * 0.7,
      });
    }
  }

  startWave(n) {
    this.wave = n;
    const comp = waveComp(n);
    const queue = [];
    for (let i = 0; i < comp.mites; i += 1) queue.push('mite');
    for (let i = 0; i < comp.spitters; i += 1) queue.push('spitter');
    for (let i = 0; i < comp.brutes; i += 1) queue.push('brute');
    if (comp.boss) queue.unshift('boss');
    else shuffle(this.rng, queue);
    this.spawnQueue = queue;
    this.spawnTimer = 0.6;
    this.waveState = 'fight';
    if (n === 10) {
      this.bannerText = 'THE HOLLOW ROOT';
      this.bannerSub = 'Slay the boss to save the garden';
    } else {
      this.bannerText = `WAVE ${n}`;
      this.bannerSub = n === 1 ? 'The blight stirs…' : `${queue.length} creatures approach`;
    }
    this.bannerTimer = 2.2;
  }

  spawnNext() {
    const kind = this.spawnQueue.shift();
    const at = edgeSpawn(this.rng);
    const enemy = makeEnemy(kind, at.x, at.y, this.rng);
    this.enemies.push(enemy);
    if (kind === 'boss') this.boss = enemy;
  }

  fireThorns(angle, count) {
    const p = this.player;
    const spread = 0.16;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = angle + offset;
      this.bullets.push({
        x: p.x + Math.cos(a) * (p.radius + 6),
        y: p.y + Math.sin(a) * (p.radius + 6),
        vx: Math.cos(a) * 780,
        vy: Math.sin(a) * 780,
        life: 0.9,
        damage: p.damage,
        radius: 6,
      });
    }
    this.stats.shotsFired += count;
  }

  chooseUpgrade(index, sound) {
    if (!this.draft || index < 0 || index >= this.draft.length) return;
    const upgrade = this.draft[index];
    upgrade.apply(this.player, this);
    this.draftCounts[upgrade.id] = (this.draftCounts[upgrade.id] || 0) + 1;
    this.draft = null;
    if (sound) sound.levelup();
  }

  damagePlayer(amount, sound, fx) {
    const p = this.player;
    if (p.invuln > 0 || this.over) return;
    p.hp -= amount;
    p.invuln = 0.5;
    if (fx) {
      fx.shake(0.35);
      fx.floater(p.x, p.y - 24, `-${amount}`, '#ff5d5d');
    }
    if (sound) sound.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      this.over = true;
      this.overReason = 'The warden has fallen.';
    }
  }

  damageHeart(amount, sound, fx) {
    if (this.over) return;
    this.heart.hp -= amount;
    if (fx) {
      fx.shake(0.3);
      fx.floater(this.heart.x, this.heart.y - 40, `-${amount}`, '#ff5d5d');
    }
    if (sound) sound.hurt();
    if (this.heart.hp <= 0) {
      this.heart.hp = 0;
      this.over = true;
      this.overReason = 'The Heartseed has withered.';
    }
  }

  killEnemy(index, sound, fx) {
    const enemy = this.enemies[index];
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.score += enemy.score * this.wave;
    if (fx) {
      fx.burst(enemy.x, enemy.y, ENEMY[enemy.kind].color, enemy.kind === 'boss' ? 60 : 14, 220);
      fx.floater(enemy.x, enemy.y - enemy.radius, `+${enemy.score * this.wave}`, '#ffd166');
    }
    if (sound) sound.die();
    // Dew gems: the enemy's XP split into 1-3 gems.
    let xpLeft = enemy.xp;
    while (xpLeft > 0) {
      const value = Math.min(xpLeft, 2);
      xpLeft -= value;
      const angle = this.rng() * Math.PI * 2;
      this.gems.push({
        x: enemy.x + Math.cos(angle) * 10,
        y: enemy.y + Math.sin(angle) * 10,
        vx: Math.cos(angle) * 60,
        vy: Math.sin(angle) * 60,
        value,
        ph: this.rng() * Math.PI * 2,
      });
    }
    if (enemy.kind === 'boss') {
      this.boss = null;
      this.won = true;
      if (fx) fx.shake(1);
    }
  }

  step(dt, input, sound, fx) {
    if (this.over || this.won || this.draft) return EVENT_NONE;
    this.time += dt;
    this.heart.pulse += dt;
    if (this.bannerTimer > 0) this.bannerTimer -= dt;

    // Wave flow.
    if (this.waveState === 'banner') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.startWave(1);
        if (sound) sound.wave();
      }
    } else if (this.waveState === 'breather') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.startWave(this.wave + 1);
        if (sound) sound.wave();
      }
    } else if (this.spawnQueue.length > 0 && this.enemies.length < 26) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnNext();
        this.spawnTimer = Math.max(0.22, 0.65 - this.wave * 0.03);
      }
    }

    const p = this.player;
    const axis = input ? input.axis() : { x: 0, y: 0 };

    // Dash.
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (input && input.dashPressed() && p.dashCd <= 0 && (axis.x !== 0 || axis.y !== 0)) {
      p.dashTime = PLAYER.dashTime;
      p.dashCd = p.dashCooldown;
      p.invuln = Math.max(p.invuln, 0.28);
      if (sound) sound.dash();
      if (fx) fx.burst(p.x, p.y, '#a8e063', 8, 120);
    }

    // Movement.
    let speed = p.speed;
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      speed = PLAYER.dashSpeed;
    }
    p.x = Math.min(VIEW.width - p.radius, Math.max(p.radius, p.x + axis.x * speed * dt));
    p.y = Math.min(VIEW.height - p.radius, Math.max(p.radius, p.y + axis.y * speed * dt));

    // Aim and auto-fire.
    if (input) {
      p.aimX = input.mouse.x;
      p.aimY = input.mouse.y;
    }
    p.facing = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    p.fireTimer -= dt;
    if (p.fireTimer <= 0) {
      this.fireThorns(p.facing, p.shots);
      p.fireTimer = 1 / p.fireRate;
      if (sound) sound.shoot();
    }

    // Bloom Nova: a ring of thorns every 6 seconds.
    if (p.nova > 0) {
      p.novaTimer -= dt;
      if (p.novaTimer <= 0) {
        p.novaTimer = 6;
        const count = 8 + p.nova * 2;
        for (let i = 0; i < count; i += 1) {
          const a = (i / count) * Math.PI * 2;
          this.bullets.push({
            x: p.x + Math.cos(a) * (p.radius + 6),
            y: p.y + Math.sin(a) * (p.radius + 6),
            vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
            life: 0.7, damage: p.damage, radius: 5,
          });
        }
        if (fx) fx.ring(p.x, p.y, '#ffd166', count);
      }
    }

    // Thorn bullets.
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20;
      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
          const e = this.enemies[j];
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const rr = e.radius + b.radius;
          if (dx * dx + dy * dy < rr * rr) {
            const crit = this.rng() < p.crit;
            const dmg = Math.round(b.damage * (crit ? 2 : 1));
            e.hp -= dmg;
            e.flash = 0.09;
            e.x += (b.vx / 780) * 6;
            e.y += (b.vy / 780) * 6;
            this.stats.hits += 1;
            if (fx) {
              fx.burst(b.x, b.y, crit ? '#ffd166' : '#a8e063', 4, 140);
              if (crit) fx.floater(e.x, e.y - e.radius - 6, `${dmg}!`, '#ffd166');
            }
            if (sound) sound.hit();
            if (e.hp <= 0) this.killEnemy(j, sound, fx);
            dead = true;
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
    if (this.won) return EVENT_WIN;

    // Blight movement and attacks.
    for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
      const e = this.enemies[j];
      if (e.flash > 0) e.flash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      if (e.shotCd > 0) e.shotCd -= dt;
      const dp = Math.hypot(p.x - e.x, p.y - e.y);
      const dh = Math.hypot(this.heart.x - e.x, this.heart.y - e.y);
      // The blight prefers the Heartseed unless the warden is much closer.
      const targetPlayer = dp < dh * 0.85;
      const tx = targetPlayer ? p.x : this.heart.x;
      const ty = targetPlayer ? p.y : this.heart.y;
      const dist = Math.hypot(tx - e.x, ty - e.y);
      const def = ENEMY[e.kind];

      if (e.kind === 'boss') this.stepBoss(e, dt, sound, fx);

      let mx = 0;
      let my = 0;
      if (e.charging > 0) {
        // Charging: straight at the recorded point.
        e.charging -= dt;
        const cd = Math.hypot(e.chargeX - e.x, e.chargeY - e.y);
        if (cd > 4) {
          mx = (e.chargeX - e.x) / cd;
          my = (e.chargeY - e.y) / cd;
          e.x += mx * 420 * dt;
          e.y += my * 420 * dt;
        }
      } else if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) {
          e.charging = 0.5;
          e.chargeX = p.x;
          e.chargeY = p.y;
        }
      } else if (def.ranged && dist < def.range && dist > 120) {
        // Spitters and the boss hold range and shoot.
        mx = 0;
        my = 0;
        if (e.shotCd <= 0) {
          e.shotCd = def.shotCd * rand(this.rng, 0.85, 1.15);
          const a = Math.atan2(ty - e.y, tx - e.x);
          this.ebullets.push({
            x: e.x + Math.cos(a) * (e.radius + 4),
            y: e.y + Math.sin(a) * (e.radius + 4),
            vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
            life: 4, damage: e.damage, radius: 7,
          });
          if (sound) sound.tone(240, 0.12, 'square', 0.05, 120);
        }
      } else if (dist > 1) {
        const wob = Math.sin(this.time * 2 * e.wobble + e.phase) * 0.35;
        const a = Math.atan2(ty - e.y, tx - e.x) + wob * 0.3;
        mx = Math.cos(a);
        my = Math.sin(a);
        e.x += mx * e.speed * dt;
        e.y += my * e.speed * dt;
      }
      e.x = Math.min(VIEW.width + 60, Math.max(-60, e.x));
      e.y = Math.min(VIEW.height + 60, Math.max(-60, e.y));

      // Contact damage.
      const hitR = e.radius + (targetPlayer ? p.radius : this.heart.radius);
      if (dist < hitR + 2 && e.attackCd <= 0) {
        e.attackCd = 0.9;
        if (targetPlayer) this.damagePlayer(e.damage, sound, fx);
        else this.damageHeart(e.damage, sound, fx);
        // Bounce the attacker back a little.
        const a = Math.atan2(e.y - ty, e.x - tx);
        e.x += Math.cos(a) * 14;
        e.y += Math.sin(a) * 14;
      }
      if (this.over) return EVENT_OVER;
    }

    // Enemy spores.
    for (let i = this.ebullets.length - 1; i >= 0; i -= 1) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20;
      if (!dead) {
        const dp = Math.hypot(p.x - b.x, p.y - b.y);
        const dh = Math.hypot(this.heart.x - b.x, this.heart.y - b.y);
        if (dp < p.radius + b.radius) {
          this.damagePlayer(b.damage, sound, fx);
          dead = true;
        } else if (dh < this.heart.radius + b.radius) {
          this.damageHeart(b.damage, sound, fx);
          dead = true;
        }
      }
      if (dead) this.ebullets.splice(i, 1);
      if (this.over) return EVENT_OVER;
    }

    // Dew gems: drift, magnetise, collect.
    for (let i = this.gems.length - 1; i >= 0; i -= 1) {
      const g = this.gems[i];
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < p.magnet) {
        const pull = 520 * (1 - d / (p.magnet + 40));
        g.vx += (dx / (d || 1)) * pull * dt * 4;
        g.vy += (dy / (d || 1)) * pull * dt * 4;
      }
      g.vx *= 0.92;
      g.vy *= 0.92;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < p.radius + 12) {
        this.gems.splice(i, 1);
        this.stats.gems += 1;
        p.xp += g.value;
        if (sound) sound.gem();
        if (p.xp >= p.xpNext) {
          p.level += 1;
          p.xp -= p.xpNext;
          p.xpNext = xpForLevel(p.level);
          this.draft = rollDraft(this.rng, this.draftCounts);
          if (fx) fx.ring(p.x, p.y, '#8dff6e', 16);
          return EVENT_LEVELUP;
        }
      }
    }

    // Wave cleared?
    if (this.waveState === 'fight' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      if (this.wave >= 10) {
        this.won = true;
        return EVENT_WIN;
      }
      this.waveState = 'breather';
      this.waveTimer = 3;
      this.bannerText = `WAVE ${this.wave} CLEARED`;
      this.bannerSub = 'Catch your breath — the blight returns';
      this.bannerTimer = 2.2;
      p.hp = Math.min(p.maxHp, p.hp + 10);
    }

    return EVENT_NONE;
  }

  /** Boss behaviour: summons mites, fires radial bursts, charges the warden. */
  stepBoss(e, dt, sound, fx) {
    e.summonCd -= dt;
    if (e.summonCd <= 0 && this.enemies.length < 40) {
      e.summonCd = 7;
      for (let k = 0; k < 3; k += 1) {
        const a = this.rng() * Math.PI * 2;
        this.enemies.push(makeEnemy('mite', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, this.rng));
      }
      if (fx) fx.burst(e.x, e.y, '#b388ff', 20, 180);
    }
    e.burstCd -= dt;
    if (e.burstCd <= 0 && e.charging <= 0 && e.telegraph <= 0) {
      e.burstCd = 5.5;
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2 + this.rng() * 0.3;
        this.ebullets.push({
          x: e.x + Math.cos(a) * (e.radius + 4),
          y: e.y + Math.sin(a) * (e.radius + 4),
          vx: Math.cos(a) * 170, vy: Math.sin(a) * 170,
          life: 5, damage: 10, radius: 7,
        });
      }
      if (sound) sound.boss();
    }
    e.chargeCd -= dt;
    if (e.chargeCd <= 0 && e.charging <= 0 && e.telegraph <= 0) {
      e.chargeCd = 9;
      e.telegraph = 0.6;
      if (fx) fx.floater(e.x, e.y - e.radius - 10, '!', '#ff5d5d');
    }
  }
}
