import java.awt.event.*;

/** Keyboard + mouse state. "pressed" flags latch until consumed by the game tick. */
public class Input implements KeyListener, MouseListener, MouseMotionListener {
    private final boolean[] keys = new boolean[1024];
    private final boolean[] keyHit = new boolean[1024];
    private final boolean[] btn = new boolean[8];
    private final boolean[] btnHit = new boolean[8];
    public volatile int mx, my;

    public synchronized boolean down(int k) { return k >= 0 && k < keys.length && keys[k]; }

    public synchronized boolean hit(int k) { return k >= 0 && k < keyHit.length && keyHit[k]; }

    public synchronized boolean mouseDown(int b) { return btn[b]; }

    public synchronized boolean mouseHit(int b) { return btnHit[b]; }

    public synchronized void endTick() {
        java.util.Arrays.fill(keyHit, false);
        java.util.Arrays.fill(btnHit, false);
    }

    public synchronized void releaseAll() {
        java.util.Arrays.fill(keys, false);
        java.util.Arrays.fill(btn, false);
    }

    @Override public synchronized void keyPressed(KeyEvent e) {
        int k = e.getKeyCode();
        if (k >= 0 && k < keys.length) {
            if (!keys[k]) keyHit[k] = true;
            keys[k] = true;
        }
    }

    @Override public synchronized void keyReleased(KeyEvent e) {
        int k = e.getKeyCode();
        if (k >= 0 && k < keys.length) keys[k] = false;
    }

    @Override public void keyTyped(KeyEvent e) {}

    @Override public synchronized void mousePressed(MouseEvent e) {
        int b = e.getButton();
        if (b > 0 && b < btn.length) {
            btn[b] = true;
            btnHit[b] = true;
        }
    }

    @Override public synchronized void mouseReleased(MouseEvent e) {
        int b = e.getButton();
        if (b > 0 && b < btn.length) btn[b] = false;
    }

    @Override public void mouseMoved(MouseEvent e) { mx = e.getX(); my = e.getY(); }

    @Override public void mouseDragged(MouseEvent e) { mx = e.getX(); my = e.getY(); }

    @Override public void mouseClicked(MouseEvent e) {}

    @Override public void mouseEntered(MouseEvent e) {}

    @Override public void mouseExited(MouseEvent e) {}
}
