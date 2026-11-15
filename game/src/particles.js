// Juice: hit sparks, death bursts, floating damage numbers and screen shake.
// All of it is visual only; the simulation never reads it.
export class Effects {
  constructor() {
    this.particles = [];
    this.floaters = [];
    this.trauma = 0;
    this.time = 0;
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.4 + Math.random() * 0.35,
        maxLife: 0.75,
        size: 2 + Math.random() * 3.5,
        color,
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  ring(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 260,
        vy: Math.sin(angle) * 260,
        life: 0.5,
        maxLife: 0.5,
        size: 3,
        color,
      });
    }
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color: color || '#f5f0dc', life: 0.9, maxLife: 0.9 });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  /** Current shake offset, deterministic in time so screenshots are stable. */
  offset() {
    const mag = this.trauma * this.trauma * 12;
    return {
      x: Math.sin(this.time * 91.7) * mag,
      y: Math.cos(this.time * 113.3) * mag,
    };
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
