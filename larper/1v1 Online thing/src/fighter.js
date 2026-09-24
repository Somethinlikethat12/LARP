// Core arena constants shared across modules.
const ARENA = { width: 1280, height: 560, left: 60, right: 1220, ground: 460 };

const FIGHTER_W = 58;
const FIGHTER_H = 118;

const PHYS = {
	gravity: 2100,
	moveSpeed: 330,
	airMoveMult: 0.82,
	jumpVel: -740,
	fastFallVel: 900
};

const LIGHT = { startup: 0.18, active: 0.09, recovery: 0.20, dmg: 7, kb: 260, hitstun: 0.26, range: 92, stamina: 6 };
const HEAVY = { startup: 0.42, active: 0.11, recovery: 0.38, dmg: 17, kb: 560, hitstun: 0.48, range: 104, stamina: 17 };

const DASH = { duration: 0.17, speed: 900, iframes: 0.15, cooldown: 0.42, stamina: 18 };
const PARRY_WINDOW = 0.14;
const PARRY_STUN = 0.62;
const GUARD_BREAK_STUN = 0.9;
const BLOCK_CHIP_MULT = 0.18;
const BLOCK_STAMINA_MULT = 1.7;
const STAMINA_MAX = 100;
const STAMINA_REGEN = 26;
const STAMINA_REGEN_DELAY = 0.35;
const HEALTH_MAX = 100;

let ATTACK_UID = 1;

class Fighter {
	constructor(index, x, color, name) {
		this.index = index; // 0 or 1
		this.x = x;
		this.y = ARENA.ground;
		this.vx = 0;
		this.vy = 0;
		this.facing = index === 0 ? 1 : -1;
		this.color = color;
		this.name = name;
		this.grounded = true;

		this.hp = HEALTH_MAX;
		this.stamina = STAMINA_MAX;
		this.staminaRegenTimer = 0;

		this.state = 'idle'; // idle, walk, jump, fall, dash, block, attackLight, attackHeavy, hitstun, guardbreak, ko
		this.stateT = 0;

		this.attack = null; // {type, phase, timer, id, hasHit}
		this.blockHeld = false;
		this.blockPressedAt = -10;
		this.dash = null; // {timer, dir}
		this.dashCooldown = 0;
		this.hitstunTimer = 0;
		this.guardbreakTimer = 0;
		this.invulnerable = false;
		this.crouching = false;
		this.koFlag = false;
	}

	reset(x, facing) {
		this.x = x; this.y = ARENA.ground; this.vx = 0; this.vy = 0;
		this.facing = facing; this.grounded = true;
		this.hp = HEALTH_MAX; this.stamina = STAMINA_MAX; this.staminaRegenTimer = 0;
		this.state = 'idle'; this.stateT = 0;
		this.attack = null; this.blockHeld = false; this.blockPressedAt = -10;
		this.dash = null; this.dashCooldown = 0; this.hitstunTimer = 0; this.guardbreakTimer = 0;
		this.invulnerable = false; this.crouching = false; this.koFlag = false;
	}

	get width() { return FIGHTER_W; }
	get height() { return FIGHTER_H; }
	get centerY() { return this.y - this.height / 2; }

	bodyRect() {
		const crouchOffset = this.crouching && this.grounded ? 18 : 0;
		const height = this.height - crouchOffset;
		return { x: this.x - this.width / 2, y: this.y - height, w: this.width, h: height };
	}

	attackHitbox() {
		if (!this.attack || this.attack.phase !== 'active') return null;
		const spec = this.attack.type === 'heavy' ? HEAVY : LIGHT;
		const h = 46;
		const startX = this.facing > 0 ? this.x + this.width / 2 : this.x - this.width / 2 - spec.range;
		const centerY = this.y - this.height * 0.62;
		return { x: startX, y: centerY - h / 2, w: spec.range, h };
	}

	canAct() {
		return this.state !== 'hitstun' && this.state !== 'guardbreak' && this.state !== 'ko' && !this.attack;
	}

	startAttack(type) {
		if (!this.canAct()) return false;
		if (this.dash) return false;
		if (this.blockHeld) return false;
		const spec = type === 'heavy' ? HEAVY : LIGHT;
		if (this.stamina < spec.stamina * 0.4) return false;
		this.attack = { type, phase: 'startup', timer: 0, id: ATTACK_UID++, hasHit: false };
		this.state = type === 'heavy' ? 'attackHeavy' : 'attackLight';
		this.stateT = 0;
		return true;
	}

	startDash(dirInput) {
		if (!this.canAct()) return false;
		if (this.dash || this.dashCooldown > 0) return false;
		if (this.stamina < DASH.stamina) return false;
		const dir = dirInput !== 0 ? dirInput : this.facing;
		this.dash = { timer: 0, dir };
		this.state = 'dash';
		this.stateT = 0;
		this.stamina -= DASH.stamina;
		this.staminaRegenTimer = STAMINA_REGEN_DELAY;
		return true;
	}

	takeStaminaHit(amount) {
		this.stamina = Math.max(0, this.stamina - amount);
		this.staminaRegenTimer = STAMINA_REGEN_DELAY;
	}

	enterHitstun(duration) {
		this.attack = null;
		this.dash = null;
		this.state = 'hitstun';
		this.hitstunTimer = duration;
		this.stateT = 0;
	}

	enterGuardbreak() {
		this.attack = null;
		this.state = 'guardbreak';
		this.guardbreakTimer = GUARD_BREAK_STUN;
		this.stateT = 0;
	}

	applyKnockback(amount, awayFromFacing) {
		this.vx = amount * awayFromFacing;
		if (!this.grounded) this.vy = Math.min(this.vy, -180);
	}

	update(dt, input, opponent, fx) {
		this.stateT += dt;

		// ---- Facing (auto-face opponent unless mid-attack/dash) ----
		if (!this.attack && !this.dash && this.state !== 'hitstun' && this.state !== 'guardbreak') {
			this.facing = opponent.x >= this.x ? 1 : -1;
		}

		// ---- Timers that tick regardless of state ----
		if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
		if (this.staminaRegenTimer > 0) {
			this.staminaRegenTimer = Math.max(0, this.staminaRegenTimer - dt);
		} else if (this.stamina < STAMINA_MAX && this.state !== 'guardbreak') {
			this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
		}

		this.invulnerable = false;
		this.crouching = false;
		this.blockHeld = false;

		// ---- State-specific handling ----
		if (this.state === 'hitstun') {
			this.hitstunTimer -= dt;
			this.vx *= 0.86;
			if (this.hitstunTimer <= 0) { this.state = 'idle'; }
		} else if (this.state === 'guardbreak') {
			this.guardbreakTimer -= dt;
			this.vx *= 0.8;
			if (this.guardbreakTimer <= 0) { this.state = 'idle'; this.stamina = 24; }
		} else if (this.dash) {
			this.dash.timer += dt;
			this.invulnerable = this.dash.timer <= DASH.iframes;
			this.vx = this.dash.dir * DASH.speed;
			if (this.dash.timer >= DASH.duration) {
				this.dash = null;
				this.dashCooldown = DASH.cooldown;
				this.state = 'idle';
			}
		} else if (this.attack) {
			this.handleAttackTimer(dt);
			this.vx *= 0.9;
			if (input.dodge) this.tryDodge(input, fx);
		} else {
			this.handleFreeInput(dt, input, fx);
		}

		// ---- Physics integration ----
		this.vy += PHYS.gravity * dt;
		this.x += this.vx * dt;
		this.y += this.vy * dt;
		if (this.y >= ARENA.ground) { this.y = ARENA.ground; this.vy = 0; this.grounded = true; }
		else this.grounded = false;

		if (this.x < ARENA.left + this.width / 2) { this.x = ARENA.left + this.width / 2; this.vx = Math.max(0, this.vx); }
		if (this.x > ARENA.right - this.width / 2) { this.x = ARENA.right - this.width / 2; this.vx = Math.min(0, this.vx); }

		// idle/walk/jump visual state resolution (only when not in a special state)
		if (!this.attack && !this.dash && this.state !== 'hitstun' && this.state !== 'guardbreak') {
			if (!this.grounded) this.state = this.vy < 0 ? 'jump' : 'fall';
			else if (this.blockHeld) this.state = 'block';
			else if (Math.abs(this.vx) > 20) this.state = 'walk';
			else this.state = 'idle';
		}
	}

	handleFreeInput(dt, input, fx) {
		const blocking = input.block && this.grounded;
		this.blockHeld = blocking;
		if (input.blockJustPressed) this.blockPressedAt = 0;
		else this.blockPressedAt += dt;

		if (input.dodge) { if (this.tryDodge(input, fx)) return; }

		if (input.lightJustPressed) { if (this.startAttack('light')) return; }
		if (input.heavyJustPressed) { if (this.startAttack('heavy')) return; }

		if (blocking) { this.vx *= 0.7; return; }

		let move = 0;
		if (input.left) move -= 1;
		if (input.right) move += 1;
		const mult = this.grounded ? 1 : PHYS.airMoveMult;
		this.vx = move * PHYS.moveSpeed * mult;

		this.crouching = input.down && this.grounded;

		if (input.jumpJustPressed && this.grounded) {
			this.vy = PHYS.jumpVel;
			this.grounded = false;
		}
		if (input.down && !this.grounded && this.vy < PHYS.fastFallVel) {
			this.vy = PHYS.fastFallVel;
		}
	}

	tryDodge(input, fx) {
		let dir = 0;
		if (input.left) dir = -1;
		if (input.right) dir = 1;
		if (input.dodgeJustPressed && this.startDash(dir)) {
			fx && fx.spawnDust(this.x, this.y - 12, this.facing);
			return true;
		}
		return false;
	}

	handleAttackTimer(dt) {
		const spec = this.attack.type === 'heavy' ? HEAVY : LIGHT;
		this.attack.timer += dt;
		if (this.attack.phase === 'startup' && this.attack.timer >= spec.startup) {
			this.attack.phase = 'active'; this.attack.timer = 0;
		} else if (this.attack.phase === 'active' && this.attack.timer >= spec.active) {
			this.attack.phase = 'recovery'; this.attack.timer = 0;
		} else if (this.attack.phase === 'recovery' && this.attack.timer >= spec.recovery) {
			this.attack = null;
			this.state = 'idle';
		}
	}

	takeDamage(amount) {
		this.hp = Math.max(0, this.hp - amount);
		if (this.hp <= 0) { this.state = 'ko'; this.koFlag = true; }
	}

	draw(ctx) {
		const r = this.bodyRect();
		ctx.save();

		// invulnerability / dash shimmer
		if (this.invulnerable) ctx.globalAlpha = 0.55;

		// shadow
		ctx.fillStyle = 'rgba(0,0,0,0.4)';
		ctx.beginPath();
		ctx.ellipse(this.x, ARENA.ground + 6, this.width * 0.6, 8, 0, 0, Math.PI * 2);
		ctx.fill();

		const bodyH = r.h;
		const bodyY = this.y - bodyH;

		// afterimage trail while dashing
		if (this.dash) {
			ctx.globalAlpha = 0.22;
			for (let i = 1; i <= 3; i++) {
				ctx.fillStyle = this.color;
				ctx.fillRect(r.x - this.dash.dir * i * 14, bodyY, r.w, bodyH);
			}
			ctx.globalAlpha = this.invulnerable ? 0.55 : 1;
		}

		// body
		const grad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
		grad.addColorStop(0, this.color);
		grad.addColorStop(1, shade(this.color, -40));
		ctx.fillStyle = grad;
		roundRect(ctx, r.x, bodyY, r.w, bodyH, 10);
		ctx.fill();

		// guard glow
		if (this.state === 'block') {
			const guardColor = this.blockPressedAt <= PARRY_WINDOW ? '#ff9a3d' : '#9adcff';
			ctx.save();
			ctx.strokeStyle = guardColor;
			ctx.lineWidth = 3;
			ctx.shadowColor = guardColor;
			ctx.shadowBlur = 12;
			roundRect(ctx, r.x - 3, bodyY - 3, r.w + 6, bodyH + 6, 12);
			ctx.stroke();
			ctx.restore();
		}
		if (this.state === 'guardbreak') {
			ctx.save();
			ctx.strokeStyle = '#ff5b3d';
			ctx.lineWidth = 3;
			roundRect(ctx, r.x - 3, bodyY - 3, r.w + 6, bodyH + 6, 12);
			ctx.stroke();
			ctx.restore();
		}
		if (this.attack && this.attack.phase === 'startup') {
			const isHeavyTell = this.attack.type === 'heavy';
			const tellPulse = isHeavyTell
				? 0.7 + Math.sin(this.stateT * 18) * 0.25
				: 0.55 + Math.sin(this.stateT * 24) * 0.2;
			ctx.save();
			ctx.globalAlpha = tellPulse;
			ctx.strokeStyle = isHeavyTell ? '#ff6b3d' : '#ffd27a';
			ctx.lineWidth = isHeavyTell ? 4 : 2;
			ctx.shadowColor = isHeavyTell ? '#ff4b2b' : '#ff9a3d';
			ctx.shadowBlur = isHeavyTell ? 24 : 14;
			const tellInset = isHeavyTell ? 10 : 6;
			roundRect(ctx, r.x - tellInset, bodyY - tellInset, r.w + tellInset * 2, bodyH + tellInset * 2, isHeavyTell ? 18 : 14);
			ctx.stroke();
			ctx.restore();
		}

		// eye / facing indicator
		ctx.fillStyle = '#0a0710';
		const eyeX = this.x + this.facing * (r.w * 0.22);
		ctx.beginPath();
		ctx.arc(eyeX, bodyY + bodyH * 0.28, 5, 0, Math.PI * 2);
		ctx.fill();

		// weapon swipe indicator (simple blade shape while active)
		if (this.attack && this.attack.phase !== 'recovery') {
			const spec = this.attack.type === 'heavy' ? HEAVY : LIGHT;
			const gripX = this.x + this.facing * r.w * 0.22;
			const gripY = this.y - this.height * 0.62;
			const bladeLength = spec.range + r.w * 0.12;
			const startupProgress = Math.min(1, this.attack.timer / spec.startup);
			const activeProgress = Math.min(1, this.attack.timer / spec.active);
			const tipAngle = this.attack.phase === 'startup'
				? -1.18 + startupProgress * 0.12
				: -1.06 + activeProgress * 1.34;
			const tipX = gripX + this.facing * Math.cos(tipAngle) * bladeLength;
			const tipY = gripY + Math.sin(tipAngle) * bladeLength;
			ctx.strokeStyle = this.attack.type === 'heavy' ? '#ffce3d'
				: (this.attack.phase === 'startup' ? '#ffd27a' : '#ffffff');
			ctx.lineWidth = this.attack.type === 'heavy' ? 8 : 5;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(gripX, gripY);
			ctx.lineTo(tipX, tipY);
			ctx.stroke();
		}

		ctx.restore();

		if (window.__DEBUG_HITBOXES) {
			const hb = this.attackHitbox();
			if (hb) { ctx.strokeStyle = 'red'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h); }
			ctx.strokeStyle = 'lime';
			ctx.strokeRect(r.x, bodyY, r.w, bodyH);
		}
	}
}

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function shade(hex, percent) {
	const n = parseInt(hex.slice(1), 16);
	let r = (n >> 16) + percent, g = ((n >> 8) & 0xff) + percent, b = (n & 0xff) + percent;
	r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
	return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------
// Combat resolution between two fighters. Called once per tick after
// both fighters have run their physics/state update.
// ---------------------------------------------------------------
function rectsOverlap(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCombat(a, b, fx, onEvent) {
	checkClash(a, b, fx, onEvent);
	tryLand(a, b, fx, onEvent);
	tryLand(b, a, fx, onEvent);
}

function tryLand(attacker, defender, fx, onEvent) {
	if (!attacker.attack || attacker.attack.phase !== 'active' || attacker.attack.hasHit) return;
	const hb = attacker.attackHitbox();
	if (!hb) return;
	const db = defender.bodyRect();
	if (!rectsOverlap(hb, db)) return;

	attacker.attack.hasHit = true;
	const spec = attacker.attack.type === 'heavy' ? HEAVY : LIGHT;
	const hitX = (attacker.x + defender.x) / 2;
	const hitY = defender.y - defender.height * 0.6;
	const awayDir = attacker.facing;
	const kind = attacker.attack.type;

	if (defender.invulnerable) {
		fx.spawnText(hitX, hitY - 30, 'DODGE', '#cfd6ff');
		onEvent && onEvent({ type: 'dodge', x: hitX, y: hitY });
		return;
	}

	const isParry = defender.blockHeld && defender.blockPressedAt <= PARRY_WINDOW;
	if (isParry) {
		fx.whiteFlash(0.5);
		fx.freeze(0.09);
		fx.shakeScreen(6);
		fx.spawnText(hitX, hitY - 34, 'PARRY!', '#ffffff', true);
		fx.spawnBlockSpark(hitX, hitY, awayDir);
		if (kind === 'heavy') attacker.takeDamage(spec.dmg * 0.5);
		if (attacker.hp > 0) attacker.enterHitstun(kind === 'heavy' ? 1 : PARRY_STUN);
		else { attacker.attack = null; attacker.dash = null; }
		attacker.applyKnockback(spec.kb * 0.35, -awayDir);
		defender.stamina = Math.min(STAMINA_MAX, defender.stamina + 10);
		onEvent && onEvent({ type: 'parry', x: hitX, y: hitY, dir: awayDir });
		return;
	}

	if (defender.blockHeld) {
		const chip = spec.dmg * BLOCK_CHIP_MULT;
		defender.takeDamage(chip);
		defender.takeStaminaHit(spec.stamina * BLOCK_STAMINA_MULT);
		defender.applyKnockback(spec.kb * 0.22, awayDir);
		fx.spawnBlockSpark(hitX, hitY, awayDir);
		fx.shakeScreen(2);
		if (defender.stamina <= 0) defender.enterGuardbreak();
		onEvent && onEvent({ type: 'block', x: hitX, y: hitY, dir: awayDir });
		return;
	}

	// clean hit
	defender.takeDamage(spec.dmg);
	defender.applyKnockback(spec.kb * 0.6, awayDir);
	if (defender.hp > 0) defender.enterHitstun(spec.hitstun);
	fx.spawnSpark(hitX, hitY, '#ffffff', kind === 'heavy' ? 20 : 11, kind === 'heavy' ? 620 : 380);
	fx.spawnSlash(hitX, hitY, awayDir, kind, attacker.color);
	fx.shakeScreen(kind === 'heavy' ? 14 : 6);
	fx.freeze(kind === 'heavy' ? 0.08 : 0.035);
	onEvent && onEvent({ type: 'hit', x: hitX, y: hitY, dir: awayDir, kind, color: attacker.color });
}

function checkClash(a, b, fx, onEvent) {
	if (!a.attack || !b.attack) return;
	if (a.attack.phase !== 'active' || b.attack.phase !== 'active') return;
	if (a.attack.hasHit || b.attack.hasHit) return;
	const ha = a.attackHitbox(), hb = b.attackHitbox();
	if (!ha || !hb || !rectsOverlap(ha, hb)) return;
	a.attack.hasHit = true; b.attack.hasHit = true;
	const midX = (a.x + b.x) / 2, midY = Math.min(a.y, b.y) - a.height * 0.6;
	fx.spawnSpark(midX, midY, '#ffe27a', 16, 500);
	fx.shakeScreen(8);
	fx.freeze(0.07);
	a.vx = -a.facing * 260; b.vx = -b.facing * 260;
	onEvent && onEvent({ type: 'clash', x: midX, y: midY });
}
