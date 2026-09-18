const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const centerX = canvas.width / 2;
const groundY = 430;

const player = {
  x: centerX,
  y: groundY,
  hp: 100,
  attackTimer: 0,
  parryTimer: 0,
  parryCooldown: 0,
  facing: 1,
  alive: true
};

const duel = {
  wave: 1,
  enemy: null,
  freezeFrames: 0,
  screenShake: 0,
  flashAlpha: 0,
  finisherText: 0,
  sparks: [],
  gameOver: false
};

let last = performance.now();
let accumulator = 0;
const step = 1000 / 60;

canvas.addEventListener("keydown", (event) => {
  if (duel.gameOver && event.key.toLowerCase() === "r") {
    resetGame();
    return;
  }
  if (!player.alive || duel.gameOver) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "j") {
    player.attackTimer = Math.max(player.attackTimer, 16);
  }
  if (key === "k" && player.parryCooldown <= 0) {
    player.parryTimer = 14;
    player.parryCooldown = 16;
  }
});
canvas.addEventListener("pointerdown", () => canvas.focus());

function spawnEnemy() {
  const fromRight = Math.random() > 0.5;
  const startX = fromRight ? canvas.width + 120 : -120;
  const duelOffset = 220 + Math.random() * 40;
  return {
    x: startX,
    y: groundY,
    hp: 100 + (duel.wave - 1) * 12,
    maxHp: 100 + (duel.wave - 1) * 12,
    facing: fromRight ? -1 : 1,
    state: "entering",
    duelX: centerX + (fromRight ? duelOffset : -duelOffset),
    speed: 2 + Math.min(duel.wave * 0.2, 2),
    attackWindup: 0,
    attackActive: 0,
    recover: 20,
    attackTimer: 70,
    stunned: 0,
    dead: false
  };
}

function resetGame() {
  player.hp = 100;
  player.attackTimer = 0;
  player.parryTimer = 0;
  player.parryCooldown = 0;
  player.facing = 1;
  player.alive = true;
  duel.wave = 1;
  duel.enemy = spawnEnemy();
  duel.freezeFrames = 0;
  duel.screenShake = 0;
  duel.flashAlpha = 0;
  duel.finisherText = 0;
  duel.sparks = [];
  duel.gameOver = false;
}

function addSparks(x, y, color, count, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 5) * power;
    duel.sparks.push({
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 18 + Math.random() * 20,
      color
    });
  }
}

function isParryPerfect(enemy) {
  return player.parryTimer > 0 && enemy.attackActive >= 5 && enemy.attackActive <= 8;
}

function isParryLate(enemy) {
  return player.parryTimer > 0 && enemy.attackActive > 0;
}

function doImpact({ heavy = false, finisher = false, x = centerX, y = groundY - 80 }) {
  duel.freezeFrames = finisher ? 18 : heavy ? 10 : 5;
  duel.screenShake = finisher ? 26 : heavy ? 14 : 8;
  duel.flashAlpha = finisher ? 0.95 : heavy ? 0.72 : 0.45;
  addSparks(x, y, finisher ? "#ffe5bd" : "#fef2cf", finisher ? 42 : 24, finisher ? 2.4 : 1.6);
}

function updateEnemy(enemy) {
  if (enemy.dead) {
    return;
  }

  player.facing = enemy.x > player.x ? 1 : -1;
  enemy.facing = player.facing * -1;

  if (enemy.state === "entering") {
    const dx = enemy.duelX - enemy.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), enemy.speed);
    enemy.x += step;
    if (Math.abs(dx) < 1) {
      enemy.state = "dueling";
    }
    return;
  }

  if (enemy.stunned > 0) {
    enemy.stunned -= 1;
    return;
  }

  if (enemy.attackWindup > 0) {
    enemy.attackWindup -= 1;
    if (enemy.attackWindup === 0) {
      enemy.attackActive = 10;
    }
  } else if (enemy.attackActive > 0) {
    enemy.attackActive -= 1;
    if (isParryPerfect(enemy)) {
      enemy.attackActive = 0;
      enemy.stunned = 36;
      doImpact({ heavy: true, x: player.x + player.facing * 65, y: player.y - 90 });
      addSparks(player.x + player.facing * 60, player.y - 96, "#8ef5ff", 20, 1.8);
      return;
    }
    if (enemy.attackActive === 5) {
      if (isParryLate(enemy)) {
        player.hp = Math.max(0, player.hp - 6);
        doImpact({ x: player.x + player.facing * 40, y: player.y - 84 });
      } else {
        player.hp = Math.max(0, player.hp - 16);
        doImpact({ heavy: true, x: player.x + player.facing * 42, y: player.y - 82 });
      }
      if (player.hp <= 0) {
        player.alive = false;
        duel.gameOver = true;
      }
    }
  } else {
    enemy.attackTimer -= 1;
    if (enemy.attackTimer <= 0) {
      enemy.attackWindup = 22;
      enemy.attackTimer = Math.max(42, enemy.recover - duel.wave);
    }
  }
}

function tryPlayerHit(enemy) {
  if (player.attackTimer !== 10 || enemy.dead) {
    return;
  }
  const reach = 100;
  if (Math.abs(enemy.x - player.x) > reach) {
    return;
  }
  const finisher = enemy.hp <= enemy.maxHp * 0.25 && enemy.stunned > 0;
  const damage = finisher ? 999 : enemy.stunned > 0 ? 44 : 18;
  enemy.hp = Math.max(0, enemy.hp - damage);
  doImpact({
    heavy: enemy.stunned > 0,
    finisher,
    x: player.x + player.facing * 85,
    y: player.y - 88
  });
  addSparks(player.x + player.facing * 84, player.y - 95, finisher ? "#ffd2bf" : "#ffedcb", finisher ? 55 : 18, finisher ? 2.8 : 1.35);
  if (finisher) {
    duel.finisherText = 38;
  }
  if (enemy.hp <= 0) {
    enemy.dead = true;
    enemy.state = "defeated";
  }
}

function updateSparks() {
  let writeIndex = 0;
  for (let i = 0; i < duel.sparks.length; i += 1) {
    const spark = duel.sparks[i];
    spark.x += spark.dx;
    spark.y += spark.dy;
    spark.dy += 0.09;
    spark.life -= 1;
    if (spark.life > 0) {
      duel.sparks[writeIndex] = spark;
      writeIndex += 1;
    }
  }
  duel.sparks.length = writeIndex;
}

function update() {
  if (!duel.enemy) {
    duel.enemy = spawnEnemy();
  }

  if (duel.freezeFrames > 0) {
    duel.freezeFrames -= 1;
    duel.flashAlpha *= 0.9;
    duel.screenShake *= 0.85;
    updateSparks();
    return;
  }

  player.attackTimer = Math.max(0, player.attackTimer - 1);
  player.parryTimer = Math.max(0, player.parryTimer - 1);
  player.parryCooldown = Math.max(0, player.parryCooldown - 1);

  updateEnemy(duel.enemy);
  tryPlayerHit(duel.enemy);
  updateSparks();

  duel.flashAlpha *= 0.84;
  duel.screenShake *= 0.82;
  duel.finisherText = Math.max(0, duel.finisherText - 1);

  if (duel.enemy.dead && duel.sparks.length < 8) {
    duel.wave += 1;
    duel.enemy = spawnEnemy();
  }
}

function drawSamurai(x, y, facing, color, stance = "idle") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const slashPose = stance === "slash";
  const parryPose = stance === "parry";

  ctx.fillStyle = color;
  ctx.fillRect(-18, -95, 36, 62);
  ctx.beginPath();
  ctx.arc(0, -112, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c4b08a";
  ctx.fillRect(-24, -34, 18, 36);
  ctx.fillRect(6, -34, 18, 36);

  ctx.fillStyle = "#141419";
  ctx.fillRect(-16, -127, 32, 8);
  ctx.fillRect(-24, -120, 48, 5);

  ctx.strokeStyle = "#f4e5bb";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(10, -70);
  ctx.lineTo(36, slashPose ? -84 : -64);
  ctx.stroke();

  ctx.strokeStyle = "#d8f8ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (parryPose) {
    ctx.moveTo(6, -70);
    ctx.lineTo(56, -102);
  } else if (slashPose) {
    ctx.moveTo(14, -72);
    ctx.lineTo(86, -96);
  } else {
    ctx.moveTo(8, -72);
    ctx.lineTo(56, -78);
  }
  ctx.stroke();

  ctx.restore();
}

function drawGround() {
  ctx.fillStyle = "#2a2a2f";
  ctx.fillRect(0, groundY + 2, canvas.width, canvas.height - groundY);
  ctx.strokeStyle = "#534a3e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 2);
  ctx.lineTo(canvas.width, groundY + 2);
  ctx.stroke();
}

function drawHUD(enemy) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(20, 20, 260, 22);
  ctx.fillRect(canvas.width - 280, 20, 260, 22);

  ctx.fillStyle = "#6f1418";
  ctx.fillRect(24, 24, 252, 14);
  ctx.fillRect(canvas.width - 276, 24, 252, 14);

  ctx.fillStyle = "#d53f4d";
  ctx.fillRect(24, 24, 252 * (player.hp / 100), 14);
  ctx.fillRect(canvas.width - 276, 24, 252 * (enemy.hp / enemy.maxHp), 14);

  ctx.fillStyle = "#f1e4bf";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("PLAYER", 24, 17);
  ctx.fillText(`ENEMY ${duel.wave}`, canvas.width - 188, 17);
}

function drawWorldEffects() {
  for (const spark of duel.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / 28);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x, spark.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function drawOverlayEffects() {
  if (duel.flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255,245,220,${duel.flashAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (duel.finisherText > 0) {
    ctx.globalAlpha = Math.min(1, duel.finisherText / 14);
    ctx.fillStyle = "#ffe4b0";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FINISHING BLOW", canvas.width / 2, 140);
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }

  if (duel.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffdcb8";
    ctx.font = "bold 60px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DEFEATED", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "24px sans-serif";
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 36);
    ctx.textAlign = "start";
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shakeX = (Math.random() - 0.5) * duel.screenShake;
  const shakeY = (Math.random() - 0.5) * duel.screenShake * 0.55;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawGround();
  const enemy = duel.enemy;

  const playerStance = player.parryTimer > 0 ? "parry" : player.attackTimer > 7 ? "slash" : "idle";
  const enemyStance = enemy.attackWindup > 0 ? "slash" : enemy.attackActive > 0 ? "slash" : "idle";

  drawSamurai(player.x, player.y, player.facing, "#8f9fb6", playerStance);
  drawSamurai(enemy.x, enemy.y, enemy.facing, enemy.stunned > 0 ? "#c4d4df" : "#7f5b66", enemyStance);

  if (player.parryTimer > 0) {
    ctx.strokeStyle = "rgba(170,245,255,0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x + player.facing * 34, player.y - 92, 24, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.attackWindup > 0) {
    ctx.strokeStyle = "rgba(255,145,145,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y - 114, 22 + (enemy.attackWindup % 6), 0, Math.PI * 2);
    ctx.stroke();
  }

  drawWorldEffects();
  ctx.restore();

  drawHUD(enemy);
  drawOverlayEffects();
}

function loop(now) {
  const elapsed = Math.min(100, now - last);
  last = now;
  accumulator += elapsed;

  while (accumulator >= step) {
    update();
    accumulator -= step;
  }
  draw();
  requestAnimationFrame(loop);
}

resetGame();
canvas.focus();
requestAnimationFrame(loop);
