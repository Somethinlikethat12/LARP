const arena = document.getElementById("arena");
const playerEl = document.getElementById("player");
const hpValue = document.getElementById("hp-value");
const scoreValue = document.getElementById("score-value");
const waveValue = document.getElementById("wave-value");
const abilityValue = document.getElementById("ability-value");
const bestValue = document.getElementById("best-value");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const startButton = document.getElementById("start-button");

const keys = new Set();
const enemies = [];
const bullets = [];
const particles = [];

const state = {
  started: false,
  gameOver: false,
  score: 0,
  wave: 1,
  best: Number(localStorage.getItem("tung-best") || 0),
  hp: 100,
  timer: 0,
  spawnTimer: 0,
  healCooldown: 0,
  lastTimestamp: 0,
  player: {
    x: 0,
    y: 0,
    radius: 18,
    speed: 260,
    facing: 1,
    attackCooldown: 0,
    dashCooldown: 0,
    invuln: 0,
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function updateHud() {
  hpValue.textContent = String(Math.max(0, state.hp));
  scoreValue.textContent = String(state.score);
  waveValue.textContent = String(state.wave);
  abilityValue.textContent = state.healCooldown > 0 ? `${state.healCooldown.toFixed(1)}s` : "Ready";
  bestValue.textContent = String(state.best);
}

function resetGame() {
  state.started = true;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.hp = 100;
  state.timer = 0;
  state.spawnTimer = 0;
  state.healCooldown = 0;
  state.player.x = arena.clientWidth / 2;
  state.player.y = arena.clientHeight / 2;
  state.player.attackCooldown = 0;
  state.player.dashCooldown = 0;
  state.player.invuln = 0;
  state.player.facing = 1;

  for (const enemy of enemies) {
    enemy.element.remove();
  }
  for (const bullet of bullets) {
    bullet.element.remove();
  }
  for (const particle of particles) {
    particle.element.remove();
  }
  enemies.length = 0;
  bullets.length = 0;
  particles.length = 0;

  spawnWave(4);
  updateHud();
  overlay.classList.add("hidden");
}

function setPlayerPosition() {
  const x = clamp(state.player.x, 22, arena.clientWidth - 22);
  const y = clamp(state.player.y, 20, arena.clientHeight - 20);
  state.player.x = x;
  state.player.y = y;
  playerEl.style.left = `${x}px`;
  playerEl.style.top = `${y}px`;
}

function createParticle(x, y, color) {
  const el = document.createElement("div");
  el.className = "splash";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.background = color;
  arena.appendChild(el);

  particles.push({
    element: el,
    x,
    y,
    vx: randomBetween(-60, 60),
    vy: randomBetween(-60, 60),
    life: 0.4,
  });
}

function spawnEnemy(kind = "scout") {
  const sizeByType = {
    scout: { radius: 18, hp: 28, speed: 92, shotCooldown: 0 },
    chaser: { radius: 20, hp: 42, speed: 108, shotCooldown: 0 },
    turret: { radius: 24, hp: 52, speed: 0, shotCooldown: 1.5 },
  };

  const template = sizeByType[kind] || sizeByType.scout;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomBetween(-20, arena.clientWidth + 20);
    y = -40;
  } else if (side === 1) {
    x = arena.clientWidth + 40;
    y = randomBetween(-20, arena.clientHeight + 20);
  } else if (side === 2) {
    x = randomBetween(-20, arena.clientWidth + 20);
    y = arena.clientHeight + 40;
  } else {
    x = -40;
    y = randomBetween(-20, arena.clientHeight + 20);
  }

  const el = document.createElement("div");
  el.className = `enemy ${kind}`;
  el.style.width = `${template.radius * 2}px`;
  el.style.height = `${template.radius * 2}px`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  arena.appendChild(el);

  enemies.push({
    type: kind,
    x,
    y,
    radius: template.radius,
    hp: template.hp + (state.wave - 1) * 6,
    maxHp: template.hp + (state.wave - 1) * 6,
    speed: template.speed + state.wave * 8,
    shotCooldown: template.shotCooldown,
    dirX: Math.random() > 0.5 ? 1 : -1,
    dirY: Math.random() > 0.5 ? 1 : -1,
    flipTimer: randomBetween(0.8, 2.4),
    element: el,
    hitFlash: 0,
  });
}

function spawnWave(size) {
  for (let i = 0; i < size; i += 1) {
    const asTurret = i === 0 && state.wave > 1 && Math.random() > 0.7;
    const kind = asTurret ? "turret" : Math.random() > 0.72 ? "chaser" : "scout";
    spawnEnemy(kind);
  }
}

function spawnEnemyBullet(enemy) {
  const dirX = state.player.x - enemy.x;
  const dirY = state.player.y - enemy.y;
  const length = Math.hypot(dirX, dirY) || 1;

  const el = document.createElement("div");
  el.className = "bullet";
  el.style.left = `${enemy.x}px`;
  el.style.top = `${enemy.y}px`;
  arena.appendChild(el);

  bullets.push({
    element: el,
    x: enemy.x,
    y: enemy.y,
    vx: (dirX / length) * 180,
    vy: (dirY / length) * 180,
    owner: "enemy",
  });
}

function performAttack() {
  if (!state.started || state.gameOver || state.player.attackCooldown > 0 || enemies.length === 0) {
    return;
  }

  state.player.attackCooldown = 0.35;

  let target = enemies[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      target = enemy;
    }
  }

  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const length = Math.hypot(dx, dy) || 1;

  const projectile = document.createElement("div");
  projectile.className = "slash";
  projectile.style.left = `${state.player.x - 16}px`;
  projectile.style.top = `${state.player.y - 16}px`;
  projectile.style.width = "32px";
  projectile.style.height = "32px";
  projectile.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  arena.appendChild(projectile);

  bullets.push({
    element: projectile,
    x: state.player.x,
    y: state.player.y,
    vx: (dx / length) * 360,
    vy: (dy / length) * 360,
    owner: "player",
    damage: 28,
  });
}

function dashPlayer() {
  if (!state.started || state.gameOver || state.player.dashCooldown > 0) {
    return;
  }

  let dx = 0;
  let dy = 0;

  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;

  if (dx === 0 && dy === 0) {
    dx = state.player.facing;
  }

  const length = Math.hypot(dx, dy) || 1;
  state.player.x = clamp(state.player.x + (dx / length) * 90, 22, arena.clientWidth - 22);
  state.player.y = clamp(state.player.y + (dy / length) * 90, 20, arena.clientHeight - 20);
  state.player.dashCooldown = 0.9;
  state.player.invuln = 0.25;
  setPlayerPosition();
}

function takeDamage(amount) {
  if (state.player.invuln > 0 || state.gameOver) {
    return;
  }

  state.hp = Math.max(0, state.hp - amount);
  state.player.invuln = 0.75;
  playerEl.style.filter = "brightness(2)";

  if (state.hp <= 0) {
    state.gameOver = true;
    state.started = false;
    overlayTitle.textContent = "Run Over";
    overlayCopy.textContent = `You reached ${state.score} points. Press R or use the button below to start again.`;
    startButton.textContent = "Retry";
    overlay.classList.remove("hidden");
  }

  updateHud();
}

function useHeal() {
  if (!state.started || state.gameOver || state.healCooldown > 0 || state.hp >= 100) {
    return;
  }

  state.hp = clamp(state.hp + 25, 0, 100);
  state.healCooldown = 6;
  createParticle(state.player.x, state.player.y, "rgba(52, 211, 153, 0.9)");
  updateHud();
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;

  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const dist = Math.hypot(dx, dy) || 1;
    state.player.x += (dx / dist) * state.player.speed * dt;
    state.player.y += (dy / dist) * state.player.speed * dt;
    state.player.facing = dx >= 0 ? 1 : -1;
  }

  if (state.player.attackCooldown > 0) {
    state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
  }
  if (state.player.dashCooldown > 0) {
    state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
  }
  if (state.healCooldown > 0) {
    state.healCooldown = Math.max(0, state.healCooldown - dt);
  }
  if (state.player.invuln > 0) {
    state.player.invuln = Math.max(0, state.player.invuln - dt);
    if (state.player.invuln === 0) {
      playerEl.style.filter = "none";
    }
  }

  setPlayerPosition();
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (enemy.type === "scout") {
      enemy.x += (dx / dist) * enemy.speed * dt * 0.65;
      enemy.y += (dy / dist) * enemy.speed * dt * 0.65;
    }

    if (enemy.type === "chaser") {
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    }

    if (enemy.type === "turret") {
      enemy.flipTimer -= dt;
      const angle = Math.atan2(dy, dx);
      enemy.element.style.transform = `rotate(${angle}rad)`;
      enemy.shotCooldown -= dt;

      if (enemy.shotCooldown <= 0) {
        enemy.shotCooldown = Math.max(0.7, 1.7 - state.wave * 0.1);
        spawnEnemyBullet(enemy);
      }
    }

    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.element.style.opacity = enemy.hitFlash > 0 ? "0.7" : "1";
    enemy.element.style.left = `${enemy.x}px`;
    enemy.element.style.top = `${enemy.y}px`;

    const playerDist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (playerDist < enemy.radius + state.player.radius + 2) {
      takeDamage(8);
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.element.style.left = `${bullet.x}px`;
    bullet.element.style.top = `${bullet.y}px`;

    const distToPlayer = Math.hypot(bullet.x - state.player.x, bullet.y - state.player.y);
    if (bullet.owner === "enemy" && distToPlayer < state.player.radius + 6) {
      takeDamage(10);
      bullet.element.remove();
      bullets.splice(i, 1);
      continue;
    }

    if (bullet.owner === "player") {
      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const enemy = enemies[j];
        const enemyDist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
        if (enemyDist < enemy.radius + 10) {
          enemy.hp -= 18;
          enemy.hitFlash = 0.12;
          createParticle(bullet.x, bullet.y, "rgba(52, 211, 153, 0.75)");
          bullet.element.remove();
          bullets.splice(i, 1);

          if (enemy.hp <= 0) {
            enemy.element.remove();
            enemies.splice(j, 1);
            state.score += 10;
            if (state.score > state.best) {
              state.best = state.score;
              localStorage.setItem("tung-best", String(state.best));
            }
          }
          break;
        }
      }
    }

    if (bullet.x < -30 || bullet.x > arena.clientWidth + 30 || bullet.y < -30 || bullet.y > arena.clientHeight + 30) {
      bullet.element.remove();
      bullets.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.element.style.left = `${particle.x}px`;
    particle.element.style.top = `${particle.y}px`;
    particle.element.style.opacity = String(Math.max(0, particle.life * 2));

    if (particle.life <= 0) {
      particle.element.remove();
      particles.splice(i, 1);
    }
  }
}

function updateGame(dt) {
  if (!state.started || state.gameOver) {
    return;
  }

  state.timer += dt;
  state.spawnTimer += dt;

  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateParticles(dt);

  if (state.spawnTimer > Math.max(1.1, 2.2 - state.wave * 0.12)) {
    state.spawnTimer = 0;
    const kindRoll = Math.random();
    const kind = kindRoll > 0.8 ? "chaser" : kindRoll > 0.55 ? "turret" : "scout";
    spawnEnemy(kind);
  }

  if (state.score >= state.wave * 50) {
    state.wave += 1;
    spawnWave(Math.min(5, state.wave + 1));
  }

  updateHud();
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - state.lastTimestamp) / 1000 || 0.016, 0.028);
  state.lastTimestamp = timestamp;
  updateGame(dt);
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const keysToBlock = [
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyS",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
    "ShiftLeft",
    "ShiftRight",
  ];

  if (keysToBlock.includes(event.code)) {
    event.preventDefault();
  }

  keys.add(event.code);

  if (event.code === "Space" && !state.started && !state.gameOver) {
    resetGame();
    return;
  }

  if (event.code === "Space") {
    performAttack();
  }

  if (event.code === "KeyE") {
    useHeal();
  }

  if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
    dashPlayer();
  }

  if (event.code === "KeyR" && (!state.started || state.gameOver)) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", () => {
  state.player.x = clamp(state.player.x, 24, arena.clientWidth - 24);
  state.player.y = clamp(state.player.y, 24, arena.clientHeight - 24);
  setPlayerPosition();
});

startButton.addEventListener("click", () => {
  resetGame();
});

updateHud();
setPlayerPosition();
state.player.x = arena.clientWidth / 2;
state.player.y = arena.clientHeight / 2;
setPlayerPosition();
requestAnimationFrame(gameLoop);
