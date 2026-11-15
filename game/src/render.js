// Everything the player sees: the garden, the Heartseed, the blight, the
// warden, the HUD and every screen. Drawing only reads the world.
import { VIEW, COLORS } from './config.js';
import { ENEMY } from './enemies.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The three level-up cards, in logical coordinates (shared with main.js). */
export function levelupLayout() {
  const w = 300;
  const h = 190;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW.width - total) / 2;
  const y = 250;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

function drawBackground(ctx, world) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, COLORS.soilTop);
  grad.addColorStop(1, COLORS.soilBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Soft radial light around the Heartseed.
  const glow = ctx.createRadialGradient(640, 360, 20, 640, 360, 420);
  glow.addColorStop(0, 'rgba(255,183,3,0.14)');
  glow.addColorStop(1, 'rgba(255,183,3,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Grass tufts.
  for (const t of world.tufts) {
    const sway = Math.sin(world.time * 0.8 + t.ph) * 2;
    ctx.strokeStyle = 'rgba(125,208,105,0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + sway, t.y - 9 * t.s);
    ctx.moveTo(t.x + 4, t.y);
    ctx.lineTo(t.x + 4 + sway, t.y - 7 * t.s);
    ctx.moveTo(t.x - 4, t.y);
    ctx.lineTo(t.x - 4 + sway, t.y - 6 * t.s);
    ctx.stroke();
  }
  // Fireflies.
  for (const f of world.fireflies) {
    const x = f.x + Math.sin(world.time * f.sp + f.ph) * 14;
    const y = f.y + Math.cos(world.time * f.sp * 0.8 + f.ph) * 10;
    const a = 0.25 + 0.25 * Math.sin(world.time * 2 + f.ph);
    ctx.globalAlpha = Math.max(0.05, a);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Arena edge.
  ctx.strokeStyle = 'rgba(125,208,105,0.25)';
  ctx.lineWidth = 2;
  roundRect(ctx, 6, 6, VIEW.width - 12, VIEW.height - 12, 18);
  ctx.stroke();
}

function drawHeart(ctx, world) {
  const h = world.heart;
  const pulse = 1 + Math.sin(h.pulse * 2.4) * 0.08;
  const glow = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, 90);
  glow.addColorStop(0, 'rgba(255,183,3,0.5)');
  glow.addColorStop(1, 'rgba(255,183,3,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 90, 0, Math.PI * 2);
  ctx.fill();
  // Petals.
  ctx.fillStyle = '#ffb703';
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + h.pulse * 0.3;
    const px = h.x + Math.cos(a) * 26 * pulse;
    const py = h.y + Math.sin(a) * 26 * pulse;
    ctx.beginPath();
    ctx.ellipse(px, py, 9, 5, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Core.
  ctx.fillStyle = COLORS.heartCore;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 16 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a4a00';
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('♥', h.x, h.y + 5);
  // Heart HP ring.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = h.hp / h.maxHp > 0.35 ? '#ffd166' : '#ff5d5d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 34, -Math.PI / 2, -Math.PI / 2 + (h.hp / h.maxHp) * Math.PI * 2);
  ctx.stroke();
}

function drawEnemy(ctx, e) {
  const def = ENEMY[e.kind];
  const wob = Math.sin(e.phase + e.flash * 10) * 0.06;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === 'boss' && e.telegraph > 0) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.telegraph * 30);
    ctx.strokeStyle = '#ff5252';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, e.radius * 0.75, e.radius * 0.9, e.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
  ctx.beginPath();
  if (e.kind === 'mite') {
    // Spiky mite: a circle with thorn spikes.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + wob;
      ctx.moveTo(Math.cos(a) * e.radius * 0.6, Math.sin(a) * e.radius * 0.6);
      ctx.lineTo(Math.cos(a) * (e.radius + 6), Math.sin(a) * (e.radius + 6));
      ctx.lineTo(Math.cos(a + 0.35) * e.radius * 0.6, Math.sin(a + 0.35) * e.radius * 0.6);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'spitter') {
    // A bloated sac with a mouth.
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.dark;
    ctx.beginPath();
    ctx.arc(0, 4, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Brute and boss: a barky blob with cracks.
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-e.radius * 0.5, -e.radius * 0.3);
    ctx.lineTo(0, 0);
    ctx.lineTo(e.radius * 0.4, -e.radius * 0.5);
    ctx.moveTo(-e.radius * 0.2, e.radius * 0.5);
    ctx.lineTo(e.radius * 0.3, e.radius * 0.2);
    ctx.stroke();
  }
  // Eyes.
  ctx.fillStyle = def.eye;
  const eyeY = -e.radius * 0.25;
  ctx.beginPath();
  ctx.arc(-e.radius * 0.35, eyeY, 3.2, 0, Math.PI * 2);
  ctx.arc(e.radius * 0.35, eyeY, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(-e.radius * 0.35, eyeY, 1.5, 0, Math.PI * 2);
  ctx.arc(e.radius * 0.35, eyeY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // HP bar for tough foes.
  if (e.maxHp > 30 && e.hp < e.maxHp) {
    bar(ctx, -e.radius, -e.radius - 12, e.radius * 2, 5, e.hp / e.maxHp, '#ff5d5d');
  }
  ctx.restore();
}

function drawPlayer(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && p.dashTime <= 0 && Math.floor(world.time * 16) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius * 0.8, p.radius * 0.9, p.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dash trail.
  if (p.dashTime > 0) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = COLORS.leaf;
    ctx.beginPath();
    ctx.arc(-Math.cos(p.facing) * 22, -Math.sin(p.facing) * 22, p.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Cloak body.
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  // Hood point.
  ctx.fillStyle = '#1b5e20';
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 6);
  ctx.lineTo(-8, -p.radius + 4);
  ctx.lineTo(8, -p.radius + 4);
  ctx.closePath();
  ctx.fill();
  // Sprout leaf on top.
  ctx.strokeStyle = COLORS.leaf;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 4);
  ctx.quadraticCurveTo(8, -p.radius - 16, 16, -p.radius - 12);
  ctx.stroke();
  // Face: two bright eyes toward the aim.
  const ex = Math.cos(p.facing) * 4;
  const ey = Math.sin(p.facing) * 4;
  ctx.fillStyle = '#e8f5e9';
  ctx.beginPath();
  ctx.arc(-5 + ex, -2 + ey, 3, 0, Math.PI * 2);
  ctx.arc(5 + ex, -2 + ey, 3, 0, Math.PI * 2);
  ctx.fill();
  // Thorn wand toward the aim.
  ctx.strokeStyle = '#a8e063';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.facing) * p.radius * 0.5, Math.sin(p.facing) * p.radius * 0.5);
  ctx.lineTo(Math.cos(p.facing) * (p.radius + 12), Math.sin(p.facing) * (p.radius + 12));
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, world) {
  const p = world.player;
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px Trebuchet MS, sans-serif';
  // Player HP.
  ctx.fillStyle = COLORS.cream;
  ctx.fillText('WARDEN', 20, 28);
  bar(ctx, 20, 36, 220, 14, p.hp / p.maxHp, '#7dd069');
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 11px Trebuchet MS, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 28, 47);
  // Heartseed HP.
  ctx.font = 'bold 15px Trebuchet MS, sans-serif';
  ctx.fillStyle = COLORS.cream;
  ctx.fillText('HEARTSEED', 20, 72);
  bar(ctx, 20, 80, 220, 14, world.heart.hp / world.heart.maxHp, '#ffd166');
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 11px Trebuchet MS, sans-serif';
  ctx.fillText(`${Math.ceil(world.heart.hp)} / ${world.heart.maxHp}`, 28, 91);
  // Wave and score, top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px Trebuchet MS, sans-serif';
  ctx.fillStyle = COLORS.cream;
  ctx.fillText(`WAVE ${Math.max(1, world.wave)} / 10`, VIEW.width - 20, 32);
  ctx.font = 'bold 17px Trebuchet MS, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`SCORE ${world.score}`, VIEW.width - 20, 58);
  ctx.fillStyle = COLORS.cream;
  ctx.font = '15px Trebuchet MS, sans-serif';
  ctx.fillText(`${world.kills} blight slain`, VIEW.width - 20, 80);
  // Boss bar.
  if (world.boss) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#ff8a80';
    ctx.fillText('THE HOLLOW ROOT', VIEW.width / 2, 30);
    bar(ctx, VIEW.width / 2 - 220, 38, 440, 12, world.boss.hp / world.boss.maxHp, '#ff5252');
  }
  // XP bar along the bottom.
  ctx.textAlign = 'left';
  bar(ctx, 20, VIEW.height - 30, VIEW.width - 40, 10, p.xp / p.xpNext, '#8dff6e');
  ctx.fillStyle = COLORS.cream;
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.fillText(`LEVEL ${p.level}`, 20, VIEW.height - 38);
  // Dash cooldown pip.
  if (p.dashCd > 0) {
    ctx.fillStyle = 'rgba(245,240,220,0.6)';
    ctx.font = '13px Trebuchet MS, sans-serif';
    ctx.fillText(`Dash ${(p.dashCd).toFixed(1)}s`, 20, VIEW.height - 60);
  } else {
    ctx.fillStyle = COLORS.leaf;
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.fillText('Dash ready — SPACE', 20, VIEW.height - 60);
  }
}

function drawBanner(ctx, world) {
  if (world.bannerTimer <= 0) return;
  const a = Math.min(1, world.bannerTimer / 0.6, (2.2 - world.bannerTimer) / 0.4 + 0.4);
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.cream;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText(world.bannerText, VIEW.width / 2, 200);
  ctx.font = '20px Trebuchet MS, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(world.bannerSub, VIEW.width / 2, 234);
  ctx.globalAlpha = 1;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,8,0.82)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,208,105,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(ctx, world, best) {
  ctx.fillStyle = 'rgba(8,12,6,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.leaf;
  ctx.font = 'bold 92px Georgia, serif';
  ctx.fillText('BRAMBLE', VIEW.width / 2, 250);
  ctx.fillStyle = COLORS.gold;
  ctx.font = '26px Georgia, serif';
  ctx.fillText('Defend the Heartseed', VIEW.width / 2, 292);
  ctx.fillStyle = COLORS.cream;
  ctx.font = '19px Trebuchet MS, sans-serif';
  ctx.fillText('The blight comes in 10 waves. Guard the seed at the garden’s heart —', VIEW.width / 2, 350);
  ctx.fillText('and slay the Hollow Root to win. Fall, or let the seed wither, and the garden is lost.', VIEW.width / 2, 378);
  ctx.font = '17px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#b9d9a8';
  ctx.fillText('WASD / Arrows — move    •    Mouse — aim (thorns fire on their own)', VIEW.width / 2, 430);
  ctx.fillText('SPACE — dash    •    Gather dew to level up and choose boons    •    P — pause', VIEW.width / 2, 458);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 24px Trebuchet MS, sans-serif';
  ctx.fillText('— Click or press ENTER to play —', VIEW.width / 2, 520);
  if (best > 0) {
    ctx.fillStyle = COLORS.cream;
    ctx.font = '17px Trebuchet MS, sans-serif';
    ctx.fillText(`Best score: ${best}`, VIEW.width / 2, 556);
  }
}

function drawLevelup(ctx, world) {
  ctx.fillStyle = 'rgba(8,12,6,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(`LEVEL ${world.player.level}`, VIEW.width / 2, 180);
  ctx.fillStyle = COLORS.cream;
  ctx.font = '20px Trebuchet MS, sans-serif';
  ctx.fillText('The garden offers a boon — choose one (click or press 1 / 2 / 3)', VIEW.width / 2, 214);
  const cards = levelupLayout();
  world.draft.forEach((u, i) => {
    const c = cards[i];
    panel(ctx, c.x, c.y, c.w, c.h);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, c.x + c.w / 2, c.y + 30);
    ctx.font = '34px serif';
    ctx.fillText(u.icon, c.x + c.w / 2, c.y + 74);
    ctx.fillStyle = COLORS.cream;
    ctx.font = 'bold 20px Trebuchet MS, sans-serif';
    ctx.fillText(u.name, c.x + c.w / 2, c.y + 112);
    ctx.fillStyle = '#cfe8c0';
    ctx.font = '15px Trebuchet MS, sans-serif';
    const words = u.desc.split(' ');
    let line = '';
    let ly = c.y + 140;
    for (const word of words) {
      if ((line + word).length > 22) {
        ctx.fillText(line.trim(), c.x + c.w / 2, ly);
        line = '';
        ly += 20;
      }
      line += `${word} `;
    }
    if (line.trim()) ctx.fillText(line.trim(), c.x + c.w / 2, ly);
  });
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8,12,6,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.cream;
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 340);
  ctx.font = '20px Trebuchet MS, sans-serif';
  ctx.fillText('Press P or ESC to keep playing', VIEW.width / 2, 384);
}

function drawEnd(ctx, world, won) {
  ctx.fillStyle = won ? 'rgba(20,26,10,0.72)' : 'rgba(20,8,6,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? COLORS.gold : '#ff8a80';
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillText(won ? 'THE HEARTSEED BLOOMS' : 'THE GARDEN FELL', VIEW.width / 2, 250);
  ctx.fillStyle = COLORS.cream;
  ctx.font = '22px Georgia, serif';
  ctx.fillText(
    won ? 'The Hollow Root is slain. Spring returns to the garden.' : world.overReason,
    VIEW.width / 2, 296,
  );
  ctx.font = '20px Trebuchet MS, sans-serif';
  ctx.fillText(`Score ${world.score}   •   Wave ${world.wave} / 10   •   ${world.kills} blight slain   •   Level ${world.player.level}`, VIEW.width / 2, 350);
  const acc = world.stats.shotsFired > 0
    ? Math.round((world.stats.hits / world.stats.shotsFired) * 100)
    : 0;
  ctx.fillText(`Thorn accuracy ${acc}%   •   Dew gathered ${world.stats.gems}`, VIEW.width / 2, 382);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 24px Trebuchet MS, sans-serif';
  ctx.fillText('— Press R or click to play again —', VIEW.width / 2, 450);
}

/** Draw one frame. `screen` is one of the SCREEN_* constants. */
export function draw(ctx, world, screen, fx, best) {
  ctx.save();
  const off = fx ? fx.offset() : { x: 0, y: 0 };
  ctx.translate(off.x, off.y);
  drawBackground(ctx, world);
  drawHeart(ctx, world);
  // Dew gems.
  for (const g of world.gems) {
    const bob = Math.sin(world.time * 4 + g.ph) * 2;
    ctx.fillStyle = '#8dff6e';
    ctx.beginPath();
    ctx.arc(g.x, g.y + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(g.x - 2, g.y + bob - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Enemy spores.
  for (const b of world.ebullets) {
    ctx.fillStyle = '#ce93d8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3e5f5';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of world.enemies) drawEnemy(ctx, e);
  // Thorn shots.
  ctx.strokeStyle = COLORS.thorn;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  drawPlayer(ctx, world);
  if (fx) fx.draw(ctx);
  ctx.restore();

  if (screen === SCREEN_PLAY || screen === SCREEN_LEVELUP || screen === SCREEN_PAUSE) {
    drawHud(ctx, world);
    drawBanner(ctx, world);
  }
  if (screen === SCREEN_TITLE) drawTitle(ctx, world, best || 0);
  else if (screen === SCREEN_LEVELUP) drawLevelup(ctx, world);
  else if (screen === SCREEN_PAUSE) drawPause(ctx);
  else if (screen === SCREEN_OVER) drawEnd(ctx, world, false);
  else if (screen === SCREEN_WIN) drawEnd(ctx, world, true);

  // Low-HP warning vignette.
  if ((screen === SCREEN_PLAY || screen === SCREEN_LEVELUP) && world.player.hp < 30 && !world.over) {
    const pulse = 0.12 + 0.08 * Math.sin(world.time * 6);
    const vg = ctx.createRadialGradient(640, 360, 260, 640, 360, 560);
    vg.addColorStop(0, 'rgba(255,40,40,0)');
    vg.addColorStop(1, `rgba(255,40,40,${pulse})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
