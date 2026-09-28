import java.util.*;
import java.util.concurrent.*;
import javax.sound.sampled.*;

/** Procedurally synthesized sound effects (no audio files needed). */
public class Sfx {
    public enum S { CLANG, BLOCK, SLASH, HEAVY, HIT, HURT, DEATHBLOW, DODGE, ARROW, PERILOUS, BREAK, HEAL, SHRINE, IAI }

    private static final float RATE = 44100f;
    private final Map<S, Clip[]> clips = new EnumMap<>(S.class);
    private final Map<S, Integer> next = new EnumMap<>(S.class);
    private final Random rnd = new Random(7);
    private final ExecutorService exec = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "sfx");
        t.setDaemon(true);
        return t;
    });

    public Sfx() {
        exec.submit(this::load);
    }

    public void play(S s) {
        exec.submit(() -> {
            Clip[] arr = clips.get(s);
            if (arr == null) return;
            int i = next.getOrDefault(s, 0);
            next.put(s, (i + 1) % arr.length);
            Clip c = arr[i];
            c.stop();
            c.setFramePosition(0);
            c.start();
        });
    }

    private void load() {
        try {
            put(S.CLANG, clang(), 4);
            put(S.BLOCK, block(), 4);
            put(S.SLASH, whooshSound(0.2, 0.05, 0.5, 1.5), 4);
            put(S.HEAVY, whooshSound(0.35, 0.02, 0.25, 1.9), 3);
            put(S.HIT, hit(), 4);
            put(S.HURT, hurt(), 3);
            put(S.DEATHBLOW, deathblow(), 2);
            put(S.DODGE, whooshSound(0.18, 0.03, 0.15, 1.0), 3);
            put(S.ARROW, whooshSound(0.15, 0.2, 0.8, 1.2), 4);
            put(S.PERILOUS, perilous(), 2);
            put(S.BREAK, postureBreak(), 2);
            put(S.HEAL, heal(), 2);
            put(S.SHRINE, shrine(), 1);
            put(S.IAI, iai(), 2);
        } catch (Exception | LinkageError e) {
            System.err.println("Sound disabled: " + e);
        }
    }

    private void put(S s, byte[] data, int voices) throws LineUnavailableException {
        AudioFormat fmt = new AudioFormat(RATE, 16, 1, true, false);
        Clip[] arr = new Clip[voices];
        for (int i = 0; i < voices; i++) {
            arr[i] = AudioSystem.getClip();
            arr[i].open(fmt, data, 0, data.length);
        }
        clips.put(s, arr);
    }

    // ---------- synthesis helpers ----------
    private float[] buf(double sec) { return new float[(int) (sec * RATE)]; }

    private void sine(float[] b, double f, double amp, double decay, double delay) {
        int start = (int) (delay * RATE);
        for (int i = start; i < b.length; i++) {
            double t = (i - start) / RATE;
            b[i] += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * decay);
        }
    }

    private void sweep(float[] b, double f0, double f1, double amp, double decay) {
        double ph = 0;
        for (int i = 0; i < b.length; i++) {
            double t = i / RATE, p = (double) i / b.length;
            ph += 2 * Math.PI * (f0 + (f1 - f0) * p) / RATE;
            b[i] += amp * Math.sin(ph) * Math.exp(-t * decay);
        }
    }

    private void noise(float[] b, double amp, double decay, double lp) {
        double y = 0;
        for (int i = 0; i < b.length; i++) {
            double t = i / RATE;
            y += lp * ((rnd.nextDouble() * 2 - 1) - y);
            b[i] += amp * y * Math.exp(-t * decay);
        }
    }

    private void whoosh(float[] b, double amp, double lpLo, double lpHi) {
        double y = 0, y2 = 0;
        for (int i = 0; i < b.length; i++) {
            double p = (double) i / b.length;
            double env = Math.sin(Math.PI * Math.pow(p, 0.6));
            env *= env;
            double c = lpLo + (lpHi - lpLo) * Math.sin(Math.PI * p);
            y += c * ((rnd.nextDouble() * 2 - 1) - y);
            y2 += c * (y - y2);
            b[i] += amp * env * y2 * 3;
        }
    }

    private byte[] pcm(float[] b, double gain) {
        byte[] out = new byte[b.length * 2];
        for (int i = 0; i < b.length; i++) {
            double v = Math.tanh(b[i] * gain);
            if (i < 64) v *= i / 64.0;
            int tail = b.length - i;
            if (tail < 512) v *= tail / 512.0;
            short s = (short) (v * 30000);
            out[2 * i] = (byte) s;
            out[2 * i + 1] = (byte) (s >> 8);
        }
        return out;
    }

    // ---------- sounds ----------
    private byte[] clang() {
        float[] b = buf(0.7);
        noise(b, 0.9, 70, 0.9);
        sine(b, 1320, 0.5, 6, 0);
        sine(b, 2470, 0.35, 8, 0);
        sine(b, 3610, 0.25, 10, 0);
        sine(b, 5020, 0.15, 13, 0);
        sine(b, 880, 0.3, 5, 0);
        return pcm(b, 1.3);
    }

    private byte[] block() {
        float[] b = buf(0.25);
        noise(b, 0.8, 40, 0.5);
        sine(b, 520, 0.4, 18, 0);
        sine(b, 940, 0.3, 22, 0);
        sine(b, 1600, 0.15, 30, 0);
        return pcm(b, 1.1);
    }

    private byte[] whooshSound(double dur, double lo, double hi, double gain) {
        float[] b = buf(dur);
        whoosh(b, 1.0, lo, hi);
        return pcm(b, gain);
    }

    private byte[] hit() {
        float[] b = buf(0.22);
        sweep(b, 170, 55, 0.9, 18);
        noise(b, 0.7, 35, 0.25);
        return pcm(b, 1.5);
    }

    private byte[] hurt() {
        float[] b = buf(0.3);
        sweep(b, 230, 70, 0.8, 10);
        noise(b, 0.6, 25, 0.35);
        return pcm(b, 1.4);
    }

    private byte[] deathblow() {
        float[] b = buf(1.1);
        noise(b, 1.0, 10, 0.3);
        sweep(b, 130, 35, 1.0, 3.5);
        sine(b, 660, 0.3, 4, 0);
        sine(b, 1250, 0.25, 5, 0);
        sine(b, 1870, 0.12, 6, 0.02);
        return pcm(b, 1.6);
    }

    private byte[] perilous() {
        float[] b = buf(0.6);
        sine(b, 196, 0.5, 3, 0);
        sine(b, 208, 0.5, 3, 0);
        sine(b, 392, 0.25, 4, 0);
        sine(b, 1568, 0.12, 6, 0);
        noise(b, 0.3, 30, 0.6);
        return pcm(b, 1.3);
    }

    private byte[] postureBreak() {
        float[] b = buf(1.4);
        sine(b, 110, 0.7, 2.5, 0);
        sine(b, 221, 0.4, 3, 0);
        sine(b, 331, 0.3, 3.5, 0);
        sine(b, 587, 0.2, 4, 0);
        noise(b, 0.6, 20, 0.4);
        return pcm(b, 1.4);
    }

    private byte[] heal() {
        float[] b = buf(0.6);
        sweep(b, 500, 1000, 0.3, 4);
        sine(b, 1500, 0.15, 6, 0.1);
        return pcm(b, 1.0);
    }

    private byte[] shrine() {
        float[] b = buf(1.6);
        sine(b, 523, 0.3, 2, 0);
        sine(b, 659, 0.25, 2, 0.12);
        sine(b, 784, 0.25, 2, 0.24);
        sine(b, 1046, 0.2, 2, 0.36);
        return pcm(b, 1.0);
    }

    private byte[] iai() {
        float[] b = buf(0.6);
        whoosh(b, 1.0, 0.1, 0.9);
        sine(b, 3000, 0.2, 7, 0);
        sine(b, 4400, 0.12, 9, 0);
        return pcm(b, 1.5);
    }
}
