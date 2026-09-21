"use strict";

const canvas = document.getElementById("table");
const ctx = canvas.getContext("2d", { alpha: false });
const tableFrame = document.getElementById("table-frame");
const angleSlider = document.getElementById("angle-slider");
const angleFill = document.getElementById("angle-fill");
const angleReadout = document.getElementById("angle-readout");
const powerSlider = document.getElementById("power-slider");
const powerFill = document.getElementById("power-fill");
const powerReadout = document.getElementById("power-readout");
const runSeed = document.getElementById("run-seed");
const stageNumber = document.getElementById("stage-number");
const encounterType = document.getElementById("encounter-type");
const encounterName = document.getElementById("encounter-name");
const encounterSubtitle = document.getElementById("encounter-subtitle");
const runScore = document.getElementById("run-score");
const shotsLeft = document.getElementById("shots-left");
const nerveValue = document.getElementById("nerve-value");
const route = document.getElementById("route");
const tableStatus = document.getElementById("table-status");
const streakStatus = document.getElementById("streak-status");
const challengeStatus = document.getElementById("challenge-status");
const challengeStatusText = document.getElementById("challenge-status-text");
const shotLabel = document.getElementById("shot-label");
const shotDetail = document.getElementById("shot-detail");
const impactCopy = document.getElementById("impact-copy");
const impactTitle = document.getElementById("impact-title");
const impactDetail = document.getElementById("impact-detail");
const soundButton = document.getElementById("sound-button");
const rackButton = document.getElementById("rack-button");
const tableNumber = document.getElementById("table-number");
const encounterModal = document.getElementById("encounter-modal");
const encounterKicker = document.getElementById("encounter-kicker");
const encounterHeading = document.getElementById("encounter-heading");
const encounterLore = document.getElementById("encounter-lore");
const encounterObjective = document.getElementById("encounter-objective");
const modifierIcon = document.getElementById("modifier-icon");
const modifierName = document.getElementById("modifier-name");
const modifierDescription = document.getElementById("modifier-description");
const sideBetText = document.getElementById("side-bet-text");
const sideBetReward = document.getElementById("side-bet-reward");
const beginEncounterButton = document.getElementById("begin-encounter");
const rewardModal = document.getElementById("reward-modal");
const rewardKicker = document.getElementById("reward-kicker");
const rewardHeading = document.getElementById("reward-heading");
const rewardSummary = document.getElementById("reward-summary");
const upgradeGrid = document.getElementById("upgrade-grid");
const rerollUpgradesButton = document.getElementById("reroll-upgrades");
const runModal = document.getElementById("run-modal");
const runKicker = document.getElementById("run-kicker");
const runHeading = document.getElementById("run-heading");
const runSummary = document.getElementById("run-summary");
const runResult = document.getElementById("run-result");
const restartRunButton = document.getElementById("restart-run");
const chalkValue = document.getElementById("chalk-value");
const relics = document.getElementById("relics");
const runDifficultyLabel = document.getElementById("run-difficulty");
const menuModal = document.getElementById("menu-modal");
const menuBestScore = document.getElementById("menu-best-score");
const difficultyGrid = document.getElementById("difficulty-grid");
const startRunButton = document.getElementById("start-run-button");
const shootButton = document.getElementById("shoot-button");

const lowPowerDevice = (navigator.hardwareConcurrency || 6) <= 4 || (navigator.deviceMemory || 6) <= 4;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_PARTICLES = lowPowerDevice || reducedMotion ? 36 : 96;
const MAX_TRAIL_POINTS = lowPowerDevice || reducedMotion ? 3 : 7;
const BALL_COLORS = ["#f2cb54", "#3979d3", "#d94f47", "#8650a5", "#ea822e", "#318a61", "#7f2d31", "#181b1d"];
const TABLE_PALETTES = {
	clean: ["#137465", "#0b594e", "#06372f"],
	banks: ["#176e69", "#0a504d", "#063231"],
	fast: ["#236b78", "#10515f", "#082f3a"],
	narrow: ["#71612d", "#4f431d", "#28230e"],
	drift: ["#416d56", "#29513d", "#153123"],
	blackout: ["#1d4e4b", "#103330", "#071b1b"],
	hot: ["#7b4937", "#573023", "#2f1813"],
	house: ["#683a3d", "#432329", "#241116"]
};
const DEFAULT_POWER = 28;
const DEFAULT_ANGLE = 0;
const MIN_IMPACT_SPEED = 120;
const PHYSICS_STEP = 1 / 180;
const RAIL = 28;

const balls = [];
const pockets = [];
const rings = [];
const particles = [];
const pocketEffects = [];
const ENCOUNTERS = [
	{ name: "The First Cut", type: "Opening table", lore: "The house is quiet. Make it listen.", target: 3, shots: 5, balls: 6, modifier: "Clean slate", effect: "clean", description: "No house rules. Yet.", icon: "◇", sideBet: "Pocket a ball on the break", challenge: "break-pocket", reward: 8 },
	{ name: "Railbird", type: "Challenge", lore: "The rails remember every careless angle.", target: 4, shots: 5, balls: 7, modifier: "Called banks", effect: "banks", description: "Rail-first pockets pay bonus chalk.", icon: "↗", sideBet: "Sink a bank shot", challenge: "bank-pocket", reward: 12 },
	{ name: "Quickcloth", type: "Hazard", lore: "This cloth has somewhere else to be.", target: 5, shots: 6, balls: 8, modifier: "Fast cloth", effect: "fast", description: "Balls keep more speed after contact.", icon: "»", sideBet: "Pocket two balls in one shot", challenge: "multi-pocket", reward: 12 },
	{ name: "The House Shark", type: "Boss table", lore: "He has never paid for a drink or missed the eight.", target: 6, shots: 6, balls: 9, modifier: "Narrow jaws", effect: "narrow", description: "Pockets bite three pixels tighter.", icon: "◆", sideBet: "Clear the contract without a scratch", challenge: "no-scratch", reward: 18, boss: true },
	{ name: "Crooked Mile", type: "Hazard", lore: "Nothing rolls straight this deep into the night.", target: 6, shots: 6, balls: 9, modifier: "Table drift", effect: "drift", description: "A faint current pulls every moving ball.", icon: "~", sideBet: "Finish with three shots left", challenge: "quick-clear", reward: 15 },
	{ name: "Lights Out", type: "Challenge", lore: "Trust the line before it disappears.", target: 7, shots: 6, balls: 10, modifier: "Short sight", effect: "blackout", description: "The aim guide ends early.", icon: "◐", sideBet: "Sink a ball above 75% power", challenge: "power-pocket", reward: 15 },
	{ name: "Last Call", type: "Elite table", lore: "One song left. No room for a wasted stroke.", target: 8, shots: 7, balls: 11, modifier: "Hot pockets", effect: "hot", description: "Pocket pull is fierce, but scratches cost extra.", icon: "✦", sideBet: "Pocket three balls in one shot", challenge: "triple-pocket", reward: 20 },
	{ name: "The Proprietor", type: "Final boss", lore: "Clear his table and the night belongs to you.", target: 10, shots: 8, balls: 12, modifier: "House rules", effect: "house", description: "Fast cloth, narrow jaws, and merciless rails.", icon: "♛", sideBet: "Win without a missed shot", challenge: "no-miss", reward: 30, boss: true }
];

const UPGRADES = [
	{ id: "blackthorn", name: "Blackthorn Cue", icon: "╱", rarity: "Craft", max: 3, description: "Strike force increases by 12% per level." },
	{ id: "deep-pockets", name: "Deep Pockets", icon: "◎", rarity: "Craft", max: 3, description: "Pocket capture radius grows by 2.5px per level." },
	{ id: "gravity-chalk", name: "Gravity Chalk", icon: "◉", rarity: "Craft", max: 3, description: "Pocket pull reaches farther and pulls harder." },
	{ id: "measured-eye", name: "Measured Eye", icon: "⌁", rarity: "Craft", max: 2, description: "The prediction line reaches 30% farther." },
	{ id: "spare-stroke", name: "Spare Stroke", icon: "+", rarity: "Rare", max: 2, description: "Begin every table with one extra shot." },
	{ id: "gold-leaf", name: "Gold Leaf", icon: "$", rarity: "Rare", max: 3, description: "Earn 2 more chalk for every pocketed ball." },
	{ id: "run-maker", name: "Run Maker", icon: "×", rarity: "Rare", max: 3, description: "Consecutive scoring shots gain a larger multiplier." },
	{ id: "rail-work", name: "Rail Work", icon: "∟", rarity: "Rare", max: 2, description: "Bank shots score 75 more and earn extra chalk." },
	{ id: "steady-hand", name: "Steady Hand", icon: "◇", rarity: "Rare", max: 1, description: "The first scratch on each table refunds its shot." },
	{ id: "second-wind", name: "Second Wind", icon: "◆", rarity: "Rare", max: 2, description: "Gain one maximum Nerve and recover one Nerve." },
	{ id: "moon-jaws", name: "Moon Jaws", icon: "☾", rarity: "Relic", max: 1, relic: true, description: "Pockets become dramatically wider on every table." },
	{ id: "golden-eight", name: "Golden Eight", icon: "8", rarity: "Relic", max: 1, relic: true, description: "The eight ball scores triple and refunds a shot." },
	{ id: "echo-break", name: "Echo Break", icon: "Ⅱ", rarity: "Relic", max: 1, relic: true, description: "Your opening break on every table is free." },
	{ id: "true-line", name: "The True Line", icon: "∞", rarity: "Relic", max: 1, relic: true, description: "House darkness can no longer shorten your aim guide." },
	{ id: "loaded-chalk", name: "Loaded Chalk", icon: "❖", rarity: "Mythic", max: 1, mythic: true, description: "All chalk earnings are doubled." },
	{ id: "nine-lives", name: "Nine Lives", icon: "9", rarity: "Mythic", max: 1, mythic: true, description: "The first run-ending Nerve loss instead leaves you with 1." },
	{ id: "bank-vision", name: "Bank Vision", icon: "⇄", rarity: "Mythic", max: 1, mythic: true, description: "The aim guide previews a one-rail bank when there is no direct shot." },
	{ id: "midnight-run", name: "Midnight Run", icon: "☄", rarity: "Mythic", max: 1, mythic: true, description: "Combo scaling from consecutive pockets is 50% stronger." }
];

const DIFFICULTIES = [
	{ id: "casual", name: "Casual Night", tagline: "Loose rules and easy chalk. Learn the felt.", nerve: 4, shotBonus: 1, targetDelta: 0, chalkMult: 1.25, luckBonus: 0.04, scoreMult: 0.7 },
	{ id: "standard", name: "Standard Circuit", tagline: "The house plays it straight. No favors, no traps.", nerve: 3, shotBonus: 0, targetDelta: 0, chalkMult: 1, luckBonus: 0, scoreMult: 1 },
	{ id: "highstakes", name: "High Stakes", tagline: "Fewer shots to work with. The house watches closer.", nerve: 2, shotBonus: -1, targetDelta: 0, chalkMult: 1, luckBonus: 0.05, scoreMult: 1.35 },
	{ id: "nightmare", name: "Nightmare Table", tagline: "One bad break and it is over. Play perfectly.", nerve: 1, shotBonus: -1, targetDelta: 1, chalkMult: 0.85, luckBonus: 0.1, scoreMult: 1.75 }
];

const run = {
	seed: Math.floor(1000 + Math.random() * 9000),
	stage: 0,
	score: 0,
	chalk: 0,
	nerve: 3,
	maxNerve: 3,
	shots: 0,
	sunk: 0,
	state: "briefing",
	upgrades: [],
	totalShots: 0,
	totalPocketed: 0,
	combo: 0,
	bestCombo: 0,
	stats: null,
	rngState: 0,
	eightSunk: false,
	pendingEight: null,
	nineLivesUsed: false,
	difficulty: DIFFICULTIES[1]
};
const sounds = Array.from({ length: 7 }, (_, index) => {
	const audio = new Audio(`../sfx/ding${index + 1}.mp3`);
	audio.preload = "auto";
	return audio;
});

const cue = {
	id: 0,
	x: 0,
	y: 0,
	vx: 0,
	vy: 0,
	r: 10,
	active: true,
	angle: 0,
	cooldown: 0,
	trail: []
};

const aim = { x: 0, y: 0 };
let W = 0;
let H = 0;
let renderScale = 1;
let tableLayer = null;
let spriteCache = new Map();
let power = DEFAULT_POWER;
let shotAngle = DEFAULT_ANGLE;
let shotInProgress = false;
let shotPocketed = 0;
let scratch = false;
let rackBreak = true;
let soundEnabled = true;
let cinematicUsed = false;
let hitStop = 0;
let screenShake = 0;
let flash = 0;
let lastTime = 0;
let accumulator = 0;
let trailClock = 0;
let lastSoundAt = 0;
let impactFrame = null;
let currentDraftIsRelic = false;
let rerollCost = 12;
let menuActive = true;
let selectedDifficultyId = "standard";
let angleDragActive = false;

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function roman(value) {
	return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][value] || String(value + 1);
}

function currentEncounter() {
	return ENCOUNTERS[run.stage];
}

function objectiveText(encounter, shots = run.shots) {
	const target = encounterTarget(encounter);
	return encounter.boss
		? `Sink ${target - 1}, then the eight in ${shots} shots`
		: `Sink ${target} balls in ${shots} shots`;
}

function encounterTarget(encounter) {
	return Math.max(2, encounter.target + (run.difficulty?.targetDelta || 0));
}

function shotsFor(encounter) {
	return Math.max(2, encounter.shots + upgradeLevel("spare-stroke") + (run.difficulty?.shotBonus || 0));
}

function chalkGain(amount) {
	const multiplier = (run.difficulty?.chalkMult || 1) * (hasUpgrade("loaded-chalk") ? 2 : 1);
	return Math.round(amount * multiplier);
}

function mythicChance(boss) {
	const base = boss ? 0.3 : 0.1;
	return clamp(base + (run.difficulty?.luckBonus || 0), 0, 0.85);
}

function seededRandom() {
	let value = run.rngState || run.seed;
	value ^= value << 13;
	value ^= value >>> 17;
	value ^= value << 5;
	run.rngState = value >>> 0;
	return run.rngState / 4294967296;
}

function upgradeLevel(id) {
	return run.upgrades.reduce((total, upgradeId) => total + (upgradeId === id ? 1 : 0), 0);
}

function hasUpgrade(id) {
	return upgradeLevel(id) > 0;
}

function freshStageStats() {
	return {
		shotsUsed: 0,
		scratches: 0,
		misses: 0,
		bankPockets: 0,
		breakPockets: 0,
		powerPockets: 0,
		maxShotPocketed: 0,
		safetyUsed: false
	};
}

function challengeWon(encounter) {
	const stats = run.stats;
	if (!stats) return false;
	switch (encounter.challenge) {
		case "break-pocket": return stats.breakPockets > 0;
		case "bank-pocket": return stats.bankPockets > 0;
		case "multi-pocket": return stats.maxShotPocketed >= 2;
		case "no-scratch": return stats.scratches === 0;
		case "quick-clear": return stats.shotsUsed <= 3;
		case "power-pocket": return stats.powerPockets > 0;
		case "triple-pocket": return stats.maxShotPocketed >= 3;
		case "no-miss": return stats.misses === 0 && stats.scratches === 0;
		default: return false;
	}
}

function challengeSecuredDuringPlay(encounter) {
	if (!run.stats) return false;
	switch (encounter.challenge) {
		case "break-pocket": return run.stats.breakPockets > 0;
		case "bank-pocket": return run.stats.bankPockets > 0;
		case "multi-pocket": return Math.max(run.stats.maxShotPocketed, shotPocketed) >= 2;
		case "power-pocket": return run.stats.powerPockets > 0;
		case "triple-pocket": return Math.max(run.stats.maxShotPocketed, shotPocketed) >= 3;
		default: return false;
	}
}

function updateChallengeStatus() {
	const encounter = currentEncounter();
	const secured = challengeSecuredDuringPlay(encounter);
	challengeStatus.classList.toggle("complete", secured);
	challengeStatusText.textContent = secured ? `Secured / +${chalkGain(encounter.reward)} chalk` : encounter.sideBet;
}

function renderInventory() {
	if (!run.upgrades.length) {
		const empty = document.createElement("i");
		empty.textContent = "Empty case";
		relics.replaceChildren(empty);
		return;
	}

	const counts = new Map();
	for (const id of run.upgrades) counts.set(id, (counts.get(id) || 0) + 1);
	const tokens = [...counts.entries()].map(([id, count]) => {
		const upgrade = UPGRADES.find((candidate) => candidate.id === id);
		const token = document.createElement("span");
		token.className = `relic-token${upgrade.relic ? " legendary" : ""}${upgrade.mythic ? " mythic" : ""}`;
		token.textContent = count > 1 ? `${upgrade.icon}${count}` : upgrade.icon;
		token.title = `${upgrade.name}${count > 1 ? ` ${count}` : ""}: ${upgrade.description}`;
		token.setAttribute("aria-label", token.title);
		return token;
	});
	relics.replaceChildren(...tokens);
}

function renderRoute() {
	route.replaceChildren(...ENCOUNTERS.map((encounter, index) => {
		const node = document.createElement("span");
		node.className = `route-node${index < run.stage ? " complete" : ""}${index === run.stage ? " current" : ""}${encounter.boss ? " boss" : ""}`;
		node.title = `${index + 1}. ${encounter.name}`;
		node.setAttribute("aria-label", `${index + 1}. ${encounter.name}${index === run.stage ? ", current" : index < run.stage ? ", cleared" : ""}`);
		return node;
	}));
}

function showModal(modal) {
	modal.hidden = false;
	requestAnimationFrame(() => {
		modal.classList.add("show");
		modal.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
	});
}

function hideModal(modal) {
	modal.classList.remove("show");
	modal.hidden = true;
}

function prepareEncounter(retry = false) {
	const encounter = currentEncounter();
	run.shots = shotsFor(encounter);
	run.sunk = 0;
	run.eightSunk = false;
	run.pendingEight = null;
	run.state = "briefing";
	run.stats = freshStageStats();
	hideModal(rewardModal);
	hideModal(runModal);
	stageNumber.textContent = `${String(run.stage + 1).padStart(2, "0")} / ${String(ENCOUNTERS.length).padStart(2, "0")}`;
	encounterType.textContent = encounter.type;
	encounterName.textContent = encounter.name;
	encounterSubtitle.textContent = encounter.lore;
	tableNumber.textContent = roman(run.stage);
	encounterKicker.textContent = `Stage ${roman(run.stage)} / ${encounter.type}`;
	encounterHeading.textContent = encounter.name;
	encounterLore.textContent = encounter.lore;
	encounterObjective.textContent = objectiveText(encounter);
	modifierIcon.textContent = encounter.icon;
	modifierName.textContent = encounter.modifier;
	modifierDescription.textContent = encounter.description;
	tableFrame.dataset.effect = encounter.effect;
	sideBetText.textContent = encounter.sideBet;
	sideBetReward.textContent = `+${chalkGain(encounter.reward)} chalk`;
	beginEncounterButton.textContent = retry ? "Re-rack" : run.stage === 0 ? "Chalk up" : "Enter table";
	if (retry) {
		encounterKicker.textContent = `Nerve lost / ${run.nerve} remaining`;
		encounterLore.textContent = "The rack resets. Your upgrades do not.";
	}
	if (!menuActive) showModal(encounterModal);
	renderRoute();
	renderInventory();
	updateHud();
}

function shuffledPool(predicate) {
	const available = UPGRADES.filter((upgrade) => predicate(upgrade) && upgradeLevel(upgrade.id) < upgrade.max);
	for (let index = available.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(seededRandom() * (index + 1));
		[available[index], available[swapIndex]] = [available[swapIndex], available[index]];
	}
	return available;
}

function pickUpgradeChoices(relicDraft) {
	const primary = shuffledPool((upgrade) => Boolean(upgrade.relic) === relicDraft && !upgrade.mythic);
	const choices = primary.slice(0, 3);
	const mythicPool = shuffledPool((upgrade) => upgrade.mythic);
	if (mythicPool.length && choices.length && seededRandom() < mythicChance(relicDraft)) {
		const slot = Math.floor(seededRandom() * choices.length);
		choices[slot] = mythicPool[0];
	}
	return choices;
}

function renderUpgradeDraft(relicDraft) {
	currentDraftIsRelic = relicDraft;
	const choices = pickUpgradeChoices(relicDraft);
	if (choices.some((upgrade) => upgrade.mythic)) rewardKicker.textContent = `Rare find / ${rewardKicker.textContent}`;
	const cards = choices.map((upgrade) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `upgrade-card${upgrade.relic ? " relic" : ""}${upgrade.mythic ? " mythic" : ""}`;

		const icon = document.createElement("span");
		icon.className = "upgrade-icon";
		icon.textContent = upgrade.icon;
		const rarity = document.createElement("span");
		rarity.className = "upgrade-rarity";
		rarity.textContent = upgrade.rarity;
		const name = document.createElement("strong");
		name.textContent = upgrade.name;
		const description = document.createElement("small");
		description.textContent = upgrade.description;
		const level = document.createElement("span");
		level.className = "upgrade-level";
		level.textContent = upgrade.max === 1 ? "Unique" : `Level ${upgradeLevel(upgrade.id) + 1} / ${upgrade.max}`;
		button.append(icon, rarity, name, description, level);
		button.addEventListener("click", () => chooseUpgrade(upgrade));
		return button;
	});
	upgradeGrid.replaceChildren(...cards);
	rerollUpgradesButton.textContent = `Reroll / ${rerollCost} chalk`;
	rerollUpgradesButton.disabled = run.chalk < rerollCost;
}

function rerollDraft() {
	if (run.state !== "reward" || run.chalk < rerollCost) return;
	run.chalk -= rerollCost;
	rerollCost += 4;
	updateHud();
	renderUpgradeDraft(currentDraftIsRelic);
}

function chooseUpgrade(upgrade) {
	if (run.state !== "reward") return;
	run.upgrades.push(upgrade.id);
	if (upgrade.id === "second-wind") {
		run.maxNerve = Math.min(5, run.maxNerve + 1);
		run.nerve = Math.min(run.maxNerve, run.nerve + 1);
	}
	renderInventory();
	hideModal(rewardModal);
	run.stage++;
	rack();
}

function completeEncounter() {
	if (run.state !== "playing") return;
	const encounter = currentEncounter();
	const sideBetCleared = challengeWon(encounter);
	const clearBonus = Math.round(((run.stage + 1) * 300 + run.shots * 100) * run.difficulty.scoreMult);
	run.score += clearBonus;
	if (sideBetCleared) run.chalk += chalkGain(encounter.reward);
	run.state = "reward";
	updateHud(true);
	showImpactCopy(encounter.boss ? "Boss down" : "Cleared", `+${clearBonus} contract`, "pocket");

	if (run.stage === ENCOUNTERS.length - 1) {
		endRun(true, sideBetCleared ? "Every contract and the final side bet are yours." : "The final rack falls silent.");
		return;
	}

	rewardKicker.textContent = `${encounter.name} cleared / +${clearBonus}`;
	rewardHeading.textContent = encounter.boss ? "Claim a house relic" : "Choose your edge";
	rewardSummary.textContent = sideBetCleared
		? `Side bet won. +${chalkGain(encounter.reward)} chalk. Pick one upgrade for the road.`
		: "Contract complete. The side bet slipped away, but the run continues.";
	rerollCost = encounter.boss ? 18 : 12;
	renderUpgradeDraft(Boolean(encounter.boss));
	showModal(rewardModal);
}

function failEncounter() {
	if (run.state !== "playing") return;
	run.nerve--;
	run.combo = 0;
	updateHud();
	if (run.nerve <= 0) {
		if (hasUpgrade("nine-lives") && !run.nineLivesUsed) {
			run.nineLivesUsed = true;
			run.nerve = 1;
			updateHud();
			showImpactCopy("Nine Lives", "One life spared", "foul");
			rack(true);
			return;
		}
		endRun(false, "The last shot faded before the contract was paid.");
		return;
	}
	showImpactCopy("Rattled", `${run.nerve} nerve remaining`, "foul");
	rack(true);
}

function makeResultStat(label, value) {
	const item = document.createElement("div");
	item.className = "result-stat";
	const caption = document.createElement("span");
	caption.textContent = label;
	const result = document.createElement("strong");
	result.textContent = value;
	item.append(caption, result);
	return item;
}

function endRun(won, message) {
	run.state = won ? "victory" : "defeat";
	shotInProgress = false;
	hideModal(encounterModal);
	hideModal(rewardModal);
	runKicker.textContent = won ? "Circuit conquered" : "Run over";
	runHeading.textContent = won ? "The night is yours." : "The house wins.";
	runSummary.textContent = message;
	tableStatus.textContent = won ? "Circuit conquered" : "Run ended";
	streakStatus.textContent = won ? `${ENCOUNTERS.length} / ${ENCOUNTERS.length} cleared` : `Stage ${run.stage + 1} reached`;
	shotLabel.textContent = won ? "Victory" : "Run over";
	shotDetail.textContent = won ? "The Velvet Circuit is yours" : "The house is waiting for another run";
	let bestScore = run.score;
	try {
		const previousBest = Number(localStorage.getItem("afterglow-best") || 0);
		bestScore = Math.max(previousBest, run.score);
		if (run.score > previousBest) localStorage.setItem("afterglow-best", String(run.score));
	} catch {}
	runResult.replaceChildren(
		makeResultStat("Stage", `${Math.min(run.stage + 1, ENCOUNTERS.length)} / ${ENCOUNTERS.length}`),
		makeResultStat("Score", run.score.toLocaleString()),
		makeResultStat("Pocketed", String(run.totalPocketed)),
		makeResultStat("Best", bestScore.toLocaleString())
	);
	restartRunButton.textContent = won ? "Play another run" : "Run it back";
	if (won) {
		[...route.children].forEach((node, index) => {
			node.classList.add("complete");
			node.classList.remove("current");
			node.setAttribute("aria-label", `${index + 1}. ${ENCOUNTERS[index].name}, cleared`);
		});
	}
	showModal(runModal);
}

function startNewRun() {
	run.seed = Math.floor(1000 + Math.random() * 9000);
	run.rngState = run.seed;
	run.stage = 0;
	run.score = 0;
	run.chalk = 0;
	run.nerve = run.difficulty.nerve;
	run.maxNerve = run.difficulty.nerve;
	run.shots = 0;
	run.sunk = 0;
	run.state = "briefing";
	run.nineLivesUsed = false;
	runDifficultyLabel.textContent = run.difficulty.name;
	run.upgrades.length = 0;
	run.totalShots = 0;
	run.totalPocketed = 0;
	run.combo = 0;
	run.bestCombo = 0;
	run.eightSunk = false;
	run.pendingEight = null;
	run.rngState = run.seed;
	rack();
}

function difficultyStat(label, value) {
	const chip = document.createElement("span");
	const chipLabel = document.createElement("i");
	chipLabel.textContent = label;
	const chipValue = document.createElement("b");
	chipValue.textContent = value;
	chip.append(chipLabel, chipValue);
	return chip;
}

function renderDifficultyGrid() {
	const cards = DIFFICULTIES.map((difficulty) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `difficulty-card${difficulty.id === selectedDifficultyId ? " selected" : ""}`;

		const name = document.createElement("strong");
		name.textContent = difficulty.name;
		const tagline = document.createElement("small");
		tagline.textContent = difficulty.tagline;
		const stats = document.createElement("div");
		stats.className = "difficulty-stats";
		stats.append(
			difficultyStat("Nerve", "◆".repeat(difficulty.nerve)),
			difficultyStat("Shots", difficulty.shotBonus === 0 ? "Standard" : `${difficulty.shotBonus > 0 ? "+" : ""}${difficulty.shotBonus}`),
			difficultyStat("Luck", `+${Math.round(difficulty.luckBonus * 100)}%`),
			difficultyStat("Payout", `${difficulty.scoreMult.toFixed(2)}×`)
		);
		button.append(name, tagline, stats);
		button.addEventListener("click", () => {
			selectedDifficultyId = difficulty.id;
			renderDifficultyGrid();
		});
		return button;
	});
	difficultyGrid.replaceChildren(...cards);
}

function updateMenuBest() {
	let best = 0;
	try {
		best = Number(localStorage.getItem("afterglow-best") || 0);
	} catch {}
	menuBestScore.textContent = best.toLocaleString();
}

function startRunFromMenu() {
	run.difficulty = DIFFICULTIES.find((difficulty) => difficulty.id === selectedDifficultyId) || DIFFICULTIES[1];
	menuActive = false;
	hideModal(menuModal);
	startNewRun();
}

function returnToMenu() {
	hideModal(runModal);
	menuActive = true;
	renderDifficultyGrid();
	updateMenuBest();
	showModal(menuModal);
}

function playableBounds(radius = cue.r) {
	return {
		left: RAIL + radius,
		right: W - RAIL - radius,
		top: RAIL + radius,
		bottom: H - RAIL - radius
	};
}

function createPockets() {
	const edge = RAIL - 2;
	pockets.splice(0, pockets.length,
		{ x: edge, y: edge, kind: "corner" },
		{ x: W / 2, y: RAIL - 5, kind: "side" },
		{ x: W - edge, y: edge, kind: "corner" },
		{ x: edge, y: H - edge, kind: "corner" },
		{ x: W / 2, y: H - RAIL + 5, kind: "side" },
		{ x: W - edge, y: H - edge, kind: "corner" }
	);
}

function makeBallSprite(number, color, stripe, radius, cueBall = false) {
	const key = `${number}-${color}-${stripe}-${radius}-${renderScale}`;
	if (spriteCache.has(key)) return spriteCache.get(key);

	const logicalSize = Math.ceil(radius * 3.4);
	const sprite = document.createElement("canvas");
	sprite.width = Math.ceil(logicalSize * renderScale);
	sprite.height = Math.ceil(logicalSize * renderScale);
	const spriteCtx = sprite.getContext("2d");
	spriteCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
	const center = logicalSize / 2;

	spriteCtx.shadowColor = "rgba(0, 0, 0, .58)";
	spriteCtx.shadowBlur = radius * 0.42;
	spriteCtx.shadowOffsetY = radius * 0.3;
	const body = spriteCtx.createRadialGradient(
		center - radius * 0.38,
		center - radius * 0.48,
		radius * 0.06,
		center,
		center,
		radius * 1.08
	);
	body.addColorStop(0, "#ffffff");
	body.addColorStop(0.14, cueBall || stripe ? "#f7f1df" : color);
	body.addColorStop(0.7, cueBall ? "#dcd8c9" : color);
	body.addColorStop(1, cueBall ? "#979b96" : "#080b0c");
	spriteCtx.fillStyle = body;
	spriteCtx.beginPath();
	spriteCtx.arc(center, center, radius, 0, Math.PI * 2);
	spriteCtx.fill();
	spriteCtx.shadowColor = "transparent";

	if (!cueBall && stripe) {
		spriteCtx.save();
		spriteCtx.beginPath();
		spriteCtx.arc(center, center, radius - 0.4, 0, Math.PI * 2);
		spriteCtx.clip();
		spriteCtx.fillStyle = color;
		spriteCtx.fillRect(center - radius, center - radius * 0.44, radius * 2, radius * 0.88);
		spriteCtx.restore();
	}

	if (!cueBall) {
		spriteCtx.fillStyle = "#f7f1df";
		spriteCtx.beginPath();
		spriteCtx.arc(center, center, radius * 0.36, 0, Math.PI * 2);
		spriteCtx.fill();
		spriteCtx.fillStyle = "#121719";
		spriteCtx.font = `700 ${Math.max(7, radius * 0.7)}px "Arial Narrow", sans-serif`;
		spriteCtx.textAlign = "center";
		spriteCtx.textBaseline = "middle";
		spriteCtx.fillText(String(number), center, center + 0.3);
	} else {
		spriteCtx.fillStyle = "rgba(114, 232, 202, .58)";
		spriteCtx.beginPath();
		spriteCtx.arc(center - radius * 0.24, center - radius * 0.3, radius * 0.1, 0, Math.PI * 2);
		spriteCtx.fill();
	}

	const result = { image: sprite, size: logicalSize };
	spriteCache.set(key, result);
	return result;
}

function buildTableLayer() {
	tableLayer = document.createElement("canvas");
	tableLayer.width = canvas.width;
	tableLayer.height = canvas.height;
	const layerCtx = tableLayer.getContext("2d", { alpha: false });
	layerCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

	const effect = currentEncounter()?.effect || "clean";
	const palette = TABLE_PALETTES[effect] || TABLE_PALETTES.clean;
	const felt = layerCtx.createRadialGradient(W * 0.48, H * 0.42, 18, W * 0.5, H * 0.5, Math.max(W, H) * 0.72);
	felt.addColorStop(0, palette[0]);
	felt.addColorStop(0.52, palette[1]);
	felt.addColorStop(1, palette[2]);
	layerCtx.fillStyle = felt;
	layerCtx.fillRect(0, 0, W, H);

	layerCtx.save();
	layerCtx.globalAlpha = 0.085;
	layerCtx.strokeStyle = "#b8ffe8";
	layerCtx.lineWidth = 0.7;
	for (let diagonal = -H; diagonal < W + H; diagonal += 31) {
		layerCtx.beginPath();
		layerCtx.moveTo(diagonal, 0);
		layerCtx.lineTo(diagonal + H, H);
		layerCtx.stroke();
	}
	layerCtx.restore();
	if (effect === "fast" || effect === "house") {
		layerCtx.save();
		layerCtx.globalAlpha = 0.08;
		layerCtx.strokeStyle = "#d9fff5";
		for (let stripe = RAIL + 18; stripe < H - RAIL; stripe += 22) {
			layerCtx.beginPath();
			layerCtx.moveTo(RAIL, stripe);
			layerCtx.lineTo(W - RAIL, stripe - 8);
			layerCtx.stroke();
		}
		layerCtx.restore();
	}
	if (effect === "drift") {
		layerCtx.save();
		layerCtx.fillStyle = "rgba(216, 255, 236, .1)";
		layerCtx.font = "18px Georgia, serif";
		for (let x = W * 0.24; x < W * 0.82; x += W * 0.19) layerCtx.fillText("›", x, H * 0.5);
		layerCtx.restore();
	}

	const topRail = layerCtx.createLinearGradient(0, 0, 0, RAIL);
	topRail.addColorStop(0, "#102e2a");
	topRail.addColorStop(0.72, "#09231f");
	topRail.addColorStop(1, "#071a18");
	layerCtx.fillStyle = topRail;
	layerCtx.fillRect(0, 0, W, RAIL);
	layerCtx.save();
	layerCtx.translate(0, H);
	layerCtx.scale(1, -1);
	layerCtx.fillRect(0, 0, W, RAIL);
	layerCtx.restore();

	const sideRail = layerCtx.createLinearGradient(0, 0, RAIL, 0);
	sideRail.addColorStop(0, "#102e2a");
	sideRail.addColorStop(0.72, "#09231f");
	sideRail.addColorStop(1, "#071a18");
	layerCtx.fillStyle = sideRail;
	layerCtx.fillRect(0, RAIL, RAIL, H - RAIL * 2);
	layerCtx.save();
	layerCtx.translate(W, 0);
	layerCtx.scale(-1, 1);
	layerCtx.fillRect(0, RAIL, RAIL, H - RAIL * 2);
	layerCtx.restore();

	layerCtx.strokeStyle = "rgba(227, 180, 95, .45)";
	layerCtx.lineWidth = 1;
	layerCtx.strokeRect(RAIL + 0.5, RAIL + 0.5, W - RAIL * 2 - 1, H - RAIL * 2 - 1);
	layerCtx.strokeStyle = "rgba(114, 232, 202, .16)";
	layerCtx.strokeRect(RAIL + 3.5, RAIL + 3.5, W - RAIL * 2 - 7, H - RAIL * 2 - 7);

	layerCtx.fillStyle = "rgba(227, 180, 95, .58)";
	for (let index = 1; index < 8; index++) {
		const markerX = RAIL + ((W - RAIL * 2) * index) / 8;
		for (const markerY of [RAIL * 0.5, H - RAIL * 0.5]) {
			layerCtx.save();
			layerCtx.translate(markerX, markerY);
			layerCtx.rotate(Math.PI / 4);
			layerCtx.fillRect(-2.2, -2.2, 4.4, 4.4);
			layerCtx.restore();
		}
	}
	for (let index = 1; index < 4; index++) {
		const markerY = RAIL + ((H - RAIL * 2) * index) / 4;
		for (const markerX of [RAIL * 0.5, W - RAIL * 0.5]) {
			layerCtx.save();
			layerCtx.translate(markerX, markerY);
			layerCtx.rotate(Math.PI / 4);
			layerCtx.fillRect(-2.2, -2.2, 4.4, 4.4);
			layerCtx.restore();
		}
	}

	for (const pocket of pockets) {
		const radius = pocket.kind === "side" ? 25 : 24;
		const glow = layerCtx.createRadialGradient(pocket.x, pocket.y, 2, pocket.x, pocket.y, radius * 1.55);
		glow.addColorStop(0, "#000000");
		glow.addColorStop(0.62, "#020606");
		glow.addColorStop(0.7, "rgba(227, 180, 95, .62)");
		glow.addColorStop(0.76, "rgba(8, 20, 18, .8)");
		glow.addColorStop(1, "rgba(8, 20, 18, 0)");
		layerCtx.fillStyle = glow;
		layerCtx.beginPath();
		layerCtx.arc(pocket.x, pocket.y, radius * 1.55, 0, Math.PI * 2);
		layerCtx.fill();
	}

	layerCtx.save();
	layerCtx.translate(W / 2, H / 2);
	layerCtx.fillStyle = "rgba(2, 18, 16, .12)";
	layerCtx.font = `400 ${Math.min(52, W * 0.052)}px "Bodoni 72", Georgia, serif`;
	layerCtx.textAlign = "center";
	layerCtx.textBaseline = "middle";
	layerCtx.fillText("AFTERGLOW", 0, 0);
	layerCtx.restore();

	const vignette = layerCtx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
	vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
	vignette.addColorStop(1, "rgba(0, 0, 0, .24)");
	layerCtx.fillStyle = vignette;
	layerCtx.fillRect(0, 0, W, H);
}

function resize() {
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (width < 1 || height < 1) return;

	const oldW = W;
	const oldH = H;
	W = width;
	H = height;
	renderScale = Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1.25 : 1.8);
	canvas.width = Math.round(W * renderScale);
	canvas.height = Math.round(H * renderScale);
	ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	spriteCache = new Map();
	createPockets();
	buildTableLayer();

	if (!balls.length) {
		rack();
		return;
	}

	const scaleX = oldW ? W / oldW : 1;
	const scaleY = oldH ? H / oldH : 1;
	for (const ball of [cue, ...balls]) {
		ball.x *= scaleX;
		ball.y *= scaleY;
		ball.r = Math.min(11, Math.max(7.5, W * 0.0125, H * 0.024));
		ball.trail.length = 0;
	}
	syncAimFromAngle();
}

function rack(retry = false) {
	balls.length = 0;
	rings.length = 0;
	particles.length = 0;
	pocketEffects.length = 0;
	power = DEFAULT_POWER;
	shotAngle = DEFAULT_ANGLE;
	shotInProgress = false;
	shotPocketed = 0;
	scratch = false;
	rackBreak = true;
	cinematicUsed = false;
	hitStop = 0;
	impactFrame = null;
	impactCopy.className = "impact-copy";
	tableFrame.classList.remove("impacting");
	buildTableLayer();

	const radius = Math.min(11, Math.max(7.5, W * 0.0125, H * 0.024));
	cue.r = radius;
	cue.x = W * 0.265;
	cue.y = H * 0.5;
	cue.vx = 0;
	cue.vy = 0;
	cue.active = true;
	cue.angle = 0;
	cue.cooldown = 0;
	cue.trail.length = 0;
	syncAimFromAngle();

	const startX = W * 0.69;
	const startY = H * 0.5;
	const ballCount = currentEncounter().balls;
	let number = 1;
	for (let row = 0; row < 5 && number <= ballCount; row++) {
		for (let column = 0; column <= row; column++) {
			if (number > ballCount) break;
			const ballNumber = number;
			balls.push({
				id: ballNumber,
				number: ballNumber,
				x: startX + row * radius * 1.76,
				y: startY + (column - row / 2) * radius * 2.04,
				vx: 0,
				vy: 0,
				r: radius,
				color: BALL_COLORS[(ballNumber - 1) % 8],
				stripe: ballNumber > 8,
				active: true,
				angle: 0,
				cooldown: 0,
				railHits: 0,
				trail: []
			});
			number++;
		}
	}

	powerSlider.value = String(DEFAULT_POWER);
	setPower(DEFAULT_POWER);
	setAngle(0);
	shotLabel.textContent = "Ready";
	shotDetail.textContent = objectiveText(currentEncounter(), shotsFor(currentEncounter()));
	prepareEncounter(retry);
}

function updateHud(scoreChanged = false) {
	const encounter = currentEncounter();
	runSeed.textContent = String(run.seed);
	runScore.textContent = String(run.score).padStart(6, "0");
	shotsLeft.textContent = String(Math.max(0, run.shots)).padStart(2, "0");
	nerveValue.textContent = `${"◆ ".repeat(run.nerve)}${"◇ ".repeat(Math.max(0, run.maxNerve - run.nerve))}`.trim();
	nerveValue.setAttribute("aria-label", `${run.nerve} nerve remaining`);
	tableStatus.textContent = `Stage ${run.stage + 1} / ${shotInProgress ? "Balls in motion" : run.state === "playing" ? "Line up your shot" : "Awaiting break"}`;
	streakStatus.textContent = `${run.sunk} / ${encounterTarget(encounter)} pocketed`;
	chalkValue.textContent = String(run.chalk);
	updateChallengeStatus();

	if (scoreChanged) {
		const card = runScore.closest(".run-stat");
		card.classList.remove("score-pop");
		void card.offsetWidth;
		card.classList.add("score-pop");
	}
}

function beginEncounter() {
	if (run.state !== "briefing") return;
	run.state = "playing";
	hideModal(encounterModal);
	shotLabel.textContent = "Ready";
	shotDetail.textContent = objectiveText(currentEncounter());
	updateHud();
	canvas.focus({ preventScroll: true });
}

function setPower(value) {
	power = clamp(Number(value), 8, 100);
	powerSlider.value = String(Math.round(power));
	powerFill.style.width = `${power}%`;
	powerReadout.value = String(Math.round(power));
	powerReadout.textContent = String(Math.round(power));
}

function syncAimFromAngle(length = Math.max(W, H) || 1) {
	aim.x = cue.x + Math.cos(shotAngle) * length;
	aim.y = cue.y + Math.sin(shotAngle) * length;
}

function setAngle(value) {
	const degrees = clamp(Number(value), -180, 180);
	shotAngle = (degrees * Math.PI) / 180;
	angleSlider.value = String(Math.round(degrees));
	angleReadout.value = `${Math.round(degrees)}°`;
	angleReadout.textContent = `${Math.round(degrees)}°`;
	angleFill.style.width = `${((degrees + 180) / 360) * 100}%`;
	syncAimFromAngle();
}

function setAngleFromPointer(event) {
	const bounds = canvas.getBoundingClientRect();
	const targetX = clamp(event.clientX - bounds.left, 0, W);
	const targetY = clamp(event.clientY - bounds.top, 0, H);
	setAngle((Math.atan2(targetY - cue.y, targetX - cue.x) * 180) / Math.PI);
}

function canShoot() {
	return run.state === "playing" && run.shots > 0 && cue.active && !shotInProgress && hitStop <= 0 && cue.vx * cue.vx + cue.vy * cue.vy < 25;
}

function isInputFocused(target) {
	return target instanceof HTMLElement && target.closest("button, input, select, textarea, [contenteditable='true']") !== null;
}

function shoot() {
	if (!canShoot()) return;
	const dx = aim.x - cue.x;
	const dy = aim.y - cue.y;
	const distance = Math.hypot(dx, dy) || 1;
	const openingShot = run.stats.shotsUsed === 0;
	const freeBreak = openingShot && hasUpgrade("echo-break");
	const shotPower = power;
	const force = (330 + power * 9.5) * (1 + upgradeLevel("blackthorn") * 0.12);
	cue.vx = (dx / distance) * force;
	cue.vy = (dy / distance) * force;
	cue.angle = Math.atan2(dy, dx);
	shotInProgress = true;
	shotPocketed = 0;
	scratch = false;
	cinematicUsed = false;
	rackBreak = openingShot;
	if (!freeBreak) run.shots--;
	run.totalShots++;
	run.stats.shotsUsed++;
	run.stats.lastPower = shotPower;
	for (const ball of balls) ball.railHits = 0;
	shotLabel.textContent = "Shot live";
	shotDetail.textContent = freeBreak ? "Echo Break / free shot" : `${Math.round(power)}% power`;
	updateHud();
	emitParticles(cue.x, cue.y, -dx / distance, -dy / distance, power > 72 ? 12 : 7, "#dffdf3", power / 8);
	screenShake = Math.max(screenShake, power / 28);
	playImpactSound(power / 100, 0);
	setPower(DEFAULT_POWER);
}

function playImpactSound(intensity, variation = -1) {
	if (!soundEnabled) return;
	const now = performance.now();
	if (now - lastSoundAt < 32) return;
	lastSoundAt = now;
	const index = variation >= 0 ? variation % sounds.length : Math.floor(Math.random() * sounds.length);
	const sound = sounds[index];
	sound.volume = clamp(0.1 + intensity * 0.5, 0.1, 0.62);
	sound.playbackRate = 0.9 + Math.random() * 0.2;
	sound.currentTime = 0;
	sound.play().catch(() => {});
}

function showImpactCopy(title, detail, type = "") {
	impactTitle.textContent = title;
	impactDetail.textContent = detail;
	impactCopy.className = `impact-copy ${type}`.trim();
	void impactCopy.offsetWidth;
	impactCopy.classList.add("show");
}

function flashFrame() {
	tableFrame.classList.remove("impacting");
	void tableFrame.offsetWidth;
	tableFrame.classList.add("impacting");
}

function emitParticles(x, y, normalX, normalY, count, color, speed) {
	const available = MAX_PARTICLES - particles.length;
	const total = Math.min(count, available);
	for (let index = 0; index < total; index++) {
		const spread = (Math.random() - 0.5) * Math.PI * 1.35;
		const baseAngle = Math.atan2(normalY, normalX) + spread;
		const velocity = speed * (22 + Math.random() * 46);
		const life = 0.2 + Math.random() * 0.34;
		particles.push({
			x,
			y,
			vx: Math.cos(baseAngle) * velocity,
			vy: Math.sin(baseAngle) * velocity,
			life,
			maxLife: life,
			color,
			size: 0.8 + Math.random() * 1.8
		});
	}
}

function triggerImpact(x, y, normalX, normalY, color, strength, target, kind = "collision") {
	const intensity = clamp(strength / 48, 2, 18);
	rings.push({ x, y, radius: 4, life: 1, color, width: intensity > 8 ? 3 : 1.5, speed: 78 + intensity * 11 });
	if (rings.length > 20) rings.shift();
	emitParticles(x, y, normalX, normalY, Math.ceil(intensity * (lowPowerDevice ? 0.65 : 1.15)), color, intensity);
	screenShake = Math.max(screenShake, intensity * 0.74);
	flash = Math.max(flash, Math.min(0.72, intensity / 20));
	playImpactSound(intensity / 18);

	const cinematic = kind === "collision" && intensity >= 8 && !cinematicUsed;
	if (cinematic) {
		cinematicUsed = true;
		hitStop = reducedMotion ? 0 : lowPowerDevice ? 0.035 : 0.058;
		impactFrame = {
			x,
			y,
			normalX,
			normalY,
			color,
			life: 1,
			strength: intensity,
			rays: Array.from({ length: lowPowerDevice ? 9 : 18 }, () => ({
				angle: Math.random() * Math.PI * 2,
				length: 45 + Math.random() * Math.min(W, H) * 0.34,
				width: 0.5 + Math.random() * 2
			}))
		};
		flashFrame();
		showImpactCopy(rackBreak ? "Break" : "Crack", intensity > 13 ? "Thunderous contact" : "Clean contact");
		if (navigator.vibrate) navigator.vibrate(10);
	}

	if (target) target.cooldown = 0.055;
}

function pocketBall(ball, pocket) {
	if (!ball.active) return;
	ball.vx = 0;
	ball.vy = 0;
	ball.trail.length = 0;
	ball.active = false;
	pocketEffects.push({ x: pocket.x, y: pocket.y, radius: ball.r, life: 1, color: ball.color || "#72e8ca" });
	if (pocketEffects.length > 8) pocketEffects.shift();

	if (ball === cue) {
		cue.active = false;
		scratch = true;
		run.stats.scratches++;
		let refundedScratch = false;
		if (hasUpgrade("steady-hand") && !run.stats.safetyUsed) {
			run.stats.safetyUsed = true;
			run.shots++;
			refundedScratch = true;
		} else if (currentEncounter().effect === "hot" || currentEncounter().effect === "house") {
			run.shots = Math.max(0, run.shots - 1);
		}
		flash = 0.65;
		screenShake = 9;
		showImpactCopy("Scratch", refundedScratch ? "Steady Hand refunds the shot" : "Ball in hand", "foul");
		updateHud();
		playImpactSound(0.75, 5);
		return;
	}
	if (ball.number === 8 && currentEncounter().boss && run.sunk < encounterTarget(currentEncounter()) - 1) {
		run.pendingEight = ball;
		flash = 0.72;
		screenShake = 11;
		showImpactCopy("Too soon", "The eight must fall last", "foul");
		playImpactSound(0.9, 6);
		return;
	}

	const banked = ball.railHits > 0;
	const bankBonus = banked ? 75 * (1 + upgradeLevel("rail-work")) : 0;
	const comboBonus = (run.combo * (0.12 + upgradeLevel("run-maker") * 0.08) + shotPocketed * 0.15) * (hasUpgrade("midnight-run") ? 1.5 : 1);
	const comboScale = 1 + comboBonus;
	let basePoints = 45 + ball.number * 5 + bankBonus;
	if (ball.number === 8) basePoints *= hasUpgrade("golden-eight") ? 3 : 1.6;
	const points = Math.round(basePoints * comboScale * run.difficulty.scoreMult);
	const chalkEarned = chalkGain(3 + upgradeLevel("gold-leaf") * 2 + (banked ? 2 + upgradeLevel("rail-work") * 2 : 0));
	run.score += points;
	run.chalk += chalkEarned;
	run.sunk++;
	if (ball.number === 8) run.eightSunk = true;
	run.totalPocketed++;
	shotPocketed++;
	if (banked) run.stats.bankPockets++;
	if (rackBreak) run.stats.breakPockets++;
	if (run.stats.lastPower >= 75) run.stats.powerPockets++;
	if (ball.number === 8 && hasUpgrade("golden-eight")) run.shots++;
	streakStatus.textContent = shotPocketed > 1 ? `${shotPocketed} ball run` : `+${points} pocket`;
	showImpactCopy(ball.number === 8 ? "Eight" : banked ? "Banked" : "Sunk", `+${points} / +${chalkEarned} chalk`, "pocket");
	updateHud(true);
	playImpactSound(0.8, ball.number % sounds.length);
	if (navigator.vibrate) navigator.vibrate(7);
}

function respotEight() {
	const ball = run.pendingEight;
	if (!ball) return;
	const candidates = [
		[W * 0.68, H * 0.5],
		[W * 0.62, H * 0.38],
		[W * 0.62, H * 0.62],
		[W * 0.56, H * 0.5]
	];
	const spot = candidates.find(([x, y]) => balls.every((other) => !other.active || other === ball || Math.hypot(other.x - x, other.y - y) > ball.r * 2.2)) || candidates[3];
	ball.x = spot[0];
	ball.y = spot[1];
	ball.vx = 0;
	ball.vy = 0;
	ball.active = true;
	ball.railHits = 0;
	run.pendingEight = null;
}

function collide(a, b) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const minimumDistance = a.r + b.r;
	const distanceSquared = dx * dx + dy * dy;
	if (distanceSquared === 0 || distanceSquared >= minimumDistance * minimumDistance) return;

	const distance = Math.sqrt(distanceSquared);
	const normalX = dx / distance;
	const normalY = dy / distance;
	const overlap = minimumDistance - distance;
	a.x -= normalX * overlap * 0.5;
	a.y -= normalY * overlap * 0.5;
	b.x += normalX * overlap * 0.5;
	b.y += normalY * overlap * 0.5;

	const relativeVelocity = (a.vx - b.vx) * normalX + (a.vy - b.vy) * normalY;
	if (relativeVelocity <= 0) return;
	const impulse = relativeVelocity * 0.965;
	a.vx -= impulse * normalX;
	a.vy -= impulse * normalY;
	b.vx += impulse * normalX;
	b.vy += impulse * normalY;

	if (relativeVelocity > MIN_IMPACT_SPEED && a.cooldown <= 0 && b.cooldown <= 0) {
		triggerImpact(
			(a.x + b.x) * 0.5,
			(a.y + b.y) * 0.5,
			normalX,
			normalY,
			"#f2c76b",
			relativeVelocity,
			b
		);
		a.cooldown = 0.055;
	}
}

function updateBall(ball, dt) {
	ball.x += ball.vx * dt;
	ball.y += ball.vy * dt;
	ball.angle += (Math.hypot(ball.vx, ball.vy) / Math.max(ball.r, 1)) * dt * 0.32;
	ball.cooldown = Math.max(0, ball.cooldown - dt);

	const effect = currentEncounter().effect;
	const dragBase = effect === "fast" || effect === "house" ? 0.62 : 0.39;
	const drag = Math.pow(dragBase, dt);
	ball.vx *= drag;
	ball.vy *= drag;
	if ((effect === "drift" || effect === "house") && ball.vx * ball.vx + ball.vy * ball.vy > 100) {
		ball.vx += 19 * dt;
		ball.vy += Math.sin(ball.x * 0.014 + run.stage) * 7 * dt;
	}
	if (ball.vx * ball.vx + ball.vy * ball.vy < 4) {
		ball.vx = 0;
		ball.vy = 0;
	}

	for (const pocket of pockets) {
		const dx = pocket.x - ball.x;
		const dy = pocket.y - ball.y;
		const distanceSquared = dx * dx + dy * dy;
		const pocketUpgrade = upgradeLevel("gravity-chalk");
		const hotPull = effect === "hot" || effect === "house" ? 7 : 0;
		const pullRadius = (pocket.kind === "side" ? 48 : 46) + pocketUpgrade * 4 + hotPull;
		if (distanceSquared < pullRadius * pullRadius) {
			const distance = Math.sqrt(distanceSquared) || 1;
			const pull = (1 - distance / pullRadius) * (235 + pocketUpgrade * 32 + hotPull * 5);
			ball.vx += (dx / distance) * pull * dt;
			ball.vy += (dy / distance) * pull * dt;
			const narrowPenalty = effect === "narrow" || effect === "house" ? 3 : 0;
			const captureRadius = (pocket.kind === "side" ? 27 : 26) + upgradeLevel("deep-pockets") * 2.5 + (hasUpgrade("moon-jaws") ? 5 : 0) - narrowPenalty;
			if (distance < captureRadius) {
				pocketBall(ball, pocket);
				return;
			}
		}
	}

	const bounds = playableBounds(ball.r);
	const railBounce = effect === "house" ? 0.93 : 0.86;
	let railSpeed = 0;
	let normalX = 0;
	let normalY = 0;
	if (ball.x < bounds.left) {
		railSpeed = Math.abs(ball.vx);
		ball.x = bounds.left;
		ball.vx = Math.abs(ball.vx) * railBounce;
		normalX = 1;
	} else if (ball.x > bounds.right) {
		railSpeed = Math.abs(ball.vx);
		ball.x = bounds.right;
		ball.vx = -Math.abs(ball.vx) * railBounce;
		normalX = -1;
	}
	if (ball.y < bounds.top) {
		railSpeed = Math.max(railSpeed, Math.abs(ball.vy));
		ball.y = bounds.top;
		ball.vy = Math.abs(ball.vy) * railBounce;
		normalY = 1;
	} else if (ball.y > bounds.bottom) {
		railSpeed = Math.max(railSpeed, Math.abs(ball.vy));
		ball.y = bounds.bottom;
		ball.vy = -Math.abs(ball.vy) * railBounce;
		normalY = -1;
	}

	if (railSpeed > 32 && ball !== cue) ball.railHits++;
	if (railSpeed > MIN_IMPACT_SPEED && ball.cooldown <= 0) {
		triggerImpact(ball.x, ball.y, normalX, normalY, "#72e8ca", railSpeed * 0.62, ball, "rail");
	}
}

function physicsStep(dt) {
	const active = [];
	if (cue.active) active.push(cue);
	for (const ball of balls) {
		if (ball.active) active.push(ball);
	}

	for (const ball of active) updateBall(ball, dt);
	for (let first = 0; first < active.length; first++) {
		if (!active[first].active) continue;
		for (let second = first + 1; second < active.length; second++) {
			if (active[second].active) collide(active[first], active[second]);
		}
	}
}

function updateTrails(dt) {
	trailClock += dt;
	if (trailClock < 0.028) return;
	trailClock = 0;
	for (const ball of [cue, ...balls]) {
		if (!ball.active) continue;
		const speedSquared = ball.vx * ball.vx + ball.vy * ball.vy;
		if (speedSquared > 4200) {
			ball.trail.unshift({ x: ball.x, y: ball.y });
			if (ball.trail.length > MAX_TRAIL_POINTS) ball.trail.length = MAX_TRAIL_POINTS;
		} else if (ball.trail.length) {
			ball.trail.pop();
		}
	}
}

function allBallsStopped() {
	if (cue.active && cue.vx * cue.vx + cue.vy * cue.vy > 36) return false;
	return !balls.some((ball) => ball.active && ball.vx * ball.vx + ball.vy * ball.vy > 36);
}

function finishShot() {
	if (!shotInProgress || hitStop > 0 || !allBallsStopped()) return;

	if (!cue.active) {
		const bounds = playableBounds(cue.r);
		cue.x = clamp(W * 0.265, bounds.left, bounds.right);
		cue.y = H * 0.5;
		cue.vx = 0;
		cue.vy = 0;
		cue.active = true;
		cue.trail.length = 0;
		syncAimFromAngle();
	}
	respotEight();

	run.stats.maxShotPocketed = Math.max(run.stats.maxShotPocketed, shotPocketed);
	if (shotPocketed > 0) {
		run.combo++;
		run.bestCombo = Math.max(run.bestCombo, run.combo);
	} else {
		run.stats.misses++;
		run.combo = 0;
	}
	shotInProgress = false;
	syncAimFromAngle();
	rackBreak = false;
	if (run.sunk >= encounterTarget(currentEncounter()) && (!currentEncounter().boss || run.eightSunk)) {
		completeEncounter();
		return;
	}
	if (run.shots <= 0 && shotPocketed > 0) {
		run.shots = 1;
		showImpactCopy("Hot streak", "+1 shot", "pocket");
		streakStatus.textContent = `${run.sunk} / ${encounterTarget(currentEncounter())} pocketed / streak alive`;
	}
	if (run.shots <= 0) {
		failEncounter();
		return;
	}
	streakStatus.textContent = shotPocketed && !scratch ? `${run.sunk} / ${encounterTarget(currentEncounter())} pocketed` : scratch ? "Scratch" : "No pocket";
	shotLabel.textContent = "Ready";
	shotDetail.textContent = `${run.shots} shot${run.shots === 1 ? " remains" : "s remain"}`;
	updateHud();
	if (shotPocketed > 0 && run.shots === 1) {
		streakStatus.textContent = `${run.sunk} / ${encounterTarget(currentEncounter())} pocketed / streak alive`;
	}
}

function updateEffects(dt) {
	for (let index = particles.length - 1; index >= 0; index--) {
		const particle = particles[index];
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		particle.vx *= Math.pow(0.025, dt);
		particle.vy *= Math.pow(0.025, dt);
		particle.life -= dt;
		if (particle.life <= 0) particles.splice(index, 1);
	}
	for (let index = rings.length - 1; index >= 0; index--) {
		const ring = rings[index];
		ring.radius += ring.speed * dt;
		ring.life -= dt * 2.35;
		if (ring.life <= 0) rings.splice(index, 1);
	}
	for (let index = pocketEffects.length - 1; index >= 0; index--) {
		const effect = pocketEffects[index];
		effect.radius += dt * 66;
		effect.life -= dt * 1.85;
		if (effect.life <= 0) pocketEffects.splice(index, 1);
	}
	if (impactFrame) {
		impactFrame.life -= dt * 5.8;
		if (impactFrame.life <= 0) impactFrame = null;
	}
	screenShake *= Math.pow(0.0015, dt);
	flash *= Math.pow(0.001, dt);
}

function update(dt) {
	updateEffects(dt);
	updateTrails(dt);
	if (hitStop > 0) {
		hitStop = Math.max(0, hitStop - dt);
		return;
	}

	accumulator = Math.min(accumulator + dt, PHYSICS_STEP * 8);
	while (accumulator >= PHYSICS_STEP) {
		physicsStep(PHYSICS_STEP);
		accumulator -= PHYSICS_STEP;
	}
	finishShot();
}

function aimPrediction() {
	const dx = aim.x - cue.x;
	const dy = aim.y - cue.y;
	const magnitude = Math.hypot(dx, dy) || 1;
	const directionX = dx / magnitude;
	const directionY = dy / magnitude;
	const bounds = playableBounds(cue.r);
	const obscured = currentEncounter().effect === "blackout" && !hasUpgrade("true-line");
	let nearest = Math.max(W, H) * (obscured ? 0.45 : 1.4) * (1 + upgradeLevel("measured-eye") * 0.3);
	let target = null;

	for (const ball of balls) {
		if (!ball.active) continue;
		const offsetX = ball.x - cue.x;
		const offsetY = ball.y - cue.y;
		const projection = offsetX * directionX + offsetY * directionY;
		if (projection <= 0 || projection >= nearest) continue;
		const perpendicularSquared = offsetX * offsetX + offsetY * offsetY - projection * projection;
		const collisionRadius = cue.r + ball.r;
		if (perpendicularSquared > collisionRadius * collisionRadius) continue;
		const entry = projection - Math.sqrt(collisionRadius * collisionRadius - perpendicularSquared);
		if (entry > 0 && entry < nearest) {
			nearest = entry;
			target = ball;
		}
	}

	const wallTimeX = directionX > 0 ? (bounds.right - cue.x) / directionX : directionX < 0 ? (bounds.left - cue.x) / directionX : Infinity;
	const wallTimeY = directionY > 0 ? (bounds.bottom - cue.y) / directionY : directionY < 0 ? (bounds.top - cue.y) / directionY : Infinity;
	const wallDistance = Math.min(wallTimeX, wallTimeY);
	let hitAxis = null;
	if (wallDistance < nearest) {
		nearest = wallDistance;
		target = null;
		hitAxis = wallTimeX <= wallTimeY ? "x" : "y";
	}

	const result = {
		directionX,
		directionY,
		endX: cue.x + directionX * nearest,
		endY: cue.y + directionY * nearest,
		target
	};

	if (!target && hitAxis && hasUpgrade("bank-vision")) {
		const bankDirX = hitAxis === "x" ? -directionX : directionX;
		const bankDirY = hitAxis === "y" ? -directionY : directionY;
		result.bank = computeBankPreview(result.endX, result.endY, bankDirX, bankDirY, bounds);
	}

	return result;
}

function computeBankPreview(startX, startY, dirX, dirY, bounds) {
	let nearest = Math.max(W, H) * 0.75;
	let target = null;
	for (const ball of balls) {
		if (!ball.active) continue;
		const offsetX = ball.x - startX;
		const offsetY = ball.y - startY;
		const projection = offsetX * dirX + offsetY * dirY;
		if (projection <= 0 || projection >= nearest) continue;
		const perpendicularSquared = offsetX * offsetX + offsetY * offsetY - projection * projection;
		const collisionRadius = cue.r + ball.r;
		if (perpendicularSquared > collisionRadius * collisionRadius) continue;
		const entry = projection - Math.sqrt(collisionRadius * collisionRadius - perpendicularSquared);
		if (entry > 0 && entry < nearest) {
			nearest = entry;
			target = ball;
		}
	}
	const wallTimeX = dirX > 0 ? (bounds.right - startX) / dirX : dirX < 0 ? (bounds.left - startX) / dirX : Infinity;
	const wallTimeY = dirY > 0 ? (bounds.bottom - startY) / dirY : dirY < 0 ? (bounds.top - startY) / dirY : Infinity;
	const wallDistance = Math.min(wallTimeX, wallTimeY);
	if (wallDistance < nearest) {
		nearest = wallDistance;
		target = null;
	}
	return { endX: startX + dirX * nearest, endY: startY + dirY * nearest, target };
}

function drawAimGuide() {
	if (!cue.active || shotInProgress) return;
	const prediction = aimPrediction();
	const alpha = 0.6;
	const line = ctx.createLinearGradient(cue.x, cue.y, prediction.endX, prediction.endY);
	line.addColorStop(0, `rgba(114, 232, 202, ${alpha})`);
	line.addColorStop(0.72, `rgba(243, 236, 221, ${alpha * 0.82})`);
	line.addColorStop(1, "rgba(243, 236, 221, .08)");
	ctx.save();
	ctx.strokeStyle = line;
	ctx.lineWidth = 1;
	ctx.setLineDash([2, 7]);
	ctx.beginPath();
	ctx.moveTo(cue.x, cue.y);
	ctx.lineTo(prediction.endX, prediction.endY);
	ctx.stroke();
	ctx.setLineDash([]);

	ctx.strokeStyle = "rgba(243, 236, 221, .52)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(prediction.endX, prediction.endY, cue.r, 0, Math.PI * 2);
	ctx.stroke();

	if (prediction.target) {
		const normalX = (prediction.target.x - prediction.endX) / (prediction.target.r + cue.r);
		const normalY = (prediction.target.y - prediction.endY) / (prediction.target.r + cue.r);
		ctx.strokeStyle = "rgba(227, 180, 95, .5)";
		ctx.setLineDash([4, 7]);
		ctx.beginPath();
		ctx.moveTo(prediction.target.x, prediction.target.y);
		ctx.lineTo(prediction.target.x + normalX * 96, prediction.target.y + normalY * 96);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	if (prediction.bank) {
		ctx.strokeStyle = "rgba(114, 232, 202, .55)";
		ctx.setLineDash([3, 6]);
		ctx.beginPath();
		ctx.moveTo(prediction.endX, prediction.endY);
		ctx.lineTo(prediction.bank.endX, prediction.bank.endY);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.arc(prediction.bank.endX, prediction.bank.endY, cue.r * 0.7, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();

	drawCueStick(prediction.directionX, prediction.directionY);
}

function drawCueStick(directionX, directionY) {
	const chargePull = 18;
	const tipX = cue.x - directionX * (cue.r + chargePull);
	const tipY = cue.y - directionY * (cue.r + chargePull);
	const endX = tipX - directionX * Math.min(190, W * 0.22);
	const endY = tipY - directionY * Math.min(190, W * 0.22);
	const gradient = ctx.createLinearGradient(tipX, tipY, endX, endY);
	gradient.addColorStop(0, "#f0ded0");
	gradient.addColorStop(0.08, "#326e8c");
	gradient.addColorStop(0.13, "#d8ae6b");
	gradient.addColorStop(0.72, "#8b4d2e");
	gradient.addColorStop(1, "#28110e");

	ctx.save();
	ctx.lineCap = "round";
	ctx.strokeStyle = "rgba(0, 0, 0, .38)";
	ctx.lineWidth = 7;
	ctx.beginPath();
	ctx.moveTo(tipX + 2, tipY + 3);
	ctx.lineTo(endX + 2, endY + 3);
	ctx.stroke();
	ctx.strokeStyle = gradient;
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(tipX, tipY);
	ctx.lineTo(endX, endY);
	ctx.stroke();
	ctx.restore();
}

function drawTrails() {
	ctx.save();
	ctx.globalCompositeOperation = "screen";
	for (const ball of [cue, ...balls]) {
		if (!ball.active || !ball.trail.length) continue;
		const color = ball === cue ? "114, 232, 202" : "227, 180, 95";
		for (let index = ball.trail.length - 1; index >= 0; index--) {
			const point = ball.trail[index];
			const alpha = (1 - index / (ball.trail.length + 1)) * 0.09;
			ctx.fillStyle = `rgba(${color}, ${alpha})`;
			ctx.beginPath();
			ctx.arc(point.x, point.y, ball.r * (0.38 + alpha * 2), 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.restore();
}

function drawBall(ball) {
	if (!ball.active) return;
	const sprite = makeBallSprite(ball.number || 0, ball.color || "#f7f1df", ball.stripe || false, ball.r, ball === cue);
	ctx.save();
	ctx.translate(ball.x, ball.y);
	if (ball !== cue) ctx.rotate(ball.angle);
	ctx.drawImage(sprite.image, -sprite.size / 2, -sprite.size / 2, sprite.size, sprite.size);
	ctx.restore();
}

function drawEffects() {
	ctx.save();
	ctx.globalCompositeOperation = "screen";
	for (const ring of rings) {
		ctx.globalAlpha = Math.max(0, ring.life);
		ctx.strokeStyle = ring.color;
		ctx.lineWidth = ring.width;
		ctx.beginPath();
		ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
		ctx.stroke();
	}
	for (const effect of pocketEffects) {
		ctx.globalAlpha = Math.max(0, effect.life);
		ctx.strokeStyle = effect.color;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(effect.x, effect.y, effect.radius * 0.6, 0, Math.PI * 1.5);
		ctx.stroke();
	}
	for (const particle of particles) {
		ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
		ctx.strokeStyle = particle.color;
		ctx.lineWidth = particle.size;
		ctx.beginPath();
		ctx.moveTo(particle.x, particle.y);
		ctx.lineTo(particle.x - particle.vx * 0.018, particle.y - particle.vy * 0.018);
		ctx.stroke();
	}
	ctx.restore();
}

function drawImpactFrame() {
	if (!impactFrame) return;
	const life = clamp(impactFrame.life, 0, 1);
	ctx.save();
	ctx.globalCompositeOperation = "screen";
	ctx.translate(impactFrame.x, impactFrame.y);
	ctx.globalAlpha = life * 0.78;
	ctx.strokeStyle = impactFrame.color;
	for (const ray of impactFrame.rays) {
		ctx.save();
		ctx.rotate(ray.angle);
		ctx.lineWidth = ray.width;
		ctx.beginPath();
		ctx.moveTo(16, 0);
		ctx.lineTo(ray.length * (1.15 - life * 0.15), 0);
		ctx.stroke();
		ctx.restore();
	}
	ctx.globalAlpha = life;
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, 18 + (1 - life) * 42, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = life * 0.14;
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, W, H);
	ctx.globalAlpha = life * 0.72;
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 1;
	ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
	ctx.restore();
}

function draw() {
	const shakeX = screenShake > 0.12 ? (Math.random() - 0.5) * screenShake : 0;
	const shakeY = screenShake > 0.12 ? (Math.random() - 0.5) * screenShake : 0;
	ctx.save();
	ctx.translate(shakeX, shakeY);
	ctx.drawImage(tableLayer, -3, -3, W + 6, H + 6);
	drawTrails();
	drawAimGuide();
	for (const ball of balls) drawBall(ball);
	drawBall(cue);
	drawEffects();
	ctx.restore();

	if (flash > 0.015) {
		ctx.save();
		const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.08, W / 2, H / 2, Math.max(W, H) * 0.72);
		vignette.addColorStop(0, `rgba(255, 255, 255, ${flash * 0.26})`);
		vignette.addColorStop(0.55, `rgba(255, 255, 255, ${flash * 0.035})`);
		vignette.addColorStop(1, `rgba(0, 0, 0, ${flash * 0.48})`);
		ctx.fillStyle = vignette;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}
	drawImpactFrame();
}

function loop(time) {
	const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
	lastTime = time;
	update(dt);
	draw();
	requestAnimationFrame(loop);
}

powerSlider.addEventListener("input", () => {
	if (!shotInProgress) setPower(powerSlider.value);
});
angleSlider.addEventListener("input", () => {
	if (!shotInProgress) setAngle(angleSlider.value);
});

canvas.addEventListener("pointermove", (event) => {
	if (angleDragActive && run.state === "playing" && !shotInProgress) setAngleFromPointer(event);
});
canvas.addEventListener("pointerdown", (event) => {
	if (run.state === "playing" && !shotInProgress) {
		angleDragActive = true;
		setAngleFromPointer(event);
		canvas.setPointerCapture(event.pointerId);
	}
});
canvas.addEventListener("pointerup", (event) => {
	angleDragActive = false;
	if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener("pointercancel", (event) => {
	angleDragActive = false;
	if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

window.addEventListener("keydown", (event) => {
	if (isInputFocused(event.target) && event.target !== canvas) return;
	if ((event.code === "Space" || event.code === "Enter") && !event.repeat) {
		event.preventDefault();
		shoot();
	}
});
shootButton.addEventListener("click", shoot);

soundButton.addEventListener("click", () => {
	soundEnabled = !soundEnabled;
	soundButton.textContent = soundEnabled ? "Sound on" : "Sound off";
	soundButton.setAttribute("aria-pressed", String(soundEnabled));
});
beginEncounterButton.addEventListener("click", beginEncounter);
rerollUpgradesButton.addEventListener("click", rerollDraft);
startRunButton.addEventListener("click", startRunFromMenu);
restartRunButton.addEventListener("click", returnToMenu);
rackButton.addEventListener("click", () => endRun(false, "You left the table before the circuit was settled."));
window.addEventListener("resize", resize);
new ResizeObserver(([entry]) => {
	const width = entry.contentRect.width;
	const height = entry.contentRect.height;
	if (Math.abs(width - W) > 0.5 || Math.abs(height - H) > 0.5) resize();
}).observe(canvas);
document.addEventListener("visibilitychange", () => {
	lastTime = performance.now();
	accumulator = 0;
});

resize();
renderDifficultyGrid();
updateMenuBest();
showModal(menuModal);
requestAnimationFrame(loop);