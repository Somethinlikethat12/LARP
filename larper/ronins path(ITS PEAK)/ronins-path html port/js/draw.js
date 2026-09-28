'use strict';

/** Shared top-down character rendering. In the rotated frame +x is "forward". */
const Draw = {
    shadow(g, x, y, r) {
        g.fillStyle = 'rgba(0,0,0,0.235)';
        fillEllipse(g, x - r * 1.1 + 4, y - r * 0.9 + 6, r * 2.2, r * 1.9);
    },

    /** Body + shoulders + hat. hatStyle: 0 kasa (straw), 1 jingasa (flat dark), 2 horns (oni), 3 hood. */
    body(g, x, y, r, facing, robe, shoulder, hat, hatStyle, walk) {
        g.save();
        g.translate(x, y);
        g.rotate(facing);
        // feet
        const step = Math.sin(walk * 0.12) * r * 0.45;
        g.fillStyle = 'rgb(30,26,24)';
        fillEllipse(g, step - r * 0.3, -r * 0.7, r * 0.6, r * 0.4);
        fillEllipse(g, -step - r * 0.3, r * 0.3, r * 0.6, r * 0.4);
        // shoulders
        g.fillStyle = css(shoulder);
        roundRectPath(g, -r * 0.55, -r * 1.12, r * 1.05, r * 2.24, r * 0.35);
        g.fill();
        g.strokeStyle = css(U.shade(shoulder, 0.7));
        setStroke(g, 1.5, false);
        strokeLine(g, -r * 0.3, -r * 1.05, -r * 0.3, r * 1.05);
        // torso
        g.fillStyle = css(robe);
        fillEllipse(g, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        // head / hat
        switch (hatStyle) {
            case 0: {
                const hr = r * 0.95;
                g.fillStyle = css(hat);
                fillEllipse(g, -hr, -hr, hr * 2, hr * 2);
                g.strokeStyle = css(U.shade(hat, 0.75));
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    strokeLine(g, 0, 0, Math.cos(a) * hr, Math.sin(a) * hr);
                }
                strokeEllipse(g, -hr * 0.55, -hr * 0.55, hr * 1.1, hr * 1.1);
                g.fillStyle = css(U.shade(hat, 1.15));
                fillEllipse(g, -r * 0.15, -r * 0.15, r * 0.3, r * 0.3);
                break;
            }
            case 1: {
                const hr = r * 0.9;
                g.fillStyle = css(hat);
                fillEllipse(g, -hr, -hr, hr * 2, hr * 2);
                g.fillStyle = 'rgb(220,200,160)';
                fillEllipse(g, -r * 0.22, -r * 0.22, r * 0.44, r * 0.44);
                break;
            }
            case 2: {
                g.fillStyle = css(hat);
                fillEllipse(g, -r * 0.5, -r * 0.5, r, r);
                g.fillStyle = 'rgb(235,225,200)';
                g.beginPath();
                g.moveTo(r * 0.1, -r * 0.35);
                g.lineTo(r * 0.7, -r * 0.6);
                g.lineTo(r * 0.2, -r * 0.1);
                g.closePath();
                g.fill();
                g.beginPath();
                g.moveTo(r * 0.1, r * 0.35);
                g.lineTo(r * 0.7, r * 0.6);
                g.lineTo(r * 0.2, r * 0.1);
                g.closePath();
                g.fill();
                g.fillStyle = 'rgb(255,230,80)';
                fillEllipse(g, r * 0.25, -r * 0.2, r * 0.12, r * 0.12);
                fillEllipse(g, r * 0.25, r * 0.08, r * 0.12, r * 0.12);
                break;
            }
            default:
                g.fillStyle = css(hat);
                fillEllipse(g, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
                g.fillStyle = 'rgb(200,60,220)';
                fillEllipse(g, r * 0.3, -r * 0.22, r * 0.14, r * 0.12);
                fillEllipse(g, r * 0.3, r * 0.1, r * 0.14, r * 0.12);
        }
        g.restore();
    },

    katana(g, hx, hy, ang, len, blade) {
        const c = Math.cos(ang), s = Math.sin(ang);
        setStroke(g, 4.5, true);
        g.strokeStyle = 'rgb(30,22,26)';
        strokeLine(g, hx - c * 4, hy - s * 4, hx + c * 10, hy + s * 10);
        setStroke(g, 3, false);
        g.strokeStyle = 'rgb(200,170,60)';
        strokeLine(g, hx + c * 10 - s * 4, hy + s * 10 + c * 4, hx + c * 10 + s * 4, hy + s * 10 - c * 4);
        setStroke(g, 3, true);
        g.strokeStyle = css(blade);
        strokeLine(g, hx + c * 11, hy + s * 11, hx + c * len, hy + s * len);
        setStroke(g, 1, false);
        g.strokeStyle = 'rgba(255,255,255,0.784)';
        strokeLine(g, hx + c * 12 - s, hy + s * 12 + c, hx + c * (len - 2) - s, hy + s * (len - 2) + c);
    },

    spear(g, hx, hy, ang, len, back) {
        const c = Math.cos(ang), s = Math.sin(ang);
        setStroke(g, 3.5, true);
        g.strokeStyle = 'rgb(100,70,44)';
        strokeLine(g, hx - c * back, hy - s * back, hx + c * len, hy + s * len);
        g.fillStyle = 'rgb(210,210,220)';
        g.beginPath();
        g.moveTo(hx + c * (len + 16), hy + s * (len + 16));
        g.lineTo(hx + c * len - s * 4, hy + s * len + c * 4);
        g.lineTo(hx + c * len + s * 4, hy + s * len - c * 4);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgb(170,30,30)';
        fillCircle(g, hx + c * (len - 4), hy + s * (len - 4), 3);
    },

    club(g, hx, hy, ang, len) {
        const c = Math.cos(ang), s = Math.sin(ang);
        setStroke(g, 6, true);
        g.strokeStyle = 'rgb(60,44,34)';
        strokeLine(g, hx, hy, hx + c * len * 0.4, hy + s * len * 0.4);
        setStroke(g, 12, true);
        g.strokeStyle = 'rgb(40,36,38)';
        strokeLine(g, hx + c * len * 0.35, hy + s * len * 0.35, hx + c * len, hy + s * len);
        g.fillStyle = 'rgb(170,170,160)';
        for (let i = 0; i < 5; i++) {
            const t = 0.45 + i * 0.12;
            fillCircle(g, hx + c * len * t, hy + s * len * t, 2.5);
        }
    },

    bow(g, x, y, facing, r, pull) {
        g.save();
        g.translate(x, y);
        g.rotate(facing);
        setStroke(g, 3, false);
        g.strokeStyle = 'rgb(90,50,30)';
        g.beginPath();
        g.ellipse(r * 1.1, 0, r * 0.7, r * 1.6, 0, -70 * DEG, 70 * DEG);
        g.stroke();
        setStroke(g, 1, false);
        g.strokeStyle = 'rgb(230,230,230)';
        const sx = r * 1.1 - pull * r * 0.9;
        const ex = r * 1.1 + r * 0.7 * Math.cos(70 * DEG), ey = r * 1.6 * Math.sin(70 * DEG);
        strokeLine(g, ex - r * 0.1, -ey, sx, 0);
        strokeLine(g, ex - r * 0.1, ey, sx, 0);
        if (pull > 0.05) {
            setStroke(g, 2, false);
            g.strokeStyle = 'rgb(120,90,60)';
            strokeLine(g, sx, 0, sx + 30, 0);
        }
        g.restore();
    },

    /** Sekiro-style glint: a four-point star. */
    glint(g, x, y, size, c) {
        g.fillStyle = css(U.alpha(c, 0.35));
        fillCircle(g, x, y, size * 0.6);
        g.fillStyle = css(c);
        g.beginPath();
        g.moveTo(x, y - size);
        g.lineTo(x + size * 0.18, y - size * 0.18);
        g.lineTo(x + size, y);
        g.lineTo(x + size * 0.18, y + size * 0.18);
        g.lineTo(x, y + size);
        g.lineTo(x - size * 0.18, y + size * 0.18);
        g.lineTo(x - size, y);
        g.lineTo(x - size * 0.18, y - size * 0.18);
        g.closePath();
        g.fill();
    },

    /** A centered bar that grows outward from the middle (posture). */
    postureBar(g, cx, y, w, h, frac, broken) {
        frac = U.clamp(frac, 0, 1);
        g.fillStyle = 'rgba(0,0,0,0.588)';
        g.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
        const c = broken ? rgb(255, 60, 40) : U.mix(rgb(240, 210, 80), rgb(255, 90, 30), frac);
        g.fillStyle = css(c);
        g.fillRect(cx - w / 2 * frac, y, w * frac, h);
        g.fillStyle = 'rgba(255,255,255,0.47)';
        g.fillRect(cx - 1, y - 2, 2, h + 4);
    },
};
