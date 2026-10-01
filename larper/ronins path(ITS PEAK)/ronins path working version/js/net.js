'use strict';

/** PeerJS connection for online duels: hosting, joining, message routing and round-trip measurement. */
const NET_VERSION = 1;
const ROOM_PREFIX = 'RONINSPATH-';
const PING_EVERY_MS = 250;

class DuelLink {
    constructor(prefix = ROOM_PREFIX) {
        this.prefix = prefix;
        this.peer = null;
        this.conn = null;
        this.role = null;
        this.handlers = new Map();
        this.rtt = 0;
        this.peerRtt = 0;
        this.lastHeard = 0;
        this.pingTimer = 0;
        this.closed = false;
        this.onOpen = null;
        this.onClose = null;
    }

    static available() { return typeof Peer !== 'undefined'; }

    static newCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint32Array(6);
        crypto.getRandomValues(a);
        let s = '';
        for (const v of a) s += chars[v % chars.length];
        return s;
    }

    static cleanCode(s) {
        return String(s || '').toUpperCase().replace(ROOM_PREFIX, '').replace(/[^A-Z0-9]/g, '').slice(0, 12);
    }

    static errorText(e) {
        switch (e && e.type) {
            case 'peer-unavailable': return 'No duel found with that code. Check it and try again.';
            case 'unavailable-id': return 'Room code collision - go back and host again.';
            case 'network':
            case 'server-error':
            case 'socket-error':
            case 'socket-closed': return 'Could not reach the matchmaking server. Check your internet connection.';
            case 'browser-incompatible': return 'This browser does not support WebRTC.';
            default: return 'Connection error' + (e && e.type ? ' (' + e.type + ')' : '') + '.';
        }
    }

    host(onCode, onErr) {
        this.role = 'host';
        const code = DuelLink.newCode();
        this.peer = new Peer(this.prefix + code, { debug: 0 });
        this.peer.on('open', () => onCode(code));
        this.peer.on('error', e => onErr(e));
        this.peer.on('connection', c => {
            if (this.conn !== null) {
                c.on('open', () => {
                    c.send({ t: 'full' });
                    setTimeout(() => c.close(), 300);
                });
                return;
            }
            this.wire(c);
        });
    }

    join(code, onErr) {
        this.role = 'client';
        this.peer = new Peer({ debug: 0 });
        this.peer.on('open', () => this.wire(this.peer.connect(this.prefix + code, { reliable: true, serialization: 'json' })));
        this.peer.on('error', e => onErr(e));
    }

    wire(c) {
        this.conn = c;
        c.on('open', () => {
            this.lastHeard = performance.now();
            this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now(), rtt: this.rtt }), PING_EVERY_MS);
            if (this.onOpen) this.onOpen();
        });
        c.on('data', d => this.receive(d));
        c.on('close', () => this.lost());
        c.on('error', () => this.lost());
    }

    on(type, fn) { this.handlers.set(type, fn); }

    receive(d) {
        if (this.closed || !d || typeof d !== 'object' || typeof d.t !== 'string') return;
        this.lastHeard = performance.now();
        if (d.t === 'ping') {
            this.send({ t: 'pong', ts: d.ts });
            if (Number.isFinite(d.rtt)) this.peerRtt = U.clamp(d.rtt, 0, 60000);
            return;
        }
        if (d.t === 'pong') {
            if (!Number.isFinite(d.ts)) return;
            const s = performance.now() - d.ts;
            if (s >= 0 && s < 60000) this.rtt = this.rtt === 0 ? s : this.rtt * 0.75 + s * 0.25;
            return;
        }
        const h = this.handlers.get(d.t);
        if (h) h(d);
    }

    /** Worst of both sides' measurements, so each peer judges the connection the same way. */
    ping() { return Math.max(this.rtt, this.peerRtt); }

    send(obj) {
        if (this.closed || this.conn === null || !this.conn.open) return;
        try {
            this.conn.send(obj);
        } catch (e) { /* channel closing */ }
    }

    lost() {
        if (this.closed) return;
        this.close();
        if (this.onClose) this.onClose();
    }

    close() {
        this.closed = true;
        clearInterval(this.pingTimer);
        try {
            if (this.conn !== null) this.conn.close();
        } catch (e) { /* already closed */ }
        try {
            if (this.peer !== null) this.peer.destroy();
        } catch (e) { /* already destroyed */ }
    }
}
