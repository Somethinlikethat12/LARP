'use strict';

/** Gap-closing attacks charge forward at this speed during their windup. */
function withDash(a, speed) {
    a.dash = speed;
    return a;
}

// ---- move sets ----
const EA = {
    R_A: new Attack('slash', .45, .12, .45, 70, 140, 14, 18, 240),
    R_B: new Attack('slash2', .30, .12, .50, 70, 140, 14, 18, 240),
    R_HEAVY: new Attack('heavy', .80, .14, .60, 82, 180, 22, 30, 280),
    R_DELAY: new Attack('delayed', 1.05, .14, .60, 82, 180, 22, 30, 300),
    R_THRUST: new Attack('thrust', .70, .18, .75, 118, 30, 26, 10, 560).markPerilous().markThrust(),
    R_FAST: new Attack('quick', .24, .10, .35, 66, 130, 10, 14, 220),
    SP_T1: new Attack('thrust', .50, .14, .50, 118, 26, 13, 16, 170).markThrust(),
    SP_T2: new Attack('thrust2', .28, .14, .50, 118, 26, 13, 16, 170).markThrust(),
    SP_SWEEP: new Attack('sweep', .60, .16, .60, 108, 200, 16, 22, 70),
    SP_PER: new Attack('lunge', .75, .20, .80, 150, 24, 30, 10, 620).markPerilous().markThrust(),
    BR_SMASH: new Attack('smash', .85, .18, .90, 108, 160, 30, 42, 130),
    BR_SWEEP: new Attack('sweep', .55, .16, .70, 112, 190, 22, 30, 80),
    BR_PER: new Attack('crush', 1.0, .25, 1.0, 130, 300, 38, 0, 90).markPerilous(),
    R_DASH: withDash(new Attack('dash', .50, .12, .55, 80, 120, 18, 22, 320), 430),
    R_SPIN: new Attack('spin', .55, .16, .60, 80, 300, 16, 22, 120),
    R_SWEEP: new Attack('lowsweep', .75, .16, .70, 92, 220, 24, 0, 60).markPerilous(),
    SP_DASH: withDash(new Attack('charge', .55, .16, .60, 128, 26, 16, 18, 300).markThrust(), 460),
    SP_SPIN: new Attack('whirl', .60, .18, .65, 112, 340, 15, 22, 60),
    SP_FLURRY: new Attack('flurry', .18, .10, .30, 116, 22, 8, 10, 120).markThrust(),
    BR_CHARGE: withDash(new Attack('charge', .70, .20, .90, 70, 100, 26, 40, 500), 480),
    BR_STOMP: new Attack('stomp', .80, .20, .90, 124, 360, 26, 0, 0).markPerilous(),
};

// Enemy types: 'RONIN' | 'SPEAR' | 'BRUTE'
// Enemy states: 'IDLE' | 'ALERT' | 'ENGAGE' | 'WINDUP' | 'ACTIVE' | 'RECOVER' | 'DODGE' | 'STUN' | 'BROKEN' | 'DEAD' | 'RETURN'
class Enemy extends Actor {
    constructor(g, type, x, y, elite, name, seed, vet, boss) {
        super();
        this.g = g;
        this.type = type;
        this.elite = elite;
        this.vet = elite || !!vet;
        this.boss = !!boss;
        this.name = name;
        this.lives = 1;
        this.camp = null;
        this.x = this.homeX = this.wanderX = x;
        this.y = this.homeY = this.wanderY = y;
        this.st = 'IDLE';
        this.stT = 0;
        this.stDur = 0;
        this.combos = [];
        this.gap = [];
        this.combo = null;
        this.comboIdx = 0;
        this.atk = null;
        this.atkHit = false;
        this.attackCd = 0.5;
        this.tokenT = 0;
        this.aware = false;
        this.hasToken = false;
        this.beingExecuted = false;
        this.speed = 0;
        this.detect = 0;
        this.blockChance = 0;
        this.hyper = false;
        this.lastDamageT = -99;
        this.blockStreak = 0;
        this.flinchCount = 0;
        this.blockAnim = 0;
        this.hitFlash = 0;
        this.deadT = 0;
        this.wanderT = 0;
        this.strafeDir = 1;
        this.strafeT = 0;
        this.walkAnim = 0;
        this.kbx = 0;
        this.kby = 0;
        this.reach = 0;
        this.showBars = 0;
        this.perilousT = 0;
        this.dodgeChance = 0;
        this.dodgeCd = 0;
        this.dodgeDx = 0;
        this.dodgeDy = 0;
        this.dodgeCounter = false;
        this.seenSwing = -1;
        this.rnd = new Rng(seed);
        this.facing = this.rnd.nextDouble() * TAU;
        switch (type) {
            case 'RONIN': this.stats(16, 70, 70, 150, 380, 0.5); break;
            case 'SPEAR': this.stats(16, 60, 60, 140, 400, 0.35); break;
            case 'BRUTE':
                this.stats(25, 200, 150, 105, 340, 0);
                this.hyper = true;
                break;
        }
        this.dodgeChance = { RONIN: 0.3, SPEAR: 0.22, BRUTE: 0 }[type];
        if (this.vet && !elite) {
            this.maxHp *= 1.3;
            this.maxPosture *= 1.25;
            this.detect *= 1.1;
            this.blockChance = Math.min(0.8, this.blockChance + 0.1);
            if (this.dodgeChance > 0) this.dodgeChance += 0.12;
        }
        if (elite) {
            this.r *= 1.12;
            this.maxHp *= 3.2;
            this.maxPosture *= 2.0;
            this.speed *= 1.15;
            this.detect *= 1.2;
            if (type !== 'BRUTE') {
                this.blockChance = 0.7;
                this.dodgeChance = 0.45;
            }
            this.lives = 2;
        }
        if (this.boss) {
            this.r *= 1.65;
            this.maxHp *= 2.4;
            this.maxPosture *= 2.2;
            this.speed *= 1.08;
            this.detect = 700;
            this.blockChance = 0.8;
            this.dodgeChance = 0;
            this.lives = 3;
            this.hyper = true;
        }
        this.hp = this.maxHp;
        this.buildCombos();
    }

    stats(r, hp, posture, speed, detect, block) {
        this.r = r;
        this.maxHp = hp;
        this.maxPosture = posture;
        this.speed = speed;
        this.detect = detect;
        this.blockChance = block;
    }

    scaled(a) {
        if (this.elite) return a.copy(a === EA.R_DELAY ? 1 : 0.85, 1.3);
        if (this.vet) return a.copy(a === EA.R_DELAY ? 1 : 0.94, 1.1);
        return a;
    }

    add(...a) { this.combos.push(a.map(x => this.scaled(x))); }

    addGap(...a) { this.gap.push(a.map(x => this.scaled(x))); }

    buildCombos() {
        const E = EA;
        switch (this.type) {
            case 'RONIN':
                this.add(E.R_A);
                this.add(E.R_A, E.R_B);
                this.add(E.R_A, E.R_B, E.R_HEAVY);
                this.add(E.R_THRUST);
                this.add(E.R_A, E.R_THRUST);
                this.addGap(E.R_DASH);
                this.addGap(E.R_DASH, E.R_B);
                if (this.vet) {
                    this.add(E.R_FAST, E.R_FAST, E.R_HEAVY);
                    this.add(E.R_A, E.R_DELAY);
                    this.add(E.R_SPIN);
                    this.add(E.R_A, E.R_B, E.R_SWEEP);
                    this.add(E.R_FAST, E.R_SPIN);
                    this.addGap(E.R_DASH, E.R_A, E.R_THRUST);
                }
                if (this.elite) {
                    this.add(E.R_FAST, E.R_FAST, E.R_FAST, E.R_FAST, E.R_HEAVY);
                    this.add(E.R_A, E.R_B, E.R_A, E.R_B);
                    this.add(E.R_FAST, E.R_FAST, E.R_DELAY);
                    this.add(E.R_HEAVY, E.R_THRUST);
                    this.addGap(E.R_DASH, E.R_SPIN, E.R_SWEEP);
                }
                if (this.boss) {
                    this.add(E.R_DASH, E.R_SPIN, E.R_SWEEP, E.R_THRUST);
                    this.add(E.R_FAST, E.R_FAST, E.R_SPIN, E.R_HEAVY, E.R_SWEEP);
                    this.addGap(E.R_DASH, E.R_DASH, E.R_SPIN);
                }
                this.reach = 70;
                break;
            case 'SPEAR':
                this.add(E.SP_T1);
                this.add(E.SP_T1, E.SP_T2);
                this.add(E.SP_T1, E.SP_SWEEP);
                this.add(E.SP_PER);
                this.add(E.SP_T1, E.SP_T2, E.SP_PER);
                this.addGap(E.SP_DASH);
                this.addGap(E.SP_DASH, E.SP_T2);
                if (this.vet) {
                    this.add(E.SP_FLURRY, E.SP_FLURRY, E.SP_FLURRY, E.SP_T1);
                    this.add(E.SP_SPIN);
                    this.add(E.SP_T1, E.SP_SPIN);
                    this.add(E.SP_SWEEP, E.SP_PER);
                    this.addGap(E.SP_DASH, E.SP_SWEEP, E.SP_PER);
                }
                if (this.elite) {
                    this.add(E.SP_T1, E.SP_T2, E.SP_T2, E.SP_T2, E.SP_SWEEP);
                    this.add(E.SP_SWEEP, E.SP_SWEEP, E.SP_PER);
                }
                this.reach = 112;
                break;
            case 'BRUTE':
                this.add(E.BR_SMASH);
                this.add(E.BR_SMASH, E.BR_SWEEP);
                this.add(E.BR_PER);
                this.add(E.BR_SWEEP, E.BR_SWEEP, E.BR_SMASH);
                this.addGap(E.BR_CHARGE);
                if (this.vet) {
                    this.add(E.BR_STOMP);
                    this.add(E.BR_SMASH, E.BR_STOMP);
                    this.add(E.BR_SWEEP, E.BR_SMASH, E.BR_PER);
                    this.addGap(E.BR_CHARGE, E.BR_SMASH);
                }
                if (this.elite) {
                    this.add(E.BR_SWEEP, E.BR_SWEEP, E.BR_SWEEP, E.BR_PER);
                    this.add(E.BR_SMASH, E.BR_SMASH, E.BR_SMASH);
                }
                this.reach = 104;
                break;
        }
    }

    pickCombo() {
        return this.combos[this.rnd.nextInt(this.combos.length)];
    }

    pickGap() { return this.gap[this.rnd.nextInt(this.gap.length)]; }

    setSt(s) {
        this.st = s;
        this.stT = 0;
    }

    attacking() {
        return this.st === 'WINDUP' || this.st === 'ACTIVE' || (this.st === 'RECOVER' && this.combo !== null && this.comboIdx + 1 < this.combo.length);
    }

    // ---------------- AI ----------------
    update(dt) {
        if (this.st === 'DEAD') {
            this.deadT += dt;
            return;
        }
        const g = this.g, p = g.coop && g.coop.host && g.coop.remote && g.coop.remote.st !== 'DEAD'
            && (g.player.st === 'DEAD' || this.distTo(g.coop.remote) < this.distTo(g.player)) ? g.coop.remote : g.player;
        this.target = p;
        this.stT += dt;
        this.attackCd -= dt;
        this.blockAnim -= dt;
        this.hitFlash -= dt;
        this.showBars -= dt;
        this.perilousT -= dt;
        this.dodgeCd -= dt;
        if (Math.abs(this.kbx) + Math.abs(this.kby) > 1) {
            this.move(g.world, this.kbx * dt, this.kby * dt);
            const k = Math.exp(-dt * 10);
            this.kbx *= k;
            this.kby *= k;
        }
        if (this.st !== 'BROKEN' && g.time - this.lastDamageT > 1.3) {
            this.posture = Math.max(0, this.posture - this.maxPosture * 0.10 * (0.3 + 0.7 * this.hp / this.maxHp) * dt);
        }
        const d = this.distTo(p), toP = this.angleTo(p);
        const pAlive = p.st !== 'DEAD';
        if (this.hasToken) {
            this.tokenT += dt;
            if (this.tokenT > 3 && this.st === 'ENGAGE') this.releaseToken();
        }
        if (this.elite && this.aware && this.rnd.nextDouble() < dt * 10) g.fx.wisp(this.x, this.y, rgb(110, 30, 150));
        if (this.boss && this.aware && this.rnd.nextDouble() < dt * 18) g.fx.wisp(this.x, this.y, rgb(255, 90, 50));
        if (p.untargetable() && (this.st === 'WINDUP' || (this.st === 'RECOVER' && this.attacking()))) {
            this.releaseToken();
            this.attackCd = Math.max(this.attackCd, 0.7);
            this.setSt('ENGAGE');
        }
        // one dodge roll per player swing, and only if we're being swung at
        if (p.swingId !== this.seenSwing) {
            this.seenSwing = p.swingId;
            const aimedAtMe = Math.abs(U.angDiff(p.facing, p.angleTo(this))) < 1.2 || (p.st === 'ART' && p.curArt.spin);
            if (this.st === 'ENGAGE' && pAlive && aimedAtMe && d < 170 + this.r && this.dodgeCd <= 0
                && this.rnd.nextDouble() < this.dodgeChance) {
                this.startDodge(p, p.st === 'ART' || this.rnd.nextDouble() < 0.4, true);
            }
        }
        switch (this.st) {
            case 'IDLE': this.idle(dt, d, toP, p, pAlive); break;
            case 'ALERT':
                this.facing = U.turn(this.facing, toP, dt * 8);
                if (this.stT > 0.45) this.setSt('ENGAGE');
                break;
            case 'ENGAGE': this.engage(dt, d, toP, p, pAlive); break;
            case 'WINDUP': this.windup(dt, d, toP, p); break;
            case 'ACTIVE': this.activeSt(dt, d, toP, p); break;
            case 'DODGE': {
                const sp = 560 * Math.pow(Math.max(0, 1 - this.stT / this.stDur), 1.4) + 30;
                this.move(g.world, this.dodgeDx * sp * dt, this.dodgeDy * sp * dt);
                this.facing = U.turn(this.facing, toP, dt * 10);
                if (this.stT >= this.stDur) this.afterDodge(d, p);
                break;
            }
            case 'RECOVER':
                if (this.stT >= this.stDur) {
                    if (this.combo !== null && this.comboIdx + 1 < this.combo.length) {
                        this.comboIdx++;
                        this.beginAttack(1);
                    } else {
                        this.releaseToken();
                        this.attackCd = this.elite ? 0.3 + this.rnd.nextDouble() * 0.7
                            : this.vet ? 0.6 + this.rnd.nextDouble() * 0.9 : 0.9 + this.rnd.nextDouble() * 1.2;
                        this.setSt('ENGAGE');
                    }
                }
                break;
            case 'STUN':
                if (this.stT >= this.stDur) this.setSt('ENGAGE');
                break;
            case 'BROKEN':
                if (this.stT >= this.stDur && !this.beingExecuted) {
                    this.posture = this.maxPosture * 0.5;
                    if (this.hp <= 1) this.hp = this.maxHp * 0.15;
                    this.setSt('ENGAGE');
                }
                break;
            case 'RETURN': {
                const a = Math.atan2(this.homeY - this.y, this.homeX - this.x);
                this.facing = U.turn(this.facing, a, dt * 6);
                this.move(g.world, Math.cos(this.facing) * this.speed * 0.8 * dt, Math.sin(this.facing) * this.speed * 0.8 * dt);
                this.walkAnim += this.speed * 0.8 * dt;
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
                this.posture = Math.max(0, this.posture - this.maxPosture * 0.5 * dt);
                if (U.dist(this.x, this.y, this.homeX, this.homeY) < 24 || this.stT > 12) {
                    this.aware = false;
                    this.hp = this.maxHp;
                    this.setSt('IDLE');
                } else if (pAlive && d < this.detect * 0.6) this.setSt('ENGAGE');
                break;
            }
        }
    }

    idle(dt, d, toP, p, pAlive) {
        const g = this.g;
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
            this.wanderT = 2 + this.rnd.nextDouble() * 4;
            const a = this.rnd.nextDouble() * TAU, rr = this.rnd.nextDouble() * (this.camp !== null ? 90 : 220);
            this.wanderX = this.homeX + Math.cos(a) * rr;
            this.wanderY = this.homeY + Math.sin(a) * rr;
        }
        if (U.dist(this.x, this.y, this.wanderX, this.wanderY) > 12 && this.wanderT < 3) {
            this.facing = U.turn(this.facing, Math.atan2(this.wanderY - this.y, this.wanderX - this.x), dt * 3);
            this.move(g.world, Math.cos(this.facing) * this.speed * 0.3 * dt, Math.sin(this.facing) * this.speed * 0.3 * dt);
            this.walkAnim += this.speed * 0.3 * dt;
        }
        if (!pAlive || p.invuln > 0.5) return;
        const inCone = Math.abs(U.angDiff(this.facing, toP)) < 1.1;
        const hearing = (p.sneaking() ? 38 : (Math.hypot(p.vx, p.vy) > 60 ? 150 : 70)) * p.stealth;
        if ((d < this.detect && inCone) || d < hearing) this.alert(true);
    }

    alert(propagate) {
        if (this.aware || this.st === 'DEAD') return;
        const g = this.g;
        this.aware = true;
        this.setSt('ALERT');
        this.showBars = 3;
        g.fx.text('!', this.x, this.y - 36, rgb(255, 220, 60), 24);
        if (this.elite) g.engageBoss(this);
        if (propagate) {
            for (const e of g.enemies) if (e !== this && !e.aware && e.st !== 'DEAD' && this.distTo(e) < 520) e.alert(false);
        }
    }

    engage(dt, d, toP, p, pAlive) {
        const g = this.g;
        if (!pAlive || U.dist(this.x, this.y, this.homeX, this.homeY) > 1400 || d > 1000) {
            this.releaseToken();
            this.setSt('RETURN');
            return;
        }
        this.showBars = Math.max(this.showBars, 1);
        this.facing = U.turn(this.facing, toP, dt * 7);
        if (p.untargetable()) {
            this.releaseToken();
            this.attackCd = Math.max(this.attackCd, 0.5);
            this.circle(dt, d, toP, this.type === 'BRUTE' ? 220 : 180, 0.4);
            return;
        }
        if (this.attackCd <= 0 && !this.hasToken && g.requestToken(this)) {
            this.hasToken = true;
            this.tokenT = 0;
        }
        if (this.hasToken) {
            if (d < this.reach + p.r - 4) {
                this.startCombo(this.pickCombo(), 1);
                return;
            }
            if (this.gap.length > 0 && d > this.reach + p.r + 30 && d < 280 && this.rnd.nextDouble() < dt * (this.vet ? 2.2 : 0.9)) {
                this.startCombo(this.pickGap(), 1);
                return;
            }
            const sp = this.speed * 1.15;
            this.move(g.world, Math.cos(toP) * sp * dt, Math.sin(toP) * sp * dt);
            this.walkAnim += sp * dt;
        } else {
            this.circle(dt, d, toP, this.type === 'BRUTE' ? 200 : 165, 0.55);
        }
    }

    circle(dt, d, toP, ideal, spMul) {
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
            this.strafeT = 1 + this.rnd.nextDouble() * 2;
            this.strafeDir = this.rnd.nextBoolean() ? 1 : -1;
            if (this.dodgeCd <= 0 && this.dodgeChance > 0 && d < 280 && this.rnd.nextDouble() < (this.vet ? 0.35 : 0.12)) {
                this.startDodge(this.target || this.g.player, false, false);
                return;
            }
        }
        const radial = U.clamp((d - ideal) / 60, -1, 1);
        const mx = Math.cos(toP) * radial + Math.cos(toP + Math.PI / 2) * this.strafeDir * 0.6;
        const my = Math.sin(toP) * radial + Math.sin(toP + Math.PI / 2) * this.strafeDir * 0.6;
        const l = Math.hypot(mx, my);
        if (l > 0.01) {
            const sp = this.speed * spMul * Math.min(1, l);
            this.move(this.g.world, mx / l * sp * dt, my / l * sp * dt);
            this.walkAnim += sp * dt;
        }
    }

    startDodge(p, back, mayCounter) {
        const g = this.g, toP = this.angleTo(p), side = this.rnd.nextBoolean() ? 1 : -1;
        const a = back ? toP + Math.PI + side * 0.5 : toP + side * (Math.PI / 2 + 0.35);
        this.dodgeDx = Math.cos(a);
        this.dodgeDy = Math.sin(a);
        this.dodgeCounter = mayCounter && (this.hasToken || this.rnd.nextDouble() < (this.vet ? 0.6 : 0.35));
        this.releaseToken();
        this.setSt('DODGE');
        this.stDur = 0.32;
        this.dodgeCd = (1.4 + this.rnd.nextDouble() * 1.2) * (this.elite ? 0.7 : 1);
        g.fx.dust(this.x, this.y, 6);
        g.sfx.play('DODGE');
    }

    afterDodge(d, p) {
        this.setSt('ENGAGE');
        if (!this.dodgeCounter || p.st === 'DEAD') return;
        this.hasToken = true;
        this.tokenT = 0;
        if (d < this.reach + p.r + 10) this.startCombo(this.pickCombo(), 0.7);
        else if (this.gap.length > 0) this.startCombo(this.pickGap(), 0.8);
    }

    startCombo(c, windupMul) {
        this.combo = c;
        this.comboIdx = 0;
        this.flinchCount = 0;
        this.blockStreak = 0;
        this.beginAttack(windupMul);
    }

    beginAttack(windupMul) {
        const g = this.g;
        this.atk = this.combo[this.comboIdx];
        this.atkHit = false;
        this.setSt('WINDUP');
        // veterans vary their timing so the rhythm can't be memorised
        this.stDur = this.atk.windup * windupMul * (this.vet ? 0.88 + this.rnd.nextDouble() * 0.3 : 1);
        if (this.atk.perilous) {
            this.perilousT = this.stDur + 0.3;
            g.sfx.play('PERILOUS');
            g.fx.ring(this.x, this.y, 10, 60, 0.4, 3, rgb(255, 40, 30));
        }
    }

    windup(dt, d, toP, p) {
        const g = this.g, atk = this.atk;
        const remaining = this.stDur - this.stT;
        let turnRate = atk.thrust && remaining < 0.2 ? 2.0 : 6.5;
        if (this.type === 'BRUTE') turnRate *= 0.7;
        this.facing = U.turn(this.facing, toP, dt * turnRate);
        if (d > atk.range * 0.7 + p.r) {
            const chase = atk.dash > 0 ? atk.dash : this.speed * 0.35;
            this.move(g.world, Math.cos(this.facing) * chase * dt, Math.sin(this.facing) * chase * dt);
            this.walkAnim += chase * dt;
            if (atk.dash > 0 && this.rnd.nextDouble() < dt * 20) g.fx.dust(this.x, this.y, 1);
        }
        if (this.stT >= this.stDur) {
            this.setSt('ACTIVE');
            this.stDur = atk.active;
            g.sfx.play(this.type === 'BRUTE' || atk.perilous ? 'HEAVY' : 'SLASH');
            const c = atk.perilous ? rgb(255, 80, 60) : rgb(255, 230, 200);
            const f = this.facing, x = this.x, y = this.y;
            if (atk.thrust) {
                g.fx.line(x + Math.cos(f) * this.r, y + Math.sin(f) * this.r, x + Math.cos(f) * (atk.range + 10),
                    y + Math.sin(f) * (atk.range + 10), 0.18, 3, c);
            } else {
                g.fx.slash(x, y, atk.range * 0.8, f + atk.arc / 2, -atk.arc, 0.22, this.type === 'BRUTE' ? 10 : 6, c);
            }
        }
    }

    activeSt(dt, d, toP, p) {
        const g = this.g, atk = this.atk;
        const f = Math.max(0, 1 - this.stT / atk.active);
        const close = d < this.r + p.r + 6 && Math.abs(U.angDiff(this.facing, toP)) < 1;
        if (!close && atk.lunge > 0) this.move(g.world, Math.cos(this.facing) * atk.lunge * f * dt, Math.sin(this.facing) * atk.lunge * f * dt);
        if (!this.atkHit && p.st !== 'DEAD') {
            const tol = atk.arc / 2 + Math.asin(Math.min(1, p.r / Math.max(d, 1)));
            if (d <= atk.range + p.r && Math.abs(U.angDiff(this.facing, toP)) <= tol) {
                const res = p.receive(this.x, this.y, atk.damage, atk.posture, atk.perilous);
                if (g.coop && g.coop.host && p === g.coop.remote && res !== P_IGNORE) g.coop.impact(p, res);
                if (res !== P_IGNORE) this.atkHit = true;
                if (res === P_DEFLECT) this.onDeflected();
                else if (res === P_BLOCK) {
                    this.kbx = -Math.cos(this.facing) * 60;
                    this.kby = -Math.sin(this.facing) * 60;
                }
            }
        }
        if (this.st === 'ACTIVE' && this.stT >= this.stDur) {
            const more = this.comboIdx + 1 < this.combo.length;
            this.setSt('RECOVER');
            this.stDur = more ? 0.06 : atk.recovery;
        }
    }

    onDeflected() {
        const g = this.g, p = this.target || g.player, last = this.comboIdx + 1 >= this.combo.length;
        const chain = 1 + 0.08 * Math.min(p.deflectStreak - 1, 5);
        this.posture += (this.atk.posture * 1.3 + 6) * p.deflectPost * chain;
        this.lastDamageT = g.time;
        this.showBars = 3;
        this.hitFlash = 0.07;
        this.kbx = -Math.cos(this.facing) * 240;
        this.kby = -Math.sin(this.facing) * 240;
        g.fx.dust(this.x, this.y, 5);
        if (this.posture >= this.maxPosture) {
            this.breakPosture();
            return;
        }
        if (last) {
            this.setSt('STUN');
            this.stDur = this.elite ? 0.5 : 0.8;
            this.releaseToken();
            this.attackCd = 0.6;
            g.slowmo(0.16);
            g.fx.text('OPENING', this.x, this.y - 40, rgb(255, 235, 170), 15);
        }
    }

    /** Player sword connects. */
    takeHit(p, pa) {
        if (this.st === 'DEAD' || this.beingExecuted) return;
        if (this.st === 'DODGE' && this.stT < 0.24) return;
        const g = this.g;
        const ang = p.angleTo(this);
        const cx = this.x - Math.cos(ang) * this.r, cy = this.y - Math.sin(ang) * this.r;
        this.showBars = 4;
        this.lastDamageT = g.time;
        const wasAware = this.aware;
        if (!this.aware) this.alert(true);
        const neutral = wasAware && (this.st === 'ENGAGE' || this.st === 'ALERT' || this.st === 'RETURN');
        if (neutral && !pa.pierce && this.rnd.nextDouble() < (this.blockChance + this.blockStreak * 0.1) * (pa.art ? 0.5 : 1)) {
            this.facing = ang + Math.PI;
            if (this.elite && !pa.art && this.blockStreak >= 1 && this.rnd.nextDouble() < 0.55) {
                g.fx.sparks(cx, cy, ang + Math.PI, 2.2, 22, 480, rgb(255, 120, 200));
                g.sfx.play('CLANG');
                g.hitstop(0.07);
                g.shake(6);
                g.fx.text('PARRIED!', p.x, p.y - 42, rgb(255, 110, 110), 16);
                p.recoil(ang + Math.PI);
                this.hasToken = true;
                this.startCombo(this.pickCombo(), 0.55);
                return;
            }
            this.posture += pa.posture * 1.1;
            this.blockStreak++;
            this.blockAnim = 0.25;
            g.fx.sparks(cx, cy, ang + Math.PI, 1.6, 12, 300, rgb(255, 160, 70));
            g.sfx.play('BLOCK');
            g.hitstop(0.035);
            g.shake(2);
            this.kbx = Math.cos(ang) * 120;
            this.kby = Math.sin(ang) * 120;
            if (this.posture >= this.maxPosture) {
                this.breakPosture();
                return;
            }
            if (this.blockStreak >= 3) {
                this.hasToken = true;
                this.startCombo(this.pickCombo(), 0.6);
            }
            return;
        }
        this.blockStreak = 0;
        const dmg = pa.damage * (wasAware ? 1 : 2);
        this.hp -= dmg;
        this.posture += pa.posture * 0.6;
        this.hitFlash = 0.12;
        g.fx.blood(cx, cy, ang, 10, 260);
        g.sfx.play('HIT');
        g.hitstop(pa.art ? 0.11 : pa.heavy ? 0.075 : 0.045);
        g.shake(pa.art ? 8 : pa.heavy ? 5 : 3.5);
        if (pa.art) g.fx.sparks(cx, cy, ang, 1.4, 16, 460, rgb(255, 230, 170));
        g.fx.text(String(Math.trunc(dmg)), this.x + this.rnd.nextGaussian() * 6, this.y - 30, WHITE, 13);
        p.ki += 4;
        if (this.hp <= 0) {
            if (this.elite) {
                this.hp = 1;
                this.breakPosture();
            } else this.die(ang);
            return;
        }
        if (this.posture >= this.maxPosture) {
            this.breakPosture();
            return;
        }
        const armored = this.hyper || (this.st === 'WINDUP' && this.atk !== null && this.atk.perilous) || (this.elite && this.st === 'ACTIVE');
        if (!armored && this.st !== 'BROKEN') {
            this.flinchCount++;
            if (this.flinchCount >= 3) {
                this.facing = ang + Math.PI;
                this.hasToken = true;
                this.startCombo(this.pickCombo(), 0.55);
            } else {
                const left = this.st === 'STUN' ? this.stDur - this.stT : 0;
                this.releaseToken();
                this.setSt('STUN');
                this.stDur = Math.max(left, 0.3);
                this.kbx = Math.cos(ang) * 140;
                this.kby = Math.sin(ang) * 140;
            }
        }
    }

    /** Iai Flash and other unblockable damage. */
    takeRaw(dmg, post, ang) {
        if (this.st === 'DEAD' || this.beingExecuted) return;
        const g = this.g;
        if (!this.aware) this.alert(true);
        this.showBars = 4;
        this.lastDamageT = g.time;
        this.hp -= dmg;
        this.posture += post;
        this.hitFlash = 0.15;
        g.fx.blood(this.x, this.y, ang, 14, 300);
        g.fx.text(String(Math.trunc(dmg)), this.x, this.y - 30, rgb(255, 230, 120), 15);
        if (this.hp <= 0) {
            if (this.elite) {
                this.hp = 1;
                this.breakPosture();
            } else this.die(ang);
        } else if (this.posture >= this.maxPosture) this.breakPosture();
        else if (!this.hyper) {
            this.releaseToken();
            this.setSt('STUN');
            this.stDur = 0.45;
        }
    }

    breakPosture() {
        this.posture = this.maxPosture;
        this.releaseToken();
        this.setSt('BROKEN');
        this.stDur = this.elite ? 2.4 : 3.0;
        this.g.onPostureBreak(this);
    }

    die(ang) {
        this.hp = 0;
        this.alive = false;
        this.releaseToken();
        this.setSt('DEAD');
        this.facing = ang;
        this.deadT = 0;
        this.beingExecuted = false;
        this.g.onEnemyKilled(this);
    }

    releaseToken() {
        this.hasToken = false;
        this.tokenT = 0;
    }

    resetToHome() {
        if (this.st === 'DEAD') return;
        this.x = this.homeX;
        this.y = this.homeY;
        this.hp = this.maxHp;
        this.posture = 0;
        this.aware = false;
        this.beingExecuted = false;
        this.kbx = this.kby = 0;
        this.releaseToken();
        this.setSt('IDLE');
    }

    // ---------------- rendering ----------------
    draw(g2, time) {
        const x = this.x, y = this.y, r = this.r;
        if (this.st === 'DEAD') {
            const a = U.clamp(1 - (this.deadT - 10) / 3, 0, 1);
            if (a <= 0) return;
            g2.save();
            g2.translate(x, y);
            g2.rotate(this.facing);
            g2.fillStyle = css(U.alpha(U.shade(this.robeColor(), 0.6), a));
            fillEllipse(g2, -r * 1.4, -r * 0.8, r * 2.8, r * 1.6);
            g2.fillStyle = css(U.alpha(U.shade(this.hatColor(), 0.6), a));
            fillEllipse(g2, r * 0.8, -r * 0.6, r * 1.2, r * 1.2);
            g2.restore();
            return;
        }
        Draw.shadow(g2, x, y, r);
        let drawR = r, sway = 0;
        if (this.st === 'BROKEN') {
            drawR = r * 0.88;
            sway = Math.sin(time * 6) * 0.15;
        }
        let robe = this.robeColor(), sh = this.shoulderColor();
        const hat = this.hatColor();
        if (this.st === 'BROKEN') {
            robe = U.shade(robe, 0.7);
            sh = U.shade(sh, 0.7);
        }
        if (this.hitFlash > 0) {
            robe = U.mix(robe, WHITE, 0.8);
            sh = U.mix(sh, WHITE, 0.8);
        }
        if (this.boss) {
            g2.fillStyle = css(rgb(255, 70, 40, 55 + Math.trunc(35 * Math.sin(time * 5))));
            fillCircle(g2, x, y, r * 2.1);
        } else if (this.elite) {
            g2.fillStyle = css(rgb(120, 40, 170, 40 + Math.trunc(30 * Math.sin(time * 4))));
            fillCircle(g2, x, y, r * 1.8);
        }
        if (this.atk !== null && this.atk.perilous && (this.st === 'WINDUP' || this.st === 'ACTIVE')) {
            g2.fillStyle = 'rgba(255,30,20,0.275)';
            fillCircle(g2, x, y, r * 1.9);
        }
        if (this.st === 'DODGE') {
            g2.fillStyle = 'rgba(225,225,235,0.2)';
            fillCircle(g2, x - this.dodgeDx * 16, y - this.dodgeDy * 16, r * 1.3);
        }
        let hatStyle;
        switch (this.type) {
            case 'RONIN': hatStyle = this.elite ? 3 : 0; break;
            case 'SPEAR': hatStyle = 1; break;
            default: hatStyle = 2;
        }
        Draw.body(g2, x, y, drawR, this.facing + sway, robe, sh, hat, hatStyle, this.walkAnim);
        this.drawWeapon(g2, time);
    }

    drawWeapon(g2, time) {
        const st = this.st, atk = this.atk, facing = this.facing, x = this.x, y = this.y, r = this.r;
        const wp = st === 'WINDUP' ? U.clamp(this.stT / Math.max(this.stDur, 0.01), 0, 1) : 0;
        const ap = st === 'ACTIVE' ? U.clamp(this.stT / Math.max(this.stDur, 0.01), 0, 1) : 0;
        let handRel = 0.9, blade = facing + 0.6, extend = 0;
        const slashing = atk !== null && !atk.thrust;
        if (st === 'WINDUP' && atk !== null) {
            if (slashing) {
                blade = facing + atk.arc / 2 + 0.5 * wp;
                handRel = 0.9 + 0.4 * wp;
            } else if (atk.thrust) {
                blade = facing;
                handRel = 0.5;
                extend = -12 * wp;
            }
        } else if (st === 'ACTIVE' && atk !== null) {
            if (slashing) {
                blade = facing + U.lerp(atk.arc / 2, -atk.arc / 2, ap);
                handRel = (blade - facing) * 0.5;
            } else if (atk.thrust) {
                blade = facing;
                handRel = 0.2;
                extend = 22 * Math.sin(Math.PI * Math.min(1, ap * 1.4));
            }
        } else if (st === 'RECOVER' && atk !== null && slashing) {
            blade = facing - atk.arc / 2;
            handRel = -0.5;
        } else if (this.blockAnim > 0) {
            blade = facing - 1.4;
            handRel = 0.15;
        } else if (st === 'BROKEN' || st === 'STUN') {
            blade = facing + 2.0;
            handRel = 1.2;
        }
        const hx = x + Math.cos(facing + handRel) * r * 0.9 + Math.cos(facing) * extend;
        const hy = y + Math.sin(facing + handRel) * r * 0.9 + Math.sin(facing) * extend;
        let tipLen;
        switch (this.type) {
            case 'RONIN':
                tipLen = this.boss ? 92 : this.elite ? 64 : 54;
                Draw.katana(g2, hx, hy, blade, tipLen, this.boss ? rgb(255, 150, 120) : this.elite ? rgb(170, 120, 200) : rgb(190, 190, 200));
                break;
            case 'SPEAR':
                if (st !== 'WINDUP' && st !== 'ACTIVE' && this.blockAnim <= 0 && st !== 'BROKEN') blade = facing + 0.25;
                tipLen = 86;
                Draw.spear(g2, hx, hy, blade, tipLen, 26);
                tipLen += 12;
                break;
            default:
                tipLen = this.elite ? 84 : 72;
                if (st === 'WINDUP' && atk !== null && !atk.thrust) blade = facing + atk.arc / 2 + 0.6 * wp;
                Draw.club(g2, hx, hy, blade, tipLen);
        }
        // the parry cue: a glint right before an attack lands
        if (st === 'WINDUP' && atk !== null && !atk.perilous) {
            const remaining = this.stDur - this.stT;
            if (remaining < 0.26 && remaining > 0.04) {
                const k = 1 - Math.abs(remaining - 0.15) / 0.11;
                const gx = hx + Math.cos(blade) * tipLen * 0.8, gy = hy + Math.sin(blade) * tipLen * 0.8;
                Draw.glint(g2, gx, gy, 6 + 10 * U.clamp(k, 0, 1), rgb(255, 250, 220));
            }
        }
    }

    robeColor() {
        if (this.boss) return rgb(56, 20, 18);
        if (this.elite) return rgb(28, 22, 34);
        switch (this.type) {
            case 'RONIN': return rgb(96, 88, 78);
            case 'SPEAR': return rgb(62, 74, 56);
            default: return rgb(170, 52, 40);
        }
    }

    shoulderColor() {
        if (this.boss) return rgb(145, 45, 30);
        if (this.elite) return this.type === 'BRUTE' ? rgb(60, 20, 30) : rgb(90, 30, 110);
        switch (this.type) {
            case 'RONIN': return rgb(70, 70, 86);
            case 'SPEAR': return rgb(110, 44, 40);
            default: return rgb(60, 50, 44);
        }
    }

    hatColor() {
        if (this.boss) return rgb(22, 12, 12);
        if (this.elite) return this.type === 'BRUTE' ? rgb(120, 30, 30) : rgb(20, 16, 22);
        switch (this.type) {
            case 'RONIN': return rgb(150, 128, 88);
            case 'SPEAR': return rgb(38, 38, 40);
            default: return rgb(150, 44, 34);
        }
    }

    /** Overhead UI: bars, perilous kanji, deathblow marker. Drawn above canopies. */
    drawOverlay(g2, time, kanjiFont, canStealth) {
        if (this.st === 'DEAD') return;
        const x = this.x, y = this.y, r = this.r;
        if (this.st === 'BROKEN' || canStealth) {
            const pulse = 0.7 + 0.3 * Math.sin(time * 10);
            const rr = 7 * pulse + 3;
            g2.fillStyle = 'rgba(255,20,20,0.353)';
            fillCircle(g2, x, y, rr * 2);
            g2.fillStyle = 'rgb(230,20,20)';
            fillCircle(g2, x, y, rr * 0.6);
        }
        if (this.perilousT > 0 && this.atk !== null && this.atk.perilous) {
            const a = U.clamp(this.perilousT * 2, 0, 1);
            const ky = y - r - 34;
            g2.fillStyle = css(U.alpha(rgb(120, 0, 0), a * 0.8));
            fillCircle(g2, x, ky, 17);
            g2.fillStyle = css(U.alpha(rgb(255, 40, 30), a));
            g2.font = kanjiFont;
            g2.textAlign = 'center';
            g2.textBaseline = 'middle';
            g2.fillText('\u5371', x, ky + 1);
            g2.textAlign = 'left';
            g2.textBaseline = 'alphabetic';
        }
        if (this.showBars > 0 && !this.elite) {
            const w = 44, bx = x - w / 2, by = y - r - 16;
            g2.fillStyle = 'rgba(0,0,0,0.588)';
            g2.fillRect(bx - 1, by - 1, w + 2, 6);
            g2.fillStyle = 'rgb(200,40,40)';
            g2.fillRect(bx, by, w * U.clamp(this.hp / this.maxHp, 0, 1), 4);
            if (this.posture > 1) Draw.postureBar(g2, x, by + 7, w, 3, this.posture / this.maxPosture, this.st === 'BROKEN');
        }
    }
}
