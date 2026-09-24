// Visual effects: slash arcs, hit sparks, particles, screen shake, hitstop.
// Pure canvas drawing helpers with no dependency on game logic.

class FX {
	constructor() {
		this.particles = [];
		this.slashes = [];
		this.texts = [];
		this.shake = 0;
		this.hitstop = 0; // seconds of frozen simulation, still rendered
		this.flash = 0; // white screen flash amount 0..1
	}

	update(dt) {
		this.shake = Math.max(0, this.shake - dt * 6);
		this.flash = Math.max(0, this.flash - dt * 3.2);
		if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dt);

		for (const p of this.particles) {
			p.life -= dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += (p.gravity || 0) * dt;
			p.vx *= (p.drag || 1);
		}
		this.particles = this.particles.filter(p => p.life > 0);

		for (const s of this.slashes) s.life -= dt;
		this.slashes = this.slashes.filter(s => s.life > 0);

		for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; }
		this.texts = this.texts.filter(t => t.life > 0);
	}

	shakeScreen(amount) { this.shake = Math.min(24, this.shake + amount); }
	freeze(seconds) { this.hitstop = Math.max(this.hitstop, seconds); }
	whiteFlash(amount) { this.flash = Math.min(1, this.flash + amount); }

	spawnSpark(x, y, color, count = 10, speed = 420) {
		for (let i = 0; i < count; i++) {
			const a = Math.random() * Math.PI * 2;
			const sp = speed * (0.4 + Math.random() * 0.8);
			this.particles.push({
				x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
				life: 0.18 + Math.random() * 0.16, maxLife: 0.3,
				color, size: 2 + Math.random() * 2.4, drag: 0.9, type: 'spark'
			});
		}
	}

	spawnDust(x, y, dir, color = '#cfd6ff') {
		for (let i = 0; i < 8; i++) {
			this.particles.push({
				x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
				vx: -dir * (120 + Math.random() * 160), vy: (Math.random() - 0.6) * 90,
				life: 0.25 + Math.random() * 0.2, color, size: 2 + Math.random() * 3,
				gravity: 200, drag: 0.92, type: 'dust'
			});
		}
	}

	spawnBlockSpark(x, y, dir) {
		for (let i = 0; i < 6; i++) {
			this.particles.push({
				x, y, vx: -dir * (200 + Math.random() * 200) , vy: (Math.random() - 0.5) * 200,
				life: 0.15 + Math.random() * 0.1, color: '#9adcff', size: 2, drag: 0.85, type: 'spark'
			});
		}
	}

	spawnSlash(x, y, facing, kind, color) {
		// kind: 'light' | 'heavy'
		this.slashes.push({
			x, y, facing, kind, color,
			t: 0, life: kind === 'heavy' ? 0.26 : 0.16, maxLife: kind === 'heavy' ? 0.26 : 0.16
		});
	}

	spawnText(x, y, str, color, big = false) {
		this.texts.push({ x, y, str, color, big, vy: -40, life: 0.7, maxLife: 0.7 });
	}

	draw(ctx) {
		// particles
		for (const p of this.particles) {
			const a = Math.max(0, p.life / (p.maxLife || 0.3));
			ctx.globalAlpha = a;
			ctx.fillStyle = p.color;
			if (p.type === 'dust') {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
			}
		}
		ctx.globalAlpha = 1;

		// slash arcs
		for (const s of this.slashes) {
			const t = 1 - Math.max(0, s.life) / s.maxLife; // 0..1 progress
			const alpha = Math.max(0, 1 - t) * 0.95;
			const radius = s.kind === 'heavy' ? 92 : 68;
			const spread = s.kind === 'heavy' ? 1.9 : 1.3;
			const startAngle = -spread / 2 + (s.facing > 0 ? 0 : Math.PI);
			ctx.save();
			ctx.translate(s.x, s.y);
			ctx.scale(s.facing, 1);
			ctx.globalAlpha = alpha;
			ctx.strokeStyle = s.color;
			ctx.lineWidth = (s.kind === 'heavy' ? 9 : 5) * (1 - t * 0.4);
			ctx.lineCap = 'round';
			ctx.shadowColor = s.color;
			ctx.shadowBlur = s.kind === 'heavy' ? 26 : 14;
			ctx.beginPath();
			const sweep = t * spread;
			ctx.arc(0, 0, radius, -spread / 2, -spread / 2 + sweep);
			ctx.stroke();
			ctx.restore();
		}
		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;

		// floating texts
		for (const t of this.texts) {
			const a = Math.max(0, t.life / t.maxLife);
			ctx.globalAlpha = a;
			ctx.fillStyle = t.color;
			ctx.font = (t.big ? '900 34px' : '700 20px') + ' Segoe UI, sans-serif';
			ctx.textAlign = 'center';
			ctx.shadowColor = t.color;
			ctx.shadowBlur = 12;
			ctx.fillText(t.str, t.x, t.y);
		}
		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
	}

	drawScreenFX(ctx, w, h) {
		if (this.flash > 0) {
			ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.55})`;
			ctx.fillRect(0, 0, w, h);
		}
	}

	getShakeOffset() {
		if (this.shake <= 0) return { x: 0, y: 0 };
		return {
			x: (Math.random() - 0.5) * this.shake,
			y: (Math.random() - 0.5) * this.shake
		};
	}
}
