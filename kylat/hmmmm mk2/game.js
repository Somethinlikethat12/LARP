// === EXISTING CHARACTER/INVENTORY DATA PRESETS ===
const partyData = {
    cloud: { name: "CLOUD", class: "melee", atk: 84, def: 62, equipment: { helmet: "Empty", chest: "Empty", arms: "Empty", leggings: "Empty", boots: "Empty", amulet: "Empty", ring: "Empty", weapon: "Empty", focus: "N/A", ammo: "N/A" }},
    aerith: { name: "AERITH", class: "magic", atk: 32, def: 45, equipment: { helmet: "Empty", chest: "Empty", arms: "Empty", leggings: "Empty", boots: "Empty", amulet: "Empty", ring: "Empty", weapon: "N/A", focus: "Empty", ammo: "N/A" }}
};
const tabConfigs = { one: "WEAPONS", two: "SCROLLS", three: "ARMOR", four: "KEY ITEMS" };
let currentCharacterId = "cloud", selectedInventoryRow = null;

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

// World Matrix Map Array Setup
// 0 = Walkable, 1 = Solid Wall, 2 = Random Encounter Tall Grass, 3 = Boss Block Area
const currentMap = [,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
 ,
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
            triggerDialogue("SEPHIROTH: 'So... you have arrived at last, Cloud.'");
            return;
        }

        // Standard Walkable verification limits
        if (destinationTile !== 1) {
            player.x = targetX;
            player.y = targetY;

            // Random Battle roll trigger if walking inside deep tall grass cells
            if (destinationTile === 2) {
                if (Math.random() < 0.12) { // 12% odds per motion step
                    console.log("Random Battle Triggered! (System placeholder)");
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

    const key = e.key.toLowerCase();

    // Close Dialogue boxes on active confirmation presses
    if (gameMode === "dialogue") {
        if (key === "enter" || key === " " || key === "e") closeDialogue();
        return;
    }

    // Tab Navigation toggles
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

    // Directional control routing hooks
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
