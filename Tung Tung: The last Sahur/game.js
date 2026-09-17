const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- IMAGE PRELOADING ---
const sprites = {
    player: new Image(),
    tungTungClan: new Image(),
    angelTung: new Image(),
    evilTung: new Image(),
    devilTung: new Image()
};

sprites.player.src = 'player.png';
sprites.tungTungClan.src = 'tungtungtung.png';
sprites.angelTung.src = 'angel Tung.png';
sprites.evilTung.src = 'eviltung.png';
sprites.devilTung.src = 'devil Tung.png';

// --- SIDE-SCROLLER PHYSICS ENGINE ---
const GRAVITY = 0.5;
const FLOOR_Y = 370; // Pixel line where the ground sits

const player = {
    x: 100,
    y: 200,
    width: 50,
    height: 60,
    velocityX: 0,
    velocityY: 0,
    speed: 5,
    jumpForce: -12,
    isGrounded: false
};

// --- SIMPLIFIED PLATFORMS & ENTITIES ---
// Simple bounding boxes representing flat surfaces to step on
const platforms = [
    { x: 0, y: FLOOR_Y, width: 1200, height: 80 }, // Main Floor
    { x: 300, y: 260, width: 200, height: 20 },   // Floating ledge
    { x: 600, y: 180, width: 150, height: 20 }    // Higher ledge
];

// World objects populated with your specific clan images
const entities = [
    { x: 200, y: FLOOR_Y - 50, w: 50, h: 50, type: 'angel', img: sprites.angelTung },
    { x: 400, y: 210, w: 50, h: 50, type: 'tungtung', img: sprites.tungTungClan },
    { x: 650, y: 130, w: 50, h: 50, type: 'enemy', img: sprites.evilTung },
    { x: 950, y: FLOOR_Y - 70, w: 70, h: 70, type: 'boss', img: sprites.devilTung }
];

const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

function update() {
    // 1. Horizontal Movement
    player.velocityX = 0;
    if (keys["ArrowLeft"] || keys["a"]) player.velocityX = -player.speed;
    if (keys["ArrowRight"] || keys["d"]) player.velocityX = player.speed;

    // 2. Jumping Input
    if ((keys["ArrowUp"] || keys["w"] || keys[" "]) && player.isGrounded) {
        player.velocityY = player.jumpForce;
        player.isGrounded = false;
    }

    // 3. Apply Gravity
    player.velocityY += GRAVITY;

    // 4. Update Positions
    player.x += player.velocityX;
    player.y += player.velocityY;

    // 5. Hard Boundaries & Platform Collisions
    player.isGrounded = false;
    for (let plat of platforms) {
        // Check if player is falling down into the top surface of a platform
        if (player.x + player.width > plat.x &&
            player.x < plat.x + plat.width &&
            player.y + player.height >= plat.y &&
            player.y + player.height - player.velocityY <= plat.y) {
            
            player.y = plat.y - player.height;
            player.velocityY = 0;
            player.isGrounded = true;
        }
    }

    // Lock boundaries to prevent walking backward past the start
    if (player.x < 0) player.x = 0;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- CAMERA SYSTEM (SIDE SCROLLER TRACKING) ---
    // Camera shifts left as the player runs right
    let cameraX = 300 - player.x;
    if (cameraX > 0) cameraX = 0; // Lock at starting screen boundary

    ctx.save();
    ctx.translate(cameraX, 0); // Everything drawn inside this block shifts dynamically!

    // 1. Draw Platforms / Ground
    ctx.fillStyle = "#1c2331";
    for (let plat of platforms) {
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.strokeStyle = "#45a29e";
        ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
    }

    // 2. Draw Clan Entities and Enemies
    for (let ent of entities) {
        if (ent.img.complete && ent.img.width > 0) {
            ctx.drawImage(ent.img, ent.x, ent.y, ent.w, ent.h);
        } else {
            // Fallback colorful blocks if image fails to render
            ctx.fillStyle = ent.type === 'enemy' ? '#ff0055' : '#66fcf1';
            ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
        }
    }

    // 3. Draw Player Character (The Chosen Sahur)
    if (sprites.player.complete && sprites.player.width > 0) {
        ctx.drawImage(sprites.player, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = "#e0a96d"; // Ash Gold block fallback
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    ctx.restore(); // Reset translation context for fixed UI elements
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
