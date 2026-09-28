import java.awt.*;
import java.awt.geom.*;
import java.util.*;

public class Enemy extends Actor {
    public enum T { RONIN, SPEAR, ARCHER, BRUTE }

    public enum St { IDLE, ALERT, ENGAGE, WINDUP, ACTIVE, RECOVER, STUN, BROKEN, DEAD, RETURN }

    // ---- move sets ----
    static final Attack R_A = new Attack("slash", .45, .12, .45, 70, 140, 14, 18, 240);
    static final Attack R_B = new Attack("slash2", .30, .12, .50, 70, 140, 14, 18, 240);
    static final Attack R_HEAVY = new Attack("heavy", .80, .14, .60, 82, 180, 22, 30, 280);
    static final Attack R_DELAY = new Attack("delayed", 1.05, .14, .60, 82, 180, 22, 30, 300);
    static final Attack R_THRUST = new Attack("thrust", .70, .18, .75, 118, 30, 26, 10, 560).perilous().thrust();
    static final Attack R_FAST = new Attack("quick", .24, .10, .35, 66, 130, 10, 14, 220);
    static final Attack SP_T1 = new Attack("thrust", .50, .14, .50, 118, 26, 13, 16, 170).thrust();
    static final Attack SP_T2 = new Attack("thrust2", .28, .14, .50, 118, 26, 13, 16, 170).thrust();
    static final Attack SP_SWEEP = new Attack("sweep", .60, .16, .60, 108, 200, 16, 22, 70);
    static final Attack SP_PER = new Attack("lunge", .75, .20, .80, 150, 24, 30, 10, 620).perilous().thrust();
    static final Attack AR_SHOT = new Attack("shot", .80, .05, .55, 900, 10, 10, 14, 0).ranged();
    static final Attack AR_STAB = new Attack("stab", .35, .10, .45, 58, 110, 8, 10, 120);
    static final Attack BR_SMASH = new Attack("smash", .85, .18, .90, 108, 160, 30, 42, 130);
    static final Attack BR_SWEEP = new Attack("sweep", .55, .16, .70, 112, 190, 22, 30, 80);
    static final Attack BR_PER = new Attack("crush", 1.0, .25, 1.0, 130, 300, 38, 0, 90).perilous();

    final SamuraiGame g;
    public final T type;
    public final boolean elite;
    public String name;
    public int lives = 1;
    public World.Camp camp;
    double homeX, homeY;
    public St st = St.IDLE;
    double stT, stDur;
    final ArrayList<Attack[]> combos = new ArrayList<>();
    Attack[] combo;
    int comboIdx;
    Attack atk;
    boolean atkHit;
    double attackCd = 0.5, tokenT;
    public boolean aware, hasToken, beingExecuted;
    double speed, detect, blockChance;
    boolean hyper;
    double lastDamageT = -99;
    int blockStreak, flinchCount;
    double blockAnim, hitFlash, deadT, wanderT, wanderX, wanderY, strafeDir = 1, strafeT, walkAnim, kbx, kby, reach;
    public double showBars, perilousT;
    final Random rnd;

    public Enemy(SamuraiGame g, T type, double x, double y, boolean elite, String name, long seed) {
        this.g = g;
        this.type = type;
        this.elite = elite;
        this.name = name;
        this.x = homeX = wanderX = x;
        this.y = homeY = wanderY = y;
        rnd = new Random(seed);
        facing = rnd.nextDouble() * Math.PI * 2;
        switch (type) {
            case RONIN -> stats(16, 70, 70, 150, 380, 0.5);
            case SPEAR -> stats(16, 60, 60, 140, 400, 0.35);
            case ARCHER -> stats(15, 40, 40, 135, 520, 0.1);
            case BRUTE -> {
                stats(25, 200, 150, 105, 340, 0);
                hyper = true;
            }
        }
        if (elite) {
            r *= 1.12;
            maxHp *= 3.2;
            maxPosture *= 2.0;
            speed *= 1.15;
            detect *= 1.2;
            if (type != T.BRUTE) blockChance = 0.7;
            lives = 2;
        }
        hp = maxHp;
        buildCombos();
    }

    private void stats(double r, double hp, double posture, double speed, double detect, double block) {
        this.r = r;
        this.maxHp = hp;
        this.maxPosture = posture;
        this.speed = speed;
        this.detect = detect;
        this.blockChance = block;
    }

    private void add(Attack... a) {
        if (elite) {
            Attack[] c = new Attack[a.length];
            for (int i = 0; i < a.length; i++) c[i] = a[i].copy(a[i] == R_DELAY ? 1 : 0.85, 1.3);
            combos.add(c);
        } else combos.add(a);
    }

    private void buildCombos() {
        switch (type) {
            case RONIN -> {
                add(R_A);
                add(R_A, R_B);
                add(R_A, R_B, R_HEAVY);
                add(R_THRUST);
                add(R_A, R_THRUST);
                if (elite) {
                    add(R_FAST, R_FAST, R_FAST, R_FAST, R_HEAVY);
                    add(R_A, R_B, R_A, R_B);
                    add(R_FAST, R_FAST, R_DELAY);
                    add(R_HEAVY, R_THRUST);
                }
                reach = 70;
            }
            case SPEAR -> {
                add(SP_T1);
                add(SP_T1, SP_T2);
                add(SP_T1, SP_SWEEP);
                add(SP_PER);
                add(SP_T1, SP_T2, SP_PER);
                if (elite) {
                    add(SP_T1, SP_T2, SP_T2, SP_T2, SP_SWEEP);
                    add(SP_SWEEP, SP_SWEEP, SP_PER);
                }
                reach = 112;
            }
            case ARCHER -> reach = 58;
            case BRUTE -> {
                add(BR_SMASH);
                add(BR_SMASH, BR_SWEEP);
                add(BR_PER);
                add(BR_SWEEP, BR_SWEEP, BR_SMASH);
                if (elite) {
                    add(BR_SWEEP, BR_SWEEP, BR_SWEEP, BR_PER);
                    add(BR_SMASH, BR_SMASH, BR_SMASH);
                }
                reach = 104;
            }
        }
    }

    Attack[] pickCombo() {
        if (type == T.ARCHER) return new Attack[] { AR_STAB };
        return combos.get(rnd.nextInt(combos.size()));
    }

    void setSt(St s) {
        st = s;
        stT = 0;
    }

    public boolean attacking() { return st == St.WINDUP || st == St.ACTIVE || (st == St.RECOVER && combo != null && comboIdx + 1 < combo.length); }

    // ---------------- AI ----------------
    public void update(double dt) {
        if (st == St.DEAD) {
            deadT += dt;
            return;
        }
        Player p = g.player;
        stT += dt;
        attackCd -= dt;
        blockAnim -= dt;
        hitFlash -= dt;
        showBars -= dt;
        perilousT -= dt;
        if (Math.abs(kbx) + Math.abs(kby) > 1) {
            move(g.world, kbx * dt, kby * dt);
            double k = Math.exp(-dt * 10);
            kbx *= k;
            kby *= k;
        }
        if (st != St.BROKEN && g.time - lastDamageT > 1.3) posture = Math.max(0, posture - maxPosture * 0.10 * (0.3 + 0.7 * hp / maxHp) * dt);
        double d = distTo(p), toP = angleTo(p);
        boolean pAlive = p.st != Player.St.DEAD;
        if (hasToken) {
            tokenT += dt;
            if (tokenT > 3 && st == St.ENGAGE) releaseToken();
        }
        if (elite && aware && rnd.nextDouble() < dt * 10) g.fx.wisp(x, y, new Color(110, 30, 150));
        switch (st) {
            case IDLE -> idle(dt, d, toP, p, pAlive);
            case ALERT -> {
                facing = U.turn(facing, toP, dt * 8);
                if (stT > 0.45) setSt(St.ENGAGE);
            }
            case ENGAGE -> engage(dt, d, toP, p, pAlive);
            case WINDUP -> windup(dt, d, toP, p);
            case ACTIVE -> active(dt, d, toP, p);
            case RECOVER -> {
                if (stT >= stDur) {
                    if (combo != null && comboIdx + 1 < combo.length) {
                        comboIdx++;
                        beginAttack(1);
                    } else {
                        releaseToken();
                        attackCd = elite ? 0.3 + rnd.nextDouble() * 0.7 : 0.9 + rnd.nextDouble() * 1.2;
                        if (type == T.ARCHER) attackCd = 1.6 + rnd.nextDouble() * 1.4;
                        setSt(St.ENGAGE);
                    }
                }
            }
            case STUN -> {
                if (stT >= stDur) setSt(St.ENGAGE);
            }
            case BROKEN -> {
                if (stT >= stDur && !beingExecuted) {
                    posture = maxPosture * 0.5;
                    if (hp <= 1) hp = maxHp * 0.15;
                    setSt(St.ENGAGE);
                }
            }
            case RETURN -> {
                double a = Math.atan2(homeY - y, homeX - x);
                facing = U.turn(facing, a, dt * 6);
                move(g.world, Math.cos(facing) * speed * 0.8 * dt, Math.sin(facing) * speed * 0.8 * dt);
                walkAnim += speed * 0.8 * dt;
                hp = Math.min(maxHp, hp + maxHp * 0.25 * dt);
                posture = Math.max(0, posture - maxPosture * 0.5 * dt);
                if (U.dist(x, y, homeX, homeY) < 24 || stT > 12) {
                    aware = false;
                    hp = maxHp;
                    setSt(St.IDLE);
                } else if (pAlive && d < detect * 0.6) setSt(St.ENGAGE);
            }
            default -> {}
        }
    }

    private void idle(double dt, double d, double toP, Player p, boolean pAlive) {
        wanderT -= dt;
        if (wanderT <= 0) {
            wanderT = 2 + rnd.nextDouble() * 4;
            double a = rnd.nextDouble() * Math.PI * 2, rr = rnd.nextDouble() * (camp != null ? 90 : 220);
            wanderX = homeX + Math.cos(a) * rr;
            wanderY = homeY + Math.sin(a) * rr;
        }
        if (U.dist(x, y, wanderX, wanderY) > 12 && wanderT < 3) {
            facing = U.turn(facing, Math.atan2(wanderY - y, wanderX - x), dt * 3);
            move(g.world, Math.cos(facing) * speed * 0.3 * dt, Math.sin(facing) * speed * 0.3 * dt);
            walkAnim += speed * 0.3 * dt;
        }
        if (!pAlive || p.invuln > 0.5) return;
        boolean inCone = Math.abs(U.angDiff(facing, toP)) < 1.1;
        double hearing = p.sneaking() ? 38 : (Math.hypot(p.vx, p.vy) > 60 ? 150 : 70);
        if ((d < detect && inCone) || d < hearing) alert(true);
    }

    public void alert(boolean propagate) {
        if (aware || st == St.DEAD) return;
        aware = true;
        setSt(St.ALERT);
        showBars = 3;
        g.fx.text("!", x, y - 36, new Color(255, 220, 60), 24);
        if (elite) g.engageBoss(this);
        if (propagate) {
            for (Enemy e : g.enemies) if (e != this && !e.aware && e.st != St.DEAD && distTo(e) < 520) e.alert(false);
        }
    }

    private void engage(double dt, double d, double toP, Player p, boolean pAlive) {
        if (!pAlive || U.dist(x, y, homeX, homeY) > 1400 || d > 1000) {
            releaseToken();
            setSt(St.RETURN);
            return;
        }
        showBars = Math.max(showBars, 1);
        facing = U.turn(facing, toP, dt * 7);
        if (type == T.ARCHER) {
            if (d < 64 && attackCd <= 0) {
                startCombo(new Attack[] { AR_STAB }, 1);
                return;
            }
            if (attackCd <= 0 && d < 620) {
                startCombo(new Attack[] { elite ? AR_SHOT.copy(0.7, 1.3) : AR_SHOT }, 1);
                return;
            }
            circle(dt, d, toP, 330, 0.6);
            return;
        }
        if (attackCd <= 0 && !hasToken && g.requestToken(this)) {
            hasToken = true;
            tokenT = 0;
        }
        if (hasToken) {
            if (d < reach + p.r - 4) {
                startCombo(pickCombo(), 1);
                return;
            }
            double sp = speed * 1.15;
            move(g.world, Math.cos(toP) * sp * dt, Math.sin(toP) * sp * dt);
            walkAnim += sp * dt;
        } else {
            circle(dt, d, toP, type == T.BRUTE ? 200 : 165, 0.55);
        }
    }

    private void circle(double dt, double d, double toP, double ideal, double spMul) {
        strafeT -= dt;
        if (strafeT <= 0) {
            strafeT = 1 + rnd.nextDouble() * 2;
            strafeDir = rnd.nextBoolean() ? 1 : -1;
        }
        double radial = U.clamp((d - ideal) / 60, -1, 1);
        double mx = Math.cos(toP) * radial + Math.cos(toP + Math.PI / 2) * strafeDir * 0.6;
        double my = Math.sin(toP) * radial + Math.sin(toP + Math.PI / 2) * strafeDir * 0.6;
        double l = Math.hypot(mx, my);
        if (l > 0.01) {
            double sp = speed * spMul * Math.min(1, l);
            move(g.world, mx / l * sp * dt, my / l * sp * dt);
            walkAnim += sp * dt;
        }
    }

    void startCombo(Attack[] c, double windupMul) {
        combo = c;
        comboIdx = 0;
        flinchCount = 0;
        blockStreak = 0;
        beginAttack(windupMul);
    }

    private void beginAttack(double windupMul) {
        atk = combo[comboIdx];
        atkHit = false;
        setSt(St.WINDUP);
        stDur = atk.windup * windupMul;
        if (atk.perilous) {
            perilousT = stDur + 0.3;
            g.sfx.play(Sfx.S.PERILOUS);
            g.fx.ring(x, y, 10, 60, 0.4, 3, new Color(255, 40, 30));
        }
    }

    private void windup(double dt, double d, double toP, Player p) {
        double remaining = stDur - stT;
        double turnRate = atk.thrust && remaining < 0.2 ? 2.0 : 6.5;
        if (type == T.BRUTE) turnRate *= 0.7;
        facing = U.turn(facing, toP, dt * turnRate);
        if (!atk.ranged && d > atk.range * 0.7 + p.r) {
            move(g.world, Math.cos(facing) * speed * 0.35 * dt, Math.sin(facing) * speed * 0.35 * dt);
            walkAnim += speed * 0.35 * dt;
        }
        if (stT >= stDur) {
            setSt(St.ACTIVE);
            stDur = atk.active;
            if (atk.ranged) {
                g.spawnArrow(this, atk);
            } else {
                g.sfx.play(type == T.BRUTE || atk.perilous ? Sfx.S.HEAVY : Sfx.S.SLASH);
                Color c = atk.perilous ? new Color(255, 80, 60) : new Color(255, 230, 200);
                if (atk.thrust) {
                    g.fx.line(x + Math.cos(facing) * r, y + Math.sin(facing) * r, x + Math.cos(facing) * (atk.range + 10),
                            y + Math.sin(facing) * (atk.range + 10), 0.18, 3, c);
                } else {
                    g.fx.slash(x, y, atk.range * 0.8, facing + atk.arc / 2, -atk.arc, 0.22, type == T.BRUTE ? 10 : 6, c);
                }
            }
        }
    }

    private void active(double dt, double d, double toP, Player p) {
        double f = Math.max(0, 1 - stT / atk.active);
        boolean close = d < r + p.r + 6 && Math.abs(U.angDiff(facing, toP)) < 1;
        if (!close && atk.lunge > 0) move(g.world, Math.cos(facing) * atk.lunge * f * dt, Math.sin(facing) * atk.lunge * f * dt);
        if (!atkHit && !atk.ranged && p.st != Player.St.DEAD) {
            double tol = atk.arc / 2 + Math.asin(Math.min(1, p.r / Math.max(d, 1)));
            if (d <= atk.range + p.r && Math.abs(U.angDiff(facing, toP)) <= tol) {
                int res = p.receive(x, y, atk.damage, atk.posture, atk.perilous);
                if (res != Player.IGNORE) atkHit = true;
                if (res == Player.DEFLECT) onDeflected();
                else if (res == Player.BLOCK) {
                    kbx = -Math.cos(facing) * 60;
                    kby = -Math.sin(facing) * 60;
                }
            }
        }
        if (st == St.ACTIVE && stT >= stDur) {
            boolean more = comboIdx + 1 < combo.length;
            setSt(St.RECOVER);
            stDur = more ? 0.06 : atk.recovery;
        }
    }

    void onDeflected() {
        boolean last = comboIdx + 1 >= combo.length;
        posture += atk.posture * 1.3 + 6;
        lastDamageT = g.time;
        showBars = 3;
        kbx = -Math.cos(facing) * 180;
        kby = -Math.sin(facing) * 180;
        if (posture >= maxPosture) {
            breakPosture();
            return;
        }
        if (last) {
            setSt(St.STUN);
            stDur = elite ? 0.5 : 0.8;
            releaseToken();
            attackCd = 0.6;
        }
    }

    /** Player sword connects. */
    public void takeHit(Player p, Attack pa) {
        if (st == St.DEAD || beingExecuted) return;
        double ang = p.angleTo(this);
        double cx = x - Math.cos(ang) * r, cy = y - Math.sin(ang) * r;
        showBars = 4;
        lastDamageT = g.time;
        boolean wasAware = aware;
        if (!aware) alert(true);
        boolean neutral = wasAware && (st == St.ENGAGE || st == St.ALERT || st == St.RETURN);
        if (neutral && rnd.nextDouble() < blockChance + blockStreak * 0.1) {
            facing = ang + Math.PI;
            if (elite && blockStreak >= 1 && rnd.nextDouble() < 0.55) {
                g.fx.sparks(cx, cy, ang + Math.PI, 2.2, 22, 480, new Color(255, 120, 200));
                g.sfx.play(Sfx.S.CLANG);
                g.hitstop(0.07);
                g.shake(6);
                g.fx.text("PARRIED!", p.x, p.y - 42, new Color(255, 110, 110), 16);
                p.recoil(ang + Math.PI);
                hasToken = true;
                startCombo(pickCombo(), 0.55);
                return;
            }
            posture += pa.posture * 1.1;
            blockStreak++;
            blockAnim = 0.25;
            g.fx.sparks(cx, cy, ang + Math.PI, 1.6, 12, 300, new Color(255, 160, 70));
            g.sfx.play(Sfx.S.BLOCK);
            g.hitstop(0.035);
            g.shake(2);
            kbx = Math.cos(ang) * 120;
            kby = Math.sin(ang) * 120;
            if (posture >= maxPosture) {
                breakPosture();
                return;
            }
            if (blockStreak >= 3) {
                hasToken = true;
                startCombo(pickCombo(), 0.6);
            }
            return;
        }
        blockStreak = 0;
        double dmg = pa.damage * (wasAware ? 1 : 2);
        hp -= dmg;
        posture += pa.posture * 0.6;
        hitFlash = 0.12;
        g.fx.blood(cx, cy, ang, 10, 260);
        g.sfx.play(Sfx.S.HIT);
        g.hitstop(pa == Player.COMBO[2] ? 0.075 : 0.045);
        g.shake(pa == Player.COMBO[2] ? 5 : 3.5);
        g.fx.text(String.valueOf((int) dmg), x + rnd.nextGaussian() * 6, y - 30, Color.WHITE, 13);
        p.ki += 4;
        if (hp <= 0) {
            if (elite) {
                hp = 1;
                breakPosture();
            } else die(ang);
            return;
        }
        if (posture >= maxPosture) {
            breakPosture();
            return;
        }
        boolean armored = hyper || (st == St.WINDUP && atk != null && atk.perilous) || (elite && st == St.ACTIVE);
        if (!armored && st != St.BROKEN) {
            flinchCount++;
            if (flinchCount >= 3) {
                facing = ang + Math.PI;
                hasToken = true;
                startCombo(pickCombo(), 0.55);
            } else {
                double left = st == St.STUN ? stDur - stT : 0;
                releaseToken();
                setSt(St.STUN);
                stDur = Math.max(left, 0.3);
                kbx = Math.cos(ang) * 140;
                kby = Math.sin(ang) * 140;
            }
        }
    }

    /** Reflected arrows, Iai Flash, etc. */
    public void takeRaw(double dmg, double post, double ang) {
        if (st == St.DEAD || beingExecuted) return;
        if (!aware) alert(true);
        showBars = 4;
        lastDamageT = g.time;
        hp -= dmg;
        posture += post;
        hitFlash = 0.15;
        g.fx.blood(x, y, ang, 14, 300);
        g.fx.text(String.valueOf((int) dmg), x, y - 30, new Color(255, 230, 120), 15);
        if (hp <= 0) {
            if (elite) {
                hp = 1;
                breakPosture();
            } else die(ang);
        } else if (posture >= maxPosture) breakPosture();
        else if (!hyper) {
            releaseToken();
            setSt(St.STUN);
            stDur = 0.45;
        }
    }

    void breakPosture() {
        posture = maxPosture;
        releaseToken();
        setSt(St.BROKEN);
        stDur = elite ? 2.4 : 3.0;
        g.onPostureBreak(this);
    }

    public void die(double ang) {
        hp = 0;
        alive = false;
        releaseToken();
        setSt(St.DEAD);
        facing = ang;
        deadT = 0;
        beingExecuted = false;
        g.onEnemyKilled(this);
    }

    void releaseToken() {
        hasToken = false;
        tokenT = 0;
    }

    public void resetToHome() {
        if (st == St.DEAD) return;
        x = homeX;
        y = homeY;
        hp = maxHp;
        posture = 0;
        aware = false;
        beingExecuted = false;
        kbx = kby = 0;
        releaseToken();
        setSt(St.IDLE);
    }

    // ---------------- rendering ----------------
    public void draw(Graphics2D g2, double time) {
        if (st == St.DEAD) {
            double a = U.clamp(1 - (deadT - 10) / 3, 0, 1);
            if (a <= 0) return;
            AffineTransform at = g2.getTransform();
            g2.translate(x, y);
            g2.rotate(facing);
            g2.setColor(U.alpha(U.shade(robeColor(), 0.6), a));
            g2.fill(new Ellipse2D.Double(-r * 1.4, -r * 0.8, r * 2.8, r * 1.6));
            g2.setColor(U.alpha(U.shade(hatColor(), 0.6), a));
            g2.fill(new Ellipse2D.Double(r * 0.8, -r * 0.6, r * 1.2, r * 1.2));
            g2.setTransform(at);
            return;
        }
        Draw.shadow(g2, x, y, r);
        double drawR = r;
        double sway = 0;
        if (st == St.BROKEN) {
            drawR = r * 0.88;
            sway = Math.sin(time * 6) * 0.15;
        }
        Color robe = robeColor(), sh = shoulderColor(), hat = hatColor();
        if (st == St.BROKEN) {
            robe = U.shade(robe, 0.7);
            sh = U.shade(sh, 0.7);
        }
        if (hitFlash > 0) {
            robe = U.mix(robe, Color.WHITE, 0.8);
            sh = U.mix(sh, Color.WHITE, 0.8);
        }
        if (elite) {
            g2.setColor(new Color(120, 40, 170, 40 + (int) (30 * Math.sin(time * 4))));
            g2.fill(new Ellipse2D.Double(x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6));
        }
        if (atk != null && atk.perilous && (st == St.WINDUP || st == St.ACTIVE)) {
            g2.setColor(new Color(255, 30, 20, 70));
            g2.fill(new Ellipse2D.Double(x - r * 1.9, y - r * 1.9, r * 3.8, r * 3.8));
        }
        int hatStyle = switch (type) {
            case RONIN -> elite ? 3 : 0;
            case SPEAR -> 1;
            case ARCHER -> 0;
            case BRUTE -> 2;
        };
        Draw.body(g2, x, y, drawR, facing + sway, robe, sh, hat, hatStyle, walkAnim);
        drawWeapon(g2, time);
    }

    private void drawWeapon(Graphics2D g2, double time) {
        double wp = st == St.WINDUP ? U.clamp(stT / Math.max(stDur, 0.01), 0, 1) : 0;
        double ap = st == St.ACTIVE ? U.clamp(stT / Math.max(stDur, 0.01), 0, 1) : 0;
        double handRel = 0.9, blade = facing + 0.6, extend = 0;
        boolean slashing = atk != null && !atk.thrust && !atk.ranged;
        if (st == St.WINDUP && atk != null) {
            if (slashing) {
                blade = facing + atk.arc / 2 + 0.5 * wp;
                handRel = 0.9 + 0.4 * wp;
            } else if (atk.thrust) {
                blade = facing;
                handRel = 0.5;
                extend = -12 * wp;
            }
        } else if (st == St.ACTIVE && atk != null) {
            if (slashing) {
                blade = facing + U.lerp(atk.arc / 2, -atk.arc / 2, ap);
                handRel = (blade - facing) * 0.5;
            } else if (atk.thrust) {
                blade = facing;
                handRel = 0.2;
                extend = 22 * Math.sin(Math.PI * Math.min(1, ap * 1.4));
            }
        } else if (st == St.RECOVER && atk != null && slashing) {
            blade = facing - atk.arc / 2;
            handRel = -0.5;
        } else if (blockAnim > 0) {
            blade = facing - 1.4;
            handRel = 0.15;
        } else if (st == St.BROKEN || st == St.STUN) {
            blade = facing + 2.0;
            handRel = 1.2;
        }
        double hx = x + Math.cos(facing + handRel) * r * 0.9 + Math.cos(facing) * extend;
        double hy = y + Math.sin(facing + handRel) * r * 0.9 + Math.sin(facing) * extend;
        double tipLen;
        switch (type) {
            case RONIN -> {
                tipLen = elite ? 64 : 54;
                Draw.katana(g2, hx, hy, blade, tipLen, elite ? new Color(170, 120, 200) : new Color(190, 190, 200));
            }
            case SPEAR -> {
                if (st != St.WINDUP && st != St.ACTIVE && blockAnim <= 0 && st != St.BROKEN) blade = facing + 0.25;
                tipLen = 86;
                Draw.spear(g2, hx, hy, blade, tipLen, 26);
                tipLen += 12;
            }
            case BRUTE -> {
                tipLen = elite ? 84 : 72;
                if (st == St.WINDUP && atk != null && !atk.thrust) blade = facing + atk.arc / 2 + 0.6 * wp;
                Draw.club(g2, hx, hy, blade, tipLen);
            }
            default -> {
                double pull = st == St.WINDUP && atk != null && atk.ranged ? wp : 0;
                Draw.bow(g2, x, y, facing, r, pull);
                if (atk == AR_STAB && (st == St.WINDUP || st == St.ACTIVE)) Draw.katana(g2, hx, hy, blade, 30, new Color(190, 190, 200));
                hx = x + Math.cos(facing) * r * 1.6;
                hy = y + Math.sin(facing) * r * 1.6;
                blade = facing;
                tipLen = 0;
            }
        }
        // the parry cue: a glint right before an attack lands
        if (st == St.WINDUP && atk != null && !atk.perilous) {
            double remaining = stDur - stT;
            if (remaining < 0.26 && remaining > 0.04) {
                double k = 1 - Math.abs(remaining - 0.15) / 0.11;
                double gx = hx + Math.cos(blade) * tipLen * 0.8, gy = hy + Math.sin(blade) * tipLen * 0.8;
                Draw.glint(g2, gx, gy, 6 + 10 * U.clamp(k, 0, 1), new Color(255, 250, 220));
            }
        }
    }

    Color robeColor() {
        if (elite) return new Color(28, 22, 34);
        return switch (type) {
            case RONIN -> new Color(96, 88, 78);
            case SPEAR -> new Color(62, 74, 56);
            case ARCHER -> new Color(88, 66, 44);
            case BRUTE -> new Color(170, 52, 40);
        };
    }

    Color shoulderColor() {
        if (elite) return type == T.BRUTE ? new Color(60, 20, 30) : new Color(90, 30, 110);
        return switch (type) {
            case RONIN -> new Color(70, 70, 86);
            case SPEAR -> new Color(110, 44, 40);
            case ARCHER -> new Color(70, 80, 60);
            case BRUTE -> new Color(60, 50, 44);
        };
    }

    Color hatColor() {
        if (elite) return type == T.BRUTE ? new Color(120, 30, 30) : new Color(20, 16, 22);
        return switch (type) {
            case RONIN -> new Color(150, 128, 88);
            case SPEAR -> new Color(38, 38, 40);
            case ARCHER -> new Color(126, 104, 64);
            case BRUTE -> new Color(150, 44, 34);
        };
    }

    /** Overhead UI: bars, perilous kanji, deathblow marker. Drawn above canopies. */
    public void drawOverlay(Graphics2D g2, double time, Font kanjiFont, boolean kanjiOk, boolean canStealth) {
        if (st == St.DEAD) return;
        if (st == St.BROKEN || canStealth) {
            double pulse = 0.7 + 0.3 * Math.sin(time * 10);
            double rr = 7 * pulse + 3;
            g2.setColor(new Color(255, 20, 20, 90));
            g2.fill(new Ellipse2D.Double(x - rr * 2, y - rr * 2, rr * 4, rr * 4));
            g2.setColor(new Color(230, 20, 20));
            g2.fill(new Ellipse2D.Double(x - rr * 0.6, y - rr * 0.6, rr * 1.2, rr * 1.2));
        }
        if (perilousT > 0 && atk != null && atk.perilous) {
            double a = U.clamp(perilousT * 2, 0, 1);
            double ky = y - r - 34;
            g2.setColor(U.alpha(new Color(120, 0, 0), a * 0.8));
            g2.fill(new Ellipse2D.Double(x - 17, ky - 17, 34, 34));
            g2.setColor(U.alpha(new Color(255, 40, 30), a));
            g2.setFont(kanjiFont);
            String s = kanjiOk ? "\u5371" : "!";
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(s, (float) (x - fm.stringWidth(s) / 2.0), (float) (ky + fm.getAscent() / 2.8));
        }
        if (showBars > 0 && !elite) {
            double w = 44, bx = x - w / 2, by = y - r - 16;
            g2.setColor(new Color(0, 0, 0, 150));
            g2.fill(new Rectangle2D.Double(bx - 1, by - 1, w + 2, 6));
            g2.setColor(new Color(200, 40, 40));
            g2.fill(new Rectangle2D.Double(bx, by, w * U.clamp(hp / maxHp, 0, 1), 4));
            if (posture > 1) Draw.postureBar(g2, x, by + 7, w, 3, posture / maxPosture, st == St.BROKEN);
        }
    }
}
