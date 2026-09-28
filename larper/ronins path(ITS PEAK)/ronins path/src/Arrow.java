import java.awt.*;
import java.awt.geom.*;

public class Arrow {
    public double x, y, vx, vy, life = 2.5, stuckT;
    public boolean friendly, stuck, dead;
    public Enemy owner;
    public double damage = 10, posture = 14;

    public void draw(Graphics2D g) {
        double a = Math.atan2(vy, vx);
        double cx = Math.cos(a), cy = Math.sin(a);
        double alpha = stuck ? U.clamp(1 - (stuckT - 2) , 0, 1) : 1;
        g.setStroke(new BasicStroke(2f));
        g.setColor(U.alpha(new Color(110, 80, 50), alpha));
        g.draw(new Line2D.Double(x - cx * 22, y - cy * 22, x, y));
        g.setColor(U.alpha(friendly ? new Color(255, 220, 90) : new Color(220, 220, 230), alpha));
        g.draw(new Line2D.Double(x - cx * 5, y - cy * 5, x + cx * 2, y + cy * 2));
        g.setColor(U.alpha(new Color(240, 240, 240), alpha));
        g.draw(new Line2D.Double(x - cx * 22 - cy * 3, y - cy * 22 + cx * 3, x - cx * 17, y - cy * 17));
        g.draw(new Line2D.Double(x - cx * 22 + cy * 3, y - cy * 22 - cx * 3, x - cx * 17, y - cy * 17));
        if (friendly && !stuck) {
            g.setColor(new Color(255, 220, 90, 90));
            g.setStroke(new BasicStroke(5f));
            g.draw(new Line2D.Double(x - cx * 40, y - cy * 40, x, y));
        }
    }
}
