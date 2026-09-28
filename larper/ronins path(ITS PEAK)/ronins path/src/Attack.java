/** Timing and hitbox data for a single swing. Angles in degrees for readability. */
public class Attack {
    public final String name;
    public double windup, active, recovery, range, arc, damage, posture, lunge;
    public boolean perilous, thrust, ranged;

    public Attack(String name, double windup, double active, double recovery, double range, double arcDeg, double damage,
            double posture, double lunge) {
        this.name = name;
        this.windup = windup;
        this.active = active;
        this.recovery = recovery;
        this.range = range;
        this.arc = Math.toRadians(arcDeg);
        this.damage = damage;
        this.posture = posture;
        this.lunge = lunge;
    }

    public Attack perilous() { perilous = true; return this; }

    public Attack thrust() { thrust = true; return this; }

    public Attack ranged() { ranged = true; return this; }

    public Attack copy(double windupMul, double dmgMul) {
        Attack a = new Attack(name, windup * windupMul, active, recovery * Math.max(0.6, windupMul), range, Math.toDegrees(arc),
                damage * dmgMul, posture * dmgMul, lunge);
        a.perilous = perilous;
        a.thrust = thrust;
        a.ranged = ranged;
        return a;
    }
}
