'use strict';

const P_IGNORE = 0, P_DEFLECT = 1, P_BLOCK = 2, P_HIT = 3;
const PERFECT_WINDOW = 0.18, DODGE_TIME = 0.34, DODGE_IFRAMES = 0.25;
const P_COMBO = [
    new Attack('cut1', 0.08, 0.09, 0.20, 84, 150, 14, 12, 190),
    new Attack('cut2', 0.07, 0.09, 0.20, 84, 150, 14, 12, 190),
    new Attack('cut3', 0.15, 0.11, 0.34, 98, 230, 24, 22, 280),
];

// Player states: 'FREE' | 'ATTACK' | 'ART' | 'DRAGON' | 'DODGE' | 'STAGGER' | 'HEAL' | 'DEATHBLOW' | 'MIKIRI' | 'IAI' | 'DEAD'
class Player extends Actor {
    constructor(g, x, y) {
        super();
        this.g = g;
        this.x = x;
        this.y = y;
        this.r = 15;
        this.maxHp = this.hp = 100;
        this.maxPosture = 100;
        this.facing = -Math.PI / 2;
        this.st = 'FREE';
        this.stT = 0;
        this.speed = 245;
        this.vx = 0;
        this.vy = 0;
        // input snapshot
        this.moveX = 0;
        this.moveY = 0;
        this.aimX = 0;
        this.aimY = 0;
        this.guardHeld = false;
        this.bufAttack = 0;
        this.bufParry = 0;
        this.bufDodge = 0;
        this.bufHeal = 0;
        this.bufIai = 0;
        this.bufArt = 0;
        this.bufDragon = 0;
        // combat art
        this.curArt = null;
        this.curArtAtks = null;
        this.artIdx = 0;
        this.artAtk = null;
        this.artAtkEnd = 0;
        this.dragonAtk = null;
        this.dragonDone = false;
        // attack
        this.combo = -1;
        this.swingId = 0;
        this.phase = 0;
        this.swingSign = 1;
        this.cur = null;
        this.hitSet = new Set();
        this.comboGrace = 0;
        // guard / deflect
        this.guarding = false;
        this.guardStart = -99;
        this.guardWindow = PERFECT_WINDOW;
        this.spam = 0;
        this.deflectStreak = 0;
        this.deflectStreakT = 0;
        this.guardFlash = 0;
        // misc
        this.dodgeDx = 0;
        this.dodgeDy = 0;
        this.dodgeHeld = false;
        this.sprinting = false;
        this.invuln = 0;
        this.staggerDur = 0;
        this.hurtFlash = 0;
        this.postureCd = 0;
        this.walkAnim = 0;
        this.scarf = 0;
        this.baseMaxHp = 100;
        this.baseGourds = 3;
        this.gourds = 0;
        this.artCharges = 0;
        this.healed = false;
        this.ki = 0;
        this.lastStandUsed = false;
        this.dbTarget = null;
        this.dbDone = false;
        this.iaiSx = 0;
        this.iaiSy = 0;
        this.iaiDx = 0;
        this.iaiDy = 0;
        this.iaiDone = false;
        this.iaiLine = false;
        this.iaiVictims = [];
        this.deadT = 0;
        this.applyLoadout();
        this.hp = this.maxHp;
        this.gourds = this.maxGourds;
    }

    /** Recompute stats and attacks from the equipped gear and learned skills. */
    applyLoadout() {
        const lo = this.g.loadout, s = computeStats(lo, this.baseMaxHp, this.baseGourds, this.g.skills);
        this.maxHp = s.maxHp;
        this.hp = Math.min(this.hp, this.maxHp);
        this.maxPosture = s.maxPosture;
        this.maxGourds = s.gourds;
        this.gourds = Math.min(this.gourds, this.maxGourds);
        this.maxArtCharges = s.charges;
        this.artCharges = Math.min(this.artCharges, this.maxArtCharges);
        this.speed = 245 * s.move;
        this.perfectWindow = s.deflect;
        this.guardWindow = s.deflect;
        this.dmgTaken = s.def;
        this.stealth = s.stealth;
        this.deathblowHeal = s.deathblowHeal;
        this.deflectPost = s.deflectPost;
        this.deflectRecover = s.deflectRecover;
        this.dodgeIframes = s.iframes;
        this.dragonFlash = s.dragonFlash;
        this.lastStand = s.lastStand;
        this.dragonDamage = 58 * s.dmg * s.artDmg;
        this.comboAtk = P_COMBO.map((a, i) => {
            const b = scaledAttack(a, s);
            b.heavy = i === 2;
            return b;
        });
        this.art = lo.artDef();
        const artStats = Object.assign({}, s, { dmg: s.dmg * s.artDmg });
        this.artAtks = this.art.hits.map(h => scaledAttack(h.atk, artStats));
        this.sword = lo.swordDef();
    }

    sneaking() { return this.st === 'FREE' && this.guarding && Math.hypot(this.vx, this.vy) < 160; }

    /** Enemies hold off while a deathblow plays out. */
    untargetable() { return this.st === 'DEATHBLOW'; }

    invulnerable() {
        const st = this.st;
        const art = this.curArt;
        return this.invuln > 0 || st === 'DEATHBLOW' || st === 'MIKIRI' || st === 'IAI' || (st === 'DODGE' && this.stT < this.dodgeIframes)
            || (st === 'ART' && art.iframes !== undefined && this.stT >= art.iframes[0] && this.stT < art.iframes[1]);
    }

    readInput(inp, wx, wy) {
        let mx = 0, my = 0;
        if (inp.down('KeyW') || inp.down('ArrowUp')) my -= 1;
        if (inp.down('KeyS') || inp.down('ArrowDown')) my += 1;
        if (inp.down('KeyA') || inp.down('ArrowLeft')) mx -= 1;
        if (inp.down('KeyD') || inp.down('ArrowRight')) mx += 1;
        const l = Math.hypot(mx, my);
        this.moveX = l > 0 ? mx / l : 0;
        this.moveY = l > 0 ? my / l : 0;
        this.aimX = wx;
        this.aimY = wy;
        this.guardHeld = inp.mouseDown(3) || inp.down('KeyK');
        this.dodgeHeld = inp.down('Space') || inp.down('KeyL');
        if (inp.mouseHit(1) || inp.hit('KeyJ')) this.bufAttack = 0.22;
        if (inp.mouseHit(3) || inp.hit('KeyK')) this.bufParry = 0.15;
        if (inp.hit('Space') || inp.hit('KeyL')) this.bufDodge = 0.18;
        if (inp.hit('KeyQ')) this.bufHeal = 0.12;
        if (inp.hit('KeyF')) this.bufIai = 0.15;
        if (inp.hit('KeyR')) this.bufArt = 0.2;
        if (inp.hit('KeyG')) this.bufDragon = 0.15;
    }

    update(dt) {
        const g = this.g;
        this.stT += dt;
        this.bufAttack -= dt;
        this.bufParry -= dt;
        this.bufDodge -= dt;
        this.bufHeal -= dt;
        this.bufIai -= dt;
        this.bufArt -= dt;
        this.bufDragon -= dt;
        this.invuln -= dt;
        this.hurtFlash -= dt;
        this.guardFlash -= dt;
        this.comboGrace -= dt;
        this.postureCd -= dt;
        if ((this.deflectStreakT -= dt) <= 0) this.deflectStreak = 0;
        this.spam = Math.max(0, this.spam - dt * 2.2);
        this.ki = U.clamp(this.ki, 0, 100);
        if (this.st === 'DEAD') {
            this.deadT += dt;
            return;
        }
        if (this.postureCd <= 0 && this.st !== 'STAGGER') {
            const rate = (this.guarding ? 34 : 17) * (0.4 + 0.6 * this.hp / this.maxHp);
            this.posture = Math.max(0, this.posture - rate * dt);
        }
        const aimAng = Math.atan2(this.aimY - this.y, this.aimX - this.x);
        this.scarf += dt * (4 + Math.hypot(this.vx, this.vy) / 40);
        if (this.st !== 'FREE') this.sprinting = false;

        switch (this.st) {
            case 'FREE': this.free(dt, aimAng); break;
            case 'ATTACK': this.attack(dt, aimAng); break;
            case 'ART': this.artUpdate(dt, aimAng); break;
            case 'DRAGON': this.dragonUpdate(dt); break;
            case 'DODGE': {
                const t = this.stT / DODGE_TIME;
                const sp = 660 * Math.pow(Math.max(0, 1 - t), 1.4) + 40;
                this.vx = this.dodgeDx * sp;
                this.vy = this.dodgeDy * sp;
                this.move(g.world, this.vx * dt, this.vy * dt);
                if (this.stT > 0.2 && this.bufAttack > 0) {
                    this.bufAttack = 0;
                    this.beginAttackOrDeathblow(0);
                } else if (this.stT > 0.2 && this.bufParry > 0) {
                    this.bufParry = 0;
                    this.toFree();
                    this.startGuard();
                } else if (this.stT >= DODGE_TIME) this.toFree();
                break;
            }
            case 'MIKIRI':
                if (this.stT < 0.1) this.move(g.world, Math.cos(this.facing) * 200 * dt, Math.sin(this.facing) * 200 * dt);
                if (this.stT > 0.3 && this.bufAttack > 0) {
                    this.bufAttack = 0;
                    this.beginAttackOrDeathblow(0);
                } else if (this.stT >= 0.45) this.toFree();
                break;
            case 'STAGGER': {
                this.move(g.world, this.vx * dt, this.vy * dt);
                const k = Math.exp(-dt * 8);
                this.vx *= k;
                this.vy *= k;
                if (this.stT >= this.staggerDur) this.toFree();
                break;
            }
            case 'HEAL':
                this.facing = U.turn(this.facing, aimAng, dt * 10);
                this.vx = U.lerp(this.vx, this.moveX * this.speed * 0.35, 1 - Math.exp(-dt * 16));
                this.vy = U.lerp(this.vy, this.moveY * this.speed * 0.35, 1 - Math.exp(-dt * 16));
                this.move(g.world, this.vx * dt, this.vy * dt);
                if (this.stT >= 0.45 && !this.healed) {
                    this.healed = true;
                    this.gourds--;
                    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5);
                    g.fx.heal(this.x, this.y);
                    g.sfx.play('HEAL');
                }
                if (this.stT >= 0.75) this.toFree();
                break;
            case 'DEATHBLOW': {
                const e = this.dbTarget;
                this.facing = this.angleTo(e);
                const tx = e.x - Math.cos(this.facing) * (e.r + this.r + 6), ty = e.y - Math.sin(this.facing) * (e.r + this.r + 6);
                const k = 1 - Math.exp(-dt * 25);
                this.x += (tx - this.x) * k;
                this.y += (ty - this.y) * k;
                g.world.resolve(this);
                if (this.stT >= 0.13 && !this.dbDone) {
                    this.dbDone = true;
                    g.executeDeathblow(this, e);
                }
                if (this.stT >= 0.55) this.toFree();
                break;
            }
            case 'IAI': this.iai(dt); break;
        }
    }

    toFree() {
        this.st = 'FREE';
        this.stT = 0;
    }

    free(dt, aimAng) {
        const g = this.g;
        this.facing = U.turn(this.facing, aimAng, dt * 22);
        if (this.bufParry > 0) {
            this.bufParry = 0;
            this.startGuard();
        }
        this.guarding = this.guardHeld || (g.time - this.guardStart < this.guardWindow);
        // holding the dodge button while moving sprints; tapping it still rolls
        this.sprinting = this.dodgeHeld && !this.guarding && (this.moveX !== 0 || this.moveY !== 0);
        const sp = this.speed * (this.guarding ? 0.5 : this.sprinting ? 1.5 : 1);
        this.vx = U.lerp(this.vx, this.moveX * sp, 1 - Math.exp(-dt * 16));
        this.vy = U.lerp(this.vy, this.moveY * sp, 1 - Math.exp(-dt * 16));
        this.move(g.world, this.vx * dt, this.vy * dt);
        this.walkAnim += Math.hypot(this.vx, this.vy) * dt;
        if (this.sprinting && g.rnd.nextDouble() < dt * 12) {
            g.fx.dust(this.x - Math.cos(this.facing) * this.r * 0.6, this.y - Math.sin(this.facing) * this.r * 0.6, 1);
        }
        if (this.bufAttack > 0) {
            this.bufAttack = 0;
            // Sekiro-style: attack while holding block performs the combat art
            if (this.guardHeld && g.deathblowTarget() === null) this.tryArt(aimAng);
            else this.beginAttackOrDeathblow(this.comboGrace > 0 && this.combo >= 0 && this.combo < 2 ? this.combo + 1 : 0);
        } else if (this.bufArt > 0) {
            this.bufArt = 0;
            this.tryArt(aimAng);
        } else if (this.bufDodge > 0) {
            this.bufDodge = 0;
            this.startDodge();
        } else if (this.bufHeal > 0) {
            this.bufHeal = 0;
            if (this.gourds > 0 && this.hp < this.maxHp) {
                this.st = 'HEAL';
                this.stT = 0;
                this.healed = false;
                this.guarding = false;
            } else if (this.gourds <= 0) g.fx.text('Gourd empty', this.x, this.y - 40, rgb(200, 200, 200), 13);
        } else if (this.bufIai > 0) {
            this.bufIai = 0;
            if (this.ki >= 100) this.startIai(aimAng);
            else g.fx.text('Ki not full', this.x, this.y - 40, rgb(140, 180, 255), 13);
        } else if (this.bufDragon > 0) {
            this.bufDragon = 0;
            this.startDragon(aimAng);
        }
    }

    startGuard() {
        this.spam += 1;
        this.guardWindow = U.clamp(this.perfectWindow - Math.max(0, this.spam - 1.2) * 0.04, 0.05, this.perfectWindow);
        this.guardStart = this.g.time;
        this.guarding = true;
    }

    beginAttackOrDeathblow(idx) {
        const t = this.g.deathblowTarget();
        if (t !== null) this.startDeathblow(t);
        else this.startAttack(idx);
    }

    startAttack(i) {
        this.st = 'ATTACK';
        this.stT = 0;
        this.phase = 0;
        this.combo = i;
        this.swingId++;
        this.cur = this.comboAtk[i];
        this.hitSet.clear();
        this.swingSign = i === 1 ? -1 : 1;
        this.guarding = false;
        this.facing = U.turn(this.facing, Math.atan2(this.aimY - this.y, this.aimX - this.x), 1.2);
    }

    attack(dt, aimAng) {
        const g = this.g, cur = this.cur;
        if (this.phase === 0) this.facing = U.turn(this.facing, aimAng, dt * 14);
        if (this.phase <= 1) {
            const sp = this.phase === 0 ? cur.lunge * 0.35 : cur.lunge * (1 - this.stT / cur.active);
            if (!g.enemyInFront(this, this.facing, this.r + 26)) this.move(g.world, Math.cos(this.facing) * sp * dt, Math.sin(this.facing) * sp * dt);
        }
        if (this.phase === 0) {
            if (this.bufParry > 0) {
                this.bufParry = 0;
                this.toFree();
                this.startGuard();
            } else if (this.bufDodge > 0) {
                this.bufDodge = 0;
                this.startDodge();
            } else if (this.stT >= cur.windup) {
                this.phase = 1;
                this.stT = 0;
                g.sfx.play(this.combo === 2 ? 'HEAVY' : 'SLASH');
                const start = this.facing + this.swingSign * cur.arc / 2;
                g.fx.slash(this.x, this.y, cur.range * 0.82, start, -this.swingSign * cur.arc, 0.2, this.combo === 2 ? 9 : 6, rgb(180, 220, 255));
            }
        } else if (this.phase === 1) {
            g.playerHitCheck(this, cur);
            if (this.stT >= cur.active) {
                this.phase = 2;
                this.stT = 0;
            }
        } else {
            if (this.stT > 0.04 && this.bufArt > 0) {
                this.bufArt = 0;
                this.tryArt(aimAng);
            } else if (this.stT > 0.04 && this.bufAttack > 0 && this.combo < 2) {
                this.bufAttack = 0;
                this.beginAttackOrDeathblow(this.combo + 1);
            } else if (this.bufParry > 0) {
                this.bufParry = 0;
                this.toFree();
                this.startGuard();
                this.comboGrace = 0.45;
            } else if (this.bufDodge > 0) {
                this.bufDodge = 0;
                this.startDodge();
            } else if (this.stT >= cur.recovery) {
                this.toFree();
                this.comboGrace = 0.4;
            }
        }
    }

    tryArt(aimAng) {
        const g = this.g, a = this.art;
        if (this.artCharges < a.cost) {
            g.fx.text('Deflect attacks to charge ' + a.name, this.x, this.y - 40, rgb(255, 215, 110), 13);
            return;
        }
        this.artCharges -= a.cost;
        this.swingId++;
        this.curArt = a;
        this.curArtAtks = this.artAtks;
        this.st = 'ART';
        this.stT = 0;
        this.artIdx = 0;
        this.artAtk = null;
        this.guarding = false;
        this.facing = aimAng;
        g.fx.text(a.name, this.x, this.y - 50, a.color, 17);
        g.fx.ring(this.x, this.y, 8, 60, 0.3, 3, a.color);
        g.sfx.play('DODGE');
    }

    gainArtCharge() {
        if (this.artCharges >= this.maxArtCharges) return;
        this.artCharges++;
        if (this.artCharges === this.art.cost) {
            this.g.fx.text(this.art.name + ' ready', this.x, this.y - 64, this.art.color, 15);
            this.g.fx.ring(this.x, this.y, 10, 50, 0.35, 3, this.art.color);
        }
    }

    artUpdate(dt, aimAng) {
        const g = this.g, a = this.curArt, t = this.stT;
        if (t < a.hits[0].t) this.facing = U.turn(this.facing, aimAng, dt * 9);
        if (a.lunge && t >= a.lunge[0] && t < a.lunge[1] && !g.enemyInFront(this, this.facing, this.r + 20)) {
            this.move(g.world, Math.cos(this.facing) * a.lunge[2] * dt, Math.sin(this.facing) * a.lunge[2] * dt);
            if (a.trail) g.fx.wisp(this.x, this.y, a.color);
        }
        while (this.artIdx < a.hits.length && t >= a.hits[this.artIdx].t) {
            const h = a.hits[this.artIdx], atk = this.curArtAtks[this.artIdx];
            this.artIdx++;
            this.artAtk = atk;
            this.artAtkEnd = h.t + atk.active;
            this.hitSet.clear();
            g.sfx.play('HEAVY');
            const sweep = Math.min(atk.arc, TAU), f = this.facing;
            g.fx.slash(this.x, this.y, atk.range * 0.85, f + sweep / 2, -sweep, 0.25, 9, a.color);
            if (h.line) g.fx.line(this.x, this.y, this.x + Math.cos(f) * atk.range, this.y + Math.sin(f) * atk.range, 0.3, 4, a.color);
            if (a.recover) this.posture = Math.max(0, this.posture - a.recover);
            g.shake(5);
        }
        if (this.artAtk !== null) {
            if (t < this.artAtkEnd) g.playerHitCheck(this, this.artAtk);
            else this.artAtk = null;
        }
        if (t > a.hits[a.hits.length - 1].t + 0.14 && this.bufDodge > 0) {
            this.bufDodge = 0;
            this.artAtk = null;
            this.startDodge();
        } else if (t >= a.dur) this.toFree();
    }

    startDodge() {
        const g = this.g;
        let dx = this.moveX, dy = this.moveY;
        if (dx === 0 && dy === 0) {
            dx = Math.cos(this.facing);
            dy = Math.sin(this.facing);
        }
        this.dodgeDx = dx;
        this.dodgeDy = dy;
        this.st = 'DODGE';
        this.stT = 0;
        this.guarding = false;
        g.sfx.play('DODGE');
        g.fx.dust(this.x, this.y, 6);
        const m = g.mikiriCandidate(this, dx, dy);
        if (m !== null) {
            this.st = 'MIKIRI';
            this.stT = 0;
            this.facing = this.angleTo(m);
            g.onMikiri(this, m);
        }
    }

    startDeathblow(e) {
        this.st = 'DEATHBLOW';
        this.stT = 0;
        this.dbTarget = e;
        this.dbDone = false;
        e.beingExecuted = true;
        this.guarding = false;
        this.facing = this.angleTo(e);
    }

    startIai(ang) {
        const g = this.g;
        this.ki = 0;
        this.st = 'IAI';
        this.stT = 0;
        this.iaiSx = this.x;
        this.iaiSy = this.y;
        this.iaiDx = Math.cos(ang);
        this.iaiDy = Math.sin(ang);
        this.facing = ang;
        this.iaiVictims.length = 0;
        this.iaiDone = false;
        this.iaiLine = false;
        this.guarding = false;
        g.sfx.play('IAI');
        g.zoomKick(0.08);
        g.fx.ring(this.x, this.y, 10, 70, 0.3, 4, rgb(150, 200, 255));
    }

    startDragon(ang) {
        const g = this.g;
        if (!this.dragonFlash) {
            g.fx.text('Learn Dragon Flash in the Skill Tree', this.x, this.y - 40, rgb(150, 190, 255), 13);
            return;
        }
        if (this.ki < 100) {
            g.fx.text('Ki not full', this.x, this.y - 40, rgb(140, 180, 255), 13);
            return;
        }
        this.ki = 0;
        this.st = 'DRAGON';
        this.stT = 0;
        this.facing = ang;
        this.dragonDone = false;
        const a = new Attack('dragonflash', 0, 0.1, 0, 260, 42, this.dragonDamage, 70, 0);
        a.art = true;
        a.heavy = true;
        a.pierce = true;
        this.dragonAtk = a;
        this.hitSet.clear();
        this.guarding = false;
        g.sfx.play('IAI');
        g.zoomKick(0.1);
        g.fx.ring(this.x, this.y, 12, 95, 0.35, 4, rgb(170, 230, 255));
        g.fx.text('DRAGON FLASH', this.x, this.y - 54, rgb(180, 235, 255), 20);
    }

    dragonUpdate(dt) {
        const g = this.g;
        if (this.stT >= 0.2 && !this.dragonDone) {
            this.dragonDone = true;
            g.playerHitCheck(this, this.dragonAtk);
            const f = this.facing;
            g.fx.line(this.x, this.y, this.x + Math.cos(f) * this.dragonAtk.range, this.y + Math.sin(f) * this.dragonAtk.range,
                0.55, 6, rgb(170, 230, 255));
            g.fx.sparks(this.x + Math.cos(f) * 110, this.y + Math.sin(f) * 110, f, 0.4, 26, 640, rgb(185, 235, 255));
            g.hitstop(0.12);
            g.shake(12);
        }
        if (this.stT >= 0.62) this.toFree();
    }

    iai(dt) {
        const g = this.g;
        if (this.stT < 0.16) {
            this.move(g.world, this.iaiDx * 2100 * dt, this.iaiDy * 2100 * dt);
            g.fx.wisp(this.x, this.y, rgb(170, 210, 255));
            for (const e of g.enemies) {
                if (e.st === 'DEAD' || this.iaiVictims.includes(e)) continue;
                if (U.segDist(e.x, e.y, this.iaiSx, this.iaiSy, this.x, this.y) < e.r + 45) this.iaiVictims.push(e);
            }
        } else if (!this.iaiLine) {
            this.iaiLine = true;
            g.fx.line(this.iaiSx, this.iaiSy, this.x, this.y, 0.9, 5, rgb(150, 200, 255));
        }
        if (this.stT >= 0.5 && !this.iaiDone) {
            this.iaiDone = true;
            g.resolveIai(this, this.iaiVictims);
        }
        if (this.stT >= 0.7) this.toFree();
    }

    /** Called when an attack reaches the player. Returns P_IGNORE, P_DEFLECT, P_BLOCK or P_HIT. */
    receive(sx, sy, dmg, post, perilous) {
        const g = this.g;
        if (this.st === 'DEAD' || this.invulnerable()) return P_IGNORE;
        dmg *= this.dmgTaken;
        const ang = Math.atan2(sy - this.y, sx - this.x);
        const cx = this.x + Math.cos(ang) * (this.r + 12), cy = this.y + Math.sin(ang) * (this.r + 12);
        const front = Math.abs(U.angDiff(this.facing, ang)) < 105 * DEG;
        if (!perilous && this.st === 'FREE' && this.guarding && front) {
            if (g.time - this.guardStart <= this.guardWindow) {
                this.posture = Math.min(this.maxPosture - 1, this.posture + post * 0.12);
                this.spam = 0;
                this.deflectStreak++;
                this.deflectStreakT = 1.6;
                this.ki = Math.min(100, this.ki + 12);
                this.gainArtCharge();
                if (this.deflectRecover > 0) this.posture = Math.max(0, this.posture - this.deflectRecover);
                this.guardFlash = 0.25;
                const k = Math.min(this.deflectStreak, 6);
                g.fx.sparks(cx, cy, ang, 2.8, 36 + k * 8, 620 + k * 50, rgb(255, 200, 80));
                g.fx.sparks(cx, cy, ang + Math.PI / 2, 0.6, 8 + k, 460, WHITE);
                g.fx.sparks(cx, cy, ang - Math.PI / 2, 0.6, 8 + k, 460, WHITE);
                g.fx.ring(cx, cy, 4, 50 + k * 8, 0.25, 4, rgb(255, 240, 180));
                g.fx.ring(cx, cy, 2, 100 + k * 14, 0.4, 2, rgb(255, 255, 255));
                for (let i = 0; i < 7; i++) {
                    const a = ang + (i - 3) * 0.32 + (Math.random() - 0.5) * 0.15, l0 = 10, l1 = 44 + k * 7 + Math.random() * 16;
                    g.fx.line(cx + Math.cos(a) * l0, cy + Math.sin(a) * l0, cx + Math.cos(a) * l1, cy + Math.sin(a) * l1, 0.14, 2.5, rgb(255, 245, 210));
                }
                g.sfx.play('CLANG');
                g.sfx.play('PARRY');
                g.hitstop(0.1 + k * 0.012);
                g.shake(8 + k * 1.2);
                g.zoomKick(0.035 + k * 0.008);
                g.flash(rgb(255, 235, 180), 0.14 + k * 0.02);
                g.parryBurst(cx, cy, k);
                const s = this.deflectStreak > 1 ? 'DEFLECT x' + this.deflectStreak : 'DEFLECT';
                g.fx.text(s, this.x, this.y - 42, this.deflectStreak >= 4 ? rgb(255, 250, 200) : rgb(255, 215, 90), 16 + k * 3);
                return P_DEFLECT;
            }
            this.posture += post;
            this.postureCd = 1.0;
            this.move(g.world, -Math.cos(ang) * 10, -Math.sin(ang) * 10);
            g.fx.sparks(cx, cy, ang, 1.8, 10, 280, rgb(255, 150, 60));
            g.sfx.play('BLOCK');
            g.shake(3);
            g.hitstop(0.035);
            this.deflectStreak = 0;
            if (this.posture >= this.maxPosture) {
                this.posture = this.maxPosture * 0.6;
                this.hp -= dmg * 0.5;
                this.st = 'STAGGER';
                this.stT = 0;
                this.staggerDur = 1.2;
                this.guarding = false;
                this.vx = -Math.cos(ang) * 200;
                this.vy = -Math.sin(ang) * 200;
                g.fx.text('GUARD BROKEN', this.x, this.y - 42, rgb(255, 80, 60), 18);
                g.sfx.play('BREAK');
                g.shake(10);
                if (g.onGuardBreak) g.onGuardBreak(this);
                if (this.hp <= 0) this.die();
            }
            return P_BLOCK;
        }
        this.hp -= dmg;
        this.posture = Math.min(this.maxPosture, this.posture + post * 0.35);
        this.postureCd = 1.0;
        this.hurtFlash = 0.3;
        this.invuln = 0.35;
        this.guarding = false;
        this.deflectStreak = 0;
        this.st = 'STAGGER';
        this.stT = 0;
        this.staggerDur = perilous ? 0.55 : 0.3;
        this.vx = -Math.cos(ang) * (perilous ? 380 : 230);
        this.vy = -Math.sin(ang) * (perilous ? 380 : 230);
        g.fx.blood(this.x, this.y, ang + Math.PI, 12, 260);
        g.sfx.play('HURT');
        g.shake(perilous ? 14 : 9);
        g.hitstop(0.06);
        g.flash(rgb(200, 0, 0), 0.25);
        if (this.hp <= 0) this.die();
        return P_HIT;
    }

    /** An elite parried our swing. */
    recoil(awayAng) {
        this.st = 'STAGGER';
        this.stT = 0;
        this.staggerDur = 0.45;
        this.posture = Math.min(this.maxPosture - 1, this.posture + 15);
        this.postureCd = 1.0;
        this.vx = Math.cos(awayAng) * 260;
        this.vy = Math.sin(awayAng) * 260;
    }

    die() {
        if (this.lastStand && !this.lastStandUsed) {
            this.lastStandUsed = true;
            this.hp = 1;
            this.posture = 0;
            this.invuln = 1.2;
            this.st = 'STAGGER';
            this.stT = 0;
            this.staggerDur = 0.25;
            this.g.fx.text('IRON WILL', this.x, this.y - 54, rgb(180, 220, 255), 22);
            this.g.fx.ring(this.x, this.y, 8, 90, 0.6, 5, rgb(180, 220, 255));
            this.g.sfx.play('BREAK');
            return;
        }
        this.hp = 0;
        this.st = 'DEAD';
        this.stT = 0;
        this.deadT = 0;
        this.g.onPlayerDeath();
    }

    respawn(sx, sy) {
        this.x = sx;
        this.y = sy;
        this.hp = this.maxHp;
        this.posture = 0;
        this.gourds = this.maxGourds;
        this.artCharges = 0;
        this.st = 'FREE';
        this.stT = 0;
        this.vx = this.vy = 0;
        this.invuln = 1.5;
        this.ki = 0;
        this.lastStandUsed = false;
    }

    // ---------------- rendering ----------------
    draw(g2, time) {
        const x = this.x, y = this.y, r = this.r, facing = this.facing, st = this.st, lo = this.g.loadout;
        if (st === 'DEAD') {
            g2.save();
            g2.translate(x, y);
            g2.rotate(facing);
            g2.fillStyle = css(lo.color('robe'));
            fillEllipse(g2, -r * 1.3, -r * 0.8, r * 2.6, r * 1.6);
            g2.restore();
            return;
        }
        // sword pose
        let handRel = 0.9, blade = facing + 0.55, bodyFacing = facing;
        if (st === 'ATTACK') {
            const cur = this.cur, ss = this.swingSign;
            const a0 = ss * cur.arc / 2, a1 = -ss * cur.arc / 2;
            const rel = this.phase === 0 ? a0 + ss * 0.35 * (this.stT / cur.windup)
                : this.phase === 1 ? U.lerp(a0, a1, Math.min(1, this.stT / cur.active)) : a1;
            blade = facing + rel;
            handRel = rel * 0.6;
        } else if (st === 'ART') {
            const a = this.curArt, rel = a.blade(this.stT);
            blade = facing + rel;
            handRel = a.spin ? rel : rel * 0.6;
            if (a.spin) bodyFacing = facing + rel - 0.9;
        } else if (st === 'FREE' && this.guarding) {
            handRel = 0.15;
            blade = facing - 1.4;
        } else if (st === 'IAI' || st === 'MIKIRI' || st === 'DRAGON') {
            handRel = 0.3;
            blade = facing + (st === 'IAI' && this.stT > 0.16 ? 2.6 : st === 'DRAGON' ? 0.2 + this.stT * 4 : 0.1);
        } else if (st === 'DEATHBLOW') {
            handRel = 0;
            blade = facing + (this.stT < 0.13 ? 1.4 : -0.6);
        } else if (st === 'STAGGER') {
            blade = facing + 1.6;
        }

        Draw.shadow(g2, x, y, r);
        Draw.scarf(g2, x, y, r, bodyFacing, this.scarf, lo.color('scarf'));
        let robe = lo.color('robe'), shoulder = lo.armorDef().shoulder;
        if (this.hurtFlash > 0.15) {
            robe = WHITE;
            shoulder = WHITE;
        }
        const flicker = this.invuln > 0 && st === 'FREE' && Math.trunc(time * 20) % 2 === 0;
        if (flicker) robe = U.shade(robe, 1.8);
        if (st === 'DODGE' || (st === 'ART' && this.curArt.trail && this.invulnerable())) {
            g2.fillStyle = st === 'DODGE' ? 'rgba(160,190,255,0.235)' : css(U.alpha(this.curArt.color, 0.3));
            fillCircle(g2, x - this.vx * 0.03, y - this.vy * 0.03, r * 1.4);
        }
        Draw.body(g2, x, y, r, bodyFacing, robe, shoulder, lo.color('hat'), lo.look.hatStyle, this.walkAnim);

        const hx = x + Math.cos(facing + handRel) * r * 0.9, hy = y + Math.sin(facing + handRel) * r * 0.9;
        const sword = this.sword;
        Draw.katana(g2, hx, hy, blade, sword.len, this.guardFlash > 0 ? rgb(255, 230, 150) : sword.color);
        if (st === 'FREE' && this.guarding && this.g.time - this.guardStart <= this.guardWindow) {
            g2.fillStyle = 'rgba(255,240,200,0.353)';
            fillCircle(g2, hx, hy, 14);
        }
        if (st === 'ART' && this.curArt.charge) {
            const left = this.curArt.hits[0].t - this.stT;
            if (left > 0 && left < 0.3) Draw.glint(g2, hx, hy, 8 + (0.3 - left) * 40, rgb(255, 225, 225));
        }
    }
}
