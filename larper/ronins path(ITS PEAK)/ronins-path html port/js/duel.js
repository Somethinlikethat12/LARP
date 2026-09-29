'use strict';

/**
 * Online matches: a 1v1 duel or a free-for-all. Every peer runs the same deterministic simulation in lockstep with a
 * small, equal input delay, so nobody has a latency advantage. Clients send their inputs to the host, which relays them
 * to everyone else, and the host also sends periodic state snapshots that clients roll back to, correcting any
 * floating-point drift between browsers.
 * Every fighter uses identical stats: default gear, no skills, host-chosen health and gourds. Only cosmetics differ.
 */
const DUEL_START_X = 220;
const DUEL_SNAP_EVERY = 30;
const DUEL_HISTORY = 240;
const LAG_PAUSE_MS = 250, LAG_RESUME_MS = 170, LAG_SILENCE_MS = 1500, LAG_RESUME_HOLD_MS = 2000, RESUME_COUNTDOWN = 1.5;
// free-for-all drops a player who has gone completely silent instead of pausing everyone forever
const FFA_KICK_SILENCE_MS = 8000;
const IN_GUARD = 1, IN_SPRINT = 2, IN_ATTACK = 4, IN_PARRY = 8, IN_DODGE = 16, IN_HEAL = 32, IN_IAI = 64, IN_ART = 128,
    IN_DRAGON = 256, IN_READY = 512, IN_ATK_HELD = 1024;
const NEUTRAL_INPUT = [0, 0, 0, 0, 0];
const DUEL_PHASES = ['COUNTDOWN', 'FIGHT', 'KO', 'MATCH_OVER'];
const PLAYER_STATES = ['FREE', 'ATTACK', 'STAB', 'ART', 'DRAGON', 'DODGE', 'STAGGER', 'HEAL', 'DEATHBLOW', 'MIKIRI', 'IAI', 'DEAD'];
const PLAYER_SYNC = ['x', 'y', 'facing', 'st', 'stT', 'vx', 'vy', 'moveX', 'moveY', 'aimX', 'aimY', 'guardHeld', 'bufAttack', 'bufParry',
    'bufDodge', 'bufHeal', 'bufIai', 'bufArt', 'bufDragon', 'artIdx', 'artAtkEnd', 'dragonDone', 'combo', 'swingId', 'phase', 'swingSign',
    'comboGrace', 'guarding', 'guardStart', 'guardWindow', 'spam', 'deflectStreak', 'deflectStreakT', 'guardFlash', 'dodgeDx', 'dodgeDy',
    'dodgeHeld', 'sprinting', 'invuln', 'staggerDur', 'hurtFlash', 'postureCd', 'walkAnim', 'scarf', 'hp', 'posture', 'gourds',
    'artCharges', 'healed', 'ki', 'dbDone', 'iaiSx', 'iaiSy', 'iaiDx', 'iaiDy', 'iaiDone', 'iaiLine', 'deadT', 'beingExecuted', 'brokenT',
    'bufStab', 'atkPress', 'atkHeld', 'atkCharging', 'atkHoldT', 'stabHits', 'perilousT', 'gone'];
const YOU_COLOR = rgb(110, 190, 255), FOE_COLOR = rgb(255, 95, 80);
const FFA_COLORS = [rgb(255, 95, 80), rgb(120, 220, 120), rgb(255, 205, 80), rgb(205, 135, 255), rgb(90, 225, 215), rgb(255, 140, 200),
    rgb(255, 160, 70), rgb(225, 225, 225)];
const MAX_FFA_PLAYERS = 8;
const ARENA_SIZES = { small: 440, medium: 560, large: 760, huge: 960 };
const NOOP = () => {};
// stands in for fx / sfx while re-simulating frames after a correction, so effects don't play twice
const MUTED = new Proxy({}, { get: () => NOOP });

function inputDelayFor(pingMs) { return U.clamp(Math.ceil(pingMs / 2 / (DT * 1000)) + 2, 3, 10); }

function sanitizeInput(d) {
    if (!Array.isArray(d) || d.length !== 5) return NEUTRAL_INPUT;
    const n = v => (Number.isFinite(v) ? v : 0);
    return [Math.sign(n(d[0])), Math.sign(n(d[1])), Math.round(U.clamp(n(d[2]), -5000, 5000)), Math.round(U.clamp(n(d[3]), -5000, 5000)),
        n(d[4]) & 2047];
}

/** Host-chosen match rules, validated so a client can trust what it receives. */
function sanitizeSettings(s) {
    s = s && typeof s === 'object' ? s : {};
    const int = (v, lo, hi, def) => (Number.isInteger(v) ? U.clamp(v, lo, hi) : def);
    const ffa = s.mode === 'ffa';
    return {
        mode: ffa ? 'ffa' : 'duel',
        maxPlayers: ffa ? int(s.maxPlayers, 2, MAX_FFA_PLAYERS, MAX_FFA_PLAYERS) : 2,
        rounds: int(s.rounds, 1, 9, 2),
        gourds: int(s.gourds, 0, 5, 1),
        hp: int(s.hp, 25, 400, 100),
        arena: Object.prototype.hasOwnProperty.call(ARENA_SIZES, s.arena) ? s.arena : ffa ? 'large' : 'medium',
        stab: s.stab !== false,
    };
}

function describeSettings(s) {
    return (s.mode === 'ffa' ? 'Free-for-all, up to ' + s.maxPlayers + ' players' : '1v1 Duel') + '  -  first to ' + s.rounds
        + (s.rounds === 1 ? ' round' : ' rounds') + '  -  ' + s.hp + ' HP  -  ' + s.gourds + (s.gourds === 1 ? ' gourd' : ' gourds')
        + '  -  ' + s.arena + ' arena  -  stab ' + (s.stab ? 'on' : 'off');
}

/** Circular ring-out-proof arena centered on the origin. */
class Arena {
    constructor(r) { this.r = r; }

    resolve(a) {
        const d = Math.hypot(a.x, a.y), m = this.r - a.r;
        if (d > m) {
            a.x = a.x / d * m;
            a.y = a.y / d * m;
        }
    }
}

/** Stands in for Game from one fighter's point of view: every other fighter still in the match is an "enemy". */
class DuelSide {
    constructor(duel, idx, loadout) {
        this.duel = duel;
        this.idx = idx;
        this.loadout = loadout;
        this.skills = new Set();
        this.self = null;
    }

    get time() { return this.duel.time; }
    get world() { return this.duel.arena; }
    get fx() { return this.duel.fx; }
    get sfx() { return this.duel.sfx; }
    get rnd() { return this.duel.cosRnd; }
    get foes() { return this.duel.players.filter(p => p !== this.self && !p.gone); }
    // only used by the Iai dash to collect victims: a dodging foe slips through it
    get enemies() { return this.foes.filter(f => f.st !== 'DEAD' && !f.invulnerable()); }

    hitstop(s) { this.duel.hitstop(s); }
    slowmo(s) { this.duel.slowmo(s); }
    shake(a) { this.duel.shake(a); }
    zoomKick(z) { this.duel.zoomKick(z); }
    flash(c, a) { this.duel.flash(c, this.idx === this.duel.localIdx ? a : a * 0.4); }
    parryBurst(x, y, k) { this.duel.parryBurst(x, y, k); }

    deathblowTarget() { return this.duel.deathblowTarget(this.self); }

    enemyInFront(p, ang, dist) {
        return this.foes.some(f => f.st !== 'DEAD' && p.distTo(f) < dist + f.r && Math.abs(U.angDiff(ang, p.angleTo(f))) < 0.9);
    }

    playerHitCheck(p, atk) {
        for (const f of this.foes) this.duel.hitCheck(p, f, atk);
    }
    mikiriCandidate(p, dx, dy) { return this.duel.mikiriCandidate(p, dx, dy); }
    onMikiri(p, f) { this.duel.onMikiri(p, f); }
    executeDeathblow(p, e) { this.duel.executeDeathblow(p, e); }
    resolveIai(p, victims) { this.duel.resolveIai(p, victims); }
    onGuardBreak(p) { this.duel.breakPosture(p); }
    onPlayerDeath() { this.duel.onDeath(this.self); }
}

class Duel {
    constructor(canvas, link, localIdx, delay, looks, settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.link = link;
        this.localIdx = localIdx;
        this.isHost = localIdx === 0;
        this.delay = delay;
        this.settings = sanitizeSettings(settings);
        this.n = looks.length;
        this.ffa = this.settings.mode === 'ffa' || this.n > 2;
        this.roundsToWin = this.settings.rounds;
        this.realSfx = new Sfx();
        this.sfx = this.realSfx;
        this.input = new Input(canvas, () => this.realSfx.unlock());
        this.realFx = new Effects();
        this.fx = this.realFx;
        this.cosRnd = new Rng(Date.now());
        this.arena = new Arena(ARENA_SIZES[this.settings.arena]);
        this.muted = false;

        // ---- simulation state (identical on every peer) ----
        this.simFrame = 0;
        this.time = 0;
        this.hitstopT = 0;
        this.slowmoT = 0;
        this.timeScale = 1;
        this.phase = 'COUNTDOWN';
        this.phaseT = 0;
        this.round = 1;
        this.score = new Array(this.n).fill(0);
        this.ready = new Array(this.n).fill(false);
        this.lastKo = -1;
        this.sides = [];
        this.players = [];
        for (let i = 0; i < this.n; i++) {
            const lo = new Loadout();
            lo.apply({ look: looks[i] }, 0);
            const side = new DuelSide(this, i, lo);
            const p = new Player(side, 0, 0);
            p.baseGourds = this.settings.gourds;
            p.baseMaxHp = this.settings.hp;
            p.brokenT = 0;
            p.beingExecuted = false;
            p.gone = false;
            p.applyLoadout();
            side.self = p;
            this.sides.push(side);
            this.players.push(p);
        }
        this.player = this.players[localIdx];

        this.inputs = this.players.map(() => new Map());
        for (let f = 0; f < delay; f++) for (const m of this.inputs) m.set(f, NEUTRAL_INPUT);
        // frame from which a departed player's inputs are neutral and they are out of the match
        this.dropAt = new Array(this.n).fill(Infinity);
        this.lastIn = new Array(this.n).fill(delay - 1);
        this.relay = [];
        this.pendingSnaps = new Map();

        // ---- presentation / connection state (local only) ----
        this.realTime = 0;
        this.camX = 0;
        this.camY = 0;
        this.camZ = 1;
        this.shakeAmt = 0;
        this.zoomKickV = 0;
        this.flashA = 0;
        this.flashColor = WHITE;
        this.parryT = 0;
        this.parryX = 0;
        this.parryY = 0;
        this.parryK = 0;
        this.hpGhost = this.players.map(p => p.maxHp);
        this.vignette = null;
        this.redVignette = null;
        this.vigW = 0;
        this.vigH = 0;
        this.lagPaused = false;
        this.resumeT = 0;
        this.goodSince = 0;
        this.stallT = 0;
        this.leaveConfirmT = 0;
        this.lostMsg = null;

        link.on('in', (d, c) => this.onRemoteInput(d, c));
        link.on('ins', d => this.onRelayedInputs(d));
        link.on('snap', d => this.onSnap(d));
        link.on('lag', d => this.onLag(d));
        link.on('drop', d => this.onDrop(d));
        link.on('bye', (d, c) => this.onPeerLeft(c));
        if (this.isHost) link.onPeerClose = c => this.onPeerLeft(c);
        else link.onClose = () => this.onLost('Connection to the host was lost.');

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();
        this.resetRound();
    }

    // ================= loop =================
    run() {
        let last = performance.now(), acc = 0;
        const frame = now => {
            const el = Math.min(0.1, (now - last) / 1000);
            last = now;
            this.realTime += el;
            this.handleMeta(el);
            this.updateLag(now, el);
            if (this.lostMsg !== null || this.lagPaused || this.resumeT > 0) {
                acc = 0;
                this.stallT = 0;
                this.input.endTick();
            } else {
                acc = Math.min(acc + el, DT * 6);
                let stalled = false;
                while (acc >= DT) {
                    const f = this.simFrame;
                    if (!this.haveInputs(f)) {
                        stalled = true;
                        break;
                    }
                    const mine = this.sampleLocal();
                    this.inputs[this.localIdx].set(f + this.delay, mine);
                    if (this.isHost) this.relay.push([0, f + this.delay, mine]);
                    else this.link.send({ t: 'in', f: f + this.delay, d: mine });
                    this.simulate(f);
                    acc -= DT;
                }
                this.stallT = stalled ? this.stallT + el : 0;
            }
            if (this.isHost) this.flushRelay();
            this.updatePresentation(el);
            this.render();
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    handleMeta(el) {
        const inp = this.input;
        this.leaveConfirmT -= el;
        if (this.lostMsg !== null) {
            if (inp.hit('Enter') || inp.hit('Escape') || inp.mouseHit(1)) this.leave(false);
            return;
        }
        if (inp.hit('Escape')) {
            inp.keyHit.delete('Escape');
            if (this.leaveConfirmT > 0) this.leave(true);
            else this.leaveConfirmT = 3;
        }
    }

    leave(notify) {
        if (notify) this.link.send({ t: 'bye' });
        setTimeout(() => {
            this.link.close();
            location.replace(location.href.split(/[?#]/)[0]);
        }, notify ? 200 : 0);
    }

    // ================= networking =================
    sampleLocal() {
        const inp = this.input, z = this.zoom();
        const wx = (inp.mx - this.canvas.width / 2) / z + this.camX, wy = (inp.my - this.canvas.height / 2) / z + this.camY;
        let mx = 0, my = 0, b = 0;
        if (inp.down('KeyW') || inp.down('ArrowUp')) my -= 1;
        if (inp.down('KeyS') || inp.down('ArrowDown')) my += 1;
        if (inp.down('KeyA') || inp.down('ArrowLeft')) mx -= 1;
        if (inp.down('KeyD') || inp.down('ArrowRight')) mx += 1;
        if (inp.mouseDown(3) || inp.down('KeyK')) b |= IN_GUARD;
        if (inp.down('Space') || inp.down('KeyL')) b |= IN_SPRINT;
        if (inp.mouseHit(1) || inp.hit('KeyJ')) b |= IN_ATTACK;
        if (inp.mouseDown(1) || inp.down('KeyJ')) b |= IN_ATK_HELD;
        if (inp.mouseHit(3) || inp.hit('KeyK')) b |= IN_PARRY;
        if (inp.hit('Space') || inp.hit('KeyL')) b |= IN_DODGE;
        if (inp.hit('KeyQ')) b |= IN_HEAL;
        if (inp.hit('KeyF')) b |= IN_IAI;
        if (inp.hit('KeyR')) b |= IN_ART;
        if (inp.hit('KeyG')) b |= IN_DRAGON;
        if (inp.hit('Enter') || inp.hit('NumpadEnter')) b |= IN_READY;
        inp.endTick();
        return sanitizeInput([mx, my, wx, wy, b]);
    }

    /** Host: a client's input. Store it and queue it for relay to the other clients. */
    onRemoteInput(d, c) {
        if (!this.isHost || !c) return;
        const i = c.idx;
        if (!Number.isInteger(i) || i <= 0 || i >= this.n || this.dropAt[i] !== Infinity) return;
        if (!Number.isInteger(d.f) || d.f < this.simFrame || d.f > this.simFrame + 600) return;
        const m = this.inputs[i];
        if (m.has(d.f)) return;
        const v = sanitizeInput(d.d);
        m.set(d.f, v);
        this.lastIn[i] = Math.max(this.lastIn[i], d.f);
        this.relay.push([i, d.f, v]);
    }

    /** Client: a batch of everyone else's inputs, relayed by the host. */
    onRelayedInputs(d) {
        if (this.isHost || !Array.isArray(d.a) || d.a.length > 4000) return;
        for (const e of d.a) {
            if (!Array.isArray(e) || e.length !== 3) continue;
            const i = e[0], f = e[1];
            if (!Number.isInteger(i) || i < 0 || i >= this.n || i === this.localIdx) continue;
            if (!Number.isInteger(f) || f < this.simFrame || f > this.simFrame + 600) continue;
            if (!this.inputs[i].has(f)) this.inputs[i].set(f, sanitizeInput(e[2]));
        }
    }

    flushRelay() {
        if (this.relay.length === 0) return;
        for (const c of this.link.conns) {
            const a = this.relay.filter(e => e[0] !== c.idx);
            if (a.length > 0) c.send({ t: 'ins', a });
        }
        this.relay.length = 0;
    }

    haveInputs(f) {
        for (let i = 0; i < this.n; i++) {
            if (i !== this.localIdx && this.dropAt[i] > f && !this.inputs[i].has(f)) return false;
        }
        return true;
    }

    inputFor(i, f) { return this.dropAt[i] <= f ? NEUTRAL_INPUT : this.inputs[i].get(f); }

    /** Someone left. The host picks the first frame they have no input for and tells everyone to drop them there. */
    onPeerLeft(c) {
        if (!this.isHost) {
            this.onLost(this.ffa ? 'The host ended the match.' : 'Your opponent left the duel.');
            return;
        }
        const i = c ? c.idx : -1;
        this.link.drop(c);
        if (!Number.isInteger(i) || i <= 0 || i >= this.n || this.dropAt[i] !== Infinity) return;
        // anything already relayed must reach the others before the drop notice
        this.flushRelay();
        const f = Math.max(this.lastIn[i] + 1, this.simFrame);
        this.dropAt[i] = f;
        this.link.send({ t: 'drop', i, f });
        this.checkAlone();
    }

    onDrop(d) {
        if (this.isHost) return;
        const i = d.i, f = d.f;
        if (!Number.isInteger(i) || i <= 0 || i >= this.n || i === this.localIdx || !Number.isInteger(f) || f < 0) return;
        this.dropAt[i] = Math.min(this.dropAt[i], f);
        this.checkAlone();
    }

    checkAlone() {
        if (this.dropAt.filter(f => f === Infinity).length < 2) {
            this.onLost(this.ffa ? 'Everyone else left the match.' : 'Your opponent left the duel.');
        }
    }

    onSnap(d) {
        if (this.isHost || !Number.isInteger(d.f) || d.f < 0) return;
        if (d.f + 1 <= this.simFrame) this.correct(d.f, d.s);
        else if (this.pendingSnaps.size < 32) this.pendingSnaps.set(d.f, d.s);
    }

    /** Adopt the host's state for frame f, then quietly re-simulate forward to where we were. */
    correct(f, s) {
        const target = this.simFrame;
        for (let i = f + 1; i < target; i++) if (!this.haveInputs(i)) return;
        if (!this.deserialize(s)) return;
        this.simFrame = f + 1;
        this.muted = true;
        this.fx = MUTED;
        this.sfx = MUTED;
        try {
            while (this.simFrame < target) this.simulate(this.simFrame);
        } finally {
            this.muted = false;
            this.fx = this.realFx;
            this.sfx = this.realSfx;
        }
    }

    onLag(d) {
        if (this.isHost) return;
        const on = !!d.on;
        if (this.lagPaused && !on) this.resumeT = RESUME_COUNTDOWN;
        this.lagPaused = on;
    }

    /** The host decides when the connection is too poor to play and pauses both sides until it recovers. */
    updateLag(now, el) {
        if (this.resumeT > 0) this.resumeT -= el;
        if (!this.isHost || this.lostMsg !== null) return;
        if (this.ffa) {
            for (const c of this.link.conns) if (now - c.lastHeard > FFA_KICK_SILENCE_MS) this.onPeerLeft(c);
            if (this.lostMsg !== null) return;
        }
        const ping = this.link.ping(), silent = this.link.silence(now);
        if (!this.lagPaused) {
            if (ping > LAG_PAUSE_MS || silent > LAG_SILENCE_MS) {
                this.lagPaused = true;
                this.goodSince = 0;
                this.link.send({ t: 'lag', on: true });
            }
        } else if (ping < LAG_RESUME_MS && silent < 600) {
            if (this.goodSince === 0) this.goodSince = now;
            else if (now - this.goodSince > LAG_RESUME_HOLD_MS) {
                this.lagPaused = false;
                this.resumeT = RESUME_COUNTDOWN;
                this.link.send({ t: 'lag', on: false });
            }
        } else this.goodSince = 0;
    }

    onLost(msg) {
        if (this.lostMsg === null) this.lostMsg = msg;
        this.lagPaused = false;
    }

    // ================= simulation =================
    simulate(f) {
        for (let i = 0; i < this.n; i++) {
            if (this.dropAt[i] <= f && !this.players[i].gone) this.removePlayer(i);
            this.applyInput(i, this.inputFor(i, f));
        }
        this.step(DT);
        this.simFrame = f + 1;
        if (this.isHost) {
            if (this.simFrame % DUEL_SNAP_EVERY === 0) this.link.send({ t: 'snap', f, s: this.serialize() });
        } else if (this.pendingSnaps.has(f)) {
            const s = this.pendingSnaps.get(f);
            this.pendingSnaps.delete(f);
            if (this.deserialize(s)) this.simFrame = f + 1;
        }
        for (const m of this.inputs) m.delete(f - DUEL_HISTORY);
    }

    removePlayer(i) {
        const p = this.players[i];
        if (p.st !== 'DEAD') this.fx.text('LEFT THE MATCH', p.x, p.y - 44, rgb(200, 190, 175), 15);
        if (p.st === 'DEATHBLOW' && p.dbTarget !== null) p.dbTarget.beingExecuted = false;
        p.dbTarget = null;
        p.gone = true;
        p.hp = 0;
        p.st = 'DEAD';
        p.stT = 0;
        p.beingExecuted = false;
        p.brokenT = 0;
        this.ready[i] = false;
    }

    applyInput(i, d) {
        const p = this.players[i];
        if (p.gone) return;
        if (this.phase === 'COUNTDOWN' || this.phase === 'MATCH_OVER') {
            if (this.phase === 'MATCH_OVER' && (d[4] & IN_READY)) this.ready[i] = !this.ready[i];
            p.moveX = p.moveY = 0;
            p.guardHeld = p.dodgeHeld = p.atkHeld = false;
            p.aimX = 0;
            p.aimY = 0;
            return;
        }
        const l = Math.hypot(d[0], d[1]);
        p.moveX = l > 0 ? d[0] / l : 0;
        p.moveY = l > 0 ? d[1] / l : 0;
        p.aimX = d[2];
        p.aimY = d[3];
        const b = d[4];
        p.guardHeld = (b & IN_GUARD) !== 0;
        p.dodgeHeld = (b & IN_SPRINT) !== 0;
        // with stabbing disabled a held button never charges, so every press is a normal slash
        p.atkHeld = this.settings.stab && (b & IN_ATK_HELD) !== 0;
        if (b & IN_ATTACK) p.atkPress = true;
        if (b & IN_PARRY) p.bufParry = 0.15;
        if (b & IN_DODGE) p.bufDodge = 0.18;
        if (b & IN_HEAL) p.bufHeal = 0.12;
        if (b & IN_IAI) p.bufIai = 0.15;
        if (b & IN_ART) p.bufArt = 0.2;
        if (b & IN_DRAGON) p.bufDragon = 0.15;
    }

    step(dt) {
        if (this.hitstopT > 0) {
            this.hitstopT -= dt;
            return;
        }
        if (this.slowmoT > 0) {
            this.slowmoT -= dt;
            this.timeScale = 0.3;
        } else this.timeScale = U.lerp(this.timeScale, 1, 1 - Math.exp(-dt * 8));
        const sdt = dt * this.timeScale;
        this.time += sdt;
        this.phaseT += dt;
        if (this.phase === 'COUNTDOWN' && this.phaseT >= 3) {
            this.phase = 'FIGHT';
            this.phaseT = 0;
            this.sfx.play('CLANG');
        } else if (this.phase === 'KO' && this.phaseT >= 2.6) {
            if (this.matchWinner() >= 0) {
                this.phase = 'MATCH_OVER';
                this.phaseT = 0;
                this.ready.fill(false);
            } else {
                this.round++;
                this.resetRound();
                return;
            }
        } else if (this.phase === 'MATCH_OVER' && this.players.every((p, i) => p.gone || this.ready[i])) {
            this.resetMatch();
            return;
        }

        const active = this.players.filter(p => !p.gone);
        for (const p of active) {
            // a fighter being executed is held in place until the blow lands
            if (p.beingExecuted && p.st !== 'DEAD') {
                p.st = 'STAGGER';
                p.staggerDur = p.stT + 1;
                p.vx = p.vy = 0;
            }
        }
        for (const p of active) p.update(sdt);
        for (const p of active) {
            if (p.brokenT > 0 && (p.st !== 'STAGGER' || (p.brokenT -= sdt) <= 0)) {
                p.brokenT = 0;
                if (p.st !== 'DEAD') p.posture = p.maxPosture * 0.5;
            }
        }
        this.separate();
        const alive = active.filter(p => p.st !== 'DEAD');
        if (this.phase === 'FIGHT' && alive.length <= 1) {
            this.phase = 'KO';
            this.phaseT = 0;
            if (alive.length === 0) this.lastKo = -1;
            else {
                this.lastKo = this.players.indexOf(alive[0]);
                this.score[this.lastKo]++;
            }
            this.slowmo(0.9);
        }
        this.fx.update(sdt);
    }

    /** Index of whoever has won the match, or -1. */
    matchWinner() { return this.score.findIndex(s => s >= this.roundsToWin); }

    spawnRadius() { return this.n === 2 ? DUEL_START_X : this.arena.r * 0.6; }

    spawnAngle(i) { return Math.PI + i * TAU / this.n; }

    resetRound() {
        const sr = this.spawnRadius();
        for (let i = 0; i < this.n; i++) {
            const p = this.players[i], a = this.spawnAngle(i);
            if (p.gone) continue;
            p.respawn(Math.cos(a) * sr, Math.sin(a) * sr);
            p.invuln = 0;
            p.facing = a + Math.PI;
            p.aimX = 0;
            p.aimY = 0;
            p.moveX = p.moveY = 0;
            p.guardHeld = p.dodgeHeld = p.guarding = p.sprinting = false;
            p.bufAttack = p.bufParry = p.bufDodge = p.bufHeal = p.bufIai = p.bufArt = p.bufDragon = p.bufStab = 0;
            p.atkPress = p.atkHeld = p.atkCharging = false;
            p.atkHoldT = 0;
            p.stabHits = 0;
            p.perilousT = 0;
            p.brokenT = 0;
            p.beingExecuted = false;
            p.dbTarget = null;
            p.combo = -1;
            p.cur = null;
            p.artAtk = null;
            p.hitSet.clear();
            p.iaiVictims.length = 0;
            p.deflectStreak = 0;
            p.deflectStreakT = 0;
            p.spam = 0;
            p.hurtFlash = 0;
            p.postureCd = 0;
            p.comboGrace = 0;
            p.guardStart = -99;
            p.deadT = 0;
        }
        this.phase = 'COUNTDOWN';
        this.phaseT = 0;
        this.hitstopT = 0;
        this.slowmoT = 0;
        this.timeScale = 1;
    }

    resetMatch() {
        this.score.fill(0);
        this.ready.fill(false);
        this.round = 1;
        this.lastKo = -1;
        this.resetRound();
    }

    separate() {
        const through = p => p.gone || p.st === 'DEAD' || p.st === 'IAI' || p.st === 'DEATHBLOW' || p.st === 'DODGE';
        const ps = this.players;
        for (let i = 0; i < ps.length; i++) {
            const a = ps[i];
            if (through(a)) continue;
            for (let j = i + 1; j < ps.length; j++) {
                const b = ps[j];
                if (through(b)) continue;
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
                if (d < min && d > 0.01) {
                    const push = (min - d) / 2;
                    a.x -= dx / d * push;
                    a.y -= dy / d * push;
                    b.x += dx / d * push;
                    b.y += dy / d * push;
                    this.arena.resolve(a);
                    this.arena.resolve(b);
                }
            }
        }
    }

    // ================= combat =================
    hitstop(s) { this.hitstopT = Math.max(this.hitstopT, s); }

    slowmo(s) { this.slowmoT = Math.max(this.slowmoT, s); }

    shake(a) { if (!this.muted) this.shakeAmt = Math.max(this.shakeAmt, a); }

    zoomKick(z) { if (!this.muted) this.zoomKickV = Math.max(this.zoomKickV, z); }

    flash(c, a) {
        if (this.muted) return;
        this.flashColor = c;
        this.flashA = Math.max(this.flashA, a);
    }

    parryBurst(x, y, k) {
        if (this.muted) return;
        this.parryT = 0.2;
        this.parryX = x;
        this.parryY = y;
        this.parryK = k;
    }

    zoom() { return this.camZ * (1 + this.zoomKickV); }

    /** Nearest posture-broken foe within deathblow reach. */
    deathblowTarget(p) {
        let best = null, bd = Infinity;
        for (const f of this.players) {
            if (f === p || f.gone || f.brokenT <= 0 || f.st === 'DEAD' || f.beingExecuted) continue;
            const d = p.distTo(f);
            if (d < 105 + f.r && d < bd) {
                bd = d;
                best = f;
            }
        }
        return best;
    }

    /** A foe whose stab this dodge steps into: dodging toward a perilous thrust at the right moment counters it. */
    mikiriCandidate(p, dx, dy) {
        for (const f of this.players) {
            if (f === p || f.gone || f.st !== 'STAB' || f.cur === null) continue;
            const cur = f.cur;
            if (!((f.phase === 0 && cur.windup - f.stT < 0.32) || f.phase === 1)) continue;
            if (p.distTo(f) > cur.range + 80) continue;
            // must be standing in the thrust's path
            if (Math.abs(U.angDiff(f.facing, f.angleTo(p))) > 0.8) continue;
            const a = p.angleTo(f);
            if (dx * Math.cos(a) + dy * Math.sin(a) > 0.5) return f;
        }
        return null;
    }

    onMikiri(p, f) {
        const fx = this.fx, a = p.angleTo(f);
        const cx = (p.x + f.x) / 2, cy = (p.y + f.y) / 2;
        f.posture = Math.min(f.maxPosture, f.posture + f.maxPosture * 0.5);
        f.postureCd = 1.0;
        f.perilousT = 0;
        f.guarding = false;
        f.atkCharging = false;
        f.st = 'STAGGER';
        f.stT = 0;
        f.staggerDur = 1.1;
        f.vx = Math.cos(a) * 260;
        f.vy = Math.sin(a) * 260;
        p.ki = Math.min(100, p.ki + 25);
        p.gainArtCharge();
        fx.sparks(cx, cy, a + Math.PI, 3.0, 40, 600, rgb(140, 220, 255));
        fx.ring(cx, cy, 5, 90, 0.4, 5, rgb(180, 230, 255));
        fx.dust(p.x, p.y, 12);
        fx.text('MIKIRI COUNTER', p.x, p.y - 48, rgb(140, 220, 255), 20);
        this.sfx.play('CLANG');
        this.sfx.play('BLOCK');
        this.hitstop(0.12);
        this.shake(11);
        this.slowmo(0.35);
        this.flash(rgb(180, 230, 255), p === this.player ? 0.2 : 0.08);
        if (f.posture >= f.maxPosture) this.breakPosture(f);
    }

    hitCheck(p, foe, atk) {
        if (foe.gone || foe.st === 'DEAD' || p.hitSet.has(foe)) return;
        const d = p.distTo(foe);
        if (d > atk.range + foe.r) return;
        const tol = atk.arc / 2 + Math.asin(Math.min(1, foe.r / Math.max(d, 1)));
        if (Math.abs(U.angDiff(p.facing, p.angleTo(foe))) > tol) return;
        // piercing attacks (Stab, Mortal Draw, Dragon Flash) cannot be guarded, like perilous enemy attacks
        const res = foe.receive(p.x, p.y, atk.damage, atk.posture, !!atk.pierce);
        if (res === P_IGNORE) return;
        p.hitSet.add(foe);
        if (res === P_DEFLECT) this.onDeflected(p, foe, atk);
        else if (res === P_HIT) {
            p.ki = Math.min(100, p.ki + 4);
            this.fx.text(String(Math.trunc(atk.damage * foe.dmgTaken)), foe.x, foe.y - 30, WHITE, 13);
            if (foe.st !== 'DEAD' && foe.posture >= foe.maxPosture) this.breakPosture(foe);
        }
    }

    /** The defender deflected: the attacker's posture takes the punishment, and heavy swings leave an opening. */
    onDeflected(att, def, atk) {
        const chain = 1 + 0.08 * Math.min(def.deflectStreak - 1, 5);
        att.posture += (atk.posture * 1.3 + 6) * chain;
        att.postureCd = 1.0;
        const away = def.angleTo(att);
        att.move(this.arena, Math.cos(away) * 12, Math.sin(away) * 12);
        if (att.posture >= att.maxPosture) this.breakPosture(att);
        else if (atk.heavy) {
            att.recoil(away);
            this.fx.text('OPENING', att.x, att.y - 40, rgb(255, 235, 170), 15);
        }
    }

    breakPosture(p) {
        if (p.st === 'DEAD') return;
        p.posture = p.maxPosture;
        p.brokenT = 1.3;
        p.st = 'STAGGER';
        p.stT = 0;
        p.staggerDur = 1.3;
        p.guarding = false;
        p.vx *= 0.3;
        p.vy *= 0.3;
        this.sfx.play('BREAK');
        this.hitstop(0.1);
        this.slowmo(0.3);
        this.shake(8);
        this.fx.ring(p.x, p.y, 10, 100, 0.5, 5, rgb(255, 60, 40));
        this.fx.sparks(p.x, p.y, 0, TAU, 24, 380, rgb(255, 120, 60));
        this.fx.text('POSTURE BROKEN', p.x, p.y - 44, rgb(255, 90, 60), 16);
    }

    executeDeathblow(p, e) {
        e.beingExecuted = false;
        if (e.st === 'DEAD') return;
        const fx = this.fx, a = p.angleTo(e);
        fx.blood(e.x, e.y, a, 45, 480);
        fx.sparks(e.x, e.y, a, 1.0, 20, 650, WHITE);
        fx.line(e.x - Math.cos(a + 0.8) * 70, e.y - Math.sin(a + 0.8) * 70, e.x + Math.cos(a + 0.8) * 70, e.y + Math.sin(a + 0.8) * 70, 0.5, 5,
            rgb(255, 80, 80));
        fx.line(e.x - Math.cos(a - 0.8) * 60, e.y - Math.sin(a - 0.8) * 60, e.x + Math.cos(a - 0.8) * 60, e.y + Math.sin(a - 0.8) * 60, 0.6, 4,
            rgb(255, 220, 220));
        fx.ring(e.x, e.y, 10, 130, 0.6, 6, rgb(255, 50, 40));
        fx.text('DEATHBLOW', e.x, e.y - 50, rgb(255, 70, 60), 22);
        this.sfx.play('DEATHBLOW');
        this.hitstop(0.16);
        this.shake(14);
        this.slowmo(0.45);
        this.zoomKick(0.12);
        this.flash(rgb(255, 200, 200), 0.3);
        e.brokenT = 0;
        e.hp = 0;
        e.die();
    }

    resolveIai(p, victims) {
        this.sfx.play('DEATHBLOW');
        this.flash(rgb(200, 230, 255), 0.25);
        if (victims.length === 0) return;
        this.hitstop(0.12);
        this.shake(12);
        for (const e of victims) {
            if (e.st === 'DEAD') continue;
            const a = p.angleTo(e) + Math.PI / 2;
            this.fx.line(e.x - Math.cos(a) * 55, e.y - Math.sin(a) * 55, e.x + Math.cos(a) * 55, e.y + Math.sin(a) * 55, 0.6, 4,
                rgb(170, 210, 255));
            this.fx.sparks(e.x, e.y, a, 1.0, 14, 500, rgb(170, 210, 255));
            this.fx.blood(e.x, e.y, a, 14, 300);
            const dmg = 45 * e.dmgTaken;
            this.fx.text(String(Math.trunc(dmg)), e.x, e.y - 30, rgb(255, 230, 120), 15);
            e.hp -= dmg;
            e.posture = Math.min(e.maxPosture, e.posture + 70);
            e.postureCd = 1.0;
            e.hurtFlash = 0.3;
            if (e.hp <= 0) {
                e.die();
                continue;
            }
            // a stab endures the first blow
            const endured = e.st === 'STAB' && e.phase < 2 && ++e.stabHits < 2;
            if (!endured) {
                e.guarding = false;
                e.st = 'STAGGER';
                e.stT = 0;
                e.staggerDur = 0.45;
            }
            if (e.posture >= e.maxPosture) this.breakPosture(e);
        }
    }

    onDeath(p) {
        this.sfx.play('BREAK');
        this.shake(12);
        this.fx.ring(p.x, p.y, 10, 140, 0.8, 5, rgb(255, 60, 50));
    }

    // ================= snapshots =================
    serialize() {
        return {
            t: this.time, h: this.hitstopT, s: this.slowmoT, ts: this.timeScale, ph: this.phase, pt: this.phaseT, r: this.round,
            sc: this.score.slice(), rd: this.ready.slice(), k: this.lastKo, p: this.players.map(p => this.packPlayer(p)),
        };
    }

    packPlayer(p) {
        const a = PLAYER_SYNC.map(k => p[k]), idx = q => this.players.indexOf(q);
        a.push(p.artAtk !== null, [...p.hitSet].map(idx), p.dbTarget === null ? -1 : idx(p.dbTarget), p.iaiVictims.map(idx));
        return a;
    }

    deserialize(s) {
        const num = v => typeof v === 'number' && Number.isFinite(v);
        if (!s || typeof s !== 'object' || !Array.isArray(s.p) || s.p.length !== this.n || !DUEL_PHASES.includes(s.ph)) return false;
        if (![s.t, s.h, s.s, s.ts, s.pt, s.r, s.k].every(num) || !Array.isArray(s.sc) || !Array.isArray(s.rd)) return false;
        for (const a of s.p) if (!Array.isArray(a) || a.length !== PLAYER_SYNC.length + 4) return false;
        this.time = s.t;
        this.hitstopT = s.h;
        this.slowmoT = s.s;
        this.timeScale = s.ts;
        this.phase = s.ph;
        this.phaseT = s.pt;
        this.round = s.r;
        this.lastKo = Number.isInteger(s.k) && s.k >= -1 && s.k < this.n ? s.k : -1;
        for (let i = 0; i < this.n; i++) {
            this.score[i] = num(s.sc[i]) ? s.sc[i] : this.score[i];
            this.ready[i] = !!s.rd[i];
            this.unpackPlayer(this.players[i], s.p[i]);
        }
        return true;
    }

    unpackPlayer(p, a) {
        const n = PLAYER_SYNC.length;
        for (let i = 0; i < n; i++) {
            const k = PLAYER_SYNC[i], v = a[i];
            if (typeof v !== typeof p[k] || (typeof v === 'number' && !Number.isFinite(v))) continue;
            if (k === 'st' && !PLAYER_STATES.includes(v)) continue;
            p[k] = v;
        }
        const ref = v => (Number.isInteger(v) && v >= 0 && v < this.n && this.players[v] !== p ? this.players[v] : null);
        const refs = v => (Array.isArray(v) ? v.slice(0, this.n).map(ref).filter(q => q !== null) : []);
        p.cur = p.st === 'STAB' ? p.stabAtk : p.combo >= 0 && p.combo < p.comboAtk.length ? p.comboAtk[p.combo] : null;
        p.curArt = p.art;
        p.curArtAtks = p.artAtks;
        p.artAtk = a[n] && p.artIdx > 0 ? p.artAtks[p.artIdx - 1] || null : null;
        p.hitSet.clear();
        for (const q of refs(a[n + 1])) p.hitSet.add(q);
        p.dbTarget = ref(a[n + 2]);
        p.iaiVictims = refs(a[n + 3]);
        if ((p.st === 'ATTACK' && p.cur === null) || (p.st === 'DEATHBLOW' && p.dbTarget === null) || p.st === 'DRAGON') p.toFree();
    }

    // ================= presentation =================
    colorOf(p) {
        if (p === this.player) return YOU_COLOR;
        return this.ffa ? FFA_COLORS[this.players.indexOf(p) % FFA_COLORS.length] : FOE_COLOR;
    }

    nameOf(i) { return i === this.localIdx ? 'You' : this.ffa ? 'P' + (i + 1) : 'Opponent'; }

    /** The duel opponent (1v1 mode only). */
    get foe() { return this.players[1 - this.localIdx]; }

    /** Who the camera keeps in frame: you and your nearest living foe, or the survivors while you spectate. */
    cameraFocus() {
        const p = this.player, others = this.players.filter(q => q !== p && !q.gone);
        if (!this.ffa) return [p, this.foe];
        if (p.st !== 'DEAD') {
            let best = null, bd = 700;
            for (const q of others) {
                if (q.st === 'DEAD') continue;
                const d = p.distTo(q);
                if (d < bd) {
                    bd = d;
                    best = q;
                }
            }
            return best === null ? [p] : [p, best];
        }
        const alive = others.filter(q => q.st !== 'DEAD');
        return alive.length > 0 ? alive : [p];
    }

    updatePresentation(el) {
        const sw = this.canvas.width, sh = this.canvas.height, focus = this.cameraFocus();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const q of focus) {
            x0 = Math.min(x0, q.x);
            y0 = Math.min(y0, q.y);
            x1 = Math.max(x1, q.x);
            y1 = Math.max(y1, q.y);
        }
        const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
        const tz = U.clamp(Math.min(sw / (x1 - x0 + 460), sh / (y1 - y0 + 380)), this.ffa ? 0.4 : 0.55, 1.15);
        const k = 1 - Math.exp(-el * 5);
        this.camX += (tx - this.camX) * k;
        this.camY += (ty - this.camY) * k;
        this.camZ += (tz - this.camZ) * k;
        this.shakeAmt *= Math.exp(-el * 9);
        this.parryT -= el;
        this.zoomKickV *= Math.exp(-el * 5);
        this.flashA = Math.max(0, this.flashA - el * 2.5);
        for (let i = 0; i < this.n; i++) {
            const q = this.players[i];
            this.hpGhost[i] = this.hpGhost[i] > q.hp ? Math.max(q.hp, this.hpGhost[i] - el * 40) : q.hp;
        }
        const z = this.zoom();
        this.realFx.ambient(this.camX, this.camY, sw / z, sh / z, el, Math.sin(this.realTime * 0.2) * 20);
    }

    render() {
        const g = this.ctx, sw = this.canvas.width, sh = this.canvas.height;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#000';
        g.fillRect(0, 0, sw, sh);
        const z = this.zoom();
        const shx = (Math.random() - 0.5) * 2 * this.shakeAmt, shy = (Math.random() - 0.5) * 2 * this.shakeAmt;
        g.save();
        g.translate(sw / 2, sh / 2);
        g.scale(z, z);
        g.translate(-this.camX + shx, -this.camY + shy);
        const l = this.camX - sw / 2 / z - 40, t = this.camY - sh / 2 / z - 40, r = this.camX + sw / 2 / z + 40, b = this.camY + sh / 2 / z + 40;
        this.drawArena(g, l, t, r, b);
        this.realFx.drawDecals(g);
        const shown = this.players.filter(p => !p.gone);
        for (const p of shown) {
            setStroke(g, 2.5, false);
            g.strokeStyle = css(U.alpha(this.colorOf(p), p.st === 'DEAD' ? 0.25 : 0.7));
            strokeEllipse(g, p.x - p.r - 8, p.y - p.r * 0.6 + 6, (p.r + 8) * 2, (p.r * 0.6 + 2) * 2);
        }
        const order = shown.slice().sort((p, q) => (q.st === 'DEAD') - (p.st === 'DEAD') || p.y - q.y);
        for (const p of order) p.draw(g, this.time);
        this.realFx.drawWorld(g);
        this.realFx.drawPetals(g);
        for (const p of shown) {
            this.drawTag(g, p);
            p.drawOverlay(g, KANJI_FONT, 18);
        }
        this.realFx.drawTexts(g);
        g.restore();

        this.drawParryBurst(g, sw, sh, z);
        this.drawVignette(g, sw, sh);
        if (this.flashA > 0) {
            g.fillStyle = css(U.alpha(this.flashColor, this.flashA * 0.6));
            g.fillRect(0, 0, sw, sh);
        }
        this.drawHud(g, sw, sh);
    }

    drawArena(g, l, t, r, b) {
        const R = this.arena.r;
        g.fillStyle = 'rgb(38,52,34)';
        g.fillRect(l, t, r - l, b - t);
        g.fillStyle = 'rgb(84,70,48)';
        fillCircle(g, 0, 0, R + 30);
        const grad = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
        grad.addColorStop(0, 'rgb(196,178,136)');
        grad.addColorStop(1, 'rgb(160,140,100)');
        g.fillStyle = grad;
        fillCircle(g, 0, 0, R);
        setStroke(g, 1.5, false);
        g.strokeStyle = 'rgba(110,92,62,0.28)';
        for (let rr = 70; rr < R; rr += 55) {
            g.beginPath();
            g.arc(0, 0, rr, 0, TAU);
            g.stroke();
        }
        // starting lines
        setStroke(g, 6, false);
        g.strokeStyle = 'rgba(245,240,225,0.75)';
        const sr = this.spawnRadius() - 50;
        for (let i = 0; i < this.n; i++) {
            const a = this.spawnAngle(i), cx = Math.cos(a) * sr, cy = Math.sin(a) * sr, px = -Math.sin(a) * 34, py = Math.cos(a) * 34;
            strokeLine(g, cx - px, cy - py, cx + px, cy + py);
        }
        // sacred rope
        setStroke(g, 7, true);
        g.strokeStyle = 'rgb(232,222,196)';
        g.beginPath();
        g.arc(0, 0, R + 6, 0, TAU);
        g.stroke();
        g.fillStyle = 'rgb(250,250,245)';
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * TAU, x = Math.cos(a) * (R + 6), y = Math.sin(a) * (R + 6);
            g.beginPath();
            g.moveTo(x - 4, y);
            g.lineTo(x + 4, y + 6);
            g.lineTo(x - 3, y + 12);
            g.lineTo(x + 3, y + 18);
            g.lineTo(x - 2, y + 18);
            g.closePath();
            g.fill();
        }
        // stone lanterns
        for (let i = 0; i < 8; i++) {
            const a = (i + 0.5) / 8 * TAU, x = Math.cos(a) * (R + 90), y = Math.sin(a) * (R + 90);
            const glow = g.createRadialGradient(x, y, 0, x, y, 90);
            glow.addColorStop(0, css(rgb(255, 190, 110, Math.trunc(80 + 20 * Math.sin(this.realTime * 3 + i)))));
            glow.addColorStop(1, 'rgba(255,190,110,0)');
            g.fillStyle = glow;
            fillCircle(g, x, y, 90);
            g.fillStyle = 'rgb(110,110,104)';
            g.fillRect(x - 13, y - 13, 26, 26);
            g.fillStyle = 'rgb(255,214,140)';
            g.fillRect(x - 6, y - 6, 12, 12);
            g.fillStyle = 'rgb(80,80,76)';
            g.fillRect(x - 17, y - 19, 34, 7);
        }
    }

    drawTag(g, p) {
        if (p.st === 'DEAD') return;
        const you = p === this.player, i = this.players.indexOf(p);
        g.font = 'bold 12px sans-serif';
        this.text(g, you ? 'YOU' : this.ffa ? 'P' + (i + 1) : 'FOE', p.x, p.y - p.r - 22, this.colorOf(p), true);
        if (p.brokenT > 0) {
            const pulse = 0.6 + 0.4 * Math.sin(this.realTime * 14);
            g.fillStyle = css(rgb(220, 20, 20, Math.trunc(255 * pulse)));
            fillCircle(g, p.x, p.y - p.r - 44, 9);
            setStroke(g, 2, false);
            g.strokeStyle = 'rgba(255,255,255,0.9)';
            g.beginPath();
            g.arc(p.x, p.y - p.r - 44, 12, 0, TAU);
            g.stroke();
        }
    }

    drawFighterBars(g, p, x, y, w, label, color, wins, right) {
        g.font = 'bold 18px serif';
        this.text(g, label, right ? x + w - g.measureText(label).width : x, y - 8, color, false);
        for (let i = 0; i < this.roundsToWin; i++) {
            const cx = right ? x + 10 + i * 20 : x + w - 10 - i * 20;
            g.fillStyle = i < wins ? 'rgb(255,210,90)' : 'rgba(0,0,0,0.6)';
            fillCircle(g, cx, y - 14, 7);
            setStroke(g, 1.5, false);
            g.strokeStyle = 'rgb(255,225,160)';
            g.beginPath();
            g.arc(cx, y - 14, 7, 0, TAU);
            g.stroke();
        }
        const idx = this.players.indexOf(p);
        const fill = (frac, c) => {
            const fw = Math.trunc(w * U.clamp(frac, 0, 1));
            g.fillStyle = c;
            g.fillRect(right ? x + w - fw : x, y, fw, 12);
        };
        g.fillStyle = 'rgba(0,0,0,0.667)';
        g.fillRect(x - 2, y - 2, w + 4, 16);
        fill(this.hpGhost[idx] / p.maxHp, 'rgb(230,220,200)');
        fill(p.hp / p.maxHp, 'rgb(190,30,34)');
        Draw.postureBar(g, x + w / 2, y + 26, w, 6, p.posture / p.maxPosture, p.brokenT > 0);
        g.fillStyle = 'rgba(0,0,0,0.667)';
        g.fillRect(x - 2, y + 40, w + 4, 7);
        g.fillStyle = p.ki >= 100 ? 'rgb(150,210,255)' : 'rgb(70,120,210)';
        const kw = Math.trunc(w * p.ki / 100);
        g.fillRect(right ? x + w - kw : x, y + 42, kw, 3);
    }

    /** Free-for-all standings: every fighter's wins and health. */
    drawScoreboard(g, sw) {
        const w = 230, x = sw - 28 - w, rowH = 30;
        let y = 30;
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x - 10, y - 18, w + 20, this.n * rowH + 12);
        const order = this.players.map((p, i) => i).sort((a, b) => this.score[b] - this.score[a] || a - b);
        for (const i of order) {
            const p = this.players[i], c = p.gone ? rgb(120, 115, 105) : this.colorOf(p);
            g.fillStyle = css(c);
            fillCircle(g, x + 6, y - 5, 6);
            g.font = i === this.localIdx ? 'bold 15px serif' : '15px serif';
            this.text(g, (i === this.localIdx ? 'You (P' + (i + 1) + ')' : 'P' + (i + 1)) + (p.gone ? '  - left' : ''), x + 18, y, c, false);
            this.text(g, this.score[i] + ' / ' + this.roundsToWin, x + w - 44, y, rgb(255, 215, 120), false);
            if (!p.gone) {
                g.fillStyle = 'rgba(0,0,0,0.667)';
                g.fillRect(x + 18, y + 5, w - 70, 5);
                g.fillStyle = p.st === 'DEAD' ? 'rgb(90,80,80)' : 'rgb(190,30,34)';
                g.fillRect(x + 18, y + 5, Math.trunc((w - 70) * U.clamp(p.hp / p.maxHp, 0, 1)), 5);
            }
            y += rowH;
        }
    }

    drawHud(g, sw, sh) {
        const me = this.player, w = Math.min(380, sw / 2 - 150);
        this.drawFighterBars(g, me, 28, 44, w, this.ffa ? 'You (P' + (this.localIdx + 1) + ')' : 'You', YOU_COLOR,
            this.score[this.localIdx], false);
        if (this.ffa) this.drawScoreboard(g, sw);
        else this.drawFighterBars(g, this.foe, sw - 28 - w, 44, w, 'Opponent', FOE_COLOR, this.score[1 - this.localIdx], true);
        g.font = 'bold 20px serif';
        this.text(g, (this.ffa ? 'FREE-FOR-ALL  -  ' : '') + 'ROUND ' + this.round, sw / 2, 40, rgb(245, 235, 215), true);
        const ping = Math.round(this.link.ping());
        g.font = SMALL_FONT;
        this.text(g, 'Ping ' + ping + ' ms   -   input delay ' + Math.round(this.delay * DT * 1000) + ' ms', sw / 2, 60,
            ping > LAG_PAUSE_MS * 0.8 ? rgb(255, 150, 110) : rgb(190, 180, 165), true);

        // own resources
        const hx = 28, hy = sh - 70;
        for (let i = 0; i < me.maxGourds; i++) {
            const have = i < me.gourds, gx = hx + i * 24;
            g.fillStyle = have ? 'rgb(220,130,50)' : 'rgb(70,70,70)';
            fillEllipse(g, gx, hy + 6, 16, 16);
            fillEllipse(g, gx + 3, hy, 10, 10);
        }
        g.font = SMALL_FONT;
        this.text(g, '[Q] heal', hx + me.maxGourds * 24 + 8, hy + 18, rgb(220, 200, 170), false);
        const art = me.art, canArt = me.artCharges >= art.cost;
        g.font = 'bold 15px serif';
        this.text(g, art.name + '  ' + me.artCharges + '/' + art.cost + (canArt ? '  READY  [R] / Block + Attack' : '  (deflect to charge)'),
            hx, hy - 16, canArt ? art.color : rgb(150, 140, 130), false);
        if (me.ki >= 100) {
            g.font = HUD_FONT;
            this.text(g, '[F] IAI FLASH READY', hx, hy - 38, rgb(170, 220, 255), false);
        }
        g.font = SMALL_FONT;
        const help = 'LMB attack   Hold LMB stab   RMB deflect / hold block   Space dodge / sprint   Esc twice to leave';
        this.text(g, help, sw - 28 - g.measureText(help).width, sh - 20, rgb(180, 170, 150), false);
        if (me.deflectStreak >= 2) {
            g.font = 'bold 26px serif';
            this.text(g, me.deflectStreak + ' DEFLECT CHAIN', sw / 2, sh - 100, rgb(255, 215, 100), true);
        }
        if (this.phase === 'FIGHT' && me.st !== 'DEAD' && this.deathblowTarget(me) !== null) {
            g.font = 'bold 20px serif';
            this.text(g, '[LMB]  DEATHBLOW', sw / 2, sh - 70, rgb(255, 90, 80), true);
        } else if (this.ffa && this.phase === 'FIGHT' && me.st === 'DEAD') {
            g.font = 'bold 20px serif';
            this.text(g, 'You have fallen  -  spectating until the round ends', sw / 2, sh - 70, rgb(230, 200, 180), true);
        }
        this.drawPhase(g, sw, sh);
        if (this.leaveConfirmT > 0 && this.lostMsg === null) {
            g.font = HUD_FONT;
            this.text(g, 'Press Esc again to leave the match', sw / 2, 112, rgb(255, 150, 120), true);
        }
        this.drawConnection(g, sw, sh);
    }

    drawPhase(g, sw, sh) {
        const cy = sh / 2 - 60;
        if (this.phase === 'COUNTDOWN') {
            const n = Math.max(1, Math.ceil(3 - this.phaseT));
            g.font = TITLE_FONT;
            this.text(g, 'ROUND ' + this.round, sw / 2, cy - 40, rgb(245, 235, 215), true);
            g.font = BIG_KANJI;
            this.text(g, String(n), sw / 2, cy + 110, rgb(255, 220, 150), true);
        } else if (this.phase === 'FIGHT' && this.phaseT < 0.9) {
            const a = U.clamp(1 - this.phaseT / 0.9, 0, 1);
            g.font = BIG_KANJI;
            this.text(g, '\u65ac', sw / 2, cy + 60, U.alpha(rgb(230, 50, 40), a), true);
            g.font = TITLE_FONT;
            this.text(g, 'FIGHT', sw / 2, cy + 120, U.alpha(WHITE, a), true);
        } else if (this.phase === 'KO') {
            const a = U.clamp(this.phaseT * 3, 0, 1);
            const won = this.lastKo === this.localIdx, draw = this.lastKo === -1;
            g.fillStyle = css(rgb(0, 0, 0, Math.trunc(110 * a)));
            g.fillRect(0, cy - 60, sw, 90);
            g.font = TITLE_FONT;
            const msg = draw ? (this.ffa ? 'NO SURVIVORS' : 'DOUBLE KO') : won ? 'ROUND WON'
                : this.ffa ? 'P' + (this.lastKo + 1) + ' WINS THE ROUND' : 'ROUND LOST';
            this.text(g, msg, sw / 2, cy, U.alpha(draw ? WHITE : won ? rgb(255, 215, 120) : rgb(230, 70, 60), a), true);
        } else if (this.phase === 'MATCH_OVER') {
            const winner = this.matchWinner(), won = winner === this.localIdx;
            g.fillStyle = 'rgba(0,0,0,0.55)';
            g.fillRect(0, 0, sw, sh);
            g.font = BIG_KANJI;
            this.text(g, won ? '\u52dd' : '\u6557', sw / 2, cy + 30, won ? rgb(255, 205, 100) : rgb(200, 30, 30), true);
            g.font = TITLE_FONT;
            this.text(g, won ? 'VICTORY' : 'DEFEAT', sw / 2, cy + 100, WHITE, true);
            g.font = SUB_FONT;
            const line = this.ffa ? (won ? 'Last samurai standing' : 'P' + (winner + 1) + ' wins the match') + '  -  your rounds: '
                + this.score[this.localIdx] : this.score[this.localIdx] + '  -  ' + this.score[1 - this.localIdx];
            this.text(g, line, sw / 2, cy + 136, rgb(230, 220, 210), true);
            const meReady = this.ready[this.localIdx];
            const others = this.players.filter((p, i) => i !== this.localIdx && !p.gone);
            const othersReady = others.filter(p => this.ready[this.players.indexOf(p)]).length;
            g.font = HUD_FONT;
            this.text(g, meReady ? (this.ffa ? 'Waiting for the others...' : 'Waiting for your opponent...') + '  (Enter to cancel)'
                : 'Press ENTER for a rematch', sw / 2, cy + 180, rgb(255, 220, 150, Math.trunc(160 + 90 * Math.sin(this.realTime * 4))), true);
            if (othersReady > 0) {
                this.text(g, this.ffa ? othersReady + ' / ' + others.length + ' others want a rematch' : 'Your opponent wants a rematch', sw / 2,
                    cy + 204, FOE_COLOR, true);
            }
            g.font = SMALL_FONT;
            this.text(g, 'Esc twice to return to the main menu', sw / 2, cy + 228, rgb(190, 180, 165), true);
        }
    }

    drawConnection(g, sw, sh) {
        if (this.lostMsg !== null) {
            g.fillStyle = 'rgba(10,8,8,0.85)';
            g.fillRect(0, 0, sw, sh);
            g.font = TITLE_FONT;
            this.text(g, this.ffa ? 'MATCH ENDED' : 'DUEL ENDED', sw / 2, sh / 2 - 20, rgb(230, 60, 50), true);
            g.font = SUB_FONT;
            this.text(g, this.lostMsg, sw / 2, sh / 2 + 20, rgb(230, 220, 210), true);
            g.font = HUD_FONT;
            this.text(g, 'Press ENTER to return to the main menu', sw / 2, sh / 2 + 60, rgb(255, 220, 150), true);
            return;
        }
        if (this.lagPaused || this.resumeT > 0) {
            g.fillStyle = 'rgba(0,0,0,0.6)';
            g.fillRect(0, 0, sw, sh);
            g.font = TITLE_FONT;
            if (this.lagPaused) {
                this.text(g, 'CONNECTION UNSTABLE', sw / 2, sh / 2 - 10, rgb(255, 150, 110), true);
                g.font = SUB_FONT;
                this.text(g, 'The match is paused until the connection recovers  -  ping ' + Math.round(this.link.ping()) + ' ms', sw / 2,
                    sh / 2 + 30, rgb(230, 220, 210), true);
            } else {
                this.text(g, 'Resuming in ' + this.resumeT.toFixed(1), sw / 2, sh / 2, rgb(200, 235, 190), true);
            }
        } else if (this.stallT > 0.35) {
            g.font = HUD_FONT;
            this.text(g, this.ffa ? 'Waiting for players...' : 'Waiting for opponent...', sw / 2, 90, rgb(255, 180, 120), true);
        }
    }
}

// shared screen-space drawing helpers
for (const m of ['text', 'drawParryBurst', 'drawVignette', 'makeVignette']) Duel.prototype[m] = Game.prototype[m];
