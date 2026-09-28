import java.awt.*;
import java.awt.event.*;
import java.awt.geom.*;
import java.awt.image.BufferStrategy;
import java.awt.image.BufferedImage;
import java.util.*;
import javax.swing.*;

/**
 * RONIN'S PATH - a top-down open world samurai game.
 * Pure Java (AWT/Swing), no external libraries. Run main().
 */
public class SamuraiGame {
    public static final double DT = 1.0 / 60.0;
    static final int W = 1280, H = 720;

    final JFrame frame;
    final Canvas canvas;
    final Input in = new Input();
    public final Sfx sfx = new Sfx();
    public final Effects fx = new Effects();
    public final World world;
    public final Player player;
    public final ArrayList<Enemy> enemies = new ArrayList<>();
    final ArrayList<Arrow> arrows = new ArrayList<>();
    final Random rnd;

    public double time, realTime, timeScale = 1;
    double camX, camY, shakeAmt, zoomKickV, hitstopT, slowmoT, flashA, hpGhost = 100;
    Color flashColor = Color.WHITE;
    boolean paused, showHelp = true;
    World.Shrine lastShrine;
    int kills, elitesSlain, totalElites;
    String bannerBig, bannerSmall;
    Color bannerColor = Color.WHITE;
    double bannerT;
    Enemy boss;
    BufferedImage vignette, redVignette;
    int vigW, vigH;
    final Font kanjiFont, bigKanji;
    final boolean kanjiOk;
    final Font hudFont = new Font("SansSerif", Font.BOLD, 14), smallFont = new Font("SansSerif", Font.PLAIN, 13),
            titleFont = new Font("Serif", Font.BOLD, 46), subFont = new Font("Serif", Font.ITALIC, 20);

    public static void main(String[] args) {
        long seed = args.length > 0 ? Long.parseLong(args[0]) : System.nanoTime();
        new SamuraiGame(seed).run();
    }

    SamuraiGame(long seed) {
        rnd = new Random(seed);
        world = new World(seed);
        lastShrine = world.shrines.get(0);
        player = new Player(this, lastShrine.x, lastShrine.y + 60);
        camX = player.x;
        camY = player.y;
        spawnEnemies();

        String[] candidates = { "Yu Mincho", "MS Mincho", "Yu Gothic", "MS Gothic", "Meiryo", "Noto Serif CJK JP", "Serif", "Dialog" };
        Font kf = null;
        for (String n : candidates) {
            Font f = new Font(n, Font.BOLD, 26);
            if (f.canDisplay('\u5371') && f.canDisplay('\u6b7b')) {
                kf = f;
                break;
            }
        }
        kanjiOk = kf != null;
        kanjiFont = kf != null ? kf : new Font("SansSerif", Font.BOLD, 26);
        bigKanji = kanjiFont.deriveFont(Font.BOLD, 150f);

        frame = new JFrame("Ronin's Path");
        canvas = new Canvas();
        canvas.setPreferredSize(new Dimension(W, H));
        canvas.setIgnoreRepaint(true);
        canvas.setBackground(Color.BLACK);
        canvas.setFocusTraversalKeysEnabled(false);
        canvas.addKeyListener(in);
        canvas.addMouseListener(in);
        canvas.addMouseMotionListener(in);
        frame.setIgnoreRepaint(true);
        frame.add(canvas);
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.addWindowFocusListener(new WindowAdapter() {
            @Override public void windowLostFocus(WindowEvent e) { in.releaseAll(); }
        });
        frame.setVisible(true);
        canvas.requestFocus();
        canvas.createBufferStrategy(2);
    }

    private void spawnEnemies() {
        long s = 1;
        for (World.Camp c : world.camps) {
            if (c.elite) {
                totalElites++;
                addEnemy(new Enemy(this, c.eliteType, c.x + 70, c.y, true, c.eliteName, s++), c);
                for (int i = 0; i < 3; i++) addEnemy(randomGrunt(c, s++, false), c);
            } else {
                int n = 3 + rnd.nextInt(3);
                for (int i = 0; i < n; i++) addEnemy(randomGrunt(c, s++, false), c);
                if (rnd.nextDouble() < 0.35) addEnemy(randomGrunt(c, s++, true), c);
            }
        }
        World.Shrine sp = world.shrines.get(0);
        int wanderers = 0;
        for (int tries = 0; tries < 2000 && wanderers < 30; tries++) {
            double x = 300 + rnd.nextDouble() * (World.SIZE - 600), y = 300 + rnd.nextDouble() * (World.SIZE - 600);
            if (U.dist(x, y, sp.x, sp.y) < 900 || world.nearCamp(x, y) < 300 || world.nearShrine(x, y) < 400) continue;
            int group = rnd.nextDouble() < 0.4 ? 2 : 1;
            for (int i = 0; i < group; i++) {
                Enemy.T t = pickType();
                addEnemy(new Enemy(this, t, x + i * 40, y + i * 30, false, null, 1000 + tries * 3L + i), null);
            }
            wanderers++;
        }
    }

    private Enemy.T pickType() {
        double r = rnd.nextDouble();
        return r < 0.45 ? Enemy.T.RONIN : r < 0.72 ? Enemy.T.SPEAR : Enemy.T.ARCHER;
    }

    private Enemy randomGrunt(World.Camp c, long seed, boolean brute) {
        double a = rnd.nextDouble() * Math.PI * 2, d = 60 + rnd.nextDouble() * (c.r - 110);
        return new Enemy(this, brute ? Enemy.T.BRUTE : pickType(), c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, false, null, seed);
    }

    private void addEnemy(Enemy e, World.Camp c) {
        world.resolve(e);
        e.homeX = e.x;
        e.homeY = e.y;
        e.camp = c;
        if (c != null) c.members.add(e);
        enemies.add(e);
    }

    // ================= loop =================
    void run() {
        long last = System.nanoTime();
        double acc = 0;
        while (true) {
            long now = System.nanoTime();
            acc += (now - last) / 1e9;
            last = now;
            if (acc > 0.2) acc = 0.2;
            boolean ticked = false;
            while (acc >= DT) {
                tick(DT);
                in.endTick();
                acc -= DT;
                ticked = true;
            }
            if (ticked) render();
            else {
                try {
                    Thread.sleep(1);
                } catch (InterruptedException e) {
                    return;
                }
            }
        }
    }

    // ================= feedback API =================
    public void hitstop(double s) { hitstopT = Math.max(hitstopT, s); }

    public void shake(double a) { shakeAmt = Math.max(shakeAmt, a); }

    public void slowmo(double s) { slowmoT = Math.max(slowmoT, s); }

    public void zoomKick(double z) { zoomKickV = Math.max(zoomKickV, z); }

    public void flash(Color c, double a) {
        flashColor = c;
        flashA = Math.max(flashA, a);
    }

    public void banner(String big, String small, Color c) {
        bannerBig = big;
        bannerSmall = small;
        bannerColor = c;
        bannerT = 3.2;
    }

    // ================= update =================
    double zoom() { return 1.0 + zoomKickV; }

    void tick(double dt) {
        realTime += dt;
        if (in.hit(KeyEvent.VK_H) || (showHelp && (in.hit(KeyEvent.VK_ENTER) || in.mouseHit(1)))) {
            showHelp = !showHelp;
            return;
        }
        if (in.hit(KeyEvent.VK_ESCAPE)) paused = !paused;
        if (showHelp || paused) return;

        int sw = canvas.getWidth(), sh = canvas.getHeight();
        double z = zoom();
        double wx = (in.mx - sw / 2.0) / z + camX, wy = (in.my - sh / 2.0) / z + camY;
        player.readInput(in, wx, wy, dt);
        if (in.hit(KeyEvent.VK_E)) interact();

        shakeAmt *= Math.exp(-dt * 9);
        zoomKickV *= Math.exp(-dt * 5);
        flashA = Math.max(0, flashA - dt * 2.5);
        bannerT -= dt;
        hpGhost = hpGhost > player.hp ? Math.max(player.hp, hpGhost - dt * 40) : player.hp;

        if (hitstopT > 0) {
            hitstopT -= dt;
            return;
        }
        if (slowmoT > 0) {
            slowmoT -= dt;
            timeScale = 0.3;
        } else timeScale = U.lerp(timeScale, 1, 1 - Math.exp(-dt * 8));
        double sdt = dt * timeScale;
        time += sdt;

        player.update(sdt);
        for (Enemy e : enemies) {
            if (e.st == Enemy.St.DEAD || U.dist(e.x, e.y, player.x, player.y) < 1800 || e.st == Enemy.St.RETURN) e.update(sdt);
        }
        separate();
        updateArrows(sdt);
        fx.update(sdt);
        double vw = sw / z, vh = sh / z;
        fx.ambient(camX, camY, vw, vh, sdt, Math.sin(time * 0.2) * 20);
        for (World.Obstacle f : world.fires) {
            if (Math.abs(f.x - player.x) < 900 && Math.abs(f.y - player.y) < 700 && rnd.nextDouble() < sdt * 14) fx.ember(f.x, f.y);
        }
        for (World.Shrine s : world.shrines) {
            if (!s.discovered && U.dist(s.x, s.y, player.x, player.y) < 380) {
                s.discovered = true;
                banner("Shrine Discovered", s.name, new Color(255, 215, 120));
                sfx.play(Sfx.S.SHRINE);
            }
        }
        if (boss != null && (boss.st == Enemy.St.DEAD || boss.st == Enemy.St.RETURN || boss.st == Enemy.St.IDLE
                || boss.distTo(player) > 1300)) boss = null;

        double tx = player.x + (wx - player.x) * 0.18, ty = player.y + (wy - player.y) * 0.18;
        double k = 1 - Math.exp(-dt * 6);
        camX += (tx - camX) * k;
        camY += (ty - camY) * k;
        camX = U.clamp(camX, vw / 2, World.SIZE - vw / 2);
        camY = U.clamp(camY, vh / 2, World.SIZE - vh / 2);
    }

    private void interact() {
        if (player.st == Player.St.DEAD) {
            if (player.deadT > 1.2) respawn();
            return;
        }
        World.Shrine s = nearShrine();
        if (s != null && player.st == Player.St.FREE) {
            lastShrine = s;
            s.discovered = true;
            player.hp = player.maxHp;
            player.gourds = player.maxGourds;
            player.posture = 0;
            sfx.play(Sfx.S.SHRINE);
            fx.ring(s.x, s.y, 20, 160, 1.0, 4, new Color(255, 220, 140));
            fx.heal(player.x, player.y);
            banner("Rested", s.name + "  -  HP & gourds restored", new Color(255, 220, 140));
        }
    }

    World.Shrine nearShrine() {
        for (World.Shrine s : world.shrines) if (U.dist(s.x, s.y + 20, player.x, player.y) < 110) return s;
        return null;
    }

    private void respawn() {
        player.respawn(lastShrine.x, lastShrine.y + 60);
        for (Enemy e : enemies) if (e.aware) e.resetToHome();
        arrows.clear();
        boss = null;
        camX = player.x;
        camY = player.y;
        banner("Resurrection", lastShrine.name, new Color(230, 200, 200));
    }

    private void separate() {
        Player p = player;
        boolean passThrough = p.st == Player.St.IAI || p.st == Player.St.DEATHBLOW || p.st == Player.St.DODGE;
        for (int i = 0; i < enemies.size(); i++) {
            Enemy a = enemies.get(i);
            if (a.st == Enemy.St.DEAD || Math.abs(a.x - p.x) > 1200 || Math.abs(a.y - p.y) > 1200) continue;
            for (int j = i + 1; j < enemies.size(); j++) {
                Enemy b = enemies.get(j);
                if (b.st == Enemy.St.DEAD) continue;
                double dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r + 2;
                if (d < min && d > 0.01) {
                    double push = (min - d) / 2;
                    a.x -= dx / d * push;
                    a.y -= dy / d * push;
                    b.x += dx / d * push;
                    b.y += dy / d * push;
                    world.resolve(a);
                    world.resolve(b);
                }
            }
            if (!passThrough) {
                double dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy), min = a.r + p.r;
                if (d < min && d > 0.01) {
                    double push = min - d;
                    a.x += dx / d * push * 0.7;
                    a.y += dy / d * push * 0.7;
                    p.x -= dx / d * push * 0.3;
                    p.y -= dy / d * push * 0.3;
                    world.resolve(a);
                    world.resolve(p);
                }
            }
        }
    }

    private void updateArrows(double dt) {
        for (int i = arrows.size() - 1; i >= 0; i--) {
            Arrow a = arrows.get(i);
            if (a.stuck) {
                a.stuckT += dt;
                if (a.stuckT > 3) arrows.remove(i);
                continue;
            }
            a.life -= dt;
            for (int step = 0; step < 2 && !a.dead && !a.stuck; step++) {
                a.x += a.vx * dt / 2;
                a.y += a.vy * dt / 2;
                if (world.solidAt(a.x, a.y)) {
                    a.stuck = true;
                    fx.dust(a.x, a.y, 2);
                    break;
                }
                if (!a.friendly) {
                    if (U.dist(a.x, a.y, player.x, player.y) < player.r + 5) {
                        int res = player.receive(a.x - a.vx, a.y - a.vy, a.damage, a.posture, false);
                        if (res == Player.DEFLECT) {
                            double ang = Math.atan2(-a.vy, -a.vx);
                            if (a.owner != null && a.owner.st != Enemy.St.DEAD && a.owner.distTo(player) < 1000) ang = player.angleTo(a.owner);
                            a.vx = Math.cos(ang) * 1100;
                            a.vy = Math.sin(ang) * 1100;
                            a.friendly = true;
                            a.life = 2;
                            fx.text("REFLECT", player.x, player.y - 62, new Color(255, 230, 120), 14);
                        } else if (res != Player.IGNORE) a.dead = true;
                    }
                } else {
                    for (Enemy e : enemies) {
                        if (e.st == Enemy.St.DEAD || U.dist(a.x, a.y, e.x, e.y) > e.r + 5) continue;
                        e.takeRaw(a.damage * 2.5, a.posture * 2.5, Math.atan2(a.vy, a.vx));
                        sfx.play(Sfx.S.HIT);
                        hitstop(0.05);
                        a.dead = true;
                        break;
                    }
                }
            }
            if (a.dead || a.life <= 0) arrows.remove(i);
        }
    }

    // ================= combat API =================
    public boolean requestToken(Enemy e) {
        if (e.elite) return true;
        int n = 0;
        for (Enemy o : enemies) if (o != e && o.hasToken && !o.elite) n++;
        return n < 2;
    }

    public void engageBoss(Enemy e) {
        boss = e;
        banner(e.name, "An elite warrior blocks your path", new Color(200, 140, 255));
    }

    public void spawnArrow(Enemy e, Attack atk) {
        Arrow a = new Arrow();
        double sp = e.elite ? 900 : 720;
        a.x = e.x + Math.cos(e.facing) * (e.r + 10);
        a.y = e.y + Math.sin(e.facing) * (e.r + 10);
        a.vx = Math.cos(e.facing) * sp;
        a.vy = Math.sin(e.facing) * sp;
        a.owner = e;
        a.damage = atk.damage;
        a.posture = atk.posture;
        arrows.add(a);
        sfx.play(Sfx.S.ARROW);
    }

    boolean stealthable(Enemy e) { return !e.aware && e.st == Enemy.St.IDLE; }

    public Enemy deathblowTarget() {
        Enemy best = null;
        double bd = Double.MAX_VALUE;
        for (Enemy e : enemies) {
            if (e.st == Enemy.St.DEAD || e.beingExecuted) continue;
            boolean broken = e.st == Enemy.St.BROKEN;
            if (!broken && !stealthable(e)) continue;
            double d = e.distTo(player);
            if (d < (broken ? 105 : 75) + e.r && d < bd) {
                bd = d;
                best = e;
            }
        }
        return best;
    }

    public boolean enemyInFront(Player p, double ang, double dist) {
        for (Enemy e : enemies) {
            if (e.st == Enemy.St.DEAD) continue;
            double d = p.distTo(e);
            if (d < dist + e.r && Math.abs(U.angDiff(ang, p.angleTo(e))) < 0.9) return true;
        }
        return false;
    }

    public void playerHitCheck(Player p, Attack atk) {
        for (Enemy e : enemies) {
            if (e.st == Enemy.St.DEAD || p.hitSet.contains(e)) continue;
            double d = p.distTo(e);
            if (d > atk.range + e.r) continue;
            double tol = atk.arc / 2 + Math.asin(Math.min(1, e.r / Math.max(d, 1)));
            if (Math.abs(U.angDiff(p.facing, p.angleTo(e))) <= tol) {
                p.hitSet.add(e);
                e.takeHit(p, atk);
            }
        }
    }

    public Enemy mikiriCandidate(Player p, double dx, double dy) {
        for (Enemy e : enemies) {
            if (e.atk == null || !e.atk.perilous || !e.atk.thrust) continue;
            boolean timing = (e.st == Enemy.St.WINDUP && e.stDur - e.stT < 0.32) || e.st == Enemy.St.ACTIVE;
            if (!timing) continue;
            double d = p.distTo(e);
            if (d > e.atk.range + 80) continue;
            double a = p.angleTo(e);
            if (dx * Math.cos(a) + dy * Math.sin(a) > 0.5) return e;
        }
        return null;
    }

    public void onMikiri(Player p, Enemy e) {
        double a = p.angleTo(e);
        double cx = (p.x + e.x) / 2, cy = (p.y + e.y) / 2;
        e.posture += e.maxPosture * 0.5;
        e.lastDamageT = time;
        e.showBars = 3;
        e.perilousT = 0;
        e.releaseToken();
        e.setSt(Enemy.St.STUN);
        e.stDur = 1.1;
        e.kbx = Math.cos(a) * 260;
        e.kby = Math.sin(a) * 260;
        p.ki = Math.min(100, p.ki + 25);
        fx.sparks(cx, cy, a + Math.PI, 3.0, 40, 600, new Color(140, 220, 255));
        fx.ring(cx, cy, 5, 90, 0.4, 5, new Color(180, 230, 255));
        fx.dust(p.x, p.y, 12);
        fx.text("MIKIRI COUNTER", p.x, p.y - 48, new Color(140, 220, 255), 20);
        sfx.play(Sfx.S.CLANG);
        sfx.play(Sfx.S.BLOCK);
        hitstop(0.12);
        shake(11);
        slowmo(0.35);
        flash(new Color(180, 230, 255), 0.2);
        if (e.posture >= e.maxPosture) e.breakPosture();
    }

    public void onPostureBreak(Enemy e) {
        sfx.play(Sfx.S.BREAK);
        hitstop(0.1);
        slowmo(0.3);
        shake(8);
        fx.ring(e.x, e.y, 10, 100, 0.5, 5, new Color(255, 60, 40));
        fx.sparks(e.x, e.y, 0, Math.PI * 2, 24, 380, new Color(255, 120, 60));
        fx.text("POSTURE BROKEN", e.x, e.y - 44, new Color(255, 90, 60), 16);
    }

    public void executeDeathblow(Player p, Enemy e) {
        double a = p.angleTo(e);
        boolean stealth = !e.aware;
        e.beingExecuted = false;
        fx.blood(e.x, e.y, a, 45, 480);
        fx.sparks(e.x, e.y, a, 1.0, 20, 650, Color.WHITE);
        fx.line(e.x - Math.cos(a + 0.8) * 70, e.y - Math.sin(a + 0.8) * 70, e.x + Math.cos(a + 0.8) * 70, e.y + Math.sin(a + 0.8) * 70, 0.5, 5,
                new Color(255, 80, 80));
        fx.line(e.x - Math.cos(a - 0.8) * 60, e.y - Math.sin(a - 0.8) * 60, e.x + Math.cos(a - 0.8) * 60, e.y + Math.sin(a - 0.8) * 60, 0.6, 4,
                new Color(255, 220, 220));
        fx.ring(e.x, e.y, 10, 130, 0.6, 6, new Color(255, 50, 40));
        sfx.play(Sfx.S.DEATHBLOW);
        hitstop(0.16);
        shake(14);
        slowmo(0.45);
        zoomKick(0.12);
        flash(new Color(255, 200, 200), 0.3);
        p.ki = Math.min(100, p.ki + 20);
        if (e.elite && e.lives > 1) {
            e.lives--;
            e.hp = e.maxHp;
            e.posture = 0;
            if (!e.aware) e.alert(true);
            e.setSt(Enemy.St.STUN);
            e.stDur = 1.4;
            fx.text(stealth ? "STEALTH DEATHBLOW" : "DEATHBLOW", e.x, e.y - 50, new Color(255, 70, 60), 22);
            fx.text(e.lives + " life remains", e.x, e.y - 26, new Color(220, 180, 255), 14);
        } else {
            fx.text(stealth ? "STEALTH DEATHBLOW" : "DEATHBLOW", e.x, e.y - 50, new Color(255, 70, 60), 22);
            e.die(a);
        }
    }

    public void resolveIai(Player p, ArrayList<Enemy> victims) {
        sfx.play(Sfx.S.DEATHBLOW);
        flash(new Color(200, 230, 255), 0.25);
        if (victims.isEmpty()) return;
        hitstop(0.12);
        shake(12);
        for (Enemy e : victims) {
            if (e.st == Enemy.St.DEAD) continue;
            double a = rnd.nextDouble() * Math.PI;
            fx.line(e.x - Math.cos(a) * 55, e.y - Math.sin(a) * 55, e.x + Math.cos(a) * 55, e.y + Math.sin(a) * 55, 0.6, 4,
                    new Color(170, 210, 255));
            fx.sparks(e.x, e.y, a, 1.0, 14, 500, new Color(170, 210, 255));
            e.beingExecuted = false;
            e.takeRaw(45, 70, a);
        }
    }

    public void onEnemyKilled(Enemy e) {
        kills++;
        player.ki = Math.min(100, player.ki + 10);
        if (e.elite) {
            elitesSlain++;
            player.maxHp += 20;
            player.hp = player.maxHp;
            player.maxGourds++;
            player.gourds = player.maxGourds;
            if (boss == e) boss = null;
            if (elitesSlain >= totalElites) banner("The Land Is At Peace", "All elites have fallen. You are the last sword standing.",
                    new Color(255, 215, 120));
            else banner("ELITE SLAIN", e.name + "  -  Vitality up, +1 Healing Gourd", new Color(255, 90, 70));
        }
        World.Camp c = e.camp;
        if (c != null && !c.cleared) {
            boolean all = true;
            for (Enemy m : c.members) if (m.st != Enemy.St.DEAD) all = false;
            if (all) {
                c.cleared = true;
                if (!e.elite) banner("Camp Cleared", "The bandits here will trouble no one again", new Color(230, 230, 200));
                if (player.gourds < player.maxGourds) {
                    player.gourds++;
                    fx.text("+1 Gourd", player.x, player.y - 50, new Color(255, 180, 90), 15);
                }
            }
        }
    }

    public void onPlayerDeath() {
        sfx.play(Sfx.S.BREAK);
        slowmo(1.0);
        shake(12);
        boss = null;
        for (Enemy e : enemies) e.releaseToken();
    }

    // ================= render =================
    void render() {
        BufferStrategy bs = canvas.getBufferStrategy();
        if (bs == null) return;
        Graphics2D g = (Graphics2D) bs.getDrawGraphics();
        try {
            int sw = canvas.getWidth(), sh = canvas.getHeight();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setColor(Color.BLACK);
            g.fillRect(0, 0, sw, sh);
            AffineTransform base = g.getTransform();
            double z = zoom();
            double shx = (rnd.nextDouble() - 0.5) * 2 * shakeAmt, shy = (rnd.nextDouble() - 0.5) * 2 * shakeAmt;
            g.translate(sw / 2.0, sh / 2.0);
            g.scale(z, z);
            g.translate(-camX + shx, -camY + shy);
            double l = camX - sw / 2.0 / z - 20, t = camY - sh / 2.0 / z - 20, r = camX + sw / 2.0 / z + 20, b = camY + sh / 2.0 / z + 20;

            world.drawGround(g, l, t, r, b);
            ArrayList<World.Obstacle> vis = world.visible(l, t, r, b);
            world.drawPonds(g, vis, time);
            fx.drawDecals(g);
            world.drawObstacles(g, vis, time);
            ArrayList<Enemy> visEnemies = new ArrayList<>();
            for (Enemy e : enemies) if (e.x > l - 100 && e.x < r + 100 && e.y > t - 100 && e.y < b + 100) visEnemies.add(e);
            for (Enemy e : visEnemies) if (e.st == Enemy.St.DEAD) e.draw(g, time);
            for (Arrow a : arrows) if (a.stuck) a.draw(g);
            for (Enemy e : visEnemies) if (e.st != Enemy.St.DEAD) e.draw(g, time);
            player.draw(g, time);
            for (Arrow a : arrows) if (!a.stuck) a.draw(g);
            fx.drawWorld(g);
            world.drawCanopies(g, vis, player.x, player.y, time);
            fx.drawPetals(g);
            Enemy db = deathblowTarget();
            for (Enemy e : visEnemies) e.drawOverlay(g, time, kanjiFont, kanjiOk, e == db && stealthable(e));
            fx.drawTexts(g);
            g.setTransform(base);

            drawVignette(g, sw, sh);
            if (flashA > 0) {
                g.setColor(U.alpha(flashColor, flashA * 0.6));
                g.fillRect(0, 0, sw, sh);
            }
            drawHud(g, sw, sh, db);
        } finally {
            g.dispose();
        }
        bs.show();
        Toolkit.getDefaultToolkit().sync();
    }

    private void drawVignette(Graphics2D g, int sw, int sh) {
        if (vignette == null || vigW != sw || vigH != sh) {
            vigW = sw;
            vigH = sh;
            vignette = makeVignette(sw, sh, new Color(0, 0, 0, 170));
            redVignette = makeVignette(sw, sh, new Color(160, 0, 0, 200));
        }
        g.drawImage(vignette, 0, 0, null);
        double hpFrac = player.hp / player.maxHp;
        if (hpFrac < 0.35 && player.st != Player.St.DEAD) {
            float a = (float) U.clamp((0.35 - hpFrac) / 0.35 * (0.7 + 0.3 * Math.sin(realTime * 6)), 0, 1);
            Composite old = g.getComposite();
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, a));
            g.drawImage(redVignette, 0, 0, null);
            g.setComposite(old);
        }
    }

    private BufferedImage makeVignette(int w, int h, Color edge) {
        BufferedImage img = new BufferedImage(Math.max(1, w), Math.max(1, h), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        float rad = (float) (Math.max(w, h) * 0.75);
        g.setPaint(new RadialGradientPaint(new Point2D.Float(w / 2f, h / 2f), rad, new float[] { 0.5f, 1f },
                new Color[] { new Color(0, 0, 0, 0), edge }));
        g.fillRect(0, 0, w, h);
        g.dispose();
        return img;
    }

    private void text(Graphics2D g, String s, int x, int y, Color c, boolean center) {
        FontMetrics fm = g.getFontMetrics();
        if (center) x -= fm.stringWidth(s) / 2;
        g.setColor(new Color(0, 0, 0, 180));
        g.drawString(s, x + 2, y + 2);
        g.setColor(c);
        g.drawString(s, x, y);
    }

    private void drawHud(Graphics2D g, int sw, int sh, Enemy db) {
        Player p = player;
        // --- vitality ---
        int hx = 28, hy = sh - 86;
        double hpW = Math.min(460, p.maxHp * 2.6);
        g.setColor(new Color(0, 0, 0, 170));
        g.fillRect(hx - 2, hy - 2, (int) hpW + 4, 16);
        g.setColor(new Color(230, 220, 200));
        g.fillRect(hx, hy, (int) (hpW * U.clamp(hpGhost / p.maxHp, 0, 1)), 12);
        g.setColor(new Color(190, 30, 34));
        g.fillRect(hx, hy, (int) (hpW * U.clamp(p.hp / p.maxHp, 0, 1)), 12);
        g.setFont(hudFont);
        text(g, (int) Math.max(0, p.hp) + " / " + (int) p.maxHp, hx + 6, hy - 6, new Color(240, 230, 220), false);
        // --- ki ---
        int ky = hy + 20;
        g.setColor(new Color(0, 0, 0, 170));
        g.fillRect(hx - 2, ky - 2, 204, 10);
        boolean full = p.ki >= 100;
        g.setColor(full ? new Color(150, 210, 255, (int) (180 + 75 * Math.sin(realTime * 8))) : new Color(70, 120, 210));
        g.fillRect(hx, ky, (int) (200 * p.ki / 100), 6);
        g.setFont(smallFont);
        if (full) text(g, "[F] IAI FLASH READY", hx + 212, ky + 8, new Color(170, 220, 255), false);
        // --- gourds ---
        for (int i = 0; i < p.maxGourds; i++) {
            int gx = hx + i * 24, gy = ky + 16;
            boolean have = i < p.gourds;
            g.setColor(have ? new Color(220, 130, 50) : new Color(70, 70, 70));
            g.fillOval(gx, gy + 6, 16, 16);
            g.fillOval(gx + 3, gy, 10, 10);
            g.setColor(have ? new Color(120, 60, 30) : new Color(40, 40, 40));
            g.fillRect(gx + 6, gy - 3, 4, 4);
        }
        g.setFont(smallFont);
        text(g, "[Q] heal", hx + p.maxGourds * 24 + 6, ky + 32, new Color(220, 200, 170), false);

        // --- player posture (center) ---
        if (p.posture > 0.5) Draw.postureBar(g, sw / 2.0, sh - 44, 380, 9, p.posture / p.maxPosture, false);

        // --- prompts ---
        String prompt = null;
        if (p.st != Player.St.DEAD) {
            if (db != null) prompt = stealthable(db) ? "[LMB]  STEALTH DEATHBLOW" : "[LMB]  DEATHBLOW";
            else if (nearShrine() != null) prompt = "[E]  Rest at " + nearShrine().name;
        }
        if (prompt != null) {
            g.setFont(new Font("Serif", Font.BOLD, 20));
            text(g, prompt, sw / 2, sh - 70, db != null ? new Color(255, 90, 80) : new Color(255, 220, 150), true);
        }

        // --- top-left info ---
        int cleared = 0;
        for (World.Camp c : world.camps) if (c.cleared) cleared++;
        g.setFont(new Font("Serif", Font.BOLD, 22));
        text(g, world.biomeName(p.x, p.y), 24, 36, new Color(245, 235, 215), false);
        g.setFont(smallFont);
        text(g, "Elites slain " + elitesSlain + "/" + totalElites + "     Camps cleared " + cleared + "/" + world.camps.size()
                + "     Kills " + kills, 24, 58, new Color(220, 210, 190), false);
        text(g, "[H] controls   [Esc] pause", 24, 78, new Color(180, 170, 150), false);
        if (p.deflectStreak >= 2) {
            g.setFont(new Font("Serif", Font.BOLD, 26));
            text(g, p.deflectStreak + " DEFLECT CHAIN", sw / 2, sh - 100, new Color(255, 215, 100), true);
        }

        drawBoss(g, sw);
        drawMinimap(g, sw);

        // --- banner ---
        if (bannerT > 0 && bannerBig != null) {
            double a = U.clamp(Math.min(bannerT, 3.2 - bannerT) * 2.5, 0, 1);
            g.setColor(new Color(0, 0, 0, (int) (120 * a)));
            g.fillRect(0, sh / 2 - 150, sw, 90);
            g.setFont(titleFont);
            text(g, bannerBig, sw / 2, sh / 2 - 95, U.alpha(bannerColor, a), true);
            if (bannerSmall != null) {
                g.setFont(subFont);
                text(g, bannerSmall, sw / 2, sh / 2 - 68, U.alpha(new Color(235, 225, 210), a), true);
            }
        }

        // --- death ---
        if (p.st == Player.St.DEAD) {
            double a = U.clamp(p.deadT / 1.2, 0, 1);
            g.setColor(new Color(20, 0, 0, (int) (170 * a)));
            g.fillRect(0, 0, sw, sh);
            g.setFont(bigKanji);
            text(g, kanjiOk ? "\u6b7b" : "DEATH", sw / 2, sh / 2 + 30, U.alpha(new Color(200, 20, 20), a), true);
            g.setFont(titleFont);
            text(g, "DEATH", sw / 2, sh / 2 + 100, U.alpha(new Color(220, 200, 200), a), true);
            if (p.deadT > 1.2) {
                g.setFont(subFont);
                text(g, "Press E to resurrect at " + lastShrine.name, sw / 2, sh / 2 + 140, new Color(230, 220, 210), true);
            }
        }

        if (paused && !showHelp) {
            g.setColor(new Color(0, 0, 0, 150));
            g.fillRect(0, 0, sw, sh);
            g.setFont(titleFont);
            text(g, "PAUSED", sw / 2, sh / 2, Color.WHITE, true);
            g.setFont(subFont);
            text(g, "Esc to resume   -   H for controls", sw / 2, sh / 2 + 40, new Color(220, 210, 200), true);
        }
        if (showHelp) drawHelp(g, sw, sh);
    }

    private void drawBoss(Graphics2D g, int sw) {
        Enemy e = boss;
        if (e == null) return;
        int bw = 520, bx = sw / 2 - bw / 2, by = 46;
        g.setFont(new Font("Serif", Font.BOLD, 20));
        text(g, e.name, bx, by - 8, new Color(225, 200, 255), false);
        for (int i = 0; i < e.lives; i++) {
            g.setColor(new Color(200, 30, 30));
            g.fillOval(bx + bw - 14 - i * 18, by - 22, 12, 12);
        }
        g.setColor(new Color(0, 0, 0, 170));
        g.fillRect(bx - 2, by - 2, bw + 4, 14);
        g.setColor(new Color(170, 30, 40));
        g.fillRect(bx, by, (int) (bw * U.clamp(e.hp / e.maxHp, 0, 1)), 10);
        Draw.postureBar(g, sw / 2.0, by + 16, bw, 6, e.posture / e.maxPosture, e.st == Enemy.St.BROKEN);
    }

    private void drawMinimap(Graphics2D g, int sw) {
        int M = 200, mx = sw - M - 16, my = 16;
        double sc = (double) M / World.SIZE;
        g.setColor(new Color(0, 0, 0, 160));
        g.fillRect(mx - 4, my - 4, M + 8, M + 8);
        g.drawImage(world.minimap, mx, my, null);
        for (World.Camp c : world.camps) {
            int cx = mx + (int) (c.x * sc), cy = my + (int) (c.y * sc);
            if (c.elite) {
                Polygon d = new Polygon(new int[] { cx, cx + 6, cx, cx - 6 }, new int[] { cy - 6, cy, cy + 6, cy }, 4);
                g.setColor(c.cleared ? new Color(90, 90, 90) : new Color(170, 60, 230));
                g.fillPolygon(d);
                g.setColor(Color.BLACK);
                g.drawPolygon(d);
            } else {
                g.setColor(c.cleared ? new Color(90, 90, 90) : new Color(210, 50, 40));
                g.fillOval(cx - 4, cy - 4, 8, 8);
            }
        }
        for (World.Shrine s : world.shrines) {
            int cx = mx + (int) (s.x * sc), cy = my + (int) (s.y * sc);
            g.setColor(s.discovered ? new Color(255, 210, 90) : new Color(150, 130, 90));
            g.fillRect(cx - 3, cy - 3, 7, 7);
            if (s == lastShrine) {
                g.setColor(Color.WHITE);
                g.drawRect(cx - 5, cy - 5, 10, 10);
            }
        }
        g.setColor(new Color(255, 80, 60));
        for (Enemy e : enemies) {
            if (e.st == Enemy.St.DEAD || !e.aware) continue;
            if (U.dist(e.x, e.y, player.x, player.y) > 1500) continue;
            g.fillRect(mx + (int) (e.x * sc) - 1, my + (int) (e.y * sc) - 1, 3, 3);
        }
        double px = mx + player.x * sc, py = my + player.y * sc, f = player.facing;
        Path2D arrow = new Path2D.Double();
        arrow.moveTo(px + Math.cos(f) * 7, py + Math.sin(f) * 7);
        arrow.lineTo(px + Math.cos(f + 2.5) * 5, py + Math.sin(f + 2.5) * 5);
        arrow.lineTo(px + Math.cos(f - 2.5) * 5, py + Math.sin(f - 2.5) * 5);
        arrow.closePath();
        g.setColor(Color.WHITE);
        g.fill(arrow);
        g.setColor(new Color(255, 255, 255, 60));
        g.drawRect(mx + (int) ((camX - sw / 2.0) * sc), my + (int) ((camY - H / 2.0) * sc), (int) (sw * sc), (int) (H * sc));
    }

    private void drawHelp(Graphics2D g, int sw, int sh) {
        g.setColor(new Color(10, 8, 8, 215));
        g.fillRect(0, 0, sw, sh);
        g.setFont(new Font("Serif", Font.BOLD, 54));
        text(g, "RONIN'S PATH", sw / 2, 90, new Color(230, 60, 50), true);
        g.setFont(subFont);
        text(g, "Five elite warriors hold the land. Find their strongholds (purple on the map) and cut them down.", sw / 2, 124,
                new Color(225, 215, 200), true);
        String[][] rows = {
                { "WASD", "Move" },
                { "Mouse", "Aim / face direction" },
                { "Left Click / J", "Attack (3-hit combo, buffered)" },
                { "Right Click / K", "Tap right before a hit to DEFLECT. Hold to block (costs posture)." },
                { "Space / L", "Dodge (invincible frames). No direction = backstep." },
                { "Dodge INTO a thrust", "MIKIRI COUNTER a perilous thrust (red kanji)" },
                { "Q", "Drink healing gourd" },
                { "F", "Iai Flash - dash-slash through enemies (needs full Ki)" },
                { "E", "Rest at shrine (heal, refill gourds, set respawn)" },
                { "Hold block + walk", "Sneak. Reach an unaware enemy for a STEALTH DEATHBLOW" },
        };
        int y = 178;
        for (String[] r : rows) {
            g.setFont(hudFont);
            text(g, r[0], sw / 2 - 320, y, new Color(255, 200, 110), false);
            g.setFont(smallFont);
            text(g, r[1], sw / 2 - 110, y, new Color(230, 225, 215), false);
            y += 28;
        }
        y += 14;
        g.setFont(new Font("Serif", Font.BOLD, 20));
        text(g, "The Way of the Sword", sw / 2, y, new Color(230, 60, 50), true);
        y += 26;
        g.setFont(smallFont);
        String[] tips = {
                "A white GLINT on an enemy blade means the strike is about to land - that is your deflect cue.",
                "Deflects crush enemy POSTURE. Fill the posture bar and a red mark appears: strike for a DEATHBLOW.",
                "Mashing the parry button shrinks your deflect window. Rhythm beats panic. Successful deflects reset it.",
                "Perilous attacks (red kanji) cannot be blocked: dodge sweeps, and Mikiri-counter thrusts.",
                "Enemies block and will counterattack if you mindlessly swing. Deflect their last hit for a free opening.",
                "Perfectly deflected arrows fly back at the archer.  Elites need two deathblows.",
        };
        for (String s : tips) {
            text(g, s, sw / 2, y, new Color(215, 205, 190), true);
            y += 22;
        }
        g.setFont(hudFont);
        text(g, "Press ENTER or click to begin     (H toggles this screen)", sw / 2, sh - 30,
                new Color(255, 220, 150, (int) (160 + 90 * Math.sin(realTime * 4))), true);
    }
}
