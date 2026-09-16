// --- CORE GAME STATS & VALUES ---
let HP = 500;
let posX = 0;
let posY = 0;
const speed = 5;

// --- COMBAT CONFIGURATION SETTINGS ---
let isInvincible = false;
const iframeDuration = 1000; // 1 second player i-frame window
let isAttacking = false;
let lastFacingDirection = "right"; // Determines swing trajectory alignment
const HITSTUN_DURATION = 300;     // Mobs freeze for 300ms when clobbered

// --- MASTER ARRAYS FOR SIMULATION ---
const hurtbox = document.getElementById("hurtbox");
const enemies = [];  
const bullets = [];  
const keysPressed = {};

// --- MULTI-KEY COMBINATION INPUT MONITOR ---
window.addEventListener("keydown", (e) => {
  keysPressed[e.keyCode] = true;
  
  if (e.keyCode === 65) lastFacingDirection = "left";  // A (Face Left)
  if (e.keyCode === 68) lastFacingDirection = "right"; // D (Face Right)

  // Spacebar to trigger swing attack
  if (e.keyCode === 32 && !isAttacking) executeAttack();
});

window.addEventListener("keyup", (e) => {
  keysPressed[e.keyCode] = false;
});

function handlePlayerMovement() {
  let moveX = 0;
  let moveY = 0;

  if (keysPressed[65]) moveX -= 1; // A (Left)
  if (keysPressed[68]) moveX += 1; // D (Right)
  if (keysPressed[87]) moveY -= 1; // W (Up)
  if (keysPressed[83]) moveY += 1; // S (Down)

  // Prevent diagonal speed compounding (keeps speed uniformly at 5)
  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071;
    moveY *= 0.7071;
  }

  posX += moveX * speed;
  posY += moveY * speed;

  if (hurtbox) {
    hurtbox.style.left = posX + "px";
    hurtbox.style.top = posY + "px";
  }
}

// --- CREATURE SPAWNING BLUEPRINTS ---
function spawnEnemy(x, topY, startingHp, type) {
  const el = document.createElement("div");
  el.classList.add("enemy-hitbox", type);
  el.style.left = x + "px";
  el.style.top = topY + "px";
  document.body.appendChild(el);
  
  const enemyObj = { 
    element: el,
    hp: startingHp,
    type: type,
    x: x,
    y: topY,
    dirX: Math.random() > 0.5 ? 1 : -1,
    dirY: Math.random() > 0.5 ? 1 : -1,
    lastDirChange: 0,
    isStunned: false,
    stunEndTime: 0
  };

  enemies.push(enemyObj);

  // If this entity is a turret, set up its unique automated shooting interval
  if (type === "turret") {
    setInterval(() => {
      // Only fire if the turret element hasn't been destroyed out of the DOM
      if (document.body.contains(el) && !enemyObj.isStunned) {
        spawnTrackingBullet(enemyObj.x + 30, enemyObj.y + 30);
      }
    }, 1500); // Shoots once every 1.5 seconds
  }
}

function spawnTrackingBullet(startX, startY) {
  const el = document.createElement("div");
  el.classList.add("bullet");
  el.style.left = startX + "px";
  el.style.top = startY + "px";
  document.body.appendChild(el);

  const playerCenterX = posX + 50;
  const playerCenterY = posY + 50;
  
  const deltaX = playerCenterX - startX;
  const deltaY = playerCenterY - startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  const bulletVelocity = 4;
  const speedX = distance > 0 ? (deltaX / distance) * bulletVelocity : -bulletVelocity;
  const speedY = distance > 0 ? (deltaY / distance) * bulletVelocity : 0;

  bullets.push({ element: el, x: startX, y: startY, speedX: speedX, speedY: speedY, isDeflected: false });
}

// --- PLAYER COMBAT ATTACK SYSTEM ---
function executeAttack() {
  isAttacking = true;
  const attackEl = document.createElement("div");
  attackEl.classList.add("player-attack");
  
  if (lastFacingDirection === "right") {
    attackEl.style.left = (posX + 90) + "px";
    attackEl.classList.add("swing-right");
  } else {
    attackEl.style.left = (posX - 70) + "px";
    attackEl.classList.add("swing-left");
  }
  
  attackEl.style.top = (posY - 10) + "px";
  document.body.appendChild(attackEl);

  const attackRect = attackEl.getBoundingClientRect();

  // 1. PROJECTILE DEFLECTION SWEEP
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    const bRect = b.element.getBoundingClientRect();

    if (checkCollision(attackRect, bRect)) {
      b.speedX *= -1.5; // Reflect projectory opposite direction and speed it up
      b.speedY *= -1.5;
      b.element.style.filter = "hue-rotate(120deg)"; // Optional visual change to show it's yours
      b.isDeflected = true; 
    }
  }

  // 2. ENEMY DAMAGE AND HITSTUN SWEEP
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const enemyRect = enemy.element.getBoundingClientRect();
    
    if (checkCollision(attackRect, enemyRect)) {
      enemy.hp -= 50;
      
      // Inflict hitstun freeze parameters
      enemy.isStunned = true;
      enemy.stunEndTime = performance.now() + HITSTUN_DURATION;
      enemy.element.style.opacity = "0.6"; // Dims entity visually to indicate stun state

      // Process target death conditions
      if (enemy.hp <= 0) {
        enemy.element.remove();
        enemies.splice(i, 1);
        console.log("Tung Tung Defeated!");
      }
    }
  }

  // Clean swing visual node away after animation window
  setTimeout(() => {
    attackEl.remove();
    isAttacking = false;
  }, 150);
}

// --- BASE COLLISION UTILITIES ---
function checkCollision(rect1, rect2) {
  return (rect1.right > rect2.left && rect1.left < rect2.right && rect1.bottom > rect2.top && rect1.top < rect2.bottom);
}

function triggerDamage() {
  if (isInvincible) return; // Disregard incoming hits if currently invulnerable
  HP -= 50;
  console.log("Ouch! Angel Tung was hit! " + HP + " HP left");
  
  isInvincible = true;
  if (hurtbox) hurtbox.style.opacity = "0.5";
  
  // Flashing utility loop for aesthetic feedback
  const flashClock = setInterval(() => {
    if (!isInvincible) { 
        clearInterval(flashClock); 
        if (hurtbox) hurtbox.style.opacity = "1.0"; 
        return; 
    }
    if (hurtbox) hurtbox.style.opacity = hurtbox.style.opacity === "0.5" ? "0.2" : "0.5";
  }, 100);

  setTimeout(() => { isInvincible = false; if (hurtbox) hurtbox.style.opacity = "1.0"; }, iframeDuration);
}

// --- INSTANTIATE WORLD SETUP ENEMY MAP ---
spawnEnemy(400, 200, 100, "basic-mob");   // Basic random movement block
spawnEnemy(550, 450, 150, "tracker-mob"); // Stalker tracking block
spawnEnemy(800, 300, 200, "turret");      // 360 Degree rotating turret tank

// --- CORE RUNTIME FRAME PROCESSOR ---
function gameLoop(timestamp) {
  handlePlayerMovement();
  
  if (!hurtbox) {
    requestAnimationFrame(gameLoop);
    return;
  }
  
  const playerRect = hurtbox.getBoundingClientRect();
  const playerCenterX = posX + 50;
  const playerCenterY = posY + 50;

  // 1. Process Projectile Array Lifecycle
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.speedX; b.y += b.speedY;
    b.element.style.left = b.x + "px"; b.element.style.top = b.y + "px";

    const bRect = b.element.getBoundingClientRect();

    // Damage player if bullet belongs to enemy
    if (!b.isDeflected && checkCollision(bRect, playerRect)) {
      triggerDamage(); b.element.remove(); bullets.splice(i, 1); continue;
    }

    // Damage enemies if bullet was deflected by player
    if (b.isDeflected) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (checkCollision(bRect, enemy.element.getBoundingClientRect())) {
          enemy.hp -= 30; 
          b.element.remove();
          bullets.splice(i, 1);
          
          if (enemy.hp <= 0) {
            enemy.element.remove();
            enemies.splice(j, 1);
          }
          break;
        }
      }
      if (!bullets[i] || bullets[i] !== b) continue;
    }

    // Garbage collection out of screen borders
    if (b.x < -50 || b.x > window.innerWidth + 50 || b.y < -50 || b.y > window.innerHeight + 50) {
      b.element.remove(); bullets.splice(i, 1);
    }
  }

  // 2. Process All Active Mob AI States
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];

    // Clear hitstun flag once duration completes
    if (enemy.isStunned && timestamp >= enemy.stunEndTime) {
      enemy.isStunned = false;
      enemy.element.style.opacity = "1.0";
    }

    // Skip all AI updates below if entity is trapped in hitstun
    if (enemy.isStunned) continue;

    // AI Variant: Tank Turret Rotation
    if (enemy.type === "turret") {
      const turretCenterX = enemy.x + 40; 
      const turretCenterY = enemy.y + 40;
      const diffX = playerCenterX - turretCenterX;
      const diffY = playerCenterY - turretCenterY;
      let angleDegrees = Math.atan2(diffY, diffX) * (180 / Math.PI);
      enemy.element.style.transform = `rotate(${angleDegrees}deg)`;
    }

    // AI Variant: Basic Mob Random Bounce Movement
    if (enemy.type === "basic-mob") {
      if (timestamp - enemy.lastDirChange > 1000) {
        if (Math.random() > 0.5) enemy.dirX *= -1;
        if (Math.random() > 0.5) enemy.dirY *= -1;
        enemy.lastDirChange = timestamp;
      }
      enemy.x += enemy.dirX * 1.5; enemy.y += enemy.dirY * 1.5;
      if (enemy.x < 0 || enemy.x > window.innerWidth - 100) enemy.dirX *= -1;
      if (enemy.y < 0 || enemy.y > window.innerHeight - 100) enemy.dirY *= -1;
      enemy.element.style.left = enemy.x + "px"; enemy.element.style.top = enemy.y + "px";
    }

    // AI Variant: Stalker Mob Pathfinding Tracking
    if (enemy.type === "tracker-mob") {
      const dX = posX - enemy.x; const dY = posY - enemy.y;
      const dist = Math.sqrt(dX * dX + dY * dY);
      if (dist > 0) {
        enemy.x += (dX / dist) * 1.2; enemy.y += (dY / dist) * 1.2;
        enemy.element.style.left = enemy.x + "px"; enemy.element.style.top = enemy.y + "px";
      }
    }

    // Touch contact hit damage evaluation
    if (!isInvincible && checkCollision(enemy.element.getBoundingClientRect(), playerRect)) {
      triggerDamage();
    }
  }

  requestAnimationFrame(gameLoop);
}

// Start simulation loop execution
requestAnimationFrame(gameLoop);
