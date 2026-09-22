const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySubtitle = document.getElementById('overlaySubtitle');
const startButton = document.getElementById('startButton');
const healthValue = document.getElementById('healthValue');
const waveValue = document.getElementById('waveValue');
const scoreValue = document.getElementById('scoreValue');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const keys = {};
const enemies = [];
const projectiles = [];

function loadSprite(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const sprites = {
  player: loadSprite('player.png'),
  walker: loadSprite('enemy.png'),
  chaser: loadSprite('tracker.png'),
  shooter: loadSprite('turret.png'),
  projectile: loadSprite('laser.png'),
  slash: loadSprite('tung.png')
};

let lastTime = 0;
let state = 'menu';
let wave = 1;
let score = 0;
let spawnTimer = 0;
let worldPulse = 0;

const player = {
  x: WIDTH * 0.5,
  y: HEIGHT * 0.5,
  radius: 18,
  speed: 240,
  hp: 100,
  maxHp: 100,
  invuln: 0,
  attackCooldown: 0,
  attackTimer: 0,
  facingX: 1,
  facingY: 0,
  flash: 0
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resetGame() {
  player.x = WIDTH * 0.5;
  player.y = HEIGHT * 0.5;
  player.hp = player.maxHp;
  player.invuln = 0;
  player.attackCooldown = 0;
  player.attackTimer = 0;
  player.facingX = 1;
  player.facingY = 0;
  player.flash = 0;

  score = 0;
  wave = 1;
  spawnTimer = 0;
  worldPulse = 0;
  enemies.length = 0;
  projectiles.length = 0;

  healthValue.textContent = String(player.hp);
  waveValue.textContent = String(wave);
  scoreValue.textContent = String(score);
}

function startGame() {
  resetGame();
  state = 'playing';
  overlay.classList.remove('visible');
}

function endGame() {
  state = 'gameover';
  overlayTitle.textContent = 'Game Over';
  overlaySubtitle.textContent = `You reached ${score} points. Press the button below to jump back in.`;
  startButton.textContent = 'Restart';
  overlay.classList.add('visible');
}

function setAttackDirection() {
  const dx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const dy = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);

  if (dx !== 0 || dy !== 0) {
    const mag = Math.hypot(dx, dy) || 1;
    player.facingX = dx / mag;
    player.facingY = dy / mag;
  }
}

function triggerAttack() {
  if (state !== 'playing' || player.attackCooldown > 0) return;

  player.attackCooldown = 0.32;
  player.attackTimer = 0.16;

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dot = (dx / dist) * player.facingX + (dy / dist) * player.facingY;

    if (dist < enemy.radius + player.radius + 24 && dot > -0.25) {
      enemy.hp -= 2;
      enemy.flash = 0.18;
      if (enemy.hp <= 0) {
        score += enemy.value;
        scoreValue.textContent = String(score);
      }
    }
  }
}

function takeDamage(amount) {
  if (player.invuln > 0 || state !== 'playing') return;

  player.hp = Math.max(0, player.hp - amount);
  player.invuln = 0.7;
  player.flash = 0.3;
  healthValue.textContent = String(player.hp);

  if (player.hp <= 0) {
    endGame();
  }
}

function spawnEnemy(type) {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = Math.random() * WIDTH;
    y = -30;
  } else if (side === 1) {
    x = WIDTH + 30;
    y = Math.random() * HEIGHT;
  } else if (side === 2) {
    x = Math.random() * WIDTH;
    y = HEIGHT + 30;
  } else {
    x = -30;
    y = Math.random() * HEIGHT;
  }

  const profile = {
    walker: { radius: 16, speed: 68, hp: 3, value: 15, color: '#ff6b6b' },
    chaser: { radius: 18, speed: 88, hp: 5, value: 28, color: '#8d7dff' },
    shooter: { radius: 20, speed: 54, hp: 6, value: 40, color: '#ffd166' }
  }[type];

  enemies.push({
    x,
    y,
    radius: profile.radius,
    speed: profile.speed + wave * 4,
    hp: profile.hp + Math.floor(wave / 2),
    maxHp: profile.hp + Math.floor(wave / 2),
    value: profile.value,
    color: profile.color,
    type,
    shootCooldown: 0.8 + Math.random() * 1.2,
    orbit: Math.random() * Math.PI * 2,
    flash: 0
  });
}

function fireProjectile(enemy) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  projectiles.push({
    x: enemy.x,
    y: enemy.y,
    radius: 6,
    vx: (dx / dist) * 250,
    vy: (dy / dist) * 250,
    color: '#ff7ad9'
  });
}

function updatePlayer(dt) {
  let moveX = 0;
  let moveY = 0;

  if (keys.ArrowLeft || keys.a) moveX -= 1;
  if (keys.ArrowRight || keys.d) moveX += 1;
  if (keys.ArrowUp || keys.w) moveY -= 1;
  if (keys.ArrowDown || keys.s) moveY += 1;

  if (moveX !== 0 || moveY !== 0) {
    const mag = Math.hypot(moveX, moveY) || 1;
    moveX /= mag;
    moveY /= mag;
    setAttackDirection();
  }

  player.x += moveX * player.speed * dt;
  player.y += moveY * player.speed * dt;
  player.x = clamp(player.x, 24, WIDTH - 24);
  player.y = clamp(player.y, 24, HEIGHT - 24);

  player.invuln = Math.max(0, player.invuln - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  player.flash = Math.max(0, player.flash - dt);
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.orbit += dt * 2.2;

    if (enemy.type === 'walker') {
      enemy.x += (dx / dist) * enemy.speed * dt * 0.6;
      enemy.y += (dy / dist) * enemy.speed * dt * 0.6;
      enemy.x += Math.cos(enemy.orbit) * 18 * dt;
      enemy.y += Math.sin(enemy.orbit) * 18 * dt;
    } else if (enemy.type === 'chaser') {
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    } else if (enemy.type === 'shooter') {
      const retreat = dist < 220 ? -1 : 1;
      enemy.x += (dx / dist) * enemy.speed * dt * retreat * 0.7;
      enemy.y += (dy / dist) * enemy.speed * dt * retreat * 0.7;
      enemy.shootCooldown -= dt;

      if (dist < 420 && enemy.shootCooldown <= 0) {
        fireProjectile(enemy);
        enemy.shootCooldown = 1.2;
      }
    }

    if (dist < enemy.radius + player.radius + 2) {
      takeDamage(12);
    }

    if (enemy.hp <= 0) {
      enemies.splice(i, 1);
      continue;
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const bullet = projectiles[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
    if (dist < bullet.radius + player.radius) {
      takeDamage(10);
      projectiles.splice(i, 1);
      continue;
    }

    if (bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < -20 || bullet.y > HEIGHT + 20) {
      projectiles.splice(i, 1);
    }
  }
}

function updateWave(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const typeRoll = Math.random();
    let type = 'walker';

    if (typeRoll > 0.76) type = 'chaser';
    if (typeRoll > 0.9) type = 'shooter';

    spawnEnemy(type);
    spawnTimer = Math.max(0.45, 1.15 - wave * 0.06) + Math.random() * 0.4;
  }

  if (score > wave * 110) {
    wave += 1;
    waveValue.textContent = String(wave);
  }
}

function drawBackground() {
  ctx.fillStyle = '#08131d';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(114, 238, 255, 0.18)';
  for (let x = 0; x < WIDTH; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  const glow = 0.1 + Math.sin(worldPulse) * 0.05;
  ctx.fillStyle = `rgba(114, 238, 255, ${glow})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (sprites.player.complete !== false && sprites.player.width > 0) {
    const size = player.radius * 2 + 26;
    ctx.drawImage(sprites.player, -size / 2, -size / 2, size, size);
  } else {
    const color = player.flash > 0 ? '#ffffff' : '#72eeff';
    ctx.fillStyle = '#1a2f4a';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const hitX = player.facingX * 18;
  const hitY = player.facingY * 18;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hitX, hitY);
  ctx.stroke();

  if (player.attackTimer > 0) {
    const slashX = player.facingX * 36;
    const slashY = player.facingY * 36;
    const angle = Math.atan2(player.facingY, player.facingX);
    ctx.save();
    ctx.translate(slashX, slashY);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.9;
    if (sprites.slash.complete !== false && sprites.slash.width > 0) {
      ctx.drawImage(sprites.slash, -28, -26, 56, 52);
    } else {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, -0.6, 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    const sprite = enemy.type === 'walker' ? sprites.walker : enemy.type === 'chaser' ? sprites.chaser : sprites.shooter;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    if (sprite && sprite.complete !== false && sprite.width > 0) {
      const size = enemy.radius * 2 + 18;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(-enemy.radius, -enemy.radius - 12, enemy.radius * 2, 5);
    ctx.fillStyle = '#a3ffcc';
    ctx.fillRect(-enemy.radius, -enemy.radius - 12, (enemy.hp / enemy.maxHp) * enemy.radius * 2, 5);

    ctx.restore();
  }
}

function drawProjectiles() {
  for (const bullet of projectiles) {
    if (sprites.projectile && sprites.projectile.complete !== false && sprites.projectile.width > 0) {
      ctx.drawImage(sprites.projectile, bullet.x - 12, bullet.y - 12, 24, 24);
    } else {
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHudStatus() {
  const hpRatio = player.hp / player.maxHp;
  const barWidth = 240;
  const barX = WIDTH - barWidth - 30;
  const barY = 28;

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(barX, barY, barWidth, 20);
  ctx.fillStyle = hpRatio > 0.5 ? '#8af1b5' : hpRatio > 0.2 ? '#ffd166' : '#ff5c7a';
  ctx.fillRect(barX, barY, barWidth * hpRatio, 20);
  ctx.strokeStyle = 'rgba(114, 238, 255, 0.5)';
  ctx.strokeRect(barX, barY, barWidth, 20);
}

function draw() {
  drawBackground();

  if (state === 'playing' || state === 'gameover') {
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawHudStatus();
  } else {
    ctx.fillStyle = '#72eeff';
    ctx.font = 'bold 52px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('TUNG TUNG ARENA', WIDTH / 2, HEIGHT * 0.38);
    ctx.font = '22px Segoe UI';
    ctx.fillStyle = '#edf8ff';
    ctx.fillText('WASD to move • Space to slash • Survive the swarm', WIDTH / 2, HEIGHT * 0.46);

    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT * 0.62, 42, 0, Math.PI * 2);
    ctx.fillStyle = '#72eeff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 16, HEIGHT * 0.62 - 12);
    ctx.lineTo(WIDTH / 2 + 16, HEIGHT * 0.62);
    ctx.lineTo(WIDTH / 2 - 16, HEIGHT * 0.62 + 12);
    ctx.fillStyle = '#08131d';
    ctx.fill();
  }
}

function update(dt) {
  worldPulse += dt * 2;

  if (state !== 'playing') return;

  updatePlayer(dt);
  updateWave(dt);
  updateEnemies(dt);
  updateProjectiles(dt);

  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      score += enemy.value;
      scoreValue.textContent = String(score);
    }
  }

  healthValue.textContent = String(player.hp);
  scoreValue.textContent = String(score);
}

function tick(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.03);
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(tick);
}

window.addEventListener('keydown', function (event) {
  const key = event.key.toLowerCase();
  keys[event.key] = true;
  keys[key] = true;

  if (event.code === 'Space') {
    event.preventDefault();
    if (state === 'playing') {
      triggerAttack();
    }
  }

  if (event.key.toLowerCase() === 'r' && state === 'gameover') {
    startGame();
  }
});

window.addEventListener('keyup', function (event) {
  const key = event.key.toLowerCase();
  keys[event.key] = false;
  keys[key] = false;
});

startButton.addEventListener('click', function () {
  if (state === 'menu' || state === 'gameover') {
    startGame();
  }
});

resetGame();
overlayTitle.textContent = 'Tung Tung Arena';
overlaySubtitle.textContent = 'Move with WASD, slash with Space, and survive the endless swarm.';
startButton.textContent = 'Start Game';
requestAnimationFrame(tick);
