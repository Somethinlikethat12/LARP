'use strict';

/** Particles, slash trails, rings, floating text and ground decals. */
const FX_DOT = 0, FX_SPARK = 1, FX_PETAL = 2, FX_BLOOD = 3, FX_EMBER = 4, FX_DUST = 5, FX_WISP = 6;

class Effects {
    constructor() {
        this.ps = [];
        this.petals = [];
        this.slashes = [];
        this.lines = [];
        this.rings = [];
        this.texts = [];
        this.decals = [];
        this.rnd = new Rng(Date.now());
    }

    add(kind, x, y, vx, vy, life, size, c, drag) {
        const p = { kind, x, y, vx, vy, life, max: life, size, c, drag, rot: 0, vr: 0 };
        this.ps.push(p);
        return p;
    }

    sparks(x, y, dir, spread, n, speed, c) {
        const rnd = this.rnd;
        for (let i = 0; i < n; i++) {
            const a = dir + (rnd.nextDouble() - 0.5) * spread;
            const s = speed * (0.3 + rnd.nextDouble());
            this.add(FX_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.15 + rnd.nextDouble() * 0.3, 1.5 + rnd.nextDouble() * 2, c, 6);
        }
    }

    blood(x, y, dir, n, speed) {
        const rnd = this.rnd;
        for (let i = 0; i < n; i++) {
            const a = dir + (rnd.nextDouble() - 0.5) * 1.4;
            const s = speed * (0.2 + rnd.nextDouble());
            const c = rgb(120 + rnd.nextInt(60), 0, 10);
            this.add(FX_BLOOD, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + rnd.nextDouble() * 0.4, 2 + rnd.nextDouble() * 3, c, 5);
        }
    }

    dust(x, y, n) {
        const rnd = this.rnd;
        for (let i = 0; i < n; i++) {
            const a = rnd.nextDouble() * TAU, s = 20 + rnd.nextDouble() * 60;
            this.add(FX_DUST, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + rnd.nextDouble() * 0.3, 4 + rnd.nextDouble() * 6, rgb(180, 165, 130), 3);
        }
    }

    ember(x, y) {
        const rnd = this.rnd;
        this.add(FX_EMBER, x + rnd.nextGaussian() * 6, y + rnd.nextGaussian() * 6, rnd.nextGaussian() * 12, -30 - rnd.nextDouble() * 40,
            0.8 + rnd.nextDouble() * 0.8, 1.5 + rnd.nextDouble() * 1.5, rgb(255, 150 + rnd.nextInt(80), 40), 0.5);
    }

    wisp(x, y, c) {
        const rnd = this.rnd;
        this.add(FX_WISP, x + rnd.nextGaussian() * 10, y + rnd.nextGaussian() * 10, rnd.nextGaussian() * 10, -20 - rnd.nextDouble() * 20,
            0.6 + rnd.nextDouble() * 0.5, 4 + rnd.nextDouble() * 5, c, 1);
    }

    heal(x, y) {
        const rnd = this.rnd;
        for (let i = 0; i < 24; i++) {
            const a = rnd.nextDouble() * TAU;
            this.add(FX_WISP, x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * 20, -40 - rnd.nextDouble() * 40,
                0.7 + rnd.nextDouble() * 0.4, 3 + rnd.nextDouble() * 3, rgb(150, 255, 170), 1);
        }
    }

    slash(x, y, r, start, sweep, life, width, c) {
        this.slashes.push({ x, y, r, start, sweep, life, max: life, width, c });
    }

    line(x1, y1, x2, y2, life, width, c) {
        this.lines.push({ x1, y1, x2, y2, life, max: life, width, c });
    }

    ring(x, y, r0, r1, life, w, c) {
        this.rings.push({ x, y, r0, r1, life, max: life, w, c });
    }

    text(s, x, y, c, size) {
        this.texts.push({ s, x, y, vy: -45, life: 1.0, max: 1.0, c, size });
    }

    decal(x, y, r, c) {
        this.decals.push({ x, y, r, c: css(c) });
        while (this.decals.length > 400) this.decals.shift();
    }

    /** Keep a drifting cloud of sakura petals around the camera. */
    ambient(cx, cy, vw, vh, dt, wind) {
        const rnd = this.rnd;
        while (this.petals.length < 70) {
            this.petals.push({
                x: cx + (rnd.nextDouble() - 0.5) * vw * 1.3,
                y: cy + (rnd.nextDouble() - 0.5) * vh * 1.3,
                vx: 25 + rnd.nextDouble() * 30,
                vy: 10 + rnd.nextDouble() * 20,
                life: 0, max: 0,
                size: 2.5 + rnd.nextDouble() * 2.5,
                rot: rnd.nextDouble() * 6,
                vr: (rnd.nextDouble() - 0.5) * 4,
                c: rnd.nextInt(4) === 0 ? rgb(255, 240, 245) : rgb(255, 170 + rnd.nextInt(40), 200),
            });
            const p = this.petals[this.petals.length - 1];
            p.life = p.max = 6 + rnd.nextDouble() * 6;
        }
        for (let i = this.petals.length - 1; i >= 0; i--) {
            const p = this.petals[i];
            p.life -= dt;
            p.x += (p.vx + wind) * dt + Math.sin(p.life * 2 + p.rot) * 12 * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            if (p.life <= 0 || Math.abs(p.x - cx) > vw || Math.abs(p.y - cy) > vh) this.petals.splice(i, 1);
        }
    }

    update(dt) {
        for (let i = this.ps.length - 1; i >= 0; i--) {
            const p = this.ps[i];
            p.life -= dt;
            const k = Math.exp(-p.drag * dt);
            p.vx *= k;
            p.vy *= k;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) {
                if (p.kind === FX_BLOOD && this.rnd.nextInt(2) === 0) this.decal(p.x, p.y, p.size * 1.3, U.alpha(U.shade(p.c, 0.6), 0.7));
                this.ps.splice(i, 1);
            }
        }
        for (const arr of [this.slashes, this.lines, this.rings]) {
            for (let i = arr.length - 1; i >= 0; i--) if ((arr[i].life -= dt) <= 0) arr.splice(i, 1);
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            t.y += t.vy * dt;
            t.vy *= Math.exp(-3 * dt);
            if (t.life <= 0) this.texts.splice(i, 1);
        }
    }

    drawDecals(g) {
        for (const d of this.decals) {
            g.fillStyle = d.c;
            fillCircle(g, d.x, d.y, d.r);
        }
    }

    drawWorld(g) {
        for (const s of this.slashes) {
            const t = s.life / s.max;
            const sweepNow = s.sweep * Math.min(1, (1 - t) * 3 + 0.35);
            for (let layer = 0; layer < 2; layer++) {
                const w = s.width * t * (layer === 0 ? 2.2 : 0.8);
                setStroke(g, Math.max(0.5, w), true);
                g.strokeStyle = css(layer === 0 ? U.alpha(s.c, 0.35 * t) : U.alpha(WHITE, 0.9 * t));
                g.beginPath();
                g.arc(s.x, s.y, s.r, s.start, s.start + sweepNow, sweepNow < 0);
                g.stroke();
            }
        }
        for (const l of this.lines) {
            const t = l.life / l.max;
            setStroke(g, Math.max(0.01, l.width * 2.5 * t), true);
            g.strokeStyle = css(U.alpha(l.c, 0.4 * t));
            strokeLine(g, l.x1, l.y1, l.x2, l.y2);
            setStroke(g, Math.max(0.5, l.width * t), true);
            g.strokeStyle = css(U.alpha(WHITE, t));
            strokeLine(g, l.x1, l.y1, l.x2, l.y2);
        }
        for (const p of this.ps) {
            const t = p.life / p.max;
            switch (p.kind) {
                case FX_SPARK:
                    setStroke(g, p.size, true);
                    g.strokeStyle = css(U.alpha(U.mix(WHITE, p.c, 1 - t), Math.min(1, t * 2)));
                    strokeLine(g, p.x, p.y, p.x - p.vx * 0.035, p.y - p.vy * 0.035);
                    break;
                case FX_BLOOD:
                case FX_DOT:
                    g.fillStyle = css(U.alpha(p.c, Math.min(1, t * 3)));
                    fillCircle(g, p.x, p.y, p.size);
                    break;
                case FX_EMBER:
                    g.fillStyle = css(U.alpha(p.c, t));
                    fillCircle(g, p.x, p.y, p.size);
                    break;
                case FX_DUST:
                case FX_WISP: {
                    const s = p.size * (1.5 - t * 0.5);
                    g.fillStyle = css(U.alpha(p.c, t * (p.kind === FX_DUST ? 0.35 : 0.6)));
                    fillCircle(g, p.x, p.y, s);
                    break;
                }
            }
        }
        for (const r of this.rings) {
            const t = r.life / r.max;
            const rad = U.lerp(r.r1, r.r0, t * t);
            setStroke(g, r.w * t + 0.5, false);
            g.strokeStyle = css(U.alpha(r.c, t));
            g.beginPath();
            g.arc(r.x, r.y, rad, 0, TAU);
            g.stroke();
        }
    }

    drawPetals(g) {
        for (const p of this.petals) {
            const a = Math.min(1, Math.min(p.life, p.max - p.life));
            g.save();
            g.translate(p.x, p.y);
            g.rotate(p.rot);
            g.fillStyle = css(U.alpha(p.c, 0.85 * a));
            fillEllipse(g, -p.size, -p.size * 0.5, p.size * 2, p.size);
            g.restore();
        }
    }

    drawTexts(g) {
        g.textAlign = 'center';
        for (const t of this.texts) {
            const a = Math.min(1, t.life / t.max * 2.5);
            g.font = 'bold ' + Math.min(t.size, 63) + 'px sans-serif';
            const x = Math.floor(t.x), y = Math.floor(t.y);
            g.fillStyle = css(U.alpha(BLACK, a * 0.8));
            g.fillText(t.s, x + 2, y + 2);
            g.fillStyle = css(U.alpha(t.c, a));
            g.fillText(t.s, x, y);
        }
        g.textAlign = 'left';
    }
}
