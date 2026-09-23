// === EXISTING CHARACTER/INVENTORY DATA PRESETS ===
const partyData = {
    cloud: { name: "CLOUD", class: "melee", atk: 84, def: 62, magic: 3, magicDef: 2, speed: 95, maxHp: 150, hp: 150, equipment: { helmet: "Empty", chest: "Empty", arms: "Empty", leggings: "Empty", boots: "Empty", amulet: "Empty", ring: "Empty", weapon: "Buster Sword", focus: "N/A", ammo: "N/A" }, grimoire: ["Fireball"], chantKnowledge: new Set(["Heed me, oh flame."]) },
    aerith: { name: "AERITH", class: "magic", atk: 32, def: 45, magic: 4, magicDef: 3, speed: 88, maxHp: 120, hp: 120, equipment: { helmet: "Empty", chest: "Empty", arms: "Empty", leggings: "Empty", boots: "Empty", amulet: "Empty", ring: "Empty", weapon: "N/A", focus: "Fireball Scroll", ammo: "N/A" }, grimoire: ["Fireball"], chantKnowledge: new Set(["Heed me, oh flame."]) }
};
const tabConfigs = { one: "WEAPONS", two: "SCROLLS", three: "ARMOR", four: "KEY ITEMS" };
let currentCharacterId = "cloud", selectedInventoryRow = null;

const weaponAbilities = {
    "Buster Sword": {
        family: "greatsword",
        atkBonus: 15,
        skillDamage: 4,
        moves: [
            { name: "Heavy Slice", skillDamage: 4, text: "A crushing overhead cut that shreds defense." },
            { name: "Guard Break", skillDamage: 3, text: "A fierce burst that cracks enemy guard on impact." },
            { name: "Rending Arc", skillDamage: 5, text: "A wide swing that tears into the target's weak points." }
        ]
    },
    "Iron Helmet": {
        family: "blunt",
        atkBonus: 8,
        skillDamage: 2,
        moves: [
            { name: "Orbital Bash", skillDamage: 2, text: "A blunt strike that drives the enemy back." },
            { name: "Steel Crash", skillDamage: 3, text: "A heavy impact designed to stun the foe." }
        ]
    },
    "Fists": {
        family: "barehand",
        atkBonus: 0,
        skillDamage: 2,
        moves: [
            { name: "Knuckle Burst", skillDamage: 2, text: "Fast, close-range pressure with no wasted motion." },
            { name: "Tiger Rush", skillDamage: 3, text: "A rapid barrage built for speed and tempo." }
        ]
    },
    "Default": {
        family: "basic",
        atkBonus: 0,
        skillDamage: 2,
        moves: [
            { name: "Basic Strike", skillDamage: 2, text: "A reliable melee hit with no special effect." }
        ]
    }
};

const spellbook = {
    Fireball: { name: "Fireball", baseDamage: 500, chant: "Heed me, oh flame.", text: "Burns the target with a focused blast of flame.", requirement: "Book of Flames" },
    Frostbite: { name: "Frostbite", baseDamage: 420, chant: "By the frozen breath of winter.", text: "Freezes the battlefield and slows the target.", requirement: "Frostbound Ledger" },
    ArcaneSigil: { name: "Arc Lash", baseDamage: 360, chant: "Lightning answer my call.", text: "Crackles with lightning-sealed energy.", requirement: "Arcane Sigil Ledger" },
    Default: { name: "Spark", baseDamage: 140, chant: "light", text: "A basic elemental burst.", requirement: "None" }
};

const spellDiscovery = {
    "Book of Flames": ["Fireball"],
    "Frostbound Ledger": ["Frostbite"],
    "Arcane Sigil Ledger": ["ArcaneSigil"]
};

const GRIMOIRE_PATH = "grimoire.md";

// === NEW: MAP RENDERING VARIABLES ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const diagBox = document.getElementById("map-dialogue");

const TILE_SIZE = 16; // Perfectly fits your 10-20px engine scale request!
let gameMode = "map"; // "map", "menu", "dialogue"

// Player Settings
const playerImg = new Image();
playerImg.src = "player.png"; // Links to your image asset
let player = { x: 2, y: 2 }; // Grid tile coordinates

// Interactive Boss NPC Setting
let boss = { x: 18, y: 12, active: true };

const BATTLE_PARTY_CAP = 5;
const PARTY_SOFT_CAP = 5;

const battleState = {
    active: false,
    enemy: null,
    partyQueue: [],
    turnOrder: [],
    currentActorId: null,
    playerGuard: false,
    round: 1,
    log: "Choose an action."
};

const enemyTemplates = [
    { name: "MAD SLIME", type: "wild", hp: 44, atk: 10, def: 18, magicDef: 8, magic: 1 },
    { name: "BLOOD WOLF", type: "wild", hp: 58, atk: 13, def: 20, magicDef: 9, magic: 2 },
    { name: "MAGE THORN", type: "wild", hp: 64, atk: 18, def: 24, magicDef: 12, magic: 3 },
    { name: "SEPHIROTH", type: "boss", hp: 110, atk: 24, def: 150, magicDef: 18, magic: 5 }
];

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCurrentPartyMember() {
    return partyData[currentCharacterId] || partyData.cloud;
}

function getLivingPartyMembers() {
    const living = Object.entries(partyData)
        .filter(([, member]) => member.hp > 0)
        .map(([id, member]) => ({ id, ...member }));

    return living.slice(0, PARTY_SOFT_CAP);
}

function getCurrentBattleActor() {
    if (!battleState.turnOrder.length) return null;
    return battleState.turnOrder.find((entity) => entity.battleId === battleState.currentActorId) || battleState.turnOrder[0];
}

function getBattleTurnOrder() {
    const party = getLivingPartyMembers().map((member) => ({
        ...member,
        battleId: `party:${member.id}`,
        side: "party",
        name: member.name
    }));

    const enemies = battleState.enemy ? [{
        ...battleState.enemy,
        battleId: "enemy:0",
        side: "enemy",
        name: battleState.enemy.name
    }] : [];

    return [...party, ...enemies].sort((a, b) => (b.speed || 0) - (a.speed || 0));
}

function getEquippedWeapon(actor) {
    if (!actor || !actor.equipment) return "Fists";
    return actor.equipment.weapon && actor.equipment.weapon !== "N/A" && actor.equipment.weapon !== "Empty" ? actor.equipment.weapon : "Fists";
}

function getEquippedFocus(actor) {
    if (!actor || !actor.equipment) return "Default";
    return actor.equipment.focus && actor.equipment.focus !== "N/A" && actor.equipment.focus !== "Empty" ? actor.equipment.focus : "Default";
}

function hasMagicFocus(actor) {
    const focus = actor?.equipment?.focus;
    return Boolean(focus && focus !== "N/A" && focus !== "Empty" && focus !== "Default");
}

function getWeaponAbility(actor) {
    const weaponName = getEquippedWeapon(actor);
    const ability = weaponAbilities[weaponName] || weaponAbilities.Default;
    return ability;
}

function getSpellAbility(actor) {
    const spellName = getEquippedFocus(actor);
    return spellbook[spellName] || spellbook.Default;
}

function normaliseChant(chant) {
    return String(chant || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getSpellForChant(actor, chantText) {
    const input = normaliseChant(chantText);
    if (!input) return null;

    const available = Array.from(actor?.grimoire || []);
    for (const spellName of available) {
        const spell = spellbook[spellName];
        if (spell && normaliseChant(spell.chant) === input) {
            return spell;
        }
    }

    for (const [spellName, spell] of Object.entries(spellbook)) {
        if (spell && normaliseChant(spell.chant) === input && actor?.chantKnowledge?.has(spell.chant.trim())) {
            return spell;
        }
    }

    return null;
}

function getVisibleMagicValue(actor) {
    const magicValue = Number(actor?.magic || 0);
    return magicValue * 10;
}

function learnSpellFromBook(actor, bookTitle) {
    if (!actor || !spellDiscovery[bookTitle]) return false;
    let learned = false;
    spellDiscovery[bookTitle].forEach((spellName) => {
        if (!actor.grimoire.includes(spellName)) {
            actor.grimoire.push(spellName);
            learned = true;
        }
        if (spellbook[spellName]?.chant) {
            actor.chantKnowledge.add(spellbook[spellName].chant.trim());
        }
    });
    return learned;
}

function getWeaponMove(actor, moveName = null) {
    const weapon = getWeaponAbility(actor);
    const moves = weapon.moves && weapon.moves.length ? weapon.moves : [{ name: "Basic Strike", skillDamage: weapon.skillDamage || 2, text: "A basic blow." }];
    if (!moveName) return moves[0];
    return moves.find((move) => move.name === moveName) || moves[0];
}

function getAbilityOptions(actor) {
    const weapon = getWeaponAbility(actor);
    return weapon.moves && weapon.moves.length ? weapon.moves : [{ name: "Basic Strike", skillDamage: weapon.skillDamage || 2, text: "A basic blow." }];
}

function calculateWeaponDamage(actor, enemy, move) {
    const weapon = getWeaponAbility(actor);
    const offense = actor.atk + (weapon.atkBonus || 0);
    const skill = move.skillDamage || weapon.skillDamage || 1;
    return Math.max(0, Math.round(skill * offense - (enemy.def || 0)));
}

function renderRosterLists() {
    const partyList = document.getElementById("battle-party-list");
    const enemyList = document.getElementById("battle-enemy-list");
    if (!partyList || !enemyList) return;

    const livingParty = getLivingPartyMembers();
    partyList.innerHTML = livingParty.map((member) => {
        const isActive = `party:${member.id}` === battleState.currentActorId;
        return `
            <div class="turn-card ${isActive ? "active-turn" : ""} ${member.hp <= 0 ? "down" : ""}">
                <div class="turn-name">${member.name}</div>
                <div class="turn-meta">SPD ${member.speed || 0} · HP ${member.hp}/${member.maxHp}</div>
            </div>
        `;
    }).join("");

    if (battleState.enemy) {
        const enemyActive = battleState.currentActorId === "enemy:0";
        enemyList.innerHTML = `
            <div class="turn-card enemy-card ${enemyActive ? "active-turn" : ""}">
                <div class="turn-name">${battleState.enemy.name}</div>
                <div class="turn-meta">HP ${battleState.enemy.hp}/${battleState.enemy.maxHp} · DEF ${battleState.enemy.def || 0}</div>
            </div>
        `;
    }
}

function refreshAbilitySelect() {
    const select = document.getElementById("battle-ability-select");
    if (!select) return;

    const current = getCurrentBattleActor();
    if (!current || current.side !== "party") {
        select.disabled = true;
        select.innerHTML = '<option value="basic">Attack</option>';
        return;
    }

    const options = getAbilityOptions(current);
    select.disabled = false;
    select.innerHTML = options.map((move, index) => `<option value="${move.name}" ${index === 0 ? "selected" : ""}>${move.name}</option>`).join("");
}

function refreshChantInput() {
    const chantInput = document.getElementById("chant-input");
    if (!chantInput) return;

    const current = getCurrentBattleActor();
    const canChant = current && current.side === "party" ? hasMagicFocus(partyData[current.id]) : false;

    chantInput.disabled = !canChant;
    chantInput.placeholder = canChant ? "Type the spell chant here..." : "Requires magic focus";
}

function updateCombatUI() {
    const combatScreen = document.getElementById("combat-screen");
    if (!combatScreen || !battleState.active || !battleState.enemy) return;

    const current = getCurrentBattleActor() || getCurrentPartyMember();
    const enemy = battleState.enemy;
    const currentMember = current && current.side === "party" ? partyData[current.id] : current;

    document.getElementById("battle-player-name").textContent = currentMember ? currentMember.name : "PARTY";
    document.getElementById("battle-enemy-name").textContent = enemy.name;
    document.getElementById("battle-enemy-label").textContent = enemy.name;
    document.getElementById("battle-enemy-type").textContent = enemy.type === "boss" ? "BOSS ENEMY" : "WILD ENCOUNTER";
    document.getElementById("battle-log").textContent = battleState.log;
    document.getElementById("battle-turn-banner").textContent = `${currentMember ? currentMember.name : enemy.name}'s turn`;

    const playerHpPercent = ((currentMember?.hp ?? 0) / (currentMember?.maxHp ?? 1)) * 100;
    const enemyHpPercent = (enemy.hp / enemy.maxHp) * 100;
    document.getElementById("player-hp-fill").style.width = `${Math.max(0, playerHpPercent)}%`;
    document.getElementById("enemy-hp-fill").style.width = `${Math.max(0, enemyHpPercent)}%`;
    document.getElementById("player-hp-text").textContent = `${currentMember ? currentMember.hp : 0} / ${currentMember ? currentMember.maxHp : 1} HP`;
    document.getElementById("enemy-hp-text").textContent = `${enemy.hp} / ${enemy.maxHp} HP`;

    refreshAbilitySelect();
    refreshChantInput();
    renderRosterLists();
}

function advanceCombatTurn() {
    if (!battleState.active) return;

    const queue = getBattleTurnOrder();
    battleState.turnOrder = queue;
    if (!queue.length) {
        battleState.active = false;
        return;
    }

    const currentIndex = queue.findIndex((entity) => entity.battleId === battleState.currentActorId);
    const nextActor = queue[(currentIndex + 1) % queue.length] || queue[0];
    battleState.currentActorId = nextActor.battleId;
    battleState.log = `${nextActor.name} takes the next turn.`;
    updateCombatUI();

    if (nextActor.side === "enemy") {
        const enemyActor = nextActor;
        setTimeout(() => {
            if (!battleState.active || battleState.currentActorId !== enemyActor.battleId) return;
            const target = getLivingPartyMembers()[0] || partyData.cloud;
            const attackPower = enemyActor.atk + randomBetween(0, 8);
            const incomingDamage = Math.max(0, attackPower - Math.floor((target.def || 0) / 6));
            target.hp = Math.max(0, target.hp - incomingDamage);
            battleState.log = `${enemyActor.name} strikes ${target.name} for ${incomingDamage} damage.`;
            updateCombatUI();
            if (target.hp <= 0) {
                const aliveQueue = getLivingPartyMembers();
                if (!aliveQueue.length) {
                    battleState.active = false;
                    battleState.log = "The party has fallen. The battle ends.";
                    updateCombatUI();
                    return;
                }
            }
            advanceCombatTurn();
        }, 350);
    }
}

function showCombatScreen() {
    const combatScreen = document.getElementById("combat-screen");
    if (!combatScreen) return;
    combatScreen.style.display = "flex";
    requestAnimationFrame(() => combatScreen.classList.add("show"));
}

function hideCombatScreen() {
    const combatScreen = document.getElementById("combat-screen");
    if (!combatScreen) return;
    combatScreen.classList.remove("show");
    setTimeout(() => {
        combatScreen.style.display = "none";
    }, 220);
}

function resetBattleState() {
    battleState.active = false;
    battleState.enemy = null;
    battleState.partyQueue = [];
    battleState.turnOrder = [];
    battleState.currentActorId = null;
    battleState.playerGuard = false;
    battleState.round = 1;
    battleState.log = "Choose an action.";
}

function startBattle(enemyName = null, enemyType = "wild") {
    if (battleState.active) return;
    resetBattleState();

    const enemyTemplate = enemyTemplates.find((enemy) => enemy.name === enemyName) || enemyTemplates[Math.floor(Math.random() * (enemyTemplates.length - 1))];
    const enemy = {
        name: enemyName || enemyTemplate.name,
        type: enemyType === "boss" ? "boss" : enemyTemplate.type,
        maxHp: enemyName === "SEPHIROTH" || enemyType === "boss" ? 110 : enemyTemplate.hp,
        hp: enemyName === "SEPHIROTH" || enemyType === "boss" ? 110 : enemyTemplate.hp,
        atk: enemyName === "SEPHIROTH" || enemyType === "boss" ? 24 : enemyTemplate.atk,
        def: enemyName === "SEPHIROTH" || enemyType === "boss" ? 150 : (enemyTemplate.def || 40),
        magicDef: enemyName === "SEPHIROTH" || enemyType === "boss" ? 18 : (enemyTemplate.magicDef || 10),
        speed: enemyName === "SEPHIROTH" || enemyType === "boss" ? 96 : 80,
        isBoss: enemyType === "boss" || enemyName === "SEPHIROTH"
    };

    battleState.active = true;
    battleState.enemy = enemy;
    battleState.playerGuard = false;
    battleState.round = 1;
    battleState.turnOrder = getBattleTurnOrder();
    battleState.currentActorId = battleState.turnOrder[0]?.battleId || `party:${currentCharacterId}`;
    battleState.log = `${enemy.name} lunges into battle! ${battleState.turnOrder[0]?.name || "The party"} acts first.`;

    document.getElementById("window-map").style.display = "none";
    document.getElementById("window-inventory").style.display = "none";
    document.getElementById("window-character").style.display = "none";
    showCombatScreen();
    gameMode = "combat";
    updateCombatUI();
}

function resolveEnemyTurn() {
    if (!battleState.active || !battleState.enemy) return;

    const current = getCurrentBattleActor();
    if (!current || current.side !== "enemy") return;

    const target = getLivingPartyMembers()[0] || partyData.cloud;
    const attackPower = current.atk + randomBetween(0, 8);
    let incomingDamage = attackPower - Math.floor((target.def || 0) / 6);

    if (battleState.playerGuard) {
        incomingDamage = Math.max(2, Math.floor(incomingDamage * 0.35));
        battleState.playerGuard = false;
        battleState.log = `${current.name} hits through your guard for ${incomingDamage} damage.`;
    } else {
        battleState.log = `${current.name} strikes ${target.name} for ${incomingDamage} damage.`;
    }

    target.hp = Math.max(0, target.hp - incomingDamage);
    updateCombatUI();

    if (target.hp <= 0) {
        const aliveQueue = getLivingPartyMembers();
        if (!aliveQueue.length) {
            battleState.active = false;
            target.hp = target.maxHp;
            battleState.log = `${target.name} was defeated. The party retreats to the map.`;
            hideCombatScreen();
            document.getElementById("window-map").style.display = "flex";
            gameMode = "map";
            return;
        }
    }
}

function resolveBattleAction(action) {
    if (!battleState.active || !battleState.enemy) return;

    const current = getCurrentBattleActor();
    if (!current || current.side !== "party") return;

    const actor = partyData[current.id];
    const enemy = battleState.enemy;
    const weapon = getWeaponAbility(actor);
    const spell = getSpellAbility(actor);
    const moveName = document.getElementById("battle-ability-select")?.value || "Basic Strike";
    const move = getWeaponMove(actor, moveName);
    const chantInput = document.getElementById("chant-input")?.value || "";

    if (action === "attack" && chantInput.trim() && hasMagicFocus(actor)) {
        action = "magic";
    }

    if (action === "attack") {
        const damage = calculateWeaponDamage(actor, enemy, move);
        enemy.hp = Math.max(0, enemy.hp - damage);
        battleState.log = `${actor.name} uses ${move.name} for ${damage} damage. ${move.text}`;
    }

    if (action === "magic") {
        if (!hasMagicFocus(actor)) {
            battleState.log = `${actor.name} needs a magic focus to chant.`;
            updateCombatUI();
            return;
        }

        if (!chantInput.trim()) {
            battleState.log = `${actor.name} tries to chant, but the phrase is empty.`;
            updateCombatUI();
            if (battleState.active) advanceCombatTurn();
            return;
        }

        const knownSpell = getSpellForChant(actor, chantInput);
        if (!knownSpell) {
            battleState.log = `${actor.name} chants "${chantInput}" but the phrase is unfamiliar.`;
            updateCombatUI();
            if (battleState.active) advanceCombatTurn();
            return;
        }

        const realMagic = Number(actor.magic || 1);
        const spellDamage = Math.max(0, Math.round((knownSpell.baseDamage || 120) * realMagic - (enemy.magicDef || 0) * 2));
        enemy.hp = Math.max(0, enemy.hp - spellDamage);
        if (document.getElementById("chant-input")) document.getElementById("chant-input").value = "";
        battleState.log = `${actor.name} chants "${knownSpell.chant}" and casts ${knownSpell.name} for ${spellDamage} damage.`;
    }

    if (action === "guard") {
        battleState.playerGuard = true;
        battleState.log = `${actor.name} braces for impact.`;
    }

    if (action === "flee") {
        if (Math.random() < 0.6) {
            battleState.active = false;
            battleState.enemy = null;
            battleState.turnOrder = [];
            battleState.currentActorId = null;
            battleState.log = `${actor.name} escapes the encounter.`;
            hideCombatScreen();
            document.getElementById("window-map").style.display = "flex";
            gameMode = "map";
            return;
        }
        battleState.log = `${actor.name} fails to escape!`;
    }

    updateCombatUI();

    if (enemy.hp <= 0) {
        battleState.log = `${enemy.name} is defeated!`;
        if (enemy.isBoss) {
            boss.active = false;
            battleState.log = `Boss defeated! ${actor.name} takes control of the arena.`;
        }
        battleState.active = false;
        battleState.enemy = null;
        battleState.turnOrder = [];
        battleState.currentActorId = null;
        hideCombatScreen();
        document.getElementById("window-map").style.display = "flex";
        gameMode = "map";
        updateCombatUI();
        drawMap();
        return;
    }

    if (battleState.active) {
        advanceCombatTurn();
    }
}


// World Matrix Map Array Setup
// 0 = Walkable, 1 = Solid Wall, 2 = Random Encounter Tall Grass, 3 = Boss Block Area
const currentMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Injection rendering matrix loop
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < currentMap.length; r++) {
        for (let c = 0; c < currentMap[r].length; c++) {
            let tile = currentMap[r][c];
            if (tile === 1) {
                ctx.fillStyle = "rgb(40, 20, 20)"; // Hard Walls (Replace with bricks later)
            } else if (tile === 2) {
                ctx.fillStyle = "rgb(20, 60, 20)"; // Tall Battle Encounter Grass patches
            } else {
                ctx.fillStyle = "rgb(15, 5, 5)"; // standard open path floor floors
            }
            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // Draw Boss NPC Entity if active flag is high
    if (boss.active) {
        ctx.fillStyle = "rgb(200, 50, 50)"; // Red box placeholder (Replace with boss.png later)
        ctx.fillRect(boss.x * TILE_SIZE, boss.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Draw Player configuration using loaded source files
    if (playerImg.complete && playerImg.naturalWidth !== 0) {
        ctx.drawImage(playerImg, player.x * TILE_SIZE, player.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    } else {
        ctx.fillStyle = "rgb(0, 255, 100)"; // Green box fall-back if file is loading/missing
        ctx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
}

// Intercept movement mechanics
function movePlayer(dx, dy) {
    if (gameMode !== "map") return;

    let targetX = player.x + dx;
    let targetY = player.y + dy;

    // Boundary constraints
    if (targetY >= 0 && targetY < currentMap.length && targetX >= 0 && targetX < currentMap[0].length) {
        let destinationTile = currentMap[targetY][targetX];

        // Process Boss Object Contact Collision Check
        if (targetX === boss.x && targetY === boss.y && boss.active) {
            startBattle("SEPHIROTH", "boss");
            return;
        }

        // Standard Walkable verification limits
        if (destinationTile !== 1) {
            player.x = targetX;
            player.y = targetY;

            // Random Battle roll trigger if walking inside deep tall grass cells
            if (destinationTile === 2) {
                if (Math.random() < 0.22) {
                    startBattle();
                    return;
                }
            }
        }
    }
    drawMap();
}

function triggerDialogue(text) {
    gameMode = "dialogue";
    diagBox.textContent = text;
    diagBox.style.display = "block";
}

function closeDialogue() {
    gameMode = "map";
    diagBox.style.display = "none";
}

// === WINDOW MANAGEMENT KEYBOARD SHORTCUT REGISTRATION ===
window.addEventListener("keydown", (e) => {
    const mapWin = document.getElementById("window-map");
    const invWin = document.getElementById("window-inventory");
    const charWin = document.getElementById("window-character");
    const combatScreen = document.getElementById("combat-screen");

    const key = e.key.toLowerCase();

    if (gameMode === "dialogue") {
        if (key === "enter" || key === " " || key === "e") closeDialogue();
        return;
    }

    if (gameMode === "combat") {
        if (key === "m") {
            gameMode = "map";
            combatScreen.style.display = "none";
            mapWin.style.display = "flex";
            drawMap();
        }
        return;
    }

    if (key === "m") {
        gameMode = "map"; mapWin.style.display = "flex"; invWin.style.display = "none"; charWin.style.display = "none";
        drawMap();
    }
    if (key === "i") {
        gameMode = "menu"; invWin.style.display = "flex"; mapWin.style.display = "none"; charWin.style.display = "none";
    }
    if (key === "c") {
        gameMode = "menu"; charWin.style.display = "flex"; mapWin.style.display = "none"; invWin.style.display = "none";
        drawCharacterUI();
    }

    if (key === "w" || e.key === "ArrowUp")    movePlayer(0, -1);
    if (key === "s" || e.key === "ArrowDown")  movePlayer(0, 1);
    if (key === "a" || e.key === "ArrowLeft")  movePlayer(-1, 0);
    if (key === "d" || e.key === "ArrowRight") movePlayer(1, 0);
});

// === RESTORED ORIGINAL FUNCTIONS ===
const titleEl = document.getElementById("menu-title");
const rows = document.querySelectorAll("#inventory-rows tr");
const buttons = document.querySelectorAll(".but");

function filterMenu(categoryId) {
    titleEl.textContent = tabConfigs[categoryId] || "ITEMS";
    rows.forEach(row => {
        row.style.display = row.getAttribute("data-category") === categoryId ? "" : "none";
    });
}
buttons.forEach(button => {
    button.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        filterMenu(button.id);
    });
});

function drawCharacterUI() {
    const char = partyData[currentCharacterId];
    document.getElementById("char-display-name").textContent = char.name;
    document.getElementById("stat-atk").textContent = char.atk;
    document.getElementById("stat-def").textContent = char.def;
    document.getElementById("stat-magic").textContent = String(getVisibleMagicValue(char));
    document.querySelectorAll(".eq-slot").forEach(slotEl => {
        const slotType = slotEl.getAttribute("data-slot");
        const eqValue = char.equipment[slotType];
        const valSpan = slotEl.querySelector(".slot-val");
        valSpan.textContent = eqValue;
        if (eqValue === "N/A") { slotEl.style.display = "none"; } else { slotEl.style.display = "flex"; valSpan.style.color = eqValue === "Empty" ? "#aaa" : "#00ff66"; }
    });
}

rows.forEach(row => {
    row.addEventListener("click", () => {
        selectedInventoryRow = row;
        const itemName = row.cells[0].textContent;
        const modal = document.getElementById("confirm-modal");
        document.getElementById("modal-text").textContent = `Equip ${itemName} to who?`;
        const optContainer = document.getElementById("modal-target-options");
        optContainer.innerHTML = ""; 
        Object.keys(partyData).forEach(charKey => {
            const btn = document.createElement("button");
            btn.textContent = partyData[charKey].name;
            btn.addEventListener("click", () => executeEquipmentAction(charKey));
            optContainer.appendChild(btn);
        });
        modal.style.display = "flex";
    });
});

function executeEquipmentAction(charKey) {
    const char = partyData[charKey];
    const itemType = selectedInventoryRow.getAttribute("data-type"); 
    const itemName = selectedInventoryRow.cells[0].textContent;
    let targetSlot = itemType;
    if (itemType === "armor" && itemName.toLowerCase().includes("helmet")) targetSlot = "helmet";

    if (char.equipment[targetSlot] === "N/A") {
        alert(`${char.name} cannot equip this item type!`);
    } else {
        char.equipment[targetSlot] = itemName;
        let qty = parseInt(selectedInventoryRow.getAttribute("data-qty"), 10);
        qty--;
        selectedInventoryRow.setAttribute("data-qty", qty);
        selectedInventoryRow.querySelector(".qty-display").textContent = `x${qty}`;
    }
    document.getElementById("confirm-modal").style.display = "none";
}

document.querySelectorAll(".char-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        currentCharacterId = tab.dataset.char;
        document.querySelectorAll(".char-tab").forEach(btn => {
            btn.classList.toggle("active", btn === tab);
        });
        drawCharacterUI();
    });
});

document.getElementById("btn-cancel").addEventListener("click", () => {
    document.getElementById("confirm-modal").style.display = "none";
});

document.querySelectorAll(".battle-action").forEach(button => {
    button.addEventListener("click", () => resolveBattleAction(button.dataset.action));
});

document.getElementById("chant-input")?.addEventListener("keydown", (event) => {
    const activeBattleActor = getCurrentBattleActor();
    const isActivePartyMage = activeBattleActor && activeBattleActor.side === "party" && hasMagicFocus(partyData[activeBattleActor.id]);

    if (event.key === "Enter" && isActivePartyMage) {
        event.preventDefault();
        resolveBattleAction("magic");
    }
});

filterMenu("one");
drawMap();
drawCharacterUI();