'use strict';

/** Procedurally synthesized sound effects (no audio files needed). Audio starts on the first key/mouse press. */
class Sfx {
    constructor() {
        this.RATE = 44100;
        this.ctx = null;
        this.out = null;
        this.buffers = {};
        this.voices = {};
        this.active = {};
        this.rnd = new Rng(7);
    }

    unlock() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            try {
                this.ctx = new AC();
                this.out = this.ctx.createGain();
                this.out.gain.value = 0.8;
                this.out.connect(this.ctx.destination);
                this.load();
            } catch (e) {
                console.warn('Sound disabled: ' + e);
                this.ctx = null;
                return;
            }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    play(s) {
        const buf = this.ctx && this.buffers[s];
        if (!buf) return;
        const list = this.active[s];
        if (list.length >= this.voices[s]) {
            const old = list.shift();
            try { old.stop(); } catch (e) { /* already stopped */ }
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.out);
        src.onended = () => {
            const i = list.indexOf(src);
            if (i >= 0) list.splice(i, 1);
        };
        list.push(src);
        src.start();
    }

    load() {
        this.put('CLANG', this.clang(), 4);
        this.put('PARRY', this.parry(), 3);
        this.put('BLOCK', this.block(), 4);
        this.put('SLASH', this.whooshSound(0.14, 0.18, 0.75, 1.8), 4);
        this.put('HEAVY', this.whooshSound(0.24, 0.08, 0.45, 2.05), 3);
        this.put('HIT', this.hit(), 4);
        this.put('HURT', this.hurt(), 3);
        this.put('DEATHBLOW', this.deathblow(), 2);
        this.put('DODGE', this.whooshSound(0.11, 0.16, 0.6, 1.35), 3);
        this.put('PERILOUS', this.perilous(), 2);
        this.put('BREAK', this.postureBreak(), 2);
        this.put('HEAL', this.heal(), 2);
        this.put('SHRINE', this.shrine(), 1);
        this.put('IAI', this.iai(), 2);
    }

    put(s, data, voices) {
        const buf = this.ctx.createBuffer(1, data.length, this.RATE);
        buf.getChannelData(0).set(data);
        this.buffers[s] = buf;
        this.voices[s] = voices;
        this.active[s] = [];
    }

    // ---------- synthesis helpers ----------
    buf(sec) { return new Float32Array(Math.floor(sec * this.RATE)); }

    sine(b, f, amp, decay, delay) {
        const start = Math.floor(delay * this.RATE);
        for (let i = start; i < b.length; i++) {
            const t = (i - start) / this.RATE;
            b[i] += amp * Math.sin(TAU * f * t) * Math.exp(-t * decay);
        }
    }

    sweep(b, f0, f1, amp, decay) {
        let ph = 0;
        for (let i = 0; i < b.length; i++) {
            const t = i / this.RATE, p = i / b.length;
            ph += TAU * (f0 + (f1 - f0) * p) / this.RATE;
            b[i] += amp * Math.sin(ph) * Math.exp(-t * decay);
        }
    }

    noise(b, amp, decay, lp) {
        let y = 0;
        for (let i = 0; i < b.length; i++) {
            const t = i / this.RATE;
            y += lp * ((this.rnd.nextDouble() * 2 - 1) - y);
            b[i] += amp * y * Math.exp(-t * decay);
        }
    }

    transient(b, amp, decay) {
        let last = 0;
        for (let i = 0; i < b.length; i++) {
            const t = i / this.RATE;
            const n = this.rnd.nextDouble() * 2 - 1;
            const hp = n - last * 0.72;
            last = n;
            b[i] += amp * hp * Math.exp(-t * decay);
        }
    }

    whoosh(b, amp, lpLo, lpHi) {
        let y = 0, y2 = 0;
        for (let i = 0; i < b.length; i++) {
            const p = i / b.length;
            let env = Math.sin(Math.PI * Math.pow(p, 0.6));
            env *= env;
            const c = lpLo + (lpHi - lpLo) * Math.sin(Math.PI * p);
            y += c * ((this.rnd.nextDouble() * 2 - 1) - y);
            y2 += c * (y - y2);
            b[i] += amp * env * y2 * 3;
        }
    }

    pcm(b, gain) {
        const out = new Float32Array(b.length);
        for (let i = 0; i < b.length; i++) {
            let v = Math.tanh(b[i] * gain);
            if (i < 64) v *= i / 64;
            const tail = b.length - i;
            if (tail < 512) v *= tail / 512;
            out[i] = v * (30000 / 32768);
        }
        return out;
    }

    // ---------- sounds ----------
    clang() {
        const b = this.buf(0.34);
        this.transient(b, 1.1, 55);
        this.noise(b, 0.55, 48, 0.82);
        this.sine(b, 940, 0.32, 10, 0);
        this.sine(b, 1460, 0.42, 12, 0);
        this.sine(b, 2210, 0.34, 14, 0);
        this.sine(b, 3280, 0.24, 18, 0.002);
        this.sine(b, 4680, 0.14, 22, 0.003);
        return this.pcm(b, 1.55);
    }

    parry() {
        const b = this.buf(0.42);
        this.transient(b, 1.25, 85);
        this.noise(b, 0.45, 90, 0.9);
        this.sweep(b, 520, 160, 0.25, 18);
        this.sine(b, 1820, 0.5, 10, 0);
        this.sine(b, 2740, 0.38, 12, 0.001);
        this.sine(b, 4110, 0.24, 16, 0.002);
        this.sine(b, 5480, 0.13, 20, 0.004);
        return this.pcm(b, 1.7);
    }

    block() {
        const b = this.buf(0.16);
        this.transient(b, 0.8, 75);
        this.noise(b, 0.45, 55, 0.42);
        this.sine(b, 240, 0.45, 24, 0);
        this.sine(b, 520, 0.24, 30, 0);
        this.sine(b, 1180, 0.1, 38, 0.001);
        return this.pcm(b, 1.3);
    }

    whooshSound(dur, lo, hi, gain) {
        const b = this.buf(dur);
        this.whoosh(b, 1.0, lo, hi);
        return this.pcm(b, gain);
    }

    hit() {
        const b = this.buf(0.16);
        this.transient(b, 1.0, 95);
        this.sweep(b, 220, 60, 0.95, 22);
        this.noise(b, 0.58, 48, 0.22);
        this.sine(b, 110, 0.22, 28, 0);
        return this.pcm(b, 1.65);
    }

    hurt() {
        const b = this.buf(0.22);
        this.transient(b, 0.72, 62);
        this.sweep(b, 260, 85, 0.72, 12);
        this.noise(b, 0.48, 32, 0.3);
        this.sine(b, 160, 0.18, 18, 0);
        return this.pcm(b, 1.45);
    }

    deathblow() {
        const b = this.buf(0.72);
        this.transient(b, 1.15, 48);
        this.noise(b, 0.95, 12, 0.24);
        this.sweep(b, 180, 34, 1.15, 5.5);
        this.sine(b, 90, 0.35, 7, 0);
        this.sine(b, 690, 0.28, 6.5, 0.01);
        this.sine(b, 1380, 0.2, 8, 0.015);
        this.sine(b, 2760, 0.1, 11, 0.02);
        return this.pcm(b, 1.8);
    }

    perilous() {
        const b = this.buf(0.34);
        this.transient(b, 0.35, 40);
        this.sine(b, 220, 0.55, 6.5, 0);
        this.sine(b, 233, 0.52, 7.2, 0);
        this.sine(b, 880, 0.16, 12, 0);
        this.sine(b, 1760, 0.12, 16, 0.01);
        this.noise(b, 0.16, 34, 0.55);
        return this.pcm(b, 1.45);
    }

    postureBreak() {
        const b = this.buf(0.85);
        this.transient(b, 0.95, 52);
        this.sine(b, 98, 0.75, 3.8, 0);
        this.sine(b, 196, 0.42, 4.6, 0);
        this.sine(b, 294, 0.28, 5.4, 0.01);
        this.sine(b, 880, 0.12, 8, 0.02);
        this.noise(b, 0.72, 16, 0.28);
        return this.pcm(b, 1.65);
    }

    heal() {
        const b = this.buf(0.42);
        this.sweep(b, 620, 1180, 0.24, 6.5);
        this.sine(b, 1240, 0.18, 8, 0.03);
        this.sine(b, 1860, 0.12, 10, 0.08);
        return this.pcm(b, 1.0);
    }

    shrine() {
        const b = this.buf(1.0);
        this.sine(b, 392, 0.26, 2.8, 0);
        this.sine(b, 587, 0.2, 3, 0.08);
        this.sine(b, 784, 0.18, 3.4, 0.16);
        this.sine(b, 1174, 0.12, 4, 0.22);
        this.noise(b, 0.05, 8, 0.85);
        return this.pcm(b, 0.95);
    }

    iai() {
        const b = this.buf(0.28);
        this.whoosh(b, 1.0, 0.22, 0.92);
        this.transient(b, 0.35, 90);
        this.sine(b, 2480, 0.18, 15, 0);
        this.sine(b, 3840, 0.12, 18, 0.001);
        this.sine(b, 5120, 0.08, 24, 0.002);
        return this.pcm(b, 1.8);
    }
}
