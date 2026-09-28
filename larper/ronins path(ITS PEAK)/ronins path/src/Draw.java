import java.awt.*;
import java.awt.geom.*;

/** Shared top-down character rendering. In the rotated frame +x is "forward". */
public final class Draw {
    private Draw() {}

    public static void shadow(Graphics2D g, double x, double y, double r) {
        g.setColor(new Color(0, 0, 0, 60));
        g.fill(new Ellipse2D.Double(x - r * 1.1 + 4, y - r * 0.9 + 6, r * 2.2, r * 1.9));
    }

    /** Body + shoulders + hat. hatStyle: 0 kasa (straw), 1 jingasa (flat dark), 2 horns (oni), 3 hood. */
    public static void body(Graphics2D g, double x, double y, double r, double facing, Color robe, Color shoulder, Color hat,
            int hatStyle, double walk) {
        AffineTransform at = g.getTransform();
        g.translate(x, y);
        g.rotate(facing);
        // feet
        double step = Math.sin(walk * 0.12) * r * 0.45;
        g.setColor(new Color(30, 26, 24));
        g.fill(new Ellipse2D.Double(step - r * 0.3, -r * 0.7, r * 0.6, r * 0.4));
        g.fill(new Ellipse2D.Double(-step - r * 0.3, r * 0.3, r * 0.6, r * 0.4));
        // shoulders
        g.setColor(shoulder);
        g.fill(new RoundRectangle2D.Double(-r * 0.55, -r * 1.12, r * 1.05, r * 2.24, r * 0.7, r * 0.7));
        g.setColor(U.shade(shoulder, 0.7));
        g.setStroke(new BasicStroke(1.5f));
        g.draw(new Line2D.Double(-r * 0.3, -r * 1.05, -r * 0.3, r * 1.05));
        // torso
        g.setColor(robe);
        g.fill(new Ellipse2D.Double(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6));
        // head / hat
        switch (hatStyle) {
            case 0 -> {
                double hr = r * 0.95;
                g.setColor(hat);
                g.fill(new Ellipse2D.Double(-hr, -hr, hr * 2, hr * 2));
                g.setColor(U.shade(hat, 0.75));
                for (int i = 0; i < 8; i++) {
                    double a = i * Math.PI / 4;
                    g.draw(new Line2D.Double(0, 0, Math.cos(a) * hr, Math.sin(a) * hr));
                }
                g.draw(new Ellipse2D.Double(-hr * 0.55, -hr * 0.55, hr * 1.1, hr * 1.1));
                g.setColor(U.shade(hat, 1.15));
                g.fill(new Ellipse2D.Double(-r * 0.15, -r * 0.15, r * 0.3, r * 0.3));
            }
            case 1 -> {
                double hr = r * 0.9;
                g.setColor(hat);
                g.fill(new Ellipse2D.Double(-hr, -hr, hr * 2, hr * 2));
                g.setColor(new Color(220, 200, 160));
                g.fill(new Ellipse2D.Double(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44));
            }
            case 2 -> {
                g.setColor(hat);
                g.fill(new Ellipse2D.Double(-r * 0.5, -r * 0.5, r, r));
                g.setColor(new Color(235, 225, 200));
                Path2D h1 = new Path2D.Double();
                h1.moveTo(r * 0.1, -r * 0.35);
                h1.lineTo(r * 0.7, -r * 0.6);
                h1.lineTo(r * 0.2, -r * 0.1);
                h1.closePath();
                g.fill(h1);
                Path2D h2 = new Path2D.Double();
                h2.moveTo(r * 0.1, r * 0.35);
                h2.lineTo(r * 0.7, r * 0.6);
                h2.lineTo(r * 0.2, r * 0.1);
                h2.closePath();
                g.fill(h2);
                g.setColor(new Color(255, 230, 80));
                g.fill(new Ellipse2D.Double(r * 0.25, -r * 0.2, r * 0.12, r * 0.12));
                g.fill(new Ellipse2D.Double(r * 0.25, r * 0.08, r * 0.12, r * 0.12));
            }
            default -> {
                g.setColor(hat);
                g.fill(new Ellipse2D.Double(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24));
                g.setColor(new Color(200, 60, 220));
                g.fill(new Ellipse2D.Double(r * 0.3, -r * 0.22, r * 0.14, r * 0.12));
                g.fill(new Ellipse2D.Double(r * 0.3, r * 0.1, r * 0.14, r * 0.12));
            }
        }
        g.setTransform(at);
    }

    public static void katana(Graphics2D g, double hx, double hy, double ang, double len, Color blade) {
        double c = Math.cos(ang), s = Math.sin(ang);
        g.setStroke(new BasicStroke(4.5f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(new Color(30, 22, 26));
        g.draw(new Line2D.Double(hx - c * 4, hy - s * 4, hx + c * 10, hy + s * 10));
        g.setStroke(new BasicStroke(3f));
        g.setColor(new Color(200, 170, 60));
        g.draw(new Line2D.Double(hx + c * 10 - s * 4, hy + s * 10 + c * 4, hx + c * 10 + s * 4, hy + s * 10 - c * 4));
        g.setStroke(new BasicStroke(3f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(blade);
        g.draw(new Line2D.Double(hx + c * 11, hy + s * 11, hx + c * len, hy + s * len));
        g.setStroke(new BasicStroke(1f));
        g.setColor(new Color(255, 255, 255, 200));
        g.draw(new Line2D.Double(hx + c * 12 - s, hy + s * 12 + c, hx + c * (len - 2) - s, hy + s * (len - 2) + c));
    }

    public static void spear(Graphics2D g, double hx, double hy, double ang, double len, double back) {
        double c = Math.cos(ang), s = Math.sin(ang);
        g.setStroke(new BasicStroke(3.5f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(new Color(100, 70, 44));
        g.draw(new Line2D.Double(hx - c * back, hy - s * back, hx + c * len, hy + s * len));
        g.setColor(new Color(210, 210, 220));
        Path2D tip = new Path2D.Double();
        tip.moveTo(hx + c * (len + 16), hy + s * (len + 16));
        tip.lineTo(hx + c * len - s * 4, hy + s * len + c * 4);
        tip.lineTo(hx + c * len + s * 4, hy + s * len - c * 4);
        tip.closePath();
        g.fill(tip);
        g.setColor(new Color(170, 30, 30));
        g.fill(new Ellipse2D.Double(hx + c * (len - 4) - 3, hy + s * (len - 4) - 3, 6, 6));
    }

    public static void club(Graphics2D g, double hx, double hy, double ang, double len) {
        double c = Math.cos(ang), s = Math.sin(ang);
        g.setStroke(new BasicStroke(6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(new Color(60, 44, 34));
        g.draw(new Line2D.Double(hx, hy, hx + c * len * 0.4, hy + s * len * 0.4));
        g.setStroke(new BasicStroke(12f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(new Color(40, 36, 38));
        g.draw(new Line2D.Double(hx + c * len * 0.35, hy + s * len * 0.35, hx + c * len, hy + s * len));
        g.setColor(new Color(170, 170, 160));
        for (int i = 0; i < 5; i++) {
            double t = 0.45 + i * 0.12;
            g.fill(new Ellipse2D.Double(hx + c * len * t - 2.5, hy + s * len * t - 2.5, 5, 5));
        }
    }

    public static void bow(Graphics2D g, double x, double y, double facing, double r, double pull) {
        AffineTransform at = g.getTransform();
        g.translate(x, y);
        g.rotate(facing);
        g.setStroke(new BasicStroke(3f));
        g.setColor(new Color(90, 50, 30));
        g.draw(new Arc2D.Double(r * 0.4, -r * 1.6, r * 1.4, r * 3.2, -70, 140, Arc2D.OPEN));
        g.setStroke(new BasicStroke(1f));
        g.setColor(new Color(230, 230, 230));
        double sx = r * 1.1 - pull * r * 0.9;
        double ex = r * 1.1 + r * 0.7 * Math.cos(Math.toRadians(70)), ey = r * 1.6 * Math.sin(Math.toRadians(70));
        g.draw(new Line2D.Double(ex - r * 0.1, -ey, sx, 0));
        g.draw(new Line2D.Double(ex - r * 0.1, ey, sx, 0));
        if (pull > 0.05) {
            g.setStroke(new BasicStroke(2f));
            g.setColor(new Color(120, 90, 60));
            g.draw(new Line2D.Double(sx, 0, sx + 30, 0));
        }
        g.setTransform(at);
    }

    /** Sekiro-style glint: a four-point star. */
    public static void glint(Graphics2D g, double x, double y, double size, Color c) {
        Path2D p = new Path2D.Double();
        p.moveTo(x, y - size);
        p.lineTo(x + size * 0.18, y - size * 0.18);
        p.lineTo(x + size, y);
        p.lineTo(x + size * 0.18, y + size * 0.18);
        p.lineTo(x, y + size);
        p.lineTo(x - size * 0.18, y + size * 0.18);
        p.lineTo(x - size, y);
        p.lineTo(x - size * 0.18, y - size * 0.18);
        p.closePath();
        g.setColor(U.alpha(c, 0.35));
        g.fill(new Ellipse2D.Double(x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2));
        g.setColor(c);
        g.fill(p);
    }

    /** A centered bar that grows outward from the middle (posture). */
    public static void postureBar(Graphics2D g, double cx, double y, double w, double h, double frac, boolean broken) {
        frac = U.clamp(frac, 0, 1);
        g.setColor(new Color(0, 0, 0, 150));
        g.fill(new Rectangle2D.Double(cx - w / 2 - 1, y - 1, w + 2, h + 2));
        Color c = broken ? new Color(255, 60, 40) : U.mix(new Color(240, 210, 80), new Color(255, 90, 30), frac);
        g.setColor(c);
        g.fill(new Rectangle2D.Double(cx - w / 2 * frac, y, w * frac, h));
        g.setColor(new Color(255, 255, 255, 120));
        g.fill(new Rectangle2D.Double(cx - 1, y - 2, 2, h + 4));
    }
}
