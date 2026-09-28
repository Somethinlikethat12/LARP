/** Anything with a body in the world. */
public abstract class Actor {
    public double x, y, r, facing;
    public double hp, maxHp, posture, maxPosture;
    public boolean alive = true;

    public void move(World w, double dx, double dy) {
        x += dx;
        y += dy;
        w.resolve(this);
    }

    public double angleTo(Actor o) { return Math.atan2(o.y - y, o.x - x); }

    public double distTo(Actor o) { return U.dist(x, y, o.x, o.y); }
}
