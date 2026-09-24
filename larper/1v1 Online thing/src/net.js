// Thin wrapper around PeerJS for host/client 1v1 networking.
// Host runs the authoritative simulation; the client sends inputs and
// renders interpolated snapshots received from the host.

const Net = {
	peer: null,
	conn: null,
	role: null, // 'host' | 'client' | null
	connected: false,
	onData: null,
	onConnected: null,
	onDisconnected: null,
	onError: null,

	host(onId, onErr) {
		this.cleanup();
		this.role = 'host';
		this.peer = new Peer(genRoomCode(), { debug: 0 });
		this.peer.on('open', (id) => onId(id));
		this.peer.on('error', (err) => { onErr && onErr(err); });
		this.peer.on('connection', (c) => {
			if (this.conn) { c.close(); return; } // only one opponent allowed
			this.conn = c;
			this.wireConn();
		});
	},

	join(hostId, onErr) {
		this.cleanup();
		this.role = 'client';
		this.peer = new Peer({ debug: 0 });
		this.peer.on('open', () => {
			this.conn = this.peer.connect(hostId.trim().toUpperCase(), { reliable: false, serialization: 'json' });
			this.wireConn();
		});
		this.peer.on('error', (err) => { onErr && onErr(err); });
	},

	wireConn() {
		this.conn.on('open', () => {
			this.connected = true;
			this.onConnected && this.onConnected();
		});
		this.conn.on('data', (d) => { this.onData && this.onData(d); });
		this.conn.on('close', () => {
			this.connected = false;
			this.onDisconnected && this.onDisconnected();
		});
		this.conn.on('error', (err) => { this.onError && this.onError(err); });
	},

	send(obj) {
		if (this.conn && this.conn.open) {
			try { this.conn.send(obj); } catch (e) { /* ignore transient send errors */ }
		}
	},

	isHost() { return this.role === 'host'; },

	cleanup() {
		if (this.conn) { try { this.conn.close(); } catch (e) {} this.conn = null; }
		if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
		this.connected = false;
		this.role = null;
	}
};

function genRoomCode() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = '';
	for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
	return 'SE-' + s;
}
