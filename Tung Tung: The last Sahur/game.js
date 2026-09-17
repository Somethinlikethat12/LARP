const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game State
const keys = {};
const player = {
    x: 400,
    y: 300,
    speed: 4,
    size: 32
};

// Listen for keyboard input
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// 1. Update Game Logic
function update() {
    if (keys["ArrowUp"] || keys["w"]) player.y -= player.speed;
    if (keys["ArrowDown"] || keys["s"]) player.y += player.speed;
    if (keys["ArrowLeft"] || keys["a"]) player.x -= player.speed;
    if (keys["ArrowRight"] || keys["d"]) player.x += player.speed;

    // Check for random encounters here later
}

// 2. Render Graphics
function draw() {
    // Clear the screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a placeholder map background (Green grass)
    ctx.fillStyle = "#3a5f0b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the player (Red square placeholder)
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(player.x, player.y, player.size, player.size);
}

// 3. The Core Game Loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
