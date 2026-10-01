'use strict';

/**
 * PeerJS link for online play. A host keeps one connection per guest and relays traffic between them (star topology),
 * so a guest only ever talks to the host. A guest keeps a single connection to the host.
 */
const NET_VERSION = 2;
const ROOM_PREFIX = 'RONINSPATH-';
const PING_EVERY_MS = 250;

/** One peer-to-peer connection with its own round-trip measurement. */
class NetConn {
    constructor(c) {
        this.c = c;
        this.open = false;
        this.rtt = 0;
        this.peerRtt = 0;
        this.lastHeard = performance.now();
        this.idx = -1;
        this.look = null;
    }

    get isOpen() { return this.open && this.c.open; }

    ping() { return Math.max(this.rtt, this.peerRtt); }

    send(obj) {
        if (!this.isOpen) return;
        try {
            this.c.send(obj);
        } catch (e) { /* channel closing */ }
    }
}

class DuelLink {
    constructor(prefix = ROOM_PREFIX) {
        this.prefix = prefix;
        this.peer = null;
        this.conns = [];
        this.role = null;
        this.handlers = new Map();
        this.pingTimer = 0;
        this.closed = false;
        this.onOpen = null;
        this.onClose = null;
        this.onPeerOpen = null;
        this.onPeerClose = null;
        // the menu narrows this once a lobby is full or a match has started
        this.accept = () => true;
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
            case 'peer-unavailable': return 'No room found with that code. Check it and try again.';
            case 'unavailable-id': return 'Room code collision - go back and host again.';
            case 'network':
            case 'server-error':
            case 'socket-error':
            case 'socket-closed': return 'Could not reach the matchmaking server. Check your internet connection.';
            case 'browser-incompatible': return 'This browser does not support WebRTC.';
            default: return 'Connection error' + (e && e.type ? ' (' + e.type + ')' : '') + '.';
        }
    }

    /** First connection, kept for the paths that only ever have one. */
    get conn() { return this.conns.length > 0 ? this.conns[0].c : null; }

    get connected() { return this.conns.some(c => c.isOpen); }

    get lastHeard() {
        let t = 0;
        for (const c of this.conns) if (c.lastHeard > t) t = c.lastHeard;
        return t;
    }

    host(onCode, onErr) {
        this.role = 'host';
        const code = DuelLink.newCode();
        this.peer = new Peer(this.prefix + code, { debug: 0 });
        this.peer.on('open', () => onCode(code));
        this.peer.on('error', e => onErr(e));
        this.peer.on('connection', c => {
            if (this.closed || !this.accept(this.conns.length)) {
                c.on('open', () => {
                    try {
                        c.send({ t: 'full' });
                    } catch (e) { /* already gone */ }
                    setTimeout(() => c.close(), 300);
                });
                return;
            }
            this.wire(c);
        });
        this.startPings();
    }

    join(code, onErr) {
        this.role = 'client';
        this.peer = new Peer({ debug: 0 });
        this.peer.on('open', () => this.wire(this.peer.connect(this.prefix + code, { reliable: true, serialization: 'json' })));
        this.peer.on('error', e => onErr(e));
        this.startPings();
    }

    startPings() {
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
            for (const n of this.conns) n.send({ t: 'ping', ts: performance.now(), rtt: n.rtt });
        }, PING_EVERY_MS);
    }

    wire(c) {
        const n = new NetConn(c);
        this.conns.push(n);
        c.on('open', () => {
            n.open = true;
            n.lastHeard = performance.now();
            if (this.onPeerOpen) this.onPeerOpen(n);
            if (this.onOpen) this.onOpen(n);
        });
        c.on('data', d => this.receive(d, n));
        c.on('close', () => this.lost(n));
        c.on('error', () => this.lost(n));
    }

    /** Handlers receive (data, conn), so a host can tell its guests apart. */
    on(type, fn) { this.handlers.set(type, fn); }

    receive(d, n) {
        if (this.closed || !d || typeof d !== 'object' || typeof d.t !== 'string') return;
        n.lastHeard = performance.now();
        if (d.t === 'ping') {
            n.send({ t: 'pong', ts: d.ts });
            if (Number.isFinite(d.rtt)) n.peerRtt = U.clamp(d.rtt, 0, 60000);
            return;
        }
        if (d.t === 'pong') {
            if (!Number.isFinite(d.ts)) return;
            const s = performance.now() - d.ts;
            if (s >= 0 && s < 60000) n.rtt = n.rtt === 0 ? s : n.rtt * 0.75 + s * 0.25;
            return;
        }
        const h = this.handlers.get(d.t);
        if (h) h(d, n);
    }

    /** Worst measurement across every peer, so each side judges the connection the same way. */
    ping() {
        let p = 0;
        for (const n of this.conns) p = Math.max(p, n.ping());
        return p;
    }

    send(obj) {
        for (const n of this.conns) n.send(obj);
    }

    /** Host-only: pass a guest's message on to every other guest. */
    relay(obj, from) {
        for (const n of this.conns) if (n !== from) n.send(obj);
    }

    drop(n) {
        const i = this.conns.indexOf(n);
        if (i < 0) return;
        this.conns.splice(i, 1);
        try {
            n.c.close();
        } catch (e) { /* already closed */ }
        if (this.onPeerClose) this.onPeerClose(n);
        if (this.conns.length === 0 && this.onClose) this.onClose();
    }

    lost(n) {
        if (this.closed || this.conns.indexOf(n) < 0) return;
        this.drop(n);
    }

    close() {
        this.closed = true;
        clearInterval(this.pingTimer);
        for (const n of this.conns) {
            try {
                n.c.close();
            } catch (e) { /* already closed */ }
        }
        this.conns.length = 0;
        try {
            if (this.peer !== null) this.peer.destroy();
        } catch (e) { /* already destroyed */ }
    }
}
