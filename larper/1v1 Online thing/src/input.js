// Keyboard input handling for up to two local players, with edge (just-pressed) detection.

const KEYMAP = {
	p1: {
		left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
		light: 'KeyF', heavy: 'KeyG', dodge: 'Space', block: 'ShiftLeft'
	},
	p2: {
		left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
		light: 'KeyK', heavy: 'KeyL', dodge: 'Slash', block: 'ShiftRight'
	}
};

class InputManager {
	constructor() {
		this.down = new Set();
		this.prevDown = new Set();
		window.addEventListener('keydown', (e) => {
			if (this.isGameKey(e.code)) e.preventDefault();
			this.down.add(e.code);
		});
		window.addEventListener('keyup', (e) => {
			this.down.delete(e.code);
		});
		window.addEventListener('blur', () => { this.down.clear(); });
	}

	isGameKey(code) {
		for (const map of Object.values(KEYMAP)) {
			if (Object.values(map).includes(code)) return true;
		}
		return code === 'Escape';
	}

	// Call once per frame after reading state, to advance edge-detection.
	endFrame() {
		this.prevDown = new Set(this.down);
	}

	escapeJustPressed() {
		return this.down.has('Escape') && !this.prevDown.has('Escape');
	}

	// Returns an input snapshot object for the given player key map ('p1'|'p2').
	getState(which) {
		const map = KEYMAP[which];
		const held = (code) => this.down.has(code);
		const justPressed = (code) => this.down.has(code) && !this.prevDown.has(code);
		return {
			left: held(map.left), right: held(map.right),
			up: held(map.up), down: held(map.down),
			light: held(map.light), heavy: held(map.heavy),
			dodge: held(map.dodge), block: held(map.block),
			jumpJustPressed: justPressed(map.up),
			lightJustPressed: justPressed(map.light),
			heavyJustPressed: justPressed(map.heavy),
			dodgeJustPressed: justPressed(map.dodge),
			blockJustPressed: justPressed(map.block)
		};
	}

	// Serializable snapshot for sending over the network (booleans only, no derived edges).
	getRawKeys(which) {
		const map = KEYMAP[which];
		const held = (code) => this.down.has(code);
		return {
			left: held(map.left), right: held(map.right),
			up: held(map.up), down: held(map.down),
			light: held(map.light), heavy: held(map.heavy),
			dodge: held(map.dodge), block: held(map.block)
		};
	}
}

// Converts a raw remote key snapshot (booleans) into a full input state with
// locally-tracked just-pressed edges, since edges can't be detected from a single packet.
class RemoteInputTracker {
	constructor() { this.prev = null; }
	toInputState(raw) {
		const p = this.prev || {};
		const jp = (k) => !!raw[k] && !p[k];
		const out = {
			left: !!raw.left, right: !!raw.right, up: !!raw.up, down: !!raw.down,
			light: !!raw.light, heavy: !!raw.heavy, dodge: !!raw.dodge, block: !!raw.block,
			jumpJustPressed: jp('up'), lightJustPressed: jp('light'),
			heavyJustPressed: jp('heavy'), dodgeJustPressed: jp('dodge'), blockJustPressed: jp('block')
		};
		this.prev = raw;
		return out;
	}
}
