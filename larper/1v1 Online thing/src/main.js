// App orchestration: menus, game loop, round/match flow, HUD, and online glue.

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const im = new InputManager();
const fx = new FX();
const remoteTracker = new RemoteInputTracker();

let appState = 'menu'; // 'menu' | 'playing'
let match = null;
let lastRemoteRawKeys = { left: false, right: false, up: false, down: false, light: false, heavy: false, dodge: false, block: false };
let lastTime = performance.now();

// ---------------------------------------------------------------
// Screen management
// ---------------------------------------------------------------
function showScreen(id) {
	document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
	if (id) document.getElementById(id).classList.remove('hidden');
}

function showOnlinePanel(which) {
	['online-choice', 'online-host', 'online-join'].forEach(id => document.getElementById(id).classList.add('hidden'));
	document.getElementById(which).classList.remove('hidden');
}

// ---------------------------------------------------------------
// Match setup
// ---------------------------------------------------------------
function createMatch(mode) {
	const f0 = new Fighter(0, 300, '#ff3b5c', mode === 'client' ? 'Opponent' : 'You');
	const f1 = new Fighter(1, ARENA.width - 300, '#3ba7ff', mode === 'client' ? 'You' : (mode === 'host' ? 'Opponent' : 'P2'));
	if (mode === 'local') { f0.name = 'P1'; f1.name = 'P2'; }
	f0._targetX = f0.x; f0._targetY = f0.y;
	f1._targetX = f1.x; f1._targetY = f1.y;
	const m = {
		mode, fighters: [f0, f1],
		roundsWon: [0, 0], roundsToWin: 2, roundNum: 0,
		roundTimer: 60, phase: 'intro', bannerTimer: 1.2, bannerText: '',
		frameEvents: [], paused: false, _resultTimer: null, _resultShown: false
	};
	startRound(m);
	return m;
}

function startRound(m) {
	m.roundNum++;
	m.fighters[0].reset(300, 1);
	m.fighters[1].reset(ARENA.width - 300, -1);
	m.fighters[0]._targetX = m.fighters[0].x; m.fighters[0]._targetY = m.fighters[0].y;
	m.fighters[1]._targetX = m.fighters[1].x; m.fighters[1]._targetY = m.fighters[1].y;
	m.roundTimer = 60;
	m.phase = 'intro';
	m.bannerTimer = 1.15;
	m.bannerText = 'ROUND ' + m.roundNum;
}

function snapshotFighter(f) {
	return {
		x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing,
		hp: f.hp, stamina: f.stamina, state: f.state,
		blockHeld: f.blockHeld, invulnerable: f.invulnerable, crouching: f.crouching,
		grounded: f.grounded, stateT: f.stateT,
		attack: f.attack ? { type: f.attack.type, phase: f.attack.phase, timer: f.attack.timer } : null,
		dash: f.dash ? { dir: f.dash.dir } : null
	};
}

function applyDiscreteFields(f, s) {
	f.vx = s.vx; f.vy = s.vy; f.facing = s.facing; f.hp = s.hp; f.stamina = s.stamina;
	f.state = s.state; f.blockHeld = s.blockHeld; f.invulnerable = s.invulnerable;
	f.crouching = s.crouching; f.grounded = s.grounded; f.stateT = s.stateT;
	f.attack = s.attack ? { ...s.attack, hasHit: true, id: 0 } : null;
	f.dash = s.dash ? { ...s.dash, timer: 0 } : null;
	f._targetX = s.x; f._targetY = s.y;
}

// ---------------------------------------------------------------
// Authoritative simulation (used for local matches and the host side of online matches)
// ---------------------------------------------------------------
function tickAuthoritative(m, dt, input0, input1) {
	if (m.phase === 'matchover') return;

	if (m.phase === 'intro') {
		m.bannerTimer -= dt;
		if (m.bannerTimer <= 0) {
			if (m.bannerText !== 'FIGHT!') { m.bannerText = 'FIGHT!'; m.bannerTimer = 0.55; }
			else m.phase = 'fight';
		}
		return;
	}
	if (m.phase === 'roundover') {
		m.bannerTimer -= dt;
		if (m.bannerTimer <= 0) {
			if (m.roundsWon[0] >= m.roundsToWin || m.roundsWon[1] >= m.roundsToWin) {
				m.phase = 'matchover';
				const winnerIdx = m.roundsWon[0] > m.roundsWon[1] ? 0 : 1;
				m.bannerText = m.fighters[winnerIdx].name.toUpperCase() + ' WINS THE MATCH';
				m.winnerIdx = winnerIdx;
			} else {
				startRound(m);
			}
		}
		return;
	}

	// phase === 'fight'
	m.frameEvents = [];
	const onEvent = (e) => m.frameEvents.push(e);
	if (fx.hitstop <= 0) {
		m.fighters[0].update(dt, input0, m.fighters[1], fx);
		m.fighters[1].update(dt, input1, m.fighters[0], fx);
		resolveCombat(m.fighters[0], m.fighters[1], fx, onEvent);
		m.roundTimer = Math.max(0, m.roundTimer - dt);
	}
	checkRoundEnd(m);
}

function checkRoundEnd(m) {
	const [a, b] = m.fighters;
	let winnerIdx = null;
	if (a.hp <= 0 && b.hp <= 0) winnerIdx = -1;
	else if (a.hp <= 0) winnerIdx = 1;
	else if (b.hp <= 0) winnerIdx = 0;
	else if (m.roundTimer <= 0) {
		if (a.hp > b.hp) winnerIdx = 0; else if (b.hp > a.hp) winnerIdx = 1; else winnerIdx = -1;
	}
	if (winnerIdx === null) return;
	if (winnerIdx >= 0) m.roundsWon[winnerIdx]++;
	m.phase = 'roundover';
	m.bannerTimer = 1.8;
	m.bannerText = winnerIdx === -1 ? 'DRAW ROUND' : (m.fighters[winnerIdx].name.toUpperCase() + ' WINS THE ROUND');
}

// ---------------------------------------------------------------
// Remote event playback (client side, from host-forwarded events)
// ---------------------------------------------------------------
function applyRemoteEvent(evt) {
	switch (evt.type) {
		case 'hit':
			fx.spawnSpark(evt.x, evt.y, '#ffffff', evt.kind === 'heavy' ? 20 : 11, evt.kind === 'heavy' ? 620 : 380);
			fx.spawnSlash(evt.x, evt.y, evt.dir, evt.kind, evt.color);
			fx.shakeScreen(evt.kind === 'heavy' ? 14 : 6);
			fx.freeze(evt.kind === 'heavy' ? 0.08 : 0.035);
			break;
		case 'parry':
			fx.whiteFlash(0.5); fx.freeze(0.09); fx.shakeScreen(6);
			fx.spawnText(evt.x, evt.y - 34, 'PARRY!', '#ffffff', true);
			fx.spawnBlockSpark(evt.x, evt.y, evt.dir);
			break;
		case 'block':
			fx.spawnBlockSpark(evt.x, evt.y, evt.dir); fx.shakeScreen(2);
			break;
		case 'dodge':
			fx.spawnText(evt.x, evt.y - 30, 'DODGE', '#cfd6ff');
			break;
		case 'clash':
			fx.spawnSpark(evt.x, evt.y, '#ffe27a', 16, 500); fx.shakeScreen(8); fx.freeze(0.07);
			break;
	}
}

// ---------------------------------------------------------------
// Networking glue
// ---------------------------------------------------------------
Net.onData = (msg) => {
	if (!match) return;
	if (msg.t === 'snap' && match.mode === 'client') {
		applyDiscreteFields(match.fighters[0], msg.p0);
		applyDiscreteFields(match.fighters[1], msg.p1);
		match.roundTimer = msg.timer;
		match.roundsWon = msg.roundsWon;
		match.phase = msg.phase;
		match.bannerText = msg.bannerText;
		(msg.events || []).forEach(applyRemoteEvent);
	} else if (msg.t === 'input' && match.mode === 'host') {
		lastRemoteRawKeys = msg.keys;
	}
};

Net.onDisconnected = () => {
	if (appState === 'playing' && match && (match.mode === 'host' || match.mode === 'client')) {
		endToMenu('Opponent disconnected.');
	}
};

function beginOnlineHost() {
	showOnlinePanel('online-host');
	document.getElementById('host-status').textContent = 'Generating room…';
	document.getElementById('host-code').textContent = '…';
	Net.host((id) => {
		document.getElementById('host-code').textContent = id;
		document.getElementById('host-status').textContent = 'Waiting for opponent to connect…';
	}, (err) => {
		document.getElementById('host-status').textContent = 'Error: ' + (err && err.type ? err.type : 'connection failed');
	});
	Net.onConnected = () => {
		document.getElementById('host-status').textContent = 'Opponent connected!';
		match = createMatch('host');
		lastRemoteRawKeys = { left: false, right: false, up: false, down: false, light: false, heavy: false, dodge: false, block: false };
		enterPlaying();
	};
}

function beginOnlineJoin(code) {
	document.getElementById('join-status').textContent = 'Connecting…';
	Net.join(code, (err) => {
		document.getElementById('join-status').textContent = 'Error: ' + (err && err.type ? err.type : 'connection failed');
	});
	Net.onConnected = () => {
		document.getElementById('join-status').textContent = 'Connected!';
		match = createMatch('client');
		enterPlaying();
	};
}

function endToMenu(message) {
	Net.cleanup();
	match = null;
	appState = 'menu';
	document.getElementById('hud').classList.add('hidden');
	document.getElementById('banner').classList.add('hidden');
	document.getElementById('connstatus').classList.add('hidden');
	showScreen('screen-main');
	if (message) {
		const cs = document.getElementById('connstatus');
		cs.textContent = message;
		cs.classList.remove('hidden');
		document.getElementById('screen-main').prepend(cs);
		setTimeout(() => cs.classList.add('hidden'), 3500);
	}
}

function enterPlaying() {
	appState = 'playing';
	showScreen(null);
	document.getElementById('hud').classList.remove('hidden');
	const cs = document.getElementById('connstatus');
	if (match.mode === 'local') {
		cs.classList.add('hidden');
	} else {
		cs.textContent = match.mode === 'host' ? 'ONLINE • HOSTING' : 'ONLINE • CONNECTED';
		cs.classList.remove('hidden');
		document.querySelector('.arena-wrap').appendChild(cs);
	}
}

// ---------------------------------------------------------------
// HUD + banner
// ---------------------------------------------------------------
function updateHud(m) {
	const [a, b] = m.fighters;
	document.getElementById('p1-name').textContent = a.name;
	document.getElementById('p2-name').textContent = b.name;
	document.getElementById('p1-hp').style.width = Math.max(0, a.hp) + '%';
	document.getElementById('p2-hp').style.width = Math.max(0, b.hp) + '%';
	document.getElementById('p1-sp').style.width = Math.max(0, a.stamina) + '%';
	document.getElementById('p2-sp').style.width = Math.max(0, b.stamina) + '%';
	document.getElementById('timer').textContent = Math.ceil(m.roundTimer);
	renderPips('p1-pips', m.roundsWon[0], m.roundsToWin);
	renderPips('p2-pips', m.roundsWon[1], m.roundsToWin);

	const banner = document.getElementById('banner');
	if (m.phase === 'intro' || m.phase === 'roundover' || m.phase === 'matchover') {
		if (banner.textContent !== m.bannerText) {
			banner.textContent = m.bannerText;
			banner.style.animation = 'none'; void banner.offsetWidth; banner.style.animation = '';
		}
		banner.style.color = bannerColor(m);
		banner.classList.remove('hidden');
	} else {
		banner.classList.add('hidden');
	}

	if (m.phase === 'matchover') {
		if (m._resultTimer == null) m._resultTimer = 0.9;
		else {
			m._resultTimer -= 1 / 60;
			if (m._resultTimer <= 0 && !m._resultShown) {
				m._resultShown = true;
				banner.classList.add('hidden');
				document.getElementById('result-title').textContent = m.bannerText;
				document.getElementById('result-sub').textContent =
					`Final score: ${a.name} ${m.roundsWon[0]} — ${m.roundsWon[1]} ${b.name}`;
				document.querySelector('#screen-result [data-action="rematch"]').classList.toggle('hidden', m.mode !== 'local');
				showScreen('screen-result');
			}
		}
	}
}

function renderPips(id, won, total) {
	const el = document.getElementById(id);
	el.innerHTML = '';
	for (let i = 0; i < total; i++) {
		const s = document.createElement('span');
		if (i < won) s.classList.add('won');
		el.appendChild(s);
	}
}

function bannerColor(m) {
	if (m.bannerText.startsWith(m.fighters[0].name.toUpperCase())) return '#ff3b5c';
	if (m.bannerText.startsWith(m.fighters[1].name.toUpperCase())) return '#3ba7ff';
	return '#ffffff';
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function drawBackground() {
	const g = ctx.createLinearGradient(0, 0, 0, ARENA.height);
	g.addColorStop(0, '#1a1030');
	g.addColorStop(0.55, '#140c22');
	g.addColorStop(1, '#0a0714');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, ARENA.width, ARENA.height);

	// distant silhouettes
	ctx.fillStyle = 'rgba(60,30,90,0.35)';
	for (let i = 0; i < 6; i++) {
		const x = i * 240 - 60;
		ctx.beginPath();
		ctx.moveTo(x, ARENA.ground - 40);
		ctx.lineTo(x + 90, ARENA.ground - 140 - (i % 3) * 30);
		ctx.lineTo(x + 180, ARENA.ground - 40);
		ctx.closePath();
		ctx.fill();
	}

	// ground
	const gg = ctx.createLinearGradient(0, ARENA.ground, 0, ARENA.height);
	gg.addColorStop(0, '#241735');
	gg.addColorStop(1, '#0a0714');
	ctx.fillStyle = gg;
	ctx.fillRect(0, ARENA.ground, ARENA.width, ARENA.height - ARENA.ground);
	ctx.strokeStyle = 'rgba(255,255,255,0.12)';
	ctx.lineWidth = 2;
	ctx.beginPath(); ctx.moveTo(0, ARENA.ground); ctx.lineTo(ARENA.width, ARENA.ground); ctx.stroke();

	// arena edge glows
	ctx.fillStyle = 'rgba(255,59,92,0.08)';
	ctx.fillRect(0, 0, ARENA.left, ARENA.height);
	ctx.fillStyle = 'rgba(59,167,255,0.08)';
	ctx.fillRect(ARENA.right, 0, ARENA.width - ARENA.right, ARENA.height);
}

function render() {
	ctx.clearRect(0, 0, ARENA.width, ARENA.height);
	drawBackground();
	if (match) {
		const off = fx.getShakeOffset();
		ctx.save();
		ctx.translate(off.x, off.y);
		match.fighters[0].draw(ctx);
		match.fighters[1].draw(ctx);
		fx.draw(ctx);
		ctx.restore();
	}
	fx.drawScreenFX(ctx, ARENA.width, ARENA.height);
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
function loop(now) {
	let dt = (now - lastTime) / 1000;
	lastTime = now;
	dt = Math.min(dt, 1 / 20);

	fx.update(dt);

	if (appState === 'playing' && match && !match.paused) {
		if (im.escapeJustPressed()) {
			match.paused = true;
			showScreen('screen-pause');
		}

		if (match.mode === 'local') {
			const i0 = im.getState('p1');
			const i1 = im.getState('p2');
			tickAuthoritative(match, dt, i0, i1);
		} else if (match.mode === 'host') {
			const i0 = im.getState('p1');
			const i1 = remoteTracker.toInputState(lastRemoteRawKeys);
			tickAuthoritative(match, dt, i0, i1);
			Net.send({
				t: 'snap',
				p0: snapshotFighter(match.fighters[0]),
				p1: snapshotFighter(match.fighters[1]),
				timer: match.roundTimer, roundsWon: match.roundsWon,
				phase: match.phase, bannerText: match.bannerText,
				events: match.frameEvents
			});
		} else if (match.mode === 'client') {
			Net.send({ t: 'input', keys: im.getRawKeys('p1') });
			const k = Math.min(1, dt * 20);
			for (const f of match.fighters) {
				if (f._targetX == null) continue;
				f.x += (f._targetX - f.x) * k;
				f.y += (f._targetY - f.y) * k;
			}
		}
		updateHud(match);
		im.endFrame();
	} else if (appState === 'playing' && match && match.paused) {
		if (im.escapeJustPressed()) { match.paused = false; showScreen(null); }
		im.endFrame();
	} else {
		im.endFrame();
	}

	render();
	requestAnimationFrame(loop);
}

// ---------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------
document.addEventListener('click', (e) => {
	const btn = e.target.closest('[data-action]');
	if (!btn) return;
	const action = btn.dataset.action;
	switch (action) {
		case 'local':
			match = createMatch('local');
			enterPlaying();
			break;
		case 'online':
			showScreen('screen-online');
			showOnlinePanel('online-choice');
			break;
		case 'controls':
			showScreen('screen-controls');
			break;
		case 'back':
			showScreen('screen-main');
			break;
		case 'host':
			beginOnlineHost();
			break;
		case 'join':
			showOnlinePanel('online-join');
			document.getElementById('join-status').textContent = '';
			break;
		case 'connect': {
			const code = document.getElementById('join-code').value;
			if (code.trim()) beginOnlineJoin(code);
			break;
		}
		case 'cancel-online':
			Net.cleanup();
			showOnlinePanel('online-choice');
			break;
		case 'rematch':
			match = createMatch(match.mode);
			enterPlaying();
			break;
		case 'menu':
			endToMenu();
			break;
		case 'resume':
			match.paused = false;
			showScreen(null);
			break;
	}
});

document.getElementById('host-code').addEventListener('click', () => {
	const text = document.getElementById('host-code').textContent;
	if (text && text !== '…' && navigator.clipboard) {
		navigator.clipboard.writeText(text).then(() => {
			document.getElementById('host-status').textContent = 'Code copied to clipboard!';
		}).catch(() => {});
	}
});

document.getElementById('join-code').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') document.querySelector('[data-action="connect"]').click();
});

requestAnimationFrame(loop);
