import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.geom.*;
import java.util.*;

public class Player extends Actor {
    public enum St { FREE, ATTACK, DODGE, STAGGER, HEAL, DEATHBLOW, MIKIRI, IAI, DEAD }

    public static final int IGNORE = 0, DEFLECT = 1, BLOCK = 2, HIT = 3;
    public static final double PERFECT_WINDOW = 0.18;
    static final double DODGE_TIME = 0.34, DODGE_IFRAMES = 0.25;

    static final Attack[] COMBO = {
            new Attack("cut1", 0.08, 0.09, 0.20, 84, 150, 14, 12, 190),
            new Attack("cut2", 0.07, 0.09, 0.20, 84, 150, 14, 12, 190),
            new Attack("cut3", 0.15, 0.11, 0.34, 98, 230, 24, 22, 280) };

    final SamuraiGame g;
    public St st = St.FREE;
    double stT;
    double speed = 245, vx, vy;

    // input snapshot
    double moveX, moveY, aimX, aimY;
    boolean guardHeld;
    double bufAttack, bufParry, bufDodge, bufHeal, bufIai;

    // attack
    int combo = -1, phase, swingSign = 1;
    Attack cur;
    final HashSet<Enemy> hitSet = new HashSet<>();
    double comboGrace;

    // guard / deflect
    public boolean guarding;
    public double guardStart = -99, guardWindow = PERFECT_WINDOW, spam;
    public int deflectStreak;
    double deflectStreakT, guardFlash;

    // misc
    double dodgeDx, dodgeDy, invuln, staggerDur, hurtFlash, postureCd, walkAnim, scarf;
    public int gourds = 3, maxGourds = 3;
    boolean healed;
    public double ki;
    Enemy dbTarget;
    boolean dbDone;
    double iaiSx, iaiSy, iaiDx, iaiDy;
    boolean iaiDone, iaiLine;
    final ArrayList<Enemy> iaiVictims = new ArrayList<>();
    public double deadT;

    public Player(SamuraiGame g, double x, double y) {
        this.g = g;
        this.x = x;
        this.y = y;
        r = 15;
        maxHp = hp = 100;
        maxPosture = 100;
        facing = -Math.PI / 2;
    }

    public boolean sneaking() { return st == St.FREE && guarding && Math.hypot(vx, vy) < 160; }

    public boolean invulnerable() {
        return invuln > 0 || st == St.DEATHBLOW || st == St.MIKIRI || st == St.IAI || (st == St.DODGE && stT < DODGE_IFRAMES);
    }

    public void readInput(Input in, double wx, double wy, double dt) {
        double mx = 0, my = 0;
        if (in.down(KeyEvent.VK_W) || in.down(KeyEvent.VK_UP)) my -= 1;
        if (in.down(KeyEvent.VK_S) || in.down(KeyEvent.VK_DOWN)) my += 1;
        if (in.down(KeyEvent.VK_A) || in.down(KeyEvent.VK_LEFT)) mx -= 1;
        if (in.down(KeyEvent.VK_D) || in.down(KeyEvent.VK_RIGHT)) mx += 1;
        double l = Math.hypot(mx, my);
        moveX = l > 0 ? mx / l : 0;
        moveY = l > 0 ? my / l : 0;
        aimX = wx;
        aimY = wy;
        guardHeld = in.mouseDown(3) || in.down(KeyEvent.VK_K);
        if (in.mouseHit(1) || in.hit(KeyEvent.VK_J)) bufAttack = 0.22;
        if (in.mouseHit(3) || in.hit(KeyEvent.VK_K)) bufParry = 0.15;
        if (in.hit(KeyEvent.VK_SPACE) || in.hit(KeyEvent.VK_L)) bufDodge = 0.18;
        if (in.hit(KeyEvent.VK_Q)) bufHeal = 0.12;
        if (in.hit(KeyEvent.VK_F)) bufIai = 0.15;
    }

    public void update(double dt) {
        stT += dt;
        bufAttack -= dt;
        bufParry -= dt;
        bufDodge -= dt;
        bufHeal -= dt;
        bufIai -= dt;
        invuln -= dt;
        hurtFlash -= dt;
        guardFlash -= dt;
        comboGrace -= dt;
        postureCd -= dt;
        if ((deflectStreakT -= dt) <= 0) deflectStreak = 0;
        spam = Math.max(0, spam - dt * 2.2);
        ki = U.clamp(ki, 0, 100);
        if (st == St.DEAD) {
            deadT += dt;
            return;
        }
        if (postureCd <= 0 && st != St.STAGGER) {
            double rate = (guarding ? 34 : 17) * (0.4 + 0.6 * hp / maxHp);
            posture = Math.max(0, posture - rate * dt);
        }
        double aimAng = Math.atan2(aimY - y, aimX - x);
        scarf += dt * (4 + Math.hypot(vx, vy) / 40);

        switch (st) {
            case FREE -> free(dt, aimAng);
            case ATTACK -> attack(dt, aimAng);
            case DODGE -> {
                double t = stT / DODGE_TIME;
                double sp = 660 * Math.pow(Math.max(0, 1 - t), 1.4) + 40;
                vx = dodgeDx * sp;
                vy = dodgeDy * sp;
                move(g.world, vx * dt, vy * dt);
                if (stT > 0.2 && bufAttack > 0) {
                    bufAttack = 0;
                    beginAttackOrDeathblow(0);
                } else if (stT > 0.2 && bufParry > 0) {
                    bufParry = 0;
                    toFree();
                    startGuard();
                } else if (stT >= DODGE_TIME) toFree();
            }
            case MIKIRI -> {
                if (stT < 0.1) move(g.world, Math.cos(facing) * 200 * dt, Math.sin(facing) * 200 * dt);
                if (stT > 0.3 && bufAttack > 0) {
                    bufAttack = 0;
                    beginAttackOrDeathblow(0);
                } else if (stT >= 0.45) toFree();
            }
            case STAGGER -> {
                move(g.world, vx * dt, vy * dt);
                double k = Math.exp(-dt * 8);
                vx *= k;
                vy *= k;
                if (stT >= staggerDur) toFree();
            }
            case HEAL -> {
                facing = U.turn(facing, aimAng, dt * 10);
                vx = U.lerp(vx, moveX * speed * 0.35, 1 - Math.exp(-dt * 16));
                vy = U.lerp(vy, moveY * speed * 0.35, 1 - Math.exp(-dt * 16));
                move(g.world, vx * dt, vy * dt);
                if (stT >= 0.45 && !healed) {
                    healed = true;
                    gourds--;
                    hp = Math.min(maxHp, hp + maxHp * 0.5);
                    g.fx.heal(x, y);
                    g.sfx.play(Sfx.S.HEAL);
                }
                if (stT >= 0.75) toFree();
            }
            case DEATHBLOW -> {
                Enemy e = dbTarget;
                facing = angleTo(e);
                double tx = e.x - Math.cos(facing) * (e.r + r + 6), ty = e.y - Math.sin(facing) * (e.r + r + 6);
                double k = 1 - Math.exp(-dt * 25);
                x += (tx - x) * k;
                y += (ty - y) * k;
                g.world.resolve(this);
                if (stT >= 0.13 && !dbDone) {
                    dbDone = true;
                    g.executeDeathblow(this, e);
                }
                if (stT >= 0.55) toFree();
            }
            case IAI -> iai(dt);
            default -> {}
        }
    }

    private void toFree() {
        st = St.FREE;
        stT = 0;
    }

    private void free(double dt, double aimAng) {
        facing = U.turn(facing, aimAng, dt * 22);
        if (bufParry > 0) {
            bufParry = 0;
            startGuard();
        }
        guarding = guardHeld || (g.time - guardStart < guardWindow);
        double sp = speed * (guarding ? 0.5 : 1);
        vx = U.lerp(vx, moveX * sp, 1 - Math.exp(-dt * 16));
        vy = U.lerp(vy, moveY * sp, 1 - Math.exp(-dt * 16));
        move(g.world, vx * dt, vy * dt);
        walkAnim += Math.hypot(vx, vy) * dt;
        if (bufAttack > 0) {
            bufAttack = 0;
            beginAttackOrDeathblow(comboGrace > 0 && combo >= 0 && combo < 2 ? combo + 1 : 0);
        } else if (bufDodge > 0) {
            bufDodge = 0;
            startDodge();
        } else if (bufHeal > 0) {
            bufHeal = 0;
            if (gourds > 0 && hp < maxHp) {
                st = St.HEAL;
                stT = 0;
                healed = false;
                guarding = false;
            } else if (gourds <= 0) g.fx.text("Gourd empty", x, y - 40, new Color(200, 200, 200), 13);
        } else if (bufIai > 0) {
            bufIai = 0;
            if (ki >= 100) startIai(aimAng);
            else g.fx.text("Ki not full", x, y - 40, new Color(140, 180, 255), 13);
        }
    }

    void startGuard() {
        spam += 1;
        guardWindow = U.clamp(PERFECT_WINDOW - Math.max(0, spam - 1.2) * 0.04, 0.05, PERFECT_WINDOW);
        guardStart = g.time;
        guarding = true;
    }

    private void beginAttackOrDeathblow(int idx) {
        Enemy t = g.deathblowTarget();
        if (t != null) startDeathblow(t);
        else startAttack(idx);
    }

    private void startAttack(int i) {
        st = St.ATTACK;
        stT = 0;
        phase = 0;
        combo = i;
        cur = COMBO[i];
        hitSet.clear();
        swingSign = i == 1 ? -1 : 1;
        guarding = false;
        facing = U.turn(facing, Math.atan2(aimY - y, aimX - x), 1.2);
    }

    private void attack(double dt, double aimAng) {
        if (phase == 0) facing = U.turn(facing, aimAng, dt * 14);
        if (phase <= 1) {
            double sp = phase == 0 ? cur.lunge * 0.35 : cur.lunge * (1 - stT / cur.active);
            if (!g.enemyInFront(this, facing, r + 26)) move(g.world, Math.cos(facing) * sp * dt, Math.sin(facing) * sp * dt);
        }
        if (phase == 0) {
            if (bufParry > 0) {
                bufParry = 0;
                toFree();
                startGuard();
            } else if (bufDodge > 0) {
                bufDodge = 0;
                startDodge();
            } else if (stT >= cur.windup) {
                phase = 1;
                stT = 0;
                g.sfx.play(combo == 2 ? Sfx.S.HEAVY : Sfx.S.SLASH);
                double start = facing + swingSign * cur.arc / 2;
                g.fx.slash(x, y, cur.range * 0.82, start, -swingSign * cur.arc, 0.2, combo == 2 ? 9 : 6, new Color(180, 220, 255));
            }
        } else if (phase == 1) {
            g.playerHitCheck(this, cur);
            if (stT >= cur.active) {
                phase = 2;
                stT = 0;
            }
        } else {
            if (stT > 0.04 && bufAttack > 0 && combo < 2) {
                bufAttack = 0;
                beginAttackOrDeathblow(combo + 1);
            } else if (bufParry > 0) {
                bufParry = 0;
                toFree();
                startGuard();
                comboGrace = 0.45;
            } else if (bufDodge > 0) {
                bufDodge = 0;
                startDodge();
            } else if (stT >= cur.recovery) {
                toFree();
                comboGrace = 0.4;
            }
        }
    }

    private void startDodge() {
        double dx = moveX, dy = moveY;
        if (dx == 0 && dy == 0) {
            dx = -Math.cos(facing);
            dy = -Math.sin(facing);
        }
        dodgeDx = dx;
        dodgeDy = dy;
        st = St.DODGE;
        stT = 0;
        guarding = false;
        g.sfx.play(Sfx.S.DODGE);
        g.fx.dust(x, y, 6);
        Enemy m = g.mikiriCandidate(this, dx, dy);
        if (m != null) {
            st = St.MIKIRI;
            stT = 0;
            facing = angleTo(m);
            g.onMikiri(this, m);
        }
    }

    private void startDeathblow(Enemy e) {
        st = St.DEATHBLOW;
        stT = 0;
        dbTarget = e;
        dbDone = false;
        e.beingExecuted = true;
        guarding = false;
        facing = angleTo(e);
    }

    private void startIai(double ang) {
        ki = 0;
        st = St.IAI;
        stT = 0;
        iaiSx = x;
        iaiSy = y;
        iaiDx = Math.cos(ang);
        iaiDy = Math.sin(ang);
        facing = ang;
        iaiVictims.clear();
        iaiDone = false;
        iaiLine = false;
        guarding = false;
        g.sfx.play(Sfx.S.IAI);
        g.zoomKick(0.08);
        g.fx.ring(x, y, 10, 70, 0.3, 4, new Color(150, 200, 255));
    }

    private void iai(double dt) {
        if (stT < 0.16) {
            move(g.world, iaiDx * 2100 * dt, iaiDy * 2100 * dt);
            g.fx.wisp(x, y, new Color(170, 210, 255));
            for (Enemy e : g.enemies) {
                if (e.st == Enemy.St.DEAD || iaiVictims.contains(e)) continue;
                if (U.segDist(e.x, e.y, iaiSx, iaiSy, x, y) < e.r + 45) iaiVictims.add(e);
            }
        } else if (!iaiLine) {
            iaiLine = true;
            g.fx.line(iaiSx, iaiSy, x, y, 0.9, 5, new Color(150, 200, 255));
        }
        if (stT >= 0.5 && !iaiDone) {
            iaiDone = true;
            g.resolveIai(this, iaiVictims);
        }
        if (stT >= 0.7) toFree();
    }

    /** Called when an attack reaches the player. Returns IGNORE, DEFLECT, BLOCK or HIT. */
    public int receive(double sx, double sy, double dmg, double post, boolean perilous) {
        if (st == St.DEAD || invulnerable()) return IGNORE;
        double ang = Math.atan2(sy - y, sx - x);
        double cx = x + Math.cos(ang) * (r + 12), cy = y + Math.sin(ang) * (r + 12);
        boolean front = Math.abs(U.angDiff(facing, ang)) < Math.toRadians(105);
        if (!perilous && st == St.FREE && guarding && front) {
            if (g.time - guardStart <= guardWindow) {
                posture = Math.min(maxPosture - 1, posture + post * 0.12);
                spam = 0;
                deflectStreak++;
                deflectStreakT = 1.6;
                ki = Math.min(100, ki + 12);
                guardFlash = 0.2;
                g.fx.sparks(cx, cy, ang, 2.6, 30, 560, new Color(255, 200, 80));
                g.fx.sparks(cx, cy, ang + Math.PI / 2, 0.6, 6, 400, Color.WHITE);
                g.fx.sparks(cx, cy, ang - Math.PI / 2, 0.6, 6, 400, Color.WHITE);
                g.fx.ring(cx, cy, 4, 46, 0.25, 3, new Color(255, 240, 180));
                g.sfx.play(Sfx.S.CLANG);
                g.hitstop(0.085);
                g.shake(7);
                g.flash(new Color(255, 240, 200), 0.12);
                String s = deflectStreak > 1 ? "DEFLECT x" + deflectStreak : "DEFLECT";
                g.fx.text(s, x, y - 42, new Color(255, 215, 90), 15 + Math.min(deflectStreak, 6) * 2);
                return DEFLECT;
            }
            posture += post;
            postureCd = 1.0;
            move(g.world, -Math.cos(ang) * 10, -Math.sin(ang) * 10);
            g.fx.sparks(cx, cy, ang, 1.8, 10, 280, new Color(255, 150, 60));
            g.sfx.play(Sfx.S.BLOCK);
            g.shake(3);
            g.hitstop(0.035);
            deflectStreak = 0;
            if (posture >= maxPosture) {
                posture = maxPosture * 0.6;
                hp -= dmg * 0.5;
                st = St.STAGGER;
                stT = 0;
                staggerDur = 1.2;
                guarding = false;
                vx = -Math.cos(ang) * 200;
                vy = -Math.sin(ang) * 200;
                g.fx.text("GUARD BROKEN", x, y - 42, new Color(255, 80, 60), 18);
                g.sfx.play(Sfx.S.BREAK);
                g.shake(10);
                if (hp <= 0) die();
            }
            return BLOCK;
        }
        hp -= dmg;
        posture = Math.min(maxPosture, posture + post * 0.35);
        postureCd = 1.0;
        hurtFlash = 0.3;
        invuln = 0.35;
        guarding = false;
        deflectStreak = 0;
        st = St.STAGGER;
        stT = 0;
        staggerDur = perilous ? 0.55 : 0.3;
        vx = -Math.cos(ang) * (perilous ? 380 : 230);
        vy = -Math.sin(ang) * (perilous ? 380 : 230);
        g.fx.blood(x, y, ang + Math.PI, 12, 260);
        g.sfx.play(Sfx.S.HURT);
        g.shake(perilous ? 14 : 9);
        g.hitstop(0.06);
        g.flash(new Color(200, 0, 0), 0.25);
        if (hp <= 0) die();
        return HIT;
    }

    /** An elite parried our swing. */
    public void recoil(double awayAng) {
        st = St.STAGGER;
        stT = 0;
        staggerDur = 0.45;
        posture = Math.min(maxPosture - 1, posture + 15);
        postureCd = 1.0;
        vx = Math.cos(awayAng) * 260;
        vy = Math.sin(awayAng) * 260;
    }

    private void die() {
        hp = 0;
        st = St.DEAD;
        stT = 0;
        deadT = 0;
        g.onPlayerDeath();
    }

    public void respawn(double sx, double sy) {
        x = sx;
        y = sy;
        hp = maxHp;
        posture = 0;
        gourds = maxGourds;
        st = St.FREE;
        stT = 0;
        vx = vy = 0;
        invuln = 1.5;
        ki = 0;
    }

    // ---------------- rendering ----------------
    public void draw(Graphics2D g2, double time) {
        if (st == St.DEAD) {
            AffineTransform at = g2.getTransform();
            g2.translate(x, y);
            g2.rotate(facing);
            g2.setColor(new Color(40, 45, 70));
            g2.fill(new Ellipse2D.Double(-r * 1.3, -r * 0.8, r * 2.6, r * 1.6));
            g2.setTransform(at);
            return;
        }
        Draw.shadow(g2, x, y, r);
        // scarf trails behind
        double back = facing + Math.PI;
        Path2D sc = new Path2D.Double();
        double sx = x + Math.cos(back) * r * 0.5, sy = y + Math.sin(back) * r * 0.5;
        sc.moveTo(sx, sy);
        for (int i = 1; i <= 5; i++) {
            double d = i * 7;
            double w = Math.sin(scarf - i * 0.9) * i * 1.6;
            sc.lineTo(sx + Math.cos(back) * d + Math.cos(back + Math.PI / 2) * w, sy + Math.sin(back) * d + Math.sin(back + Math.PI / 2) * w);
        }
        g2.setStroke(new BasicStroke(4f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g2.setColor(new Color(200, 30, 40));
        g2.draw(sc);

        Color robe = new Color(40, 45, 72), shoulder = new Color(150, 32, 38);
        if (hurtFlash > 0.15) {
            robe = Color.WHITE;
            shoulder = Color.WHITE;
        }
        boolean flicker = invuln > 0 && st == St.FREE && ((int) (time * 20) % 2 == 0);
        if (flicker) {
            robe = U.shade(robe, 1.8);
        }
        if (st == St.DODGE) {
            g2.setColor(new Color(160, 190, 255, 60));
            g2.fill(new Ellipse2D.Double(x - r * 1.4 - vx * 0.03, y - r * 1.4 - vy * 0.03, r * 2.8, r * 2.8));
        }
        Draw.body(g2, x, y, r, facing, robe, shoulder, new Color(206, 176, 116), 0, walkAnim);

        // sword
        double handRel = 0.9, blade = facing + 0.55;
        if (st == St.ATTACK) {
            double a0 = swingSign * cur.arc / 2, a1 = -swingSign * cur.arc / 2;
            double rel = phase == 0 ? a0 + swingSign * 0.35 * (stT / cur.windup) : phase == 1 ? U.lerp(a0, a1, Math.min(1, stT / cur.active)) : a1;
            blade = facing + rel;
            handRel = rel * 0.6;
        } else if (st == St.FREE && guarding) {
            handRel = 0.15;
            blade = facing - 1.4;
        } else if (st == St.IAI || st == St.MIKIRI) {
            handRel = 0.3;
            blade = facing + (st == St.IAI && stT > 0.16 ? 2.6 : 0.1);
        } else if (st == St.DEATHBLOW) {
            handRel = 0;
            blade = facing + (stT < 0.13 ? 1.4 : -0.6);
        } else if (st == St.STAGGER) {
            blade = facing + 1.6;
        }
        double hx = x + Math.cos(facing + handRel) * r * 0.9, hy = y + Math.sin(facing + handRel) * r * 0.9;
        Draw.katana(g2, hx, hy, blade, 56, guardFlash > 0 ? new Color(255, 230, 150) : new Color(210, 215, 230));
        if (st == St.FREE && guarding && g.time - guardStart <= guardWindow) {
            g2.setColor(new Color(255, 240, 200, 90));
            g2.fill(new Ellipse2D.Double(hx - 14, hy - 14, 28, 28));
        }
    }
}
