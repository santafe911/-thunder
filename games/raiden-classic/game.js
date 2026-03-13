const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

const state = {
  scene: 'title',
  keys: {},
  mouse: { x: W / 2, y: H - 120, active: false, firing: false },
  stars: [],
  bullets: [],
  enemyBullets: [],
  enemies: [],
  effects: [],
  pickups: [],
  time: 0,
  score: 0,
  stageTimer: 0,
  bossSpawned: false,
  bossDefeated: false,
  victoryTimer: 0,
  rumble: 0,
};

const player = {
  x: W / 2,
  y: H - 110,
  w: 26,
  h: 34,
  speed: 4.7,
  hp: 100,
  maxHp: 100,
  lives: 3,
  bombs: 3,
  power: 1,
  fireCooldown: 0,
  invuln: 0,
  respawnTimer: 0,
};

for (let i = 0; i < 90; i++) {
  state.stars.push({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 0.7 + Math.random() * 2.8,
    size: Math.random() > 0.9 ? 2 : 1,
    color: Math.random() > 0.8 ? '#8bd3ff' : '#ffffff',
  });
}

function resetGame() {
  state.scene = 'playing';
  state.bullets = [];
  state.enemyBullets = [];
  state.enemies = [];
  state.effects = [];
  state.pickups = [];
  state.time = 0;
  state.stageTimer = 0;
  state.score = 0;
  state.bossSpawned = false;
  state.bossDefeated = false;
  state.victoryTimer = 0;
  state.rumble = 0;

  player.x = W / 2;
  player.y = H - 110;
  player.hp = 100;
  player.maxHp = 100;
  player.lives = 3;
  player.bombs = 3;
  player.power = 1;
  player.fireCooldown = 0;
  player.invuln = 120;
  player.respawnTimer = 0;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function spawnEffect(x, y, color = '#ff9d2e', size = 16, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 4;
    state.effects.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 24 + Math.random() * 18,
      maxLife: 30,
      size: size * (0.4 + Math.random() * 0.8),
      color,
    });
  }
}

function shootPlayer() {
  const base = [
    { x: player.x, y: player.y - 18, vx: 0, vy: -9 },
  ];
  if (player.power >= 2) {
    base.push({ x: player.x - 11, y: player.y - 10, vx: -0.5, vy: -8.7 });
    base.push({ x: player.x + 11, y: player.y - 10, vx: 0.5, vy: -8.7 });
  }
  if (player.power >= 3) {
    base.push({ x: player.x - 18, y: player.y - 4, vx: -1.1, vy: -8.3 });
    base.push({ x: player.x + 18, y: player.y - 4, vx: 1.1, vy: -8.3 });
  }
  if (player.power >= 4) {
    base.push({ x: player.x, y: player.y - 18, vx: -1.3, vy: -8.8, big: true });
    base.push({ x: player.x, y: player.y - 18, vx: 1.3, vy: -8.8, big: true });
  }
  for (const b of base) {
    state.bullets.push({
      ...b,
      r: b.big ? 4 : 3,
      damage: b.big ? 16 : 10,
      color: b.big ? '#fff36d' : '#8ef3ff',
    });
  }
}

function enemyShoot(enemy, pattern = 'spread') {
  if (pattern === 'aim') {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 3.4;
    state.enemyBullets.push({ x: enemy.x, y: enemy.y + 10, vx: (dx / len) * speed, vy: (dy / len) * speed, r: 4, color: '#ff7f50', damage: 12 });
    return;
  }
  const n = pattern === 'wide' ? 7 : 5;
  const spread = pattern === 'wide' ? 1.1 : 0.7;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const angle = (-spread / 2) + spread * t + Math.PI / 2;
    const speed = pattern === 'wide' ? 2.6 : 3.1;
    state.enemyBullets.push({ x: enemy.x, y: enemy.y + 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: pattern === 'wide' ? 5 : 4, color: pattern === 'wide' ? '#ff4fd8' : '#ff965d', damage: 10 });
  }
}

function spawnEnemy(type) {
  const x = 60 + Math.random() * (W - 120);
  if (type === 'drone') {
    state.enemies.push({ type, x, y: -40, w: 24, h: 24, hp: 26, maxHp: 26, speed: 2.2, fireTimer: 60 + Math.random() * 60, score: 120 });
  }
  if (type === 'fighter') {
    const side = Math.random() > 0.5 ? 1 : -1;
    state.enemies.push({ type, x: side > 0 ? W + 30 : -30, y: 120 + Math.random() * 180, w: 28, h: 22, hp: 40, maxHp: 40, speed: 2.7, side, fireTimer: 50, wave: Math.random() * 1000, score: 180 });
  }
  if (type === 'gunship') {
    state.enemies.push({ type, x, y: -50, w: 42, h: 32, hp: 180, maxHp: 180, speed: 1.15, fireTimer: 45, score: 900 });
  }
}

function spawnBoss() {
  state.enemies.push({
    type: 'boss',
    x: W / 2,
    y: -120,
    targetY: 130,
    w: 140,
    h: 96,
    hp: 1800,
    maxHp: 1800,
    fireTimer: 80,
    patternTimer: 0,
    phase: 1,
    moveDir: 1,
    score: 8000,
  });
}

function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < (a.w + b.w) && Math.abs(a.y - b.y) * 2 < (a.h + b.h);
}

function hitPlayer(damage) {
  if (player.invuln > 0 || player.respawnTimer > 0 || state.scene !== 'playing') return;
  player.hp -= damage;
  player.invuln = 70;
  state.rumble = 10;
  spawnEffect(player.x, player.y, '#ffffff', 14, 12);
  if (player.hp <= 0) {
    player.lives -= 1;
    spawnEffect(player.x, player.y, '#ff612b', 26, 26);
    if (player.lives < 0) {
      state.scene = 'gameover';
      return;
    }
    player.hp = player.maxHp;
    player.x = W / 2;
    player.y = H - 110;
    player.invuln = 140;
    player.respawnTimer = 90;
    player.power = Math.max(1, player.power - 1);
  }
}

function useBomb() {
  if (player.bombs <= 0 || state.scene !== 'playing') return;
  player.bombs -= 1;
  state.enemyBullets = [];
  state.rumble = 20;
  spawnEffect(player.x, player.y, '#7be7ff', 40, 42);
  for (const e of state.enemies) {
    if (e.type === 'boss') e.hp -= 180;
    else e.hp -= 999;
  }
}

function update() {
  state.time += 1;
  if (state.rumble > 0) state.rumble -= 1;

  for (const s of state.stars) {
    s.y += s.speed;
    if (s.y > H) {
      s.y = -4;
      s.x = Math.random() * W;
    }
  }

  if (state.scene !== 'playing') return;

  state.stageTimer += 1;

  let mx = 0, my = 0;
  if (state.keys['ArrowLeft'] || state.keys['a']) mx -= 1;
  if (state.keys['ArrowRight'] || state.keys['d']) mx += 1;
  if (state.keys['ArrowUp'] || state.keys['w']) my -= 1;
  if (state.keys['ArrowDown'] || state.keys['s']) my += 1;

  if (state.mouse.active) {
    player.x += (state.mouse.x - player.x) * 0.18;
    player.y += (state.mouse.y - player.y) * 0.18;
  } else {
    player.x += mx * player.speed;
    player.y += my * player.speed;
  }

  player.x = clamp(player.x, 26, W - 26);
  player.y = clamp(player.y, 40, H - 40);

  if (player.fireCooldown > 0) player.fireCooldown -= 1;
  if (player.invuln > 0) player.invuln -= 1;
  if (player.respawnTimer > 0) player.respawnTimer -= 1;

  const firing = state.keys['j'] || state.keys[' '] || state.mouse.firing;
  if (firing && player.fireCooldown <= 0) {
    shootPlayer();
    player.fireCooldown = Math.max(4, 8 - player.power);
  }

  if (!state.bossSpawned) {
    if (state.stageTimer % 55 === 0 && state.stageTimer < 820) spawnEnemy('drone');
    if (state.stageTimer % 160 === 80 && state.stageTimer < 760) spawnEnemy('fighter');
    if ((state.stageTimer === 300 || state.stageTimer === 620) && state.stageTimer < 820) spawnEnemy('gunship');
    if (state.stageTimer > 950) {
      state.bossSpawned = true;
      spawnBoss();
    }
  }

  for (const b of state.bullets) {
    b.x += b.vx;
    b.y += b.vy;
  }
  state.bullets = state.bullets.filter(b => b.y > -40 && b.x > -20 && b.x < W + 20);

  for (const b of state.enemyBullets) {
    b.x += b.vx;
    b.y += b.vy;
  }
  state.enemyBullets = state.enemyBullets.filter(b => b.y < H + 40 && b.x > -30 && b.x < W + 30);

  for (const e of state.enemies) {
    e.fireTimer -= 1;
    if (e.type === 'drone') {
      e.y += e.speed;
      if (e.fireTimer <= 0) {
        enemyShoot(e, 'aim');
        e.fireTimer = 90;
      }
    } else if (e.type === 'fighter') {
      e.x += e.side * e.speed;
      e.y += Math.sin((state.time + e.wave) * 0.04) * 1.8;
      if (e.fireTimer <= 0) {
        enemyShoot(e, 'spread');
        e.fireTimer = 75;
      }
    } else if (e.type === 'gunship') {
      e.y += e.speed;
      if (e.fireTimer <= 0) {
        enemyShoot(e, 'wide');
        e.fireTimer = 45;
      }
    } else if (e.type === 'boss') {
      if (e.y < e.targetY) {
        e.y += 1.8;
      } else {
        e.x += e.moveDir * 1.6;
        if (e.x < 100 || e.x > W - 100) e.moveDir *= -1;
        e.patternTimer += 1;
        if (e.hp < e.maxHp * 0.55) e.phase = 2;
        if (e.fireTimer <= 0) {
          if (e.phase === 1) {
            enemyShoot(e, 'wide');
            enemyShoot({ x: e.x - 38, y: e.y + 18 }, 'spread');
            enemyShoot({ x: e.x + 38, y: e.y + 18 }, 'spread');
            e.fireTimer = 36;
          } else {
            enemyShoot(e, 'wide');
            enemyShoot({ x: e.x - 46, y: e.y + 20 }, 'wide');
            enemyShoot({ x: e.x + 46, y: e.y + 20 }, 'wide');
            state.enemyBullets.push({ x: e.x, y: e.y + 30, vx: 0, vy: 4.4, r: 7, color: '#ffd54f', damage: 18 });
            e.fireTimer = 24;
          }
        }
      }
    }
  }

  for (const p of state.pickups) p.y += p.vy;
  state.pickups = state.pickups.filter(p => p.y < H + 30);

  for (const fx of state.effects) {
    fx.x += fx.vx;
    fx.y += fx.vy;
    fx.life -= 1;
  }
  state.effects = state.effects.filter(fx => fx.life > 0);

  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (b.dead || e.dead) continue;
      if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        e.hp -= b.damage;
        b.dead = true;
        spawnEffect(b.x, b.y, '#fff58d', 6, 3);
        if (e.hp <= 0) {
          e.dead = true;
          state.score += e.score;
          spawnEffect(e.x, e.y, e.type === 'boss' ? '#ff4e39' : '#ff9f43', e.type === 'boss' ? 40 : 20, e.type === 'boss' ? 40 : 16);
          if (Math.random() < 0.16 && e.type !== 'boss') {
            const kind = Math.random() > 0.7 ? 'bomb' : 'power';
            state.pickups.push({ x: e.x, y: e.y, vy: 1.4, kind });
          }
          if (e.type === 'boss') {
            state.bossDefeated = true;
            state.victoryTimer = 180;
          }
        }
      }
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);
  state.enemies = state.enemies.filter(e => !e.dead && e.y < H + 100 && e.x > -80 && e.x < W + 80);

  for (const b of state.enemyBullets) {
    if (Math.abs(b.x - player.x) < player.w / 2 && Math.abs(b.y - player.y) < player.h / 2) {
      b.dead = true;
      hitPlayer(b.damage || 10);
    }
  }
  state.enemyBullets = state.enemyBullets.filter(b => !b.dead);

  for (const e of state.enemies) {
    if (rectsOverlap({ x: player.x, y: player.y, w: player.w, h: player.h }, e)) {
      e.dead = true;
      hitPlayer(28);
      spawnEffect(e.x, e.y, '#ff6b3d', 22, 20);
    }
  }

  for (const p of state.pickups) {
    if (Math.abs(p.x - player.x) < 20 && Math.abs(p.y - player.y) < 20) {
      p.dead = true;
      if (p.kind === 'power') player.power = Math.min(4, player.power + 1);
      if (p.kind === 'bomb') player.bombs = Math.min(5, player.bombs + 1);
      state.score += 100;
      spawnEffect(p.x, p.y, '#6dffb3', 12, 10);
    }
  }
  state.pickups = state.pickups.filter(p => !p.dead);

  if (state.bossDefeated) {
    state.victoryTimer -= 1;
    if (state.victoryTimer <= 0) state.scene = 'victory';
  }
}

function drawShip(x, y, color = '#5fd1ff') {
  const px = Math.round(x), py = Math.round(y);
  ctx.fillStyle = '#c8f7ff';
  ctx.fillRect(px - 2, py - 16, 4, 10);
  ctx.fillStyle = color;
  ctx.fillRect(px - 5, py - 8, 10, 18);
  ctx.fillRect(px - 12, py + 2, 8, 10);
  ctx.fillRect(px + 4, py + 2, 8, 10);
  ctx.fillStyle = '#1d4f90';
  ctx.fillRect(px - 2, py - 4, 4, 8);
  ctx.fillStyle = '#ff8a3d';
  ctx.fillRect(px - 8, py + 12, 4, 5);
  ctx.fillRect(px + 4, py + 12, 4, 5);
}

function drawEnemy(e) {
  const x = Math.round(e.x), y = Math.round(e.y);
  if (e.type === 'drone') {
    ctx.fillStyle = '#ff8459';
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = '#612213';
    ctx.fillRect(x - 2, y - 4, 4, 8);
  } else if (e.type === 'fighter') {
    ctx.fillStyle = '#ffcb4d';
    ctx.fillRect(x - 12, y - 6, 24, 12);
    ctx.fillStyle = '#7c3724';
    ctx.fillRect(x - 4, y - 8, 8, 16);
  } else if (e.type === 'gunship') {
    ctx.fillStyle = '#b84dff';
    ctx.fillRect(x - 18, y - 12, 36, 24);
    ctx.fillStyle = '#3f174f';
    ctx.fillRect(x - 6, y - 14, 12, 28);
    ctx.fillStyle = '#ffcf53';
    ctx.fillRect(x - 14, y + 10, 8, 4);
    ctx.fillRect(x + 6, y + 10, 8, 4);
  } else if (e.type === 'boss') {
    ctx.fillStyle = '#7a8ca5';
    ctx.fillRect(x - 60, y - 30, 120, 60);
    ctx.fillRect(x - 30, y - 42, 60, 16);
    ctx.fillStyle = '#31445d';
    ctx.fillRect(x - 18, y - 18, 36, 28);
    ctx.fillStyle = '#ff6a4d';
    ctx.fillRect(x - 54, y - 10, 18, 24);
    ctx.fillRect(x + 36, y - 10, 18, 24);
    ctx.fillStyle = '#ffd24d';
    ctx.fillRect(x - 8, y - 28, 16, 8);
  }

  if (e.type !== 'boss') {
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#210b12';
    ctx.fillRect(x - 16, y - e.h / 2 - 10, 32, 4);
    ctx.fillStyle = '#ff6b4a';
    ctx.fillRect(x - 16, y - e.h / 2 - 10, 32 * ratio, 4);
  }
}

function drawBossBar() {
  const boss = state.enemies.find(e => e.type === 'boss');
  if (!boss) return;
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(60, 34, W - 120, 18);
  ctx.fillStyle = '#5e0c18';
  ctx.fillRect(64, 38, W - 128, 10);
  ctx.fillStyle = '#ff4e4e';
  ctx.fillRect(64, 38, (W - 128) * ratio, 10);
  ctx.fillStyle = '#fff1c1';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('最终兵器：巨鲨级空中要塞', 64, 28);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(10, 10, 178, 82);
  ctx.fillStyle = '#d4ecff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`SCORE ${state.score}`, 18, 30);
  ctx.fillText(`LIFE ${Math.max(0, player.lives)}`, 18, 48);
  ctx.fillText(`BOMB ${player.bombs}`, 18, 66);
  ctx.fillText(`POWER ${player.power}`, 18, 84);

  ctx.fillStyle = '#1d283f';
  ctx.fillRect(W - 150, 18, 120, 12);
  ctx.fillStyle = '#48e26c';
  ctx.fillRect(W - 150, 18, 120 * (player.hp / player.maxHp), 12);
  ctx.strokeStyle = '#d4ecff';
  ctx.strokeRect(W - 150, 18, 120, 12);
  ctx.fillStyle = '#d4ecff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('ARMOR', W - 150, 14);
}

function drawOverlay(title, subtitle, prompt) {
  ctx.fillStyle = 'rgba(0,0,0,0.56)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#d5e7ff';
  ctx.fillText(subtitle, W / 2, H / 2);
  ctx.fillStyle = '#9fd9ff';
  ctx.fillText(prompt, W / 2, H / 2 + 42);
  ctx.textAlign = 'left';
}

function render() {
  const shakeX = state.rumble > 0 ? (Math.random() * 6 - 3) : 0;
  const shakeY = state.rumble > 0 ? (Math.random() * 6 - 3) : 0;
  ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#163969');
  bg.addColorStop(0.45, '#0a1730');
  bg.addColorStop(1, '#03070f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (const s of state.stars) {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }

  ctx.fillStyle = 'rgba(65, 120, 205, 0.18)';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(40 + i * 90, (state.time * (1.5 + i * 0.1)) % (H + 120) - 120, 8, 120);
  }

  for (const p of state.pickups) {
    ctx.fillStyle = p.kind === 'power' ? '#7cff72' : '#ffd44d';
    ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    ctx.fillStyle = '#111';
    ctx.fillText(p.kind === 'power' ? 'P' : 'B', p.x - 4, p.y + 4);
  }

  for (const b of state.bullets) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - b.r / 2, b.y - b.r * 2, b.r, b.r * 3);
  }
  for (const b of state.enemyBullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of state.enemies) drawEnemy(e);

  if (player.respawnTimer % 8 < 4 || player.respawnTimer <= 0) {
    if (player.invuln % 6 < 3 || player.invuln <= 0) drawShip(player.x, player.y);
  }

  for (const fx of state.effects) {
    ctx.globalAlpha = Math.max(0, fx.life / fx.maxLife);
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x, fx.y, Math.max(1, fx.size / 6), Math.max(1, fx.size / 6));
    ctx.globalAlpha = 1;
  }

  drawHUD();
  drawBossBar();

  if (state.scene === 'title') {
    drawOverlay('钢翼雷霆', '单关经典雷电风爽玩版', '按 Enter / 点击开始');
  } else if (state.scene === 'victory') {
    drawOverlay('任务完成', `最终得分 ${state.score}`, '按 Enter 再来一局');
  } else if (state.scene === 'gameover') {
    drawOverlay('作战失败', `最终得分 ${state.score}`, '按 Enter 重新起飞');
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  state.keys[k] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (k === 'Enter' && (state.scene === 'title' || state.scene === 'victory' || state.scene === 'gameover')) resetGame();
  if (k === 'k') useBomb();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  state.keys[k] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = ((e.clientX - rect.left) / rect.width) * W;
  state.mouse.y = ((e.clientY - rect.top) / rect.height) * H;
  state.mouse.active = true;
});
canvas.addEventListener('mouseleave', () => {
  state.mouse.active = false;
  state.mouse.firing = false;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) state.mouse.firing = true;
  if (e.button === 2) useBomb();
  if (state.scene === 'title' || state.scene === 'victory' || state.scene === 'gameover') resetGame();
});
canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) state.mouse.firing = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

loop();
