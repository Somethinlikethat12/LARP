import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.util.*;

/** Procedurally generated open world: biomes, roads, forests, ponds, camps and shrines. */
public class World {
    public static final int SIZE = 8000;
    static final int CELL = 200, CHUNK = 256;

    public enum Kind { PINE, SAKURA, MAPLE, BAMBOO, ROCK, POND, TENT, HOUSE, FIRE, SHRINE, POST, LANTERN, BANNER }

    public static class Obstacle {
        public Kind kind;
        public double x, y, r, w, h, canopy;
        public boolean rect;
        public int variant, stamp;
        public boolean isTree() { return kind == Kind.PINE || kind == Kind.SAKURA || kind == Kind.MAPLE || kind == Kind.BAMBOO; }
    }

    public static class Camp {
        public double x, y, r;
        public boolean elite, cleared;
        public String eliteName;
        public Enemy.T eliteType;
        public final ArrayList<Enemy> members = new ArrayList<>();
    }

    public static class Shrine {
        public double x, y;
        public String name;
        public boolean discovered;
    }

    public final long seed;
    final Random rnd;
    public final ArrayList<Obstacle> obstacles = new ArrayList<>();
    public final ArrayList<Obstacle> fires = new ArrayList<>();
    public final ArrayList<Camp> camps = new ArrayList<>();
    public final ArrayList<Shrine> shrines = new ArrayList<>();
    public final ArrayList<double[]> roads = new ArrayList<>();
    private final ArrayList<Obstacle>[] grid;
    private final int gw;
    private int stampCounter = 1;
    public BufferedImage minimap;

    private final LinkedHashMap<Long, BufferedImage> chunks = new LinkedHashMap<>(256, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<Long, BufferedImage> e) { return size() > 160; }
    };

    static final String[] SHRINE_NAMES = { "Shrine of First Light", "Moonlit Shrine", "Shrine of Falling Petals", "Crane Shrine",
            "Shrine of the Red Maple", "Whispering Bamboo Shrine", "Shrine of Still Water", "Ember Shrine" };
    static final String[][] ELITES = { { "Kagemaru the Silent", "RONIN" }, { "Gozu, Oni Warlord", "BRUTE" },
            { "Lady Tomoe of the Crimson Spear", "SPEAR" }, { "Ryusei, the Fallen Blade", "RONIN" }, { "Okami, the Hollow Monk", "SPEAR" } };

    @SuppressWarnings("unchecked")
    public World(long seed) {
        this.seed = seed;
        rnd = new Random(seed);
        gw = SIZE / CELL + 1;
        grid = new ArrayList[gw * gw];
        for (int i = 0; i < grid.length; i++) grid[i] = new ArrayList<>();
        generate();
        buildMinimap();
    }

    // ---------------- noise ----------------
    private double hash(int x, int y) {
        long h = seed * 0x9E3779B97F4A7C15L + x * 0x632BE59BD9B4E019L + y * 0x85157AF5L;
        h ^= (h >>> 33);
        h *= 0xff51afd7ed558ccdL;
        h ^= (h >>> 33);
        return (h & 0xFFFFFF) / (double) 0xFFFFFF;
    }

    private double vnoise(double x, double y) {
        int xi = (int) Math.floor(x), yi = (int) Math.floor(y);
        double fx = x - xi, fy = y - yi;
        double u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        double a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
        return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
    }

    public double fbm(double x, double y) {
        return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 41, y * 4.3 + 3) * 0.15;
    }

    /** 0 = sakura fields, 1 = autumn maple, 2 = bamboo. */
    public int biome(double x, double y) {
        double n = fbm(x / 2200.0 + 100, y / 2200.0 + 100);
        if (n < 0.40) return 1;
        if (n > 0.60) return 2;
        return 0;
    }

    public String biomeName(double x, double y) {
        return switch (biome(x, y)) {
            case 1 -> "Crimson Maple Woods";
            case 2 -> "Whispering Bamboo Grove";
            default -> "Sakura Fields";
        };
    }

    Color groundColor(double x, double y) {
        int b = biome(x, y);
        Color base = switch (b) {
            case 1 -> new Color(128, 122, 62);
            case 2 -> new Color(66, 112, 58);
            default -> new Color(86, 128, 64);
        };
        double n = fbm(x / 140.0, y / 140.0);
        double f = 0.82 + n * 0.32;
        return U.shade(base, f);
    }

    // ---------------- generation ----------------
    private void generate() {
        // shrines
        Shrine spawn = new Shrine();
        spawn.x = SIZE / 2.0;
        spawn.y = SIZE / 2.0;
        spawn.name = SHRINE_NAMES[0];
        spawn.discovered = true;
        shrines.add(spawn);
        for (int tries = 0; tries < 4000 && shrines.size() < SHRINE_NAMES.length; tries++) {
            double x = 600 + rnd.nextDouble() * (SIZE - 1200), y = 600 + rnd.nextDouble() * (SIZE - 1200);
            boolean ok = true;
            for (Shrine s : shrines) if (U.dist(x, y, s.x, s.y) < 1900) ok = false;
            if (!ok) continue;
            Shrine s = new Shrine();
            s.x = x;
            s.y = y;
            s.name = SHRINE_NAMES[shrines.size()];
            shrines.add(s);
        }
        // camps
        for (int tries = 0; tries < 6000 && camps.size() < 17; tries++) {
            double x = 500 + rnd.nextDouble() * (SIZE - 1000), y = 500 + rnd.nextDouble() * (SIZE - 1000);
            if (U.dist(x, y, spawn.x, spawn.y) < 1100) continue;
            boolean ok = true;
            for (Camp c : camps) if (U.dist(x, y, c.x, c.y) < 1100) ok = false;
            for (Shrine s : shrines) if (U.dist(x, y, s.x, s.y) < 700) ok = false;
            if (!ok) continue;
            Camp c = new Camp();
            c.x = x;
            c.y = y;
            c.r = 240;
            camps.add(c);
        }
        // the five camps farthest from spawn become elite strongholds
        ArrayList<Camp> sorted = new ArrayList<>(camps);
        sorted.sort((a, b) -> Double.compare(U.dist(b.x, b.y, spawn.x, spawn.y), U.dist(a.x, a.y, spawn.x, spawn.y)));
        for (int i = 0; i < Math.min(ELITES.length, sorted.size()); i++) {
            Camp c = sorted.get(i);
            c.elite = true;
            c.r = 300;
            c.eliteName = ELITES[i][0];
            c.eliteType = Enemy.T.valueOf(ELITES[i][1]);
        }
        buildRoads();
        // ponds
        ArrayList<Obstacle> ponds = new ArrayList<>();
        for (int tries = 0; tries < 400 && ponds.size() < 16; tries++) {
            double r = 90 + rnd.nextDouble() * 150;
            double x = r + 100 + rnd.nextDouble() * (SIZE - 2 * r - 200), y = r + 100 + rnd.nextDouble() * (SIZE - 2 * r - 200);
            if (nearRoad(x, y) < r + 60 || nearCamp(x, y) < r + 80 || nearShrine(x, y) < r + 220) continue;
            boolean ok = true;
            for (Obstacle p : ponds) if (U.dist(x, y, p.x, p.y) < r + p.r + 100) ok = false;
            if (!ok) continue;
            Obstacle o = circle(Kind.POND, x, y, r);
            ponds.add(o);
        }
        // forests
        int step = 52;
        for (int gy = 0; gy < SIZE; gy += step) {
            for (int gx = 0; gx < SIZE; gx += step) {
                double x = gx + rnd.nextDouble() * step, y = gy + rnd.nextDouble() * step;
                double dens = fbm(x / 650.0, y / 650.0);
                double p = dens > 0.58 ? 0.8 : dens > 0.48 ? 0.28 : 0.035;
                if (rnd.nextDouble() > p) continue;
                int b = biome(x, y);
                Kind k;
                double roll = rnd.nextDouble();
                if (b == 1) k = roll < 0.65 ? Kind.MAPLE : Kind.PINE;
                else if (b == 2) k = roll < 0.85 ? Kind.BAMBOO : Kind.PINE;
                else k = roll < 0.35 ? Kind.SAKURA : Kind.PINE;
                double r = k == Kind.BAMBOO ? 11 : 15;
                if (!freeSpot(x, y, r + 30)) continue;
                Obstacle o = circle(k, x, y, r);
                o.canopy = k == Kind.BAMBOO ? 30 + rnd.nextDouble() * 10 : 42 + rnd.nextDouble() * 20;
                o.variant = rnd.nextInt(1000);
            }
        }
        // rocks
        for (int i = 0; i < 450; i++) {
            double x = rnd.nextDouble() * SIZE, y = rnd.nextDouble() * SIZE, r = 10 + rnd.nextDouble() * 26;
            if (!freeSpot(x, y, r + 30)) continue;
            Obstacle o = circle(Kind.ROCK, x, y, r);
            o.variant = rnd.nextInt(1000);
        }
        // camp structures
        for (Camp c : camps) {
            Obstacle fire = circle(Kind.FIRE, c.x, c.y, 14);
            fires.add(fire);
            int tents = c.elite ? 4 : 2 + rnd.nextInt(2);
            double a0 = rnd.nextDouble() * Math.PI * 2;
            for (int i = 0; i < tents; i++) {
                double a = a0 + i * Math.PI * 2 / tents;
                double tx = c.x + Math.cos(a) * (c.r - 60), ty = c.y + Math.sin(a) * (c.r - 60);
                boolean house = c.elite && i % 2 == 0;
                Obstacle t = rect(house ? Kind.HOUSE : Kind.TENT, tx, ty, house ? 110 : 64, house ? 80 : 48);
                t.variant = rnd.nextInt(1000);
            }
            int banners = c.elite ? 6 : 2;
            for (int i = 0; i < banners; i++) {
                double a = a0 + Math.PI / tents + i * Math.PI * 2 / banners;
                circle(Kind.BANNER, c.x + Math.cos(a) * (c.r - 10), c.y + Math.sin(a) * (c.r - 10), 5).variant = c.elite ? 1 : 0;
            }
        }
        // shrine structures
        for (Shrine s : shrines) {
            circle(Kind.SHRINE, s.x, s.y - 10, 24);
            circle(Kind.POST, s.x - 48, s.y + 95, 6);
            circle(Kind.POST, s.x + 48, s.y + 95, 6);
            circle(Kind.LANTERN, s.x - 70, s.y + 10, 9);
            circle(Kind.LANTERN, s.x + 70, s.y + 10, 9);
        }
    }

    private void buildRoads() {
        ArrayList<double[]> nodes = new ArrayList<>();
        for (Shrine s : shrines) nodes.add(new double[] { s.x, s.y + 120 });
        for (Camp c : camps) nodes.add(new double[] { c.x, c.y });
        int n = nodes.size();
        boolean[] in = new boolean[n];
        double[] best = new double[n];
        int[] from = new int[n];
        Arrays.fill(best, Double.MAX_VALUE);
        best[0] = 0;
        from[0] = -1;
        for (int it = 0; it < n; it++) {
            int u = -1;
            for (int i = 0; i < n; i++) if (!in[i] && (u < 0 || best[i] < best[u])) u = i;
            in[u] = true;
            if (from[u] >= 0) addRoad(nodes.get(from[u]), nodes.get(u));
            for (int v = 0; v < n; v++) {
                if (in[v]) continue;
                double d = U.dist(nodes.get(u)[0], nodes.get(u)[1], nodes.get(v)[0], nodes.get(v)[1]);
                if (d < best[v]) {
                    best[v] = d;
                    from[v] = u;
                }
            }
        }
    }

    private void addRoad(double[] a, double[] b) {
        int segs = 8;
        double px = a[0], py = a[1];
        double nx = -(b[1] - a[1]), ny = b[0] - a[0];
        double len = Math.hypot(nx, ny);
        nx /= len;
        ny /= len;
        double wob = rnd.nextDouble() * 6;
        for (int i = 1; i <= segs; i++) {
            double t = (double) i / segs;
            double off = i == segs ? 0 : Math.sin(t * Math.PI * 2 + wob) * 120 * Math.sin(t * Math.PI);
            double x = U.lerp(a[0], b[0], t) + nx * off, y = U.lerp(a[1], b[1], t) + ny * off;
            roads.add(new double[] { px, py, x, y });
            px = x;
            py = y;
        }
    }

    double nearRoad(double x, double y) {
        double best = Double.MAX_VALUE;
        for (double[] s : roads) best = Math.min(best, U.segDist(x, y, s[0], s[1], s[2], s[3]));
        return best;
    }

    double nearCamp(double x, double y) {
        double best = Double.MAX_VALUE;
        for (Camp c : camps) best = Math.min(best, U.dist(x, y, c.x, c.y) - c.r);
        return best;
    }

    double nearShrine(double x, double y) {
        double best = Double.MAX_VALUE;
        for (Shrine s : shrines) best = Math.min(best, U.dist(x, y, s.x, s.y));
        return best;
    }

    private boolean freeSpot(double x, double y, double pad) {
        if (x < pad || y < pad || x > SIZE - pad || y > SIZE - pad) return false;
        if (nearCamp(x, y) < pad || nearShrine(x, y) < 200 + pad) return false;
        if (nearRoad(x, y) < 28 + pad) return false;
        for (Obstacle o : query(x, y, pad)) {
            if (o.kind == Kind.POND ? U.dist(x, y, o.x, o.y) < o.r + pad : U.dist(x, y, o.x, o.y) < o.r + pad - 10) return false;
        }
        return true;
    }

    private Obstacle circle(Kind k, double x, double y, double r) {
        Obstacle o = new Obstacle();
        o.kind = k;
        o.x = x;
        o.y = y;
        o.r = r;
        insert(o, x - r, y - r, x + r, y + r);
        return o;
    }

    private Obstacle rect(Kind k, double cx, double cy, double w, double h) {
        Obstacle o = new Obstacle();
        o.kind = k;
        o.rect = true;
        o.x = cx - w / 2;
        o.y = cy - h / 2;
        o.w = w;
        o.h = h;
        insert(o, o.x, o.y, o.x + w, o.y + h);
        return o;
    }

    private void insert(Obstacle o, double x0, double y0, double x1, double y1) {
        obstacles.add(o);
        int cx0 = cell(x0), cy0 = cell(y0), cx1 = cell(x1), cy1 = cell(y1);
        for (int cy = cy0; cy <= cy1; cy++) for (int cx = cx0; cx <= cx1; cx++) grid[cy * gw + cx].add(o);
    }

    private int cell(double v) { return (int) U.clamp(v / CELL, 0, gw - 1); }

    public ArrayList<Obstacle> query(double x, double y, double r) {
        ArrayList<Obstacle> out = new ArrayList<>();
        int stamp = stampCounter++;
        int cx0 = cell(x - r), cy0 = cell(y - r), cx1 = cell(x + r), cy1 = cell(y + r);
        for (int cy = cy0; cy <= cy1; cy++) {
            for (int cx = cx0; cx <= cx1; cx++) {
                for (Obstacle o : grid[cy * gw + cx]) {
                    if (o.stamp == stamp) continue;
                    o.stamp = stamp;
                    out.add(o);
                }
            }
        }
        return out;
    }

    /** Push an actor out of every obstacle it overlaps. */
    public void resolve(Actor a) {
        for (int iter = 0; iter < 2; iter++) {
            for (Obstacle o : query(a.x, a.y, a.r + 2)) {
                if (o.kind == Kind.BANNER) continue;
                if (o.rect) {
                    double cx = U.clamp(a.x, o.x, o.x + o.w), cy = U.clamp(a.y, o.y, o.y + o.h);
                    double dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy);
                    if (d < a.r) {
                        if (d < 0.001) {
                            a.y = o.y - a.r;
                        } else {
                            a.x = cx + dx / d * a.r;
                            a.y = cy + dy / d * a.r;
                        }
                    }
                } else {
                    double dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy), min = a.r + o.r;
                    if (d < min) {
                        if (d < 0.001) {
                            dx = 1;
                            d = 1;
                        }
                        a.x = o.x + dx / d * min;
                        a.y = o.y + dy / d * min;
                    }
                }
            }
        }
        a.x = U.clamp(a.x, a.r, SIZE - a.r);
        a.y = U.clamp(a.y, a.r, SIZE - a.r);
    }

    /** True if a projectile at this point would hit something solid (water does not block). */
    public boolean solidAt(double x, double y) {
        if (x < 0 || y < 0 || x > SIZE || y > SIZE) return true;
        for (Obstacle o : query(x, y, 1)) {
            if (o.kind == Kind.POND || o.kind == Kind.BANNER) continue;
            if (o.rect ? (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) : U.dist(x, y, o.x, o.y) < o.r) return true;
        }
        return false;
    }

    // ---------------- rendering ----------------
    private BufferedImage chunk(int cx, int cy) {
        long key = ((long) cx << 32) | (cy & 0xffffffffL);
        BufferedImage img = chunks.get(key);
        if (img != null) return img;
        img = new BufferedImage(CHUNK, CHUNK, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        double ox = cx * CHUNK, oy = cy * CHUNK;
        for (int y = 0; y < CHUNK; y += 4) {
            for (int x = 0; x < CHUNK; x += 4) {
                g.setColor(groundColor(ox + x, oy + y));
                g.fillRect(x, y, 4, 4);
            }
        }
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Random r = new Random(key * 31 + seed);
        for (int i = 0; i < 140; i++) {
            int x = r.nextInt(CHUNK), y = r.nextInt(CHUNK);
            Color c = groundColor(ox + x, oy + y);
            g.setColor(r.nextBoolean() ? U.shade(c, 1.25) : U.shade(c, 0.75));
            g.drawLine(x, y, x + r.nextInt(3) - 1, y - 3 - r.nextInt(3));
        }
        // flowers
        int b = biome(ox + CHUNK / 2.0, oy + CHUNK / 2.0);
        for (int i = 0; i < 6; i++) {
            int x = r.nextInt(CHUNK), y = r.nextInt(CHUNK);
            g.setColor(b == 1 ? new Color(200, 90, 40) : b == 2 ? new Color(230, 230, 200) : new Color(250, 190, 210));
            g.fillOval(x, y, 3, 3);
        }
        g.translate(-ox, -oy);
        // camp dirt & shrine plazas
        for (Camp c : camps) {
            if (Math.abs(c.x - ox - CHUNK / 2.0) > c.r + CHUNK || Math.abs(c.y - oy - CHUNK / 2.0) > c.r + CHUNK) continue;
            g.setColor(new Color(128, 108, 76, 200));
            g.fill(new Ellipse2D.Double(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2));
            g.setColor(new Color(110, 92, 64, 160));
            g.fill(new Ellipse2D.Double(c.x - c.r * 0.6, c.y - c.r * 0.6, c.r * 1.2, c.r * 1.2));
        }
        for (Shrine s : shrines) {
            if (Math.abs(s.x - ox - CHUNK / 2.0) > 250 + CHUNK || Math.abs(s.y - oy - CHUNK / 2.0) > 250 + CHUNK) continue;
            g.setColor(new Color(150, 146, 136));
            g.fill(new Ellipse2D.Double(s.x - 110, s.y - 90, 220, 190));
            g.setColor(new Color(170, 166, 156));
            g.fill(new Rectangle2D.Double(s.x - 30, s.y + 60, 60, 80));
            g.setColor(new Color(120, 116, 108));
            for (int i = 0; i < 6; i++) g.draw(new Line2D.Double(s.x - 110, s.y - 60 + i * 30, s.x + 110, s.y - 60 + i * 30));
        }
        // roads
        g.setStroke(new BasicStroke(48, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(new Color(132, 112, 78));
        for (double[] s : roads) if (segNearChunk(s, ox, oy)) g.draw(new Line2D.Double(s[0], s[1], s[2], s[3]));
        g.setStroke(new BasicStroke(34, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(new Color(158, 136, 98));
        for (double[] s : roads) if (segNearChunk(s, ox, oy)) g.draw(new Line2D.Double(s[0], s[1], s[2], s[3]));
        g.dispose();
        chunks.put(key, img);
        return img;
    }

    private boolean segNearChunk(double[] s, double ox, double oy) {
        double pad = 40;
        return Math.max(s[0], s[2]) > ox - pad && Math.min(s[0], s[2]) < ox + CHUNK + pad && Math.max(s[1], s[3]) > oy - pad
                && Math.min(s[1], s[3]) < oy + CHUNK + pad;
    }

    public void drawGround(Graphics2D g, double l, double t, double r, double b) {
        int cx0 = (int) Math.floor(Math.max(0, l) / CHUNK), cy0 = (int) Math.floor(Math.max(0, t) / CHUNK);
        int cx1 = (int) Math.floor(Math.min(SIZE - 1, r) / CHUNK), cy1 = (int) Math.floor(Math.min(SIZE - 1, b) / CHUNK);
        for (int cy = cy0; cy <= cy1; cy++) for (int cx = cx0; cx <= cx1; cx++) g.drawImage(chunk(cx, cy), cx * CHUNK, cy * CHUNK, null);
    }

    public ArrayList<Obstacle> visible(double l, double t, double r, double b) {
        double cx = (l + r) / 2, cy = (t + b) / 2;
        ArrayList<Obstacle> out = query(cx, cy, Math.max(r - l, b - t) / 2 + 80);
        out.removeIf(o -> {
            double pad = Math.max(o.canopy, o.r) + (o.rect ? Math.max(o.w, o.h) : 0) + 20;
            return o.x + pad < l || o.x - pad > r || o.y + pad < t || o.y - pad > b;
        });
        return out;
    }

    public void drawPonds(Graphics2D g, java.util.List<Obstacle> vis, double time) {
        for (Obstacle o : vis) {
            if (o.kind != Kind.POND) continue;
            double r = o.r;
            g.setColor(new Color(160, 150, 112));
            g.fill(new Ellipse2D.Double(o.x - r - 12, o.y - r - 12, (r + 12) * 2, (r + 12) * 2));
            g.setColor(new Color(38, 78, 104));
            g.fill(new Ellipse2D.Double(o.x - r, o.y - r, r * 2, r * 2));
            g.setColor(new Color(58, 108, 138));
            g.fill(new Ellipse2D.Double(o.x - r * 0.75, o.y - r * 0.8, r * 1.4, r * 1.35));
            g.setColor(new Color(200, 230, 255, 70));
            g.setStroke(new BasicStroke(2));
            for (int i = 0; i < 5; i++) {
                double a = time * 0.3 + i * 1.3;
                double px = o.x + Math.cos(a + i) * r * 0.45, py = o.y + Math.sin(a * 0.7 + i * 2) * r * 0.45;
                g.draw(new Line2D.Double(px - 12, py, px + 12, py));
            }
            // lily pads
            Random rr = new Random((long) (o.x * 7 + o.y));
            for (int i = 0; i < 5; i++) {
                double a = rr.nextDouble() * 6.28, d = r * (0.3 + rr.nextDouble() * 0.55);
                double px = o.x + Math.cos(a) * d, py = o.y + Math.sin(a) * d;
                g.setColor(new Color(70, 130, 60));
                g.fill(new Arc2D.Double(px - 8, py - 8, 16, 16, 30, 300, Arc2D.PIE));
                if (i == 0) {
                    g.setColor(new Color(255, 200, 220));
                    g.fill(new Ellipse2D.Double(px - 3, py - 3, 6, 6));
                }
            }
        }
    }

    private final HashMap<Long, BufferedImage> sprites = new HashMap<>();

    private long spriteKey(Obstacle o, int layer) {
        return ((long) layer << 40) | ((long) o.kind.ordinal() << 32) | ((long) (o.variant % 12) << 16) | (int) (o.canopy / 5);
    }

    private BufferedImage newSprite(int size) {
        return GraphicsEnvironment.getLocalGraphicsEnvironment().getDefaultScreenDevice().getDefaultConfiguration()
                .createCompatibleImage(size, size, Transparency.TRANSLUCENT);
    }

    /** Trunk + ground shadow, centered on the trunk. */
    private BufferedImage baseSprite(Obstacle o) {
        long key = spriteKey(o, 0);
        BufferedImage img = sprites.get(key);
        if (img != null) return img;
        double cr = (int) (o.canopy / 5) * 5 + 2.5;
        int size = (int) (cr * 2 + 50);
        img = newSprite(size);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.translate(size / 2.0, size / 2.0);
        if (o.kind == Kind.BAMBOO) {
            Random rr = new Random(o.variant % 12);
            for (int i = 0; i < 5; i++) {
                double px = (rr.nextDouble() - 0.5) * o.r * 1.8, py = (rr.nextDouble() - 0.5) * o.r * 1.8;
                g.setColor(new Color(120, 160, 70));
                g.fill(new Ellipse2D.Double(px - 4, py - 4, 8, 8));
                g.setColor(new Color(160, 200, 100));
                g.fill(new Ellipse2D.Double(px - 2, py - 2, 4, 4));
            }
        } else {
            g.setColor(new Color(0, 0, 0, 50));
            g.fill(new Ellipse2D.Double(-cr * 0.8 + 14, -cr * 0.6 + 18, cr * 1.6, cr * 1.3));
            g.setColor(new Color(82, 58, 40));
            g.fill(new Ellipse2D.Double(-o.r, -o.r, o.r * 2, o.r * 2));
        }
        g.dispose();
        sprites.put(key, img);
        return img;
    }

    private BufferedImage canopySprite(Obstacle o) {
        long key = spriteKey(o, 1);
        BufferedImage img = sprites.get(key);
        if (img != null) return img;
        double cr = (int) (o.canopy / 5) * 5 + 2.5;
        int size = (int) (cr * 2 + 50);
        img = newSprite(size);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.translate(size / 2.0, size / 2.0);
        int v = o.variant % 12;
        Color base = switch (o.kind) {
            case SAKURA -> new Color(236, 150, 180);
            case MAPLE -> v % 3 == 0 ? new Color(220, 150, 40) : new Color(196, 60, 40);
            case BAMBOO -> new Color(110, 160, 70);
            default -> new Color(40, 86, 52);
        };
        Random rr = new Random(v * 31L + o.kind.ordinal());
        int blobs = o.kind == Kind.BAMBOO ? 4 : 6;
        g.setColor(U.shade(base, 0.75));
        g.fill(new Ellipse2D.Double(-cr, -cr, cr * 2, cr * 2));
        for (int i = 0; i < blobs; i++) {
            double ang = rr.nextDouble() * 6.28, dd = cr * 0.45 * rr.nextDouble();
            double br = cr * (0.45 + rr.nextDouble() * 0.25);
            double bx = Math.cos(ang) * dd, by = Math.sin(ang) * dd - 4;
            g.setColor(U.shade(base, 0.9 + rr.nextDouble() * 0.25));
            g.fill(new Ellipse2D.Double(bx - br, by - br, br * 2, br * 2));
        }
        g.setColor(U.alpha(U.shade(base, 1.3), 0.8));
        g.fill(new Ellipse2D.Double(-cr * 0.45 - 6, -cr * 0.55, cr * 0.6, cr * 0.5));
        if (o.kind == Kind.SAKURA) {
            g.setColor(new Color(255, 235, 245));
            for (int i = 0; i < 14; i++) {
                double ang = rr.nextDouble() * 6.28, dd = cr * 0.85 * Math.sqrt(rr.nextDouble());
                g.fill(new Ellipse2D.Double(Math.cos(ang) * dd - 1.5, Math.sin(ang) * dd - 1.5, 3, 3));
            }
        }
        g.dispose();
        sprites.put(key, img);
        return img;
    }

    public void drawObstacles(Graphics2D g, java.util.List<Obstacle> vis, double time) {
        for (Obstacle o : vis) {
            switch (o.kind) {
                case PINE, SAKURA, MAPLE, BAMBOO -> {
                    BufferedImage img = baseSprite(o);
                    g.drawImage(img, (int) Math.round(o.x - img.getWidth() / 2.0), (int) Math.round(o.y - img.getHeight() / 2.0), null);
                }
                case ROCK -> {
                    g.setColor(new Color(0, 0, 0, 60));
                    g.fill(new Ellipse2D.Double(o.x - o.r + 5, o.y - o.r + 7, o.r * 2, o.r * 2));
                    g.setColor(new Color(112, 112, 108));
                    g.fill(new Ellipse2D.Double(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2));
                    g.setColor(new Color(140, 140, 134));
                    g.fill(new Ellipse2D.Double(o.x - o.r * 0.8, o.y - o.r * 0.85, o.r * 1.3, o.r * 1.2));
                    g.setColor(new Color(90, 120, 70, 150));
                    g.fill(new Ellipse2D.Double(o.x - o.r * 0.3, o.y - o.r * 0.9, o.r * 0.7, o.r * 0.5));
                }
                case TENT -> {
                    g.setColor(new Color(0, 0, 0, 60));
                    g.fill(new Rectangle2D.Double(o.x + 6, o.y + 8, o.w, o.h));
                    g.setColor(new Color(170, 150, 110));
                    g.fill(new Rectangle2D.Double(o.x, o.y, o.w, o.h));
                    g.setColor(new Color(140, 120, 86));
                    g.fill(new Rectangle2D.Double(o.x, o.y + o.h / 2, o.w, o.h / 2));
                    g.setColor(new Color(90, 70, 50));
                    g.setStroke(new BasicStroke(2));
                    g.draw(new Line2D.Double(o.x, o.y + o.h / 2, o.x + o.w, o.y + o.h / 2));
                }
                case HOUSE -> {
                    g.setColor(new Color(0, 0, 0, 70));
                    g.fill(new Rectangle2D.Double(o.x + 8, o.y + 10, o.w, o.h));
                    g.setColor(new Color(60, 56, 64));
                    g.fill(new Rectangle2D.Double(o.x - 6, o.y - 6, o.w + 12, o.h + 12));
                    g.setColor(new Color(84, 80, 92));
                    g.fill(new Rectangle2D.Double(o.x, o.y, o.w, o.h / 2));
                    g.setColor(new Color(72, 68, 80));
                    g.fill(new Rectangle2D.Double(o.x, o.y + o.h / 2, o.w, o.h / 2));
                    g.setColor(new Color(40, 36, 44));
                    g.setStroke(new BasicStroke(2));
                    for (int i = 1; i < 8; i++) g.draw(new Line2D.Double(o.x + o.w * i / 8, o.y, o.x + o.w * i / 8, o.y + o.h));
                    g.setStroke(new BasicStroke(4));
                    g.setColor(new Color(150, 40, 40));
                    g.draw(new Line2D.Double(o.x - 6, o.y + o.h / 2, o.x + o.w + 6, o.y + o.h / 2));
                }
                case FIRE -> {
                    g.setColor(new Color(80, 80, 80));
                    g.fill(new Ellipse2D.Double(o.x - 18, o.y - 18, 36, 36));
                    double fl = 0.8 + 0.2 * Math.sin(time * 17 + o.x);
                    g.setColor(new Color(255, 120, 30, 90));
                    g.fill(new Ellipse2D.Double(o.x - 40 * fl, o.y - 40 * fl, 80 * fl, 80 * fl));
                    g.setColor(new Color(255, 140, 40));
                    g.fill(new Ellipse2D.Double(o.x - 11 * fl, o.y - 11 * fl, 22 * fl, 22 * fl));
                    g.setColor(new Color(255, 230, 120));
                    g.fill(new Ellipse2D.Double(o.x - 5 * fl, o.y - 5 * fl, 10 * fl, 10 * fl));
                }
                case SHRINE -> {
                    g.setColor(new Color(0, 0, 0, 70));
                    g.fill(new Rectangle2D.Double(o.x - 30, o.y - 22, 70, 60));
                    g.setColor(new Color(60, 50, 44));
                    g.fill(new Rectangle2D.Double(o.x - 36, o.y - 30, 72, 58));
                    g.setColor(new Color(170, 40, 36));
                    g.fill(new Rectangle2D.Double(o.x - 30, o.y - 24, 60, 22));
                    g.setColor(new Color(150, 32, 30));
                    g.fill(new Rectangle2D.Double(o.x - 30, o.y - 2, 60, 22));
                    double glow = 0.6 + 0.4 * Math.sin(time * 2);
                    g.setColor(new Color(255, 210, 120, (int) (120 * glow)));
                    g.fill(new Ellipse2D.Double(o.x - 12, o.y + 20, 24, 24));
                }
                case POST -> {
                    g.setColor(new Color(180, 40, 30));
                    g.fill(new Ellipse2D.Double(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2));
                }
                case LANTERN -> {
                    g.setColor(new Color(130, 128, 120));
                    g.fill(new Rectangle2D.Double(o.x - 9, o.y - 9, 18, 18));
                    double glow = 0.7 + 0.3 * Math.sin(time * 3 + o.x);
                    g.setColor(new Color(255, 200, 100, (int) (60 * glow)));
                    g.fill(new Ellipse2D.Double(o.x - 28, o.y - 28, 56, 56));
                    g.setColor(new Color(255, 220, 140));
                    g.fill(new Rectangle2D.Double(o.x - 4, o.y - 4, 8, 8));
                }
                default -> {}
            }
        }
    }

    /** Drawn above characters. Canopies close to the player fade so you can still see yourself. */
    public void drawCanopies(Graphics2D g, java.util.List<Obstacle> vis, double px, double py, double time) {
        for (Obstacle o : vis) {
            switch (o.kind) {
                case PINE, SAKURA, MAPLE, BAMBOO -> {
                    boolean near = U.dist(px, py, o.x, o.y) < o.canopy + 20;
                    double sway = Math.sin(time * 1.2 + o.variant) * 2;
                    BufferedImage img = canopySprite(o);
                    Composite old = null;
                    if (near) {
                        old = g.getComposite();
                        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.35f));
                    }
                    g.drawImage(img, (int) Math.round(o.x + sway - img.getWidth() / 2.0), (int) Math.round(o.y - img.getHeight() / 2.0), null);
                    if (near) g.setComposite(old);
                }
                case BANNER -> {
                    double wave = Math.sin(time * 4 + o.x * 0.1) * 4;
                    g.setColor(new Color(60, 40, 30));
                    g.fill(new Ellipse2D.Double(o.x - 3, o.y - 3, 6, 6));
                    g.setColor(o.variant == 1 ? new Color(90, 30, 110) : new Color(170, 30, 30));
                    Path2D p = new Path2D.Double();
                    p.moveTo(o.x, o.y - 2);
                    p.lineTo(o.x + 26 + wave, o.y - 6);
                    p.lineTo(o.x + 24 + wave, o.y + 10);
                    p.lineTo(o.x, o.y + 6);
                    p.closePath();
                    g.fill(p);
                }
                default -> {}
            }
        }
        // torii beams over shrine posts
        for (Shrine s : shrines) {
            if (Math.abs(s.x - px) > 1400 || Math.abs(s.y - py) > 1000) continue;
            g.setColor(new Color(190, 44, 34));
            g.fill(new Rectangle2D.Double(s.x - 72, s.y + 86, 144, 12));
            g.setColor(new Color(40, 30, 30));
            g.fill(new Rectangle2D.Double(s.x - 80, s.y + 80, 160, 7));
        }
    }

    private void buildMinimap() {
        int M = 200;
        minimap = new BufferedImage(M, M, BufferedImage.TYPE_INT_ARGB);
        double sc = (double) SIZE / M;
        for (int y = 0; y < M; y++) for (int x = 0; x < M; x++) {
            Color c = U.shade(groundColor(x * sc, y * sc), 0.8);
            minimap.setRGB(x, y, c.getRGB());
        }
        Graphics2D g = minimap.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.scale(1 / sc, 1 / sc);
        for (Obstacle o : obstacles) {
            if (o.isTree()) {
                g.setColor(new Color(20, 50, 30, 60));
                g.fill(new Ellipse2D.Double(o.x - 40, o.y - 40, 80, 80));
            }
        }
        g.setColor(new Color(150, 130, 90));
        g.setStroke(new BasicStroke(50));
        for (double[] s : roads) g.draw(new Line2D.Double(s[0], s[1], s[2], s[3]));
        g.setColor(new Color(50, 100, 140));
        for (Obstacle o : obstacles) if (o.kind == Kind.POND) g.fill(new Ellipse2D.Double(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2));
        g.dispose();
    }
}
