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
        this.put('BLOCK', this.block(), 4);
        this.put('SLASH', this.whooshSound(0.2, 0.05, 0.5, 1.5), 4);
        this.put('HEAVY', this.whooshSound(0.35, 0.02, 0.25, 1.9), 3);
        this.put('HIT', this.hit(), 4);
        this.put('HURT', this.hurt(), 3);
        this.put('DEATHBLOW', this.deathblow(), 2);
        this.put('DODGE', this.whooshSound(0.18, 0.03, 0.15, 1.0), 3);
        this.put('ARROW', this.whooshSound(0.15, 0.2, 0.8, 1.2), 4);
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
        const b = this.buf(0.7);
        this.noise(b, 0.9, 70, 0.9);
        this.sine(b, 1320, 0.5, 6, 0);
        this.sine(b, 2470, 0.35, 8, 0);
        this.sine(b, 3610, 0.25, 10, 0);
        this.sine(b, 5020, 0.15, 13, 0);
        this.sine(b, 880, 0.3, 5, 0);
        return this.pcm(b, 1.3);
    }

    block() {
        const b = this.buf(0.25);
        this.noise(b, 0.8, 40, 0.5);
        this.sine(b, 520, 0.4, 18, 0);
        this.sine(b, 940, 0.3, 22, 0);
        this.sine(b, 1600, 0.15, 30, 0);
        return this.pcm(b, 1.1);
    }

    whooshSound(dur, lo, hi, gain) {
        const b = this.buf(dur);
        this.whoosh(b, 1.0, lo, hi);
        return this.pcm(b, gain);
    }

    hit() {
        const b = this.buf(0.22);
        this.sweep(b, 170, 55, 0.9, 18);
        this.noise(b, 0.7, 35, 0.25);
        return this.pcm(b, 1.5);
    }

    hurt() {
        const b = this.buf(0.3);
        this.sweep(b, 230, 70, 0.8, 10);
        this.noise(b, 0.6, 25, 0.35);
        return this.pcm(b, 1.4);
    }

    deathblow() {
        const b = this.buf(1.1);
        this.noise(b, 1.0, 10, 0.3);
        this.sweep(b, 130, 35, 1.0, 3.5);
        this.sine(b, 660, 0.3, 4, 0);
        this.sine(b, 1250, 0.25, 5, 0);
        this.sine(b, 1870, 0.12, 6, 0.02);
        return this.pcm(b, 1.6);
    }

    perilous() {
        const b = this.buf(0.6);
        this.sine(b, 196, 0.5, 3, 0);
        this.sine(b, 208, 0.5, 3, 0);
        this.sine(b, 392, 0.25, 4, 0);
        this.sine(b, 1568, 0.12, 6, 0);
        this.noise(b, 0.3, 30, 0.6);
        return this.pcm(b, 1.3);
    }

    postureBreak() {
        const b = this.buf(1.4);
        this.sine(b, 110, 0.7, 2.5, 0);
        this.sine(b, 221, 0.4, 3, 0);
        this.sine(b, 331, 0.3, 3.5, 0);
        this.sine(b, 587, 0.2, 4, 0);
        this.noise(b, 0.6, 20, 0.4);
        return this.pcm(b, 1.4);
    }

    heal() {
        const b = this.buf(0.6);
        this.sweep(b, 500, 1000, 0.3, 4);
        this.sine(b, 1500, 0.15, 6, 0.1);
        return this.pcm(b, 1.0);
    }

    shrine() {
        const b = this.buf(1.6);
        this.sine(b, 523, 0.3, 2, 0);
        this.sine(b, 659, 0.25, 2, 0.12);
        this.sine(b, 784, 0.25, 2, 0.24);
        this.sine(b, 1046, 0.2, 2, 0.36);
        return this.pcm(b, 1.0);
    }

    iai() {
        const b = this.buf(0.6);
        this.whoosh(b, 1.0, 0.1, 0.9);
        this.sine(b, 3000, 0.2, 7, 0);
        this.sine(b, 4400, 0.12, 9, 0);
        return this.pcm(b, 1.5);
    }
}
