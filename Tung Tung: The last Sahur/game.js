const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 50;
const COLS = 16;
const ROWS = 12;

// --- GAME STATE ---
let gameState = {
    clarity: 100, // Our PG version of Sanity
    cluesFound: 0,
    inDialogue: false
};

// 0 = Walkable, 1 = Dense Woods/Wall, 3 = Angel Tung NPC, 4 = Corrupted Object
const map = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,1,1,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,1,0,1,4,0,1],
    [1,0,1,1,1,1,1,0,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,3,1,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,1,1,1,1,0,1,0,1],
    [1,0,1,4,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,0,0,0,1,0,1,0,1,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const player = {
    x: TILE_SIZE * 1,
    y: TILE_SIZE * 1,
    size: TILE_SIZE - 10,
    speed: 4
};

const keys = {};
window.addEventListener("keydown", e => { if(!gameState.inDialogue) keys[e.key] = true; });
window.addEventListener("keyup", e => keys[e.key] = false);

// --- COLLISION ENGINE ---
function isSolid(x, y) {
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    
    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return true;
    
    // Custom interaction checks (Stepping on dynamic elements)
    let tileType = map[tileY][tileX];
    if (tileType === 1) return true; // Direct solid block
    return false;
}

function checkCollision(nextX, nextY) {
    return isSolid(nextX, nextY) || 
           isSolid(nextX + player.size, nextY) || 
           isSolid(nextX, nextY + player.size) || 
           isSolid(nextX + player.size, nextY + player.size);
}

// --- JRPG INTERACTION SYSTEM (Action Key: 'e') ---
window.addEventListener("keydown", e => {
    if (e.key === "e" || e.key === "E") {
        if (gameState.inDialogue) {
            closeTextbox();
            return;
        }

        // Check tiles right in front of the center of player
        let centerX = Math.floor((player.x + player.size/2) / TILE_SIZE);
        let centerY = Math.floor((player.y + player.size/2) / TILE_SIZE);

        // Check adjacent tiles for interactables
        checkInteract(centerX, centerY);
        checkInteract(centerX + 1, centerY);
        checkInteract(centerX - 1, centerY);
        checkInteract(centerX, centerY + 1);
        checkInteract(centerX, centerY - 1);
    }
});

function checkInteract(tx, ty) {
    if(tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;
    
    let target = map[ty][tx];

    if (target === 3) { // Angel Tung NPC
        triggerDialogue("Angel Tung Elder", "Young Sahur... Devil Tung has distorted the memories of the world. Find the lost dream tokens to restore balance!");
    } 
    else if (target === 4) { // Corrupted Dream Object
        triggerDialogue("Distorted Memory", "You look at the strange relic. A dark whispers cloud your mind... Your clarity drops, but you find a missing timeline fragment!");
        map[ty][tx] = 0; // Remove item after collection
        gameState.cluesFound++;
        updateClarity(-25);
    }
}

// --- UI LOGIC ---
function triggerDialogue(speaker, text) {
    gameState.inDialogue = true;
    // Reset running keys
    for(let k in keys) keys[k] = false;

    document.getElementById("textbox-speaker").innerText = speaker;
    document.getElementById("textbox-text").innerText = text;
    document.getElementById("textbox").classList.remove("hidden");
}

function closeTextbox() {
    gameState.inDialogue = false;
    document.getElementById("textbox").classList.add("hidden");
    
    if (gameState.clarity <= 0) {
        triggerDialogue("GAME OVER", "Your Clarity completely vanished into the dream world. You became a wandering Tung... (Refresh to retry)");
        gameState.inDialogue = true; // Freeze game
    }
}

function updateClarity(amount) {
    gameState.clarity = Math.max(0, Math.min(100, gameState.clarity + amount));
    document.getElementById("sanity-fill").style.width = gameState.clarity + "%";
}

// --- ENGINE UPDATE & LOOP ---
function update() {
    if (gameState.inDialogue) return;

    let nextX = player.x;
    let nextY = player.y;

    if (keys["ArrowUp"] || keys["w"]) nextY -= player.speed;
    if (keys["ArrowDown"] || keys["s"]) nextY += player.speed;
    if (keys["ArrowLeft"] || keys["a"]) nextX -= player.speed;
    if (keys["ArrowRight"] || keys["d"]) nextX += player.speed;

    if (!checkCollision(nextX, player.y)) player.x = nextX;
    if (!checkCollision(player.x, nextY)) player.y = nextY;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (map[r][c] === 1) ctx.fillStyle = "#111625"; // Ominous trees/walls
            else if (map[r][c] === 3) ctx.fillStyle = "#45a29e"; // Teal for Angel Clan
            else if (map[r][c] === 4) ctx.fillStyle = "#ff0055"; // Bright glitch neon for clues
            else ctx.fillStyle = "#1c1d24"; // Regular walking floor
            
            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = "#10131a";
            ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // Draw the New Sahur (Gold block avatar)
    ctx.fillStyle = "#66fcf1";
    ctx.fillRect(player.x, player.y, player.size, player.size);
    
    // Basic text prompt indicator if standing near something
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px sans-serif";
    ctx.fillText("WASD to Move | Press E to Interact", 550, 30);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
