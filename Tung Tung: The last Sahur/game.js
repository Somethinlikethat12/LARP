const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Grid settings
const TILE_SIZE = 50; // Each map square is 50x50 pixels
const COLS = 16;
const ROWS = 12;

// Map Blueprint: 0 = Grass/Path, 1 = Wall, 2 = Sahur Fire (Safe zone/Danger)
const map = [,
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
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Player Setup (Starting as the new Sahur)
const player = {
    x: 1 * TILE_SIZE, // Start at tile column 1
    y: 1 * TILE_SIZE, // Start at tile row 1
    size: TILE_SIZE - 10,
    speed: 4,
    color: "#e0a96d" // Pale gold/ash color for the chosen Sahur
};

const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// Check if a specific pixel position collides with a Wall (1)
function isColliding(x, y) {
    // Check all 4 corners of the player's square bounding box
    const corners = [
        { x: x, y: y },
        { x: x + player.size, y: y },
        { x: x, y: y + player.size },
        { x: x + player.size, y: y + player.size }
    ];

    for (let corner of corners) {
        let tileX = Math.floor(corner.x / TILE_SIZE);
        let tileY = Math.floor(corner.y / TILE_SIZE);
        
        // Out of bounds checking
        if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return true;
        // Wall checking
        if (map[tileY][tileX] === 1) return true;
    }
    return false;
}

function update() {
    let nextX = player.x;
    let nextY = player.y;

    if (keys["ArrowUp"] || keys["w"]) nextY -= player.speed;
    if (keys["ArrowDown"] || keys["s"]) nextY += player.speed;
    if (keys["ArrowLeft"] || keys["a"]) nextX -= player.speed;
    if (keys["ArrowRight"] || keys["d"]) nextX += player.speed;

    // Only move if the next position doesn't collide with a wall
    if (!isColliding(nextX, player.y)) player.x = nextX;
    if (!isColliding(player.x, nextY)) player.y = nextY;

    // Interact with special grid events (like tile 2)
    checkTileEvents();
}

function checkTileEvents() {
    let currentTileX = Math.floor((player.x + player.size/2) / TILE_SIZE);
    let currentTileY = Math.floor((player.y + player.size/2) / TILE_SIZE);

    if (map[currentTileY][currentTileX] === 2) {
        // Example event: A resting place or text prompt
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px monospace";
        ctx.fillText("SAHUR BONFIRE RESTORED", 20, 40);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the Grid Map
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (map[r][c] === 1) {
                ctx.fillStyle = "#1a1a24"; // Dark Souls-style solid brick/rubble
            } else if (map[r][c] === 2) {
                ctx.fillStyle = "#ff6a00"; // Blazing orange Sahur spark tile
            } else {
                ctx.fillStyle = "#2c302e"; // Desolate, ash-covered ground path
            }
            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            
            // Subtle tile grid outlines
            ctx.strokeStyle = "#222";
            ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    // Draw the Player (The new Sahur)
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.size, player.size);
    
    // Draw a subtle "glow" on the player
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(player.x, player.y, player.size, player.size);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
