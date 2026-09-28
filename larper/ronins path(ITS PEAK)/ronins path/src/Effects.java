import java.awt.*;
import java.awt.geom.*;
import java.util.*;

/** Particles, slash trails, rings, floating text and ground decals. */
public class Effects {
    static final int DOT = 0, SPARK = 1, PETAL = 2, BLOOD = 3, EMBER = 4, DUST = 5, WISP = 6;

    static class P {
        double x, y, vx, vy, life, max, size, drag, rot, vr;
        Color c;
        int kind;
    }

    static class Slash {
        double x, y, r, start, sweep, life, max, width;
        Color c;
    }

    static class Line {
        double x1, y1, x2, y2, life, max, width;
        Color c;
    }

    static class Ring {
        double x, y, r0, r1, life, max;
        float w;
        Color c;
    }

    static class Text {
        String s;
        double x, y, vy, life, max;
        Color c;
        int size;
    }

    static class Decal {
        double x, y, r;
        Color c;
    }

    final ArrayList<P> ps = new ArrayList<>();
    final ArrayList<P> petals = new ArrayList<>();
    final ArrayList<Slash> slashes = new ArrayList<>();
    final ArrayList<Line> lines = new ArrayList<>();
    final ArrayList<Ring> rings = new ArrayList<>();
    final ArrayList<Text> texts = new ArrayList<>();
    final ArrayDeque<Decal> decals = new ArrayDeque<>();
    final Random rnd = new Random();
    private final Font[] fonts = new Font[64];

    private P add(int kind, double x, double y, double vx, double vy, double life, double size, Color c, double drag) {
        P p = new P();
        p.kind = kind;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = p.max = life;
        p.size = size;
        p.c = c;
        p.drag = drag;
        ps.add(p);
        return p;
    }

    public void sparks(double x, double y, double dir, double spread, int n, double speed, Color c) {
        for (int i = 0; i < n; i++) {
            double a = dir + (rnd.nextDouble() - 0.5) * spread;
            double s = speed * (0.3 + rnd.nextDouble());
            add(SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.15 + rnd.nextDouble() * 0.3, 1.5 + rnd.nextDouble() * 2, c, 6);
        }
    }

    public void blood(double x, double y, double dir, int n, double speed) {
        for (int i = 0; i < n; i++) {
            double a = dir + (rnd.nextDouble() - 0.5) * 1.4;
            double s = speed * (0.2 + rnd.nextDouble());
            Color c = new Color(120 + rnd.nextInt(60), 0, 10);
            add(BLOOD, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + rnd.nextDouble() * 0.4, 2 + rnd.nextDouble() * 3, c, 5);
        }
    }

    public void dust(double x, double y, int n) {
        for (int i = 0; i < n; i++) {
            double a = rnd.nextDouble() * Math.PI * 2, s = 20 + rnd.nextDouble() * 60;
            add(DUST, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + rnd.nextDouble() * 0.3, 4 + rnd.nextDouble() * 6,
                    new Color(180, 165, 130), 3);
        }
    }

    public void ember(double x, double y) {
        add(EMBER, x + rnd.nextGaussian() * 6, y + rnd.nextGaussian() * 6, rnd.nextGaussian() * 12, -30 - rnd.nextDouble() * 40,
                0.8 + rnd.nextDouble() * 0.8, 1.5 + rnd.nextDouble() * 1.5, new Color(255, 150 + rnd.nextInt(80), 40), 0.5);
    }

    public void wisp(double x, double y, Color c) {
        add(WISP, x + rnd.nextGaussian() * 10, y + rnd.nextGaussian() * 10, rnd.nextGaussian() * 10, -20 - rnd.nextDouble() * 20,
                0.6 + rnd.nextDouble() * 0.5, 4 + rnd.nextDouble() * 5, c, 1);
    }

    public void heal(double x, double y) {
        for (int i = 0; i < 24; i++) {
            double a = rnd.nextDouble() * Math.PI * 2;
            add(WISP, x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * 20, -40 - rnd.nextDouble() * 40,
                    0.7 + rnd.nextDouble() * 0.4, 3 + rnd.nextDouble() * 3, new Color(150, 255, 170), 1);
        }
    }

    public void slash(double x, double y, double r, double start, double sweep, double life, double width, Color c) {
        Slash s = new Slash();
        s.x = x;
        s.y = y;
        s.r = r;
        s.start = start;
        s.sweep = sweep;
        s.life = s.max = life;
        s.width = width;
        s.c = c;
        slashes.add(s);
    }

    public void line(double x1, double y1, double x2, double y2, double life, double width, Color c) {
        Line l = new Line();
        l.x1 = x1;
        l.y1 = y1;
        l.x2 = x2;
        l.y2 = y2;
        l.life = l.max = life;
        l.width = width;
        l.c = c;
        lines.add(l);
    }

    public void ring(double x, double y, double r0, double r1, double life, float w, Color c) {
        Ring r = new Ring();
        r.x = x;
        r.y = y;
        r.r0 = r0;
        r.r1 = r1;
        r.life = r.max = life;
        r.w = w;
        r.c = c;
        rings.add(r);
    }

    public void text(String s, double x, double y, Color c, int size) {
        Text t = new Text();
        t.s = s;
        t.x = x;
        t.y = y;
        t.vy = -45;
        t.life = t.max = 1.0;
        t.c = c;
        t.size = size;
        texts.add(t);
    }

    public void decal(double x, double y, double r, Color c) {
        Decal d = new Decal();
        d.x = x;
        d.y = y;
        d.r = r;
        d.c = c;
        decals.add(d);
        while (decals.size() > 400) decals.removeFirst();
    }

    /** Keep a drifting cloud of sakura petals around the camera. */
    public void ambient(double cx, double cy, double vw, double vh, double dt, double wind) {
        while (petals.size() < 70) {
            P p = new P();
            p.x = cx + (rnd.nextDouble() - 0.5) * vw * 1.3;
            p.y = cy + (rnd.nextDouble() - 0.5) * vh * 1.3;
            p.vx = 25 + rnd.nextDouble() * 30;
            p.vy = 10 + rnd.nextDouble() * 20;
            p.life = p.max = 6 + rnd.nextDouble() * 6;
            p.size = 2.5 + rnd.nextDouble() * 2.5;
            p.rot = rnd.nextDouble() * 6;
            p.vr = (rnd.nextDouble() - 0.5) * 4;
            p.c = rnd.nextInt(4) == 0 ? new Color(255, 240, 245) : new Color(255, 170 + rnd.nextInt(40), 200);
            petals.add(p);
        }
        for (int i = petals.size() - 1; i >= 0; i--) {
            P p = petals.get(i);
            p.life -= dt;
            p.x += (p.vx + wind) * dt + Math.sin(p.life * 2 + p.rot) * 12 * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
            if (p.life <= 0 || Math.abs(p.x - cx) > vw || Math.abs(p.y - cy) > vh) petals.remove(i);
        }
    }

    public void update(double dt) {
        for (int i = ps.size() - 1; i >= 0; i--) {
            P p = ps.get(i);
            p.life -= dt;
            double k = Math.exp(-p.drag * dt);
            p.vx *= k;
            p.vy *= k;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) {
                if (p.kind == BLOOD && rnd.nextInt(2) == 0) decal(p.x, p.y, p.size * 1.3, U.alpha(U.shade(p.c, 0.6), 0.7));
                ps.remove(i);
            }
        }
        for (int i = slashes.size() - 1; i >= 0; i--) if ((slashes.get(i).life -= dt) <= 0) slashes.remove(i);
        for (int i = lines.size() - 1; i >= 0; i--) if ((lines.get(i).life -= dt) <= 0) lines.remove(i);
        for (int i = rings.size() - 1; i >= 0; i--) if ((rings.get(i).life -= dt) <= 0) rings.remove(i);
        for (int i = texts.size() - 1; i >= 0; i--) {
            Text t = texts.get(i);
            t.life -= dt;
            t.y += t.vy * dt;
            t.vy *= Math.exp(-3 * dt);
            if (t.life <= 0) texts.remove(i);
        }
    }

    public void drawDecals(Graphics2D g) {
        for (Decal d : decals) {
            g.setColor(d.c);
            g.fill(new Ellipse2D.Double(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2));
        }
    }

    public void drawWorld(Graphics2D g) {
        Stroke old = g.getStroke();
        for (Slash s : slashes) {
            double t = s.life / s.max;
            double sweepNow = s.sweep * Math.min(1, (1 - t) * 3 + 0.35);
            for (int layer = 0; layer < 2; layer++) {
                float w = (float) (s.width * t * (layer == 0 ? 2.2 : 0.8));
                g.setStroke(new BasicStroke(Math.max(0.5f, w), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
                g.setColor(layer == 0 ? U.alpha(s.c, 0.35 * t) : U.alpha(Color.WHITE, 0.9 * t));
                double startDeg = -Math.toDegrees(s.start), extDeg = -Math.toDegrees(sweepNow);
                g.draw(new Arc2D.Double(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2, startDeg, extDeg, Arc2D.OPEN));
            }
        }
        for (Line l : lines) {
            double t = l.life / l.max;
            g.setStroke(new BasicStroke((float) (l.width * 2.5 * t), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.setColor(U.alpha(l.c, 0.4 * t));
            g.draw(new Line2D.Double(l.x1, l.y1, l.x2, l.y2));
            g.setStroke(new BasicStroke((float) Math.max(0.5, l.width * t), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.setColor(U.alpha(Color.WHITE, t));
            g.draw(new Line2D.Double(l.x1, l.y1, l.x2, l.y2));
        }
        for (P p : ps) {
            double t = p.life / p.max;
            switch (p.kind) {
                case SPARK -> {
                    g.setStroke(new BasicStroke((float) p.size, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
                    g.setColor(U.alpha(U.mix(Color.WHITE, p.c, 1 - t), Math.min(1, t * 2)));
                    g.draw(new Line2D.Double(p.x, p.y, p.x - p.vx * 0.035, p.y - p.vy * 0.035));
                }
                case BLOOD, DOT -> {
                    g.setColor(U.alpha(p.c, Math.min(1, t * 3)));
                    g.fill(new Ellipse2D.Double(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2));
                }
                case EMBER -> {
                    g.setColor(U.alpha(p.c, t));
                    g.fill(new Ellipse2D.Double(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2));
                }
                case DUST, WISP -> {
                    double s = p.size * (1.5 - t * 0.5);
                    g.setColor(U.alpha(p.c, t * (p.kind == DUST ? 0.35 : 0.6)));
                    g.fill(new Ellipse2D.Double(p.x - s, p.y - s, s * 2, s * 2));
                }
                default -> {}
            }
        }
        for (Ring r : rings) {
            double t = r.life / r.max;
            double rad = U.lerp(r.r1, r.r0, t * t);
            g.setStroke(new BasicStroke((float) (r.w * t) + 0.5f));
            g.setColor(U.alpha(r.c, t));
            g.draw(new Ellipse2D.Double(r.x - rad, r.y - rad, rad * 2, rad * 2));
        }
        g.setStroke(old);
    }

    public void drawPetals(Graphics2D g) {
        AffineTransform at = g.getTransform();
        for (P p : petals) {
            double a = Math.min(1, Math.min(p.life, p.max - p.life));
            g.translate(p.x, p.y);
            g.rotate(p.rot);
            g.setColor(U.alpha(p.c, 0.85 * a));
            g.fill(new Ellipse2D.Double(-p.size, -p.size * 0.5, p.size * 2, p.size));
            g.setTransform(at);
        }
    }

    public void drawTexts(Graphics2D g) {
        for (Text t : texts) {
            double a = Math.min(1, t.life / t.max * 2.5);
            g.setFont(font(t.size));
            FontMetrics fm = g.getFontMetrics();
            int w = fm.stringWidth(t.s);
            int x = (int) t.x - w / 2, y = (int) t.y;
            g.setColor(U.alpha(Color.BLACK, a * 0.8));
            g.drawString(t.s, x + 2, y + 2);
            g.setColor(U.alpha(t.c, a));
            g.drawString(t.s, x, y);
        }
    }

    private Font font(int size) {
        size = Math.min(size, fonts.length - 1);
        if (fonts[size] == null) fonts[size] = new Font("SansSerif", Font.BOLD, size);
        return fonts[size];
    }
}
