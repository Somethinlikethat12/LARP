import java.awt.Color;

/** Small math / color helpers. */
public final class U {
    private U() {}

    public static double clamp(double v, double a, double b) { return v < a ? a : (v > b ? b : v); }

    public static double lerp(double a, double b, double t) { return a + (b - a) * t; }

    public static double dist(double x1, double y1, double x2, double y2) { return Math.hypot(x2 - x1, y2 - y1); }

    /** Signed shortest angle from a to b, in [-PI, PI]. */
    public static double angDiff(double a, double b) {
        double d = (b - a) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    public static double turn(double cur, double target, double maxStep) {
        double d = angDiff(cur, target);
        if (Math.abs(d) <= maxStep) return target;
        return cur + Math.signum(d) * maxStep;
    }

    public static double segDist(double px, double py, double ax, double ay, double bx, double by) {
        double dx = bx - ax, dy = by - ay;
        double len2 = dx * dx + dy * dy;
        double t = len2 == 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
        return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    }

    public static Color alpha(Color c, double a) {
        return new Color(c.getRed(), c.getGreen(), c.getBlue(), (int) clamp(a * 255, 0, 255));
    }

    public static Color mix(Color a, Color b, double t) {
        t = clamp(t, 0, 1);
        return new Color((int) lerp(a.getRed(), b.getRed(), t), (int) lerp(a.getGreen(), b.getGreen(), t),
                (int) lerp(a.getBlue(), b.getBlue(), t));
    }

    public static Color shade(Color c, double f) {
        return new Color((int) clamp(c.getRed() * f, 0, 255), (int) clamp(c.getGreen() * f, 0, 255),
                (int) clamp(c.getBlue() * f, 0, 255));
    }
}
