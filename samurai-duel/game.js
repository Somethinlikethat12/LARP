const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const centerX = canvas.width / 2;
const groundY = 430;

const player = {
  x: centerX,
  y: groundY,
  hp: 100,
  attackTimer: 0,
  attackCooldown: 0,
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
  waveAnnounce: 0,
  parryFlash: 0,
  sparks: [],
  gameOver: false
};

let frameCount = 0;

function shade(hexColor, amount) {
  const num = parseInt(hexColor.replace("#", ""), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);
  return `rgb(${r},${g},${b})`;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const stars = Array.from({ length: 44 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * (groundY - 170),
  r: Math.random() * 1.4 + 0.5,
  phase: Math.random() * Math.PI * 2
}));

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
  if (key === "j" && player.attackCooldown <= 0) {
    player.attackTimer = 16;
    player.attackCooldown = 26;
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
  const duelOffset = 70 + Math.random() * 20;
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
  player.attackCooldown = 0;
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
  duel.waveAnnounce = 70;
  duel.parryFlash = 0;
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
  return player.parryTimer > 0 && enemy.attackActive >= 6 && enemy.attackActive <= 8;
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
      enemy.hp = Math.max(0, enemy.hp - 22);
      doImpact({ heavy: true, x: player.x + player.facing * 65, y: player.y - 90 });
      addSparks(player.x + player.facing * 60, player.y - 96, "#8ef5ff", 24, 2);
      duel.parryFlash = 40;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        enemy.state = "defeated";
      }
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

  if (duel.gameOver) {
    updateSparks();
    return;
  }

  frameCount += 1;
  player.attackTimer = Math.max(0, player.attackTimer - 1);
  player.attackCooldown = Math.max(0, player.attackCooldown - 1);
  player.parryTimer = Math.max(0, player.parryTimer - 1);
  player.parryCooldown = Math.max(0, player.parryCooldown - 1);

  updateEnemy(duel.enemy);
  tryPlayerHit(duel.enemy);
  updateSparks();

  duel.flashAlpha *= 0.84;
  duel.screenShake *= 0.82;
  duel.finisherText = Math.max(0, duel.finisherText - 1);
  duel.waveAnnounce = Math.max(0, duel.waveAnnounce - 1);
  duel.parryFlash = Math.max(0, duel.parryFlash - 1);

  if (duel.enemy.dead && duel.sparks.length < 8) {
    duel.wave += 1;
    duel.enemy = spawnEnemy();
    duel.waveAnnounce = 70;
  }
}

function drawSamurai(x, y, facing, color, stance = "idle", isPlayer = false) {
  const bob = stance === "idle" ? Math.sin(frameCount * 0.1 + (isPlayer ? 0 : Math.PI)) * 3 : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(facing, 1);

  const slashPose = stance === "slash";
  const parryPose = stance === "parry";
  const dark = shade(color, -45);
  const light = shade(color, 35);

  ctx.fillStyle = "#1c1e26";
  ctx.beginPath();
  ctx.moveTo(-18, -58);
  ctx.lineTo(18, -58);
  ctx.lineTo(28, -2);
  ctx.lineTo(-28, -2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c4b08a";
  ctx.fillRect(-22, -8, 16, 10);
  ctx.fillRect(6, -8, 16, 10);

  ctx.fillStyle = color;
  ctx.fillRect(-18, -95, 36, 40);
  ctx.fillStyle = "#8a2c2c";
  ctx.fillRect(-18, -60, 36, 7);

  ctx.fillStyle = dark;
  ctx.fillRect(-22, -95, 12, 16);
  ctx.fillRect(10, -95, 12, 16);

  ctx.fillStyle = "#e8c9a0";
  ctx.beginPath();
  ctx.arc(0, -112, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#141419";
  ctx.fillRect(-15, -126, 30, 7);
  ctx.beginPath();
  ctx.arc(0, -130, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = dark;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -70);
  ctx.lineTo(parryPose ? 30 : slashPose ? 42 : 24, parryPose ? -92 : slashPose ? -86 : -68);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = "#eaf6ff";
  ctx.shadowBlur = slashPose ? 16 : 4;
  ctx.strokeStyle = light;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (parryPose) {
    ctx.moveTo(6, -70);
    ctx.lineTo(58, -104);
  } else if (slashPose) {
    ctx.moveTo(14, -72);
    ctx.lineTo(92, -98);
  } else {
    ctx.moveTo(8, -72);
    ctx.lineTo(56, -78);
  }
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawDizzy(x, y) {
  for (let i = 0; i < 3; i += 1) {
    const angle = frameCount * 0.15 + i * ((Math.PI * 2) / 3);
    const sx = x + Math.cos(angle) * 22;
    const sy = y + Math.sin(angle) * 7;
    ctx.fillStyle = "#ffe98a";
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTelegraph(enemy) {
  if (enemy.attackWindup > 0) {
    const urgency = 1 - enemy.attackWindup / 22;
    const pulse = 1 + Math.sin(frameCount * 0.5) * 0.15;
    ctx.save();
    ctx.translate(enemy.x, enemy.y - 150);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = urgency > 0.6 ? "#ff5555" : "#ffd166";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(14, 10);
    ctx.lineTo(-14, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#20140f";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", 0, 7);
    ctx.textAlign = "start";
    ctx.restore();
  } else if (enemy.attackActive > 0) {
    ctx.strokeStyle = "rgba(255,90,90,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y - 114, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStars() {
  for (const star of stars) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(frameCount * 0.02 + star.phase));
    ctx.fillStyle = `rgba(244,237,213,${twinkle})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPillar(x) {
  ctx.fillStyle = "#241b14";
  ctx.fillRect(x - 14, groundY - 230, 28, 230);
  ctx.fillStyle = "#3a2b20";
  ctx.fillRect(x - 26, groundY - 242, 52, 16);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#1b1f3a");
  sky.addColorStop(1, "#3a2f4d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, groundY);

  drawStars();

  const moonGlow = ctx.createRadialGradient(canvas.width - 120, 90, 4, canvas.width - 120, 90, 70);
  moonGlow.addColorStop(0, "rgba(244,237,213,0.55)");
  moonGlow.addColorStop(1, "rgba(244,237,213,0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(canvas.width - 200, 10, 170, 170);

  ctx.fillStyle = "#f4edd5";
  ctx.beginPath();
  ctx.arc(canvas.width - 120, 90, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#141225";
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(0, groundY - 90);
  ctx.lineTo(160, groundY - 160);
  ctx.lineTo(320, groundY - 80);
  ctx.lineTo(480, groundY - 150);
  ctx.lineTo(620, groundY - 70);
  ctx.lineTo(760, groundY - 140);
  ctx.lineTo(canvas.width, groundY - 90);
  ctx.lineTo(canvas.width, groundY);
  ctx.closePath();
  ctx.fill();

  drawPillar(60);
  drawPillar(canvas.width - 60);
}

function drawGround() {
  ctx.fillStyle = "#241a16";
  ctx.fillRect(0, groundY + 2, canvas.width, canvas.height - groundY);

  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 2;
  const rows = 6;
  for (let i = 1; i <= rows; i += 1) {
    const y = groundY + ((canvas.height - groundY) * i) / rows;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#c7b078";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 2);
  ctx.lineTo(canvas.width, groundY + 2);
  ctx.stroke();
}

function drawShadow(x, y) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBar(x, y, w, h, pct, colorFrom, colorTo, label, value, alignRight = false) {
  roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(10,10,14,0.65)";
  ctx.fill();

  const fillWidth = Math.max(0, (w - 6) * Math.max(0, Math.min(1, pct)));
  if (fillWidth > 0) {
    roundRect(x + 3, y + 3, fillWidth, h - 6, (h - 6) / 2);
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, colorFrom);
    grad.addColorStop(1, colorTo);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  roundRect(x, y, w, h, h / 2);
  ctx.strokeStyle = "rgba(199,176,120,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#f4edd5";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = alignRight ? "right" : "left";
  ctx.fillText(label, alignRight ? x + w : x, y - 6);
  ctx.textAlign = alignRight ? "left" : "right";
  ctx.fillText(value, alignRight ? x : x + w, y - 6);
  ctx.textAlign = "start";
}

function drawParryStatus() {
  const ready = player.parryCooldown <= 0;
  ctx.beginPath();
  ctx.arc(40, 78, 8, 0, Math.PI * 2);
  ctx.fillStyle = ready ? "#8ef5ff" : "rgba(140,160,170,0.35)";
  ctx.fill();
  ctx.strokeStyle = "#cfe9f0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#cfe9f0";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(ready ? "PARRY READY" : "PARRY...", 54, 82);
}

function drawAttackStatus() {
  const ready = player.attackCooldown <= 0;
  ctx.beginPath();
  ctx.arc(40, 58, 8, 0, Math.PI * 2);
  ctx.fillStyle = ready ? "#ffd27a" : "rgba(140,160,170,0.35)";
  ctx.fill();
  ctx.strokeStyle = "#f0dfc0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#f0dfc0";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(ready ? "SLASH READY" : "SLASH...", 54, 62);
}

function drawHUD(enemy) {
  drawBar(24, 34, 280, 18, player.hp / 100, "#ff8a5b", "#d5333f", "PLAYER", `${Math.max(0, Math.round(player.hp))}/100`);
  drawBar(canvas.width - 304, 34, 280, 18, enemy.hp / enemy.maxHp, "#8ad1ff", "#4a6bd6", `WAVE ${duel.wave} ENEMY`, `${Math.max(0, Math.round(enemy.hp))}/${enemy.maxHp}`, true);
  drawAttackStatus();
  drawParryStatus();
}

function drawLegend() {
  roundRect(canvas.width / 2 - 230, canvas.height - 38, 460, 26, 13);
  ctx.fillStyle = "rgba(10,10,14,0.55)";
  ctx.fill();
  ctx.fillStyle = "#f4edd5";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("J = SLASH (recovers)   •   K = PARRY (perfect = stun + counter dmg)", canvas.width / 2, canvas.height - 20);
  ctx.textAlign = "start";
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

  if (duel.waveAnnounce > 0 && duel.finisherText === 0) {
    ctx.globalAlpha = Math.min(1, duel.waveAnnounce / 20);
    ctx.fillStyle = "#bcd4ff";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`WAVE ${duel.wave}`, canvas.width / 2, 90);
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }

  if (duel.parryFlash > 0) {
    ctx.globalAlpha = Math.min(1, duel.parryFlash / 16);
    ctx.fillStyle = "#8ef5ff";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PERFECT PARRY! +COUNTER", canvas.width / 2, 190);
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
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

  drawBackground();
  drawGround();
  const enemy = duel.enemy;

  drawShadow(player.x, player.y);
  drawShadow(enemy.x, enemy.y);

  const playerStance = player.parryTimer > 0 ? "parry" : player.attackTimer > 7 ? "slash" : "idle";
  const enemyStance = enemy.attackWindup > 0 ? "slash" : enemy.attackActive > 0 ? "slash" : "idle";

  drawSamurai(player.x, player.y, player.facing, "#8f9fb6", playerStance, true);
  drawSamurai(enemy.x, enemy.y, enemy.facing, enemy.stunned > 0 ? "#c4d4df" : "#7f5b66", enemyStance, false);

  if (enemy.stunned > 0) {
    drawDizzy(enemy.x, enemy.y - 150);
  }

  if (player.parryTimer > 0) {
    ctx.strokeStyle = "rgba(170,245,255,0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x + player.facing * 34, player.y - 92, 24, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawTelegraph(enemy);

  drawWorldEffects();
  ctx.restore();

  drawHUD(enemy);
  drawLegend();
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
