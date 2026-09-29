'use strict';

/**
 * PeerJS connections for online matches: hosting, joining, message routing and round-trip measurement.
 * Star topology: every client connects only to the host, which relays what the others need.
 */
const NET_VERSION = 2;
const ROOM_PREFIX = 'RONINSPATH-';
const PING_EVERY_MS = 250;

/** One data channel, with its own round-trip measurement. */
class NetConn {
    constructor(link, c) {
        this.link = link;
        this.c = c;
        this.idx = -1;
        this.look = null;
        this.rtt = 0;
        this.peerRtt = 0;
        this.lastHeard = performance.now();
        this.pingTimer = 0;
        this.closed = false;
        c.on('open', () => {
            this.lastHeard = performance.now();
            this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now(), rtt: this.rtt }), PING_EVERY_MS);
            link.opened(this);
        });
        c.on('data', d => this.receive(d));
        c.on('close', () => this.lost());
        c.on('error', () => this.lost());
    }

    get open() { return !this.closed && this.c.open; }

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
        this.link.dispatch(d, this);
    }

    /** Worst of both sides' measurements, so each end judges the connection the same way. */
    ping() { return Math.max(this.rtt, this.peerRtt); }

    send(obj) {
        if (!this.open) return;
        try {
            this.c.send(obj);
        } catch (e) { /* channel closing */ }
    }

    lost() {
        if (this.closed) return;
        this.close();
        this.link.connLost(this);
    }

    close() {
        this.closed = true;
        clearInterval(this.pingTimer);
        try {
            this.c.close();
        } catch (e) { /* already closed */ }
    }
}

class DuelLink {
    constructor() {
        this.peer = null;
        this.conns = [];
        this.role = null;
        this.handlers = new Map();
        this.closed = false;
        // host: decides whether one more connection may come in
        this.accept = null;
        // client: fired when the host connection opens / is lost
        this.onOpen = null;
        this.onClose = null;
        // host: fired when a client connection opens / is lost
        this.onPeerOpen = null;
        this.onPeerClose = null;
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
            case 'peer-unavailable': return 'No match found with that code. Check it and try again.';
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
        this.peer = new Peer(ROOM_PREFIX + code, { debug: 0 });
        this.peer.on('open', () => onCode(code));
        this.peer.on('error', e => onErr(e));
        this.peer.on('connection', c => {
            if (this.closed) return;
            if (this.accept !== null && !this.accept(this.conns.length)) {
                c.on('open', () => {
                    c.send({ t: 'full' });
                    setTimeout(() => c.close(), 300);
                });
                return;
            }
            this.conns.push(new NetConn(this, c));
        });
    }

    join(code, onErr) {
        this.role = 'client';
        this.peer = new Peer({ debug: 0 });
        this.peer.on('open', () => {
            if (this.closed) return;
            this.conns.push(new NetConn(this, this.peer.connect(ROOM_PREFIX + code, { reliable: true, serialization: 'json' })));
        });
        this.peer.on('error', e => onErr(e));
    }

    opened(nc) {
        if (this.closed) return;
        if (this.role === 'client') {
            if (this.onOpen) this.onOpen();
        } else if (this.onPeerOpen) this.onPeerOpen(nc);
    }

    on(type, fn) { this.handlers.set(type, fn); }

    dispatch(d, nc) {
        if (this.closed) return;
        const h = this.handlers.get(d.t);
        if (h) h(d, nc);
    }

    connLost(nc) {
        this.conns = this.conns.filter(c => c !== nc);
        if (this.closed) return;
        if (this.role === 'client') {
            this.close();
            if (this.onClose) this.onClose();
        } else if (this.onPeerClose) this.onPeerClose(nc);
    }

    /** Host: disconnect one client. */
    drop(nc) {
        if (nc.closed) return;
        nc.close();
        this.connLost(nc);
    }

    get connected() { return this.conns.length > 0 && this.conns[0].open; }

    /** Worst round trip over every connection. */
    ping() { return this.conns.reduce((m, c) => Math.max(m, c.ping()), 0); }

    /** Longest time since any connection was last heard from. */
    silence(now) { return this.conns.reduce((m, c) => Math.max(m, now - c.lastHeard), 0); }

    /** Client: to the host. Host: to every client. */
    send(obj) {
        if (this.closed) return;
        for (const c of this.conns) c.send(obj);
    }

    close() {
        this.closed = true;
        for (const c of this.conns) c.close();
        this.conns = [];
        try {
            if (this.peer !== null) this.peer.destroy();
        } catch (e) { /* already destroyed */ }
    }
}
