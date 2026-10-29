"use strict";

const TILE_SIZE = 32;
const ROWS = 48;
const COLS = 52;
const VIEWPORT_WIDTH = 1120;
const VIEWPORT_HEIGHT = 680;
const PLAYER_RADIUS = 10;
const PLAYER_SPEED = 190;
const DARKNESS_START_DEPTH = 10;
const LOCAL_LIGHT_RADIUS = TILE_SIZE * 1.5;
const SONAR_MAX_RADIUS = TILE_SIZE * 8;
const SONAR_EXPAND_TIME = 800;
const SONAR_REVEAL_TIME = 1500;
const SONAR_COOLDOWN = 1500;
const SONAR_RAY_COUNT = 72;
const SONAR_RAY_SPEED = SONAR_MAX_RADIUS / (SONAR_EXPAND_TIME / 1000);
const SONAR_MAX_BOUNCES = 3;
const MONSTER_RADIUS = 23;
const MONSTER_SPEED = 112;
const MONSTER_SEARCH_TIME = 7000;
const MONSTER_SEARCH_RADIUS = 4;

const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const darknessCanvas = document.createElement("canvas");
const darknessContext = darknessCanvas.getContext("2d");
const keysDown = new Set();
canvas.width = VIEWPORT_WIDTH;
canvas.height = VIEWPORT_HEIGHT;
darknessCanvas.width = VIEWPORT_WIDTH;
darknessCanvas.height = VIEWPORT_HEIGHT;

let rockFormations = [];
let seafloorRows = [];
let level = [];
const startTile = { col: 2, row: 2 };
let exitTile = { col: 0, row: 0 };

function seeded(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function isReef(col, row) {
  return rockFormations.some((rock) => {
    const dx = (col - rock.x) / rock.rx;
    const dy = (row - rock.y) / rock.ry;
    return dx * dx + dy * dy <= 1;
  });
}

function generateSeafloor() {
  const heights = [];
  const broadPhase = Math.random() * Math.PI * 2;
  const ridgePhase = Math.random() * Math.PI * 2;
  for (let col = 0; col < COLS; col += 1) {
    const broadSlope = Math.sin(col * 0.23 + broadPhase) * 1.8;
    const smallRidge = Math.sin(col * 0.61 + ridgePhase) * 1.1;
    const rawHeight = Math.round(ROWS - 4 + broadSlope + smallRidge);
    if (col === 0) heights.push(rawHeight);
    else heights.push(Math.max(heights[col - 1] - 1, Math.min(heights[col - 1] + 1, rawHeight)));
  }
  return heights;
}

function seafloorRowAt(col) {
  return seafloorRows[col];
}

function terrainIsOpen(col, row) {
  return row > 0 && col > 0 && col < COLS - 1 && row < seafloorRowAt(col) && !isReef(col, row);
}

function randomOpenTile(minRow, maxRow, avoid = [], minimumDistance = 7) {
  const candidates = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = 2; col < COLS - 2; col += 1) {
      if (!terrainIsOpen(col, row)) continue;
      if (avoid.some((tile) => Math.hypot(col - tile.col, row - tile.row) < minimumDistance)) continue;
      candidates.push({ col, row });
    }
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function generateMap() {
  seafloorRows = generateSeafloor();
  rockFormations = [];
  let attempts = 0;
  while (rockFormations.length < 23 && attempts < 400) {
    attempts += 1;
    const rock = {
      x: 5 + Math.random() * (COLS - 10),
      y: 7 + Math.random() * (ROWS - 17),
      rx: 1.15 + Math.random() * 2.8,
      ry: 1.0 + Math.random() * 1.8,
    };
    if (Math.hypot(rock.x - startTile.col, rock.y - startTile.row) < 8) continue;
    if (rock.y + rock.ry >= seafloorRowAt(Math.round(rock.x)) - 1) continue;
    const tooClose = rockFormations.some((other) =>
      Math.hypot(rock.x - other.x, rock.y - other.y) < Math.max(rock.rx, rock.ry) + Math.max(other.rx, other.ry) + 1.7
    );
    if (!tooClose) rockFormations.push(rock);
  }

  exitTile = randomOpenTile(ROWS - 14, ROWS - 6, [startTile], 18);
  level = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => {
      if (!terrainIsOpen(col, row)) return "#";
      if (col === startTile.col && row === startTile.row) return "P";
      if (col === exitTile.col && row === exitTile.row) return "E";
      return ".";
    }).join(""),
  );
}

generateMap();

let MONSTER_START = randomOpenTile(12, ROWS - 12, [startTile, exitTile], 12);
let HUNTER_START = randomOpenTile(ROWS / 2, ROWS - 8, [startTile, exitTile, MONSTER_START], 10);

const player = {
  x: (startTile.col + 0.5) * TILE_SIZE,
  y: (startTile.row + 0.5) * TILE_SIZE,
  heading: 0,
};
const monster = {
  x: (MONSTER_START.col + 0.5) * TILE_SIZE,
  y: (MONSTER_START.row + 0.5) * TILE_SIZE,
  path: [],
  revealedUntil: 0,
  isAlerted: false,
  mode: "idle",
  searchCenter: null,
  searchEndsAt: 0,
  nextSearchAt: 0,
};
const hunter = {
  x: (HUNTER_START.col + 0.5) * TILE_SIZE,
  y: (HUNTER_START.row + 0.5) * TILE_SIZE,
  path: [],
  revealedUntil: 0,
  nextPathUpdateAt: 0,
};
const HUNTER_RADIUS = 24;
const HUNTER_SPEED = 72;
const HUNTER_PATH_UPDATE_TIME = 650;
const SURFACE_Y = TILE_SIZE;
const METERS_PER_TILE = 8;

const camera = { x: 0, y: 0 };
const sonarPulses = [];
const revealedTiles = new Map();
let sonarReadyAt = 0;
let gameState = "playing";
let keyHintAngle = 0;
let keyHintUntil = 0;
let lockedMessageUntil = 0;

const keyItem = {
  x: 0,
  y: 0,
  col: 0,
  row: 0,
  collected: false,
  revealedUntil: 0,
};

const particles = Array.from({ length: 85 }, (_, index) => ({
  x: seeded(index * 3 + 1) * VIEWPORT_WIDTH,
  y: seeded(index * 3 + 2) * VIEWPORT_HEIGHT,
  radius: 0.5 + seeded(index * 3 + 3) * 1.7,
  speed: 3 + seeded(index * 5 + 4) * 8,
  opacity: 0.08 + seeded(index * 7 + 5) * 0.22,
}));

const fogClouds = Array.from({ length: 34 }, (_, index) => ({
  x: seeded(index * 11 + 2) * VIEWPORT_WIDTH,
  y: seeded(index * 13 + 4) * VIEWPORT_HEIGHT,
  radius: 75 + seeded(index * 17 + 6) * 145,
  stretch: 0.35 + seeded(index * 19 + 8) * 0.55,
  speed: 2 + seeded(index * 23 + 10) * 7,
  alpha: 0.035 + seeded(index * 29 + 12) * 0.085,
  phase: seeded(index * 31 + 14) * Math.PI * 2,
}));

let audioContext = null;
let musicGain = null;
let musicTimer = null;
let musicMuted = false;
let beatIndex = 0;

function playUrgentBeat() {
  if (!audioContext || musicMuted) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  const notes = [82.41, 82.41, 98.0, 73.42, 82.41, 110.0, 98.0, 73.42];
  oscillator.type = beatIndex % 4 === 3 ? "square" : "sawtooth";
  oscillator.frequency.setValueAtTime(notes[beatIndex % notes.length], now);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
  oscillator.connect(envelope).connect(musicGain);
  oscillator.start(now);
  oscillator.stop(now + 0.21);
  beatIndex += 1;
}

function startMusic() {
  if (audioContext) {
    if (audioContext.state === "suspended") audioContext.resume();
    return;
  }
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  audioContext = new AudioEngine();
  musicGain = audioContext.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(audioContext.destination);

  const droneGain = audioContext.createGain();
  droneGain.gain.value = 0.055;
  droneGain.connect(musicGain);
  for (const frequency of [41.2, 61.7]) {
    const drone = audioContext.createOscillator();
    drone.type = "sine";
    drone.frequency.value = frequency;
    drone.connect(droneGain);
    drone.start();
  }

  playUrgentBeat();
  musicTimer = window.setInterval(playUrgentBeat, 250);
}

function toggleMusic() {
  startMusic();
  musicMuted = !musicMuted;
  if (musicGain) musicGain.gain.setTargetAtTime(musicMuted ? 0 : 0.16, audioContext.currentTime, 0.04);
}

window.addEventListener("pointerdown", startMusic, { once: true });

window.addEventListener("keydown", (event) => {
  startMusic();
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    keysDown.add(key);
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) triggerSonar(performance.now());
  }
  if (key === "r" && gameState !== "playing") resetGame();
  if (key === "m" && !event.repeat) toggleMusic();
});
window.addEventListener("keyup", (event) => keysDown.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keysDown.clear());

function isWallAt(x, y) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return level[row][col] === "#";
}

function canStandAt(x, y) {
  return [
    [x - PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x - PLAYER_RADIUS, y + PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y + PLAYER_RADIUS],
  ].every(([pointX, pointY]) => !isWallAt(pointX, pointY));
}

function updatePlayer(deltaTime) {
  if (gameState !== "playing") return;
  let dx = 0;
  let dy = 0;
  if (keysDown.has("a") || keysDown.has("arrowleft")) dx -= 1;
  if (keysDown.has("d") || keysDown.has("arrowright")) dx += 1;
  if (keysDown.has("w") || keysDown.has("arrowup")) dy -= 1;
  if (keysDown.has("s") || keysDown.has("arrowdown")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    player.heading = Math.atan2(dy, dx);
  }

  const distance = PLAYER_SPEED * deltaTime;
  const nextX = player.x + dx * distance;
  const nextY = player.y + dy * distance;
  if (canStandAt(nextX, player.y)) player.x = nextX;
  if (canStandAt(player.x, nextY)) player.y = nextY;
}

function updateCamera() {
  const worldWidth = COLS * TILE_SIZE;
  const worldHeight = ROWS * TILE_SIZE;
  const targetX = player.x - VIEWPORT_WIDTH / 2;
  const targetY = player.y - VIEWPORT_HEIGHT / 2;
  camera.x = Math.max(0, Math.min(targetX, worldWidth - VIEWPORT_WIDTH));
  camera.y = Math.max(0, Math.min(targetY, worldHeight - VIEWPORT_HEIGHT));
}

function getDepthInMeters() {
  const depthInTiles = Math.max(0, player.y / TILE_SIZE - 1.5);
  return depthInTiles * METERS_PER_TILE;
}

function placeKeyRandomly() {
  const tile = randomOpenTile(5, ROWS - 6, [startTile, exitTile, MONSTER_START, HUNTER_START], 7);
  keyItem.col = tile.col;
  keyItem.row = tile.row;
  keyItem.x = (tile.col + 0.5) * TILE_SIZE;
  keyItem.y = (tile.row + 0.5) * TILE_SIZE;
  keyItem.collected = false;
  keyItem.revealedUntil = 0;
}

placeKeyRandomly();

function createSonarRays(originX, originY) {
  return Array.from({ length: SONAR_RAY_COUNT }, (_, index) => {
    const angle = index * Math.PI * 2 / SONAR_RAY_COUNT;
    return {
      x: originX,
      y: originY,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      traveled: 0,
      bounces: 0,
      active: true,
      trail: [{ x: originX, y: originY }],
    };
  });
}

function triggerSonar(currentTime) {
  if (gameState !== "playing" || currentTime < sonarReadyAt) return;
  sonarReadyAt = currentTime + SONAR_COOLDOWN;
  sonarPulses.push({
    x: player.x,
    y: player.y,
    startedAt: currentTime,
    lastUpdatedAt: currentTime,
    rays: createSonarRays(player.x, player.y),
  });

  // Sound travels through the whole basin: every valid sonar pulse starts a search.
  sendMonsterTo(player.x, player.y, currentTime);

  if (!keyItem.collected) {
    const exactAngle = Math.atan2(keyItem.y - player.y, keyItem.x - player.x);
    const errorSign = Math.random() < 0.5 ? -1 : 1;
    const errorAmount = (8 + Math.random() * 14) * Math.PI / 180;
    keyHintAngle = exactAngle + errorSign * errorAmount;
    keyHintUntil = currentTime + 1900;
  }
}

function isWalkableTile(col, row) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS && level[row][col] !== "#";
}

function findPath(startCol, startRow, targetCol, targetRow) {
  if (!isWalkableTile(targetCol, targetRow)) return [];
  const startKey = `${startCol},${startRow}`;
  const targetKey = `${targetCol},${targetRow}`;
  const queue = [[startCol, startRow]];
  const visited = new Set([startKey]);
  const previous = new Map();

  for (let index = 0; index < queue.length; index += 1) {
    const [col, row] = queue[index];
    const key = `${col},${row}`;
    if (key === targetKey) break;

    for (const [columnStep, rowStep] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextCol = col + columnStep;
      const nextRow = row + rowStep;
      const nextKey = `${nextCol},${nextRow}`;
      if (!isWalkableTile(nextCol, nextRow) || visited.has(nextKey)) continue;
      visited.add(nextKey);
      previous.set(nextKey, key);
      queue.push([nextCol, nextRow]);
    }
  }

  if (!visited.has(targetKey)) return [];
  const reversedPath = [];
  let currentKey = targetKey;
  while (currentKey !== startKey) {
    const [col, row] = currentKey.split(",").map(Number);
    reversedPath.push({
      x: (col + 0.5) * TILE_SIZE,
      y: (row + 0.5) * TILE_SIZE,
    });
    currentKey = previous.get(currentKey);
  }
  return reversedPath.reverse();
}

function sendMonsterTo(targetX, targetY, currentTime) {
  const startCol = Math.floor(monster.x / TILE_SIZE);
  const startRow = Math.floor(monster.y / TILE_SIZE);
  const targetCol = Math.floor(targetX / TILE_SIZE);
  const targetRow = Math.floor(targetY / TILE_SIZE);
  monster.path = findPath(startCol, startRow, targetCol, targetRow);
  monster.isAlerted = monster.path.length > 0;
  monster.mode = "investigating";
  monster.searchCenter = { col: targetCol, row: targetRow };
  monster.searchEndsAt = currentTime + MONSTER_SEARCH_TIME;
  monster.nextSearchAt = currentTime;
}

function chooseSearchDestination(currentTime) {
  if (!monster.searchCenter || currentTime >= monster.searchEndsAt) {
    monster.mode = "idle";
    monster.isAlerted = false;
    return;
  }

  const startCol = Math.floor(monster.x / TILE_SIZE);
  const startRow = Math.floor(monster.y / TILE_SIZE);
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1 + Math.random() * (MONSTER_SEARCH_RADIUS - 1);
    const targetCol = Math.round(monster.searchCenter.col + Math.cos(angle) * radius);
    const targetRow = Math.round(monster.searchCenter.row + Math.sin(angle) * radius);
    if (!isWalkableTile(targetCol, targetRow)) continue;
    const path = findPath(startCol, startRow, targetCol, targetRow);
    if (path.length === 0) continue;
    monster.path = path;
    monster.mode = "searching";
    monster.isAlerted = true;
    monster.nextSearchAt = currentTime + 250;
    return;
  }

  monster.nextSearchAt = currentTime + 400;
}

function updateMonster(deltaTime, currentTime) {
  if (gameState !== "playing") return;

  if (monster.path.length === 0) {
    if (monster.mode === "investigating") {
      monster.mode = "searching";
      monster.nextSearchAt = currentTime;
    }
    if (monster.mode === "searching" && currentTime >= monster.nextSearchAt) {
      chooseSearchDestination(currentTime);
    }
    return;
  }

  const destination = monster.path[0];
  const dx = destination.x - monster.x;
  const dy = destination.y - monster.y;
  const distance = Math.hypot(dx, dy);
  const step = MONSTER_SPEED * deltaTime;

  if (distance <= step) {
    monster.x = destination.x;
    monster.y = destination.y;
    monster.path.shift();
    if (monster.path.length === 0 && monster.mode === "searching") {
      monster.nextSearchAt = currentTime + 300;
    }
  } else {
    monster.x += (dx / distance) * step;
    monster.y += (dy / distance) * step;
  }
}

function updateHunter(deltaTime, currentTime) {
  if (gameState !== "playing") return;

  if (currentTime >= hunter.nextPathUpdateAt || hunter.path.length === 0) {
    const startCol = Math.floor(hunter.x / TILE_SIZE);
    const startRow = Math.floor(hunter.y / TILE_SIZE);
    const targetCol = Math.floor(player.x / TILE_SIZE);
    const targetRow = Math.floor(player.y / TILE_SIZE);
    hunter.path = findPath(startCol, startRow, targetCol, targetRow);
    hunter.nextPathUpdateAt = currentTime + HUNTER_PATH_UPDATE_TIME;
  }

  if (hunter.path.length === 0) return;
  const destination = hunter.path[0];
  const dx = destination.x - hunter.x;
  const dy = destination.y - hunter.y;
  const distance = Math.hypot(dx, dy);
  const step = HUNTER_SPEED * deltaTime;
  if (distance <= step) {
    hunter.x = destination.x;
    hunter.y = destination.y;
    hunter.path.shift();
  } else {
    hunter.x += (dx / distance) * step;
    hunter.y += (dy / distance) * step;
  }
}

function checkGameOutcome(currentTime) {
  if (gameState !== "playing") return;
  const exitX = (exitTile.col + 0.5) * TILE_SIZE;
  const exitY = (exitTile.row + 0.5) * TILE_SIZE;
  const searcherContact = Math.hypot(player.x - monster.x, player.y - monster.y) <= PLAYER_RADIUS + MONSTER_RADIUS;
  const hunterContact = Math.hypot(player.x - hunter.x, player.y - hunter.y) <= PLAYER_RADIUS + HUNTER_RADIUS;
  const monsterContact = searcherContact || hunterContact;
  const reachedExit = Math.hypot(player.x - exitX, player.y - exitY) <= PLAYER_RADIUS + 11;
  const reachedKey = !keyItem.collected && Math.hypot(player.x - keyItem.x, player.y - keyItem.y) <= PLAYER_RADIUS + 11;

  if (reachedKey) {
    keyItem.collected = true;
    keyHintUntil = 0;
  }

  // Monster contact takes priority if both events occur in the same frame.
  if (monsterContact) gameState = "lost";
  else if (reachedExit && keyItem.collected) gameState = "won";
  else if (reachedExit) lockedMessageUntil = currentTime + 1200;
}

function resetGame() {
  generateMap();
  MONSTER_START = randomOpenTile(12, ROWS - 12, [startTile, exitTile], 12);
  HUNTER_START = randomOpenTile(ROWS / 2, ROWS - 8, [startTile, exitTile, MONSTER_START], 10);
  player.x = (startTile.col + 0.5) * TILE_SIZE;
  player.y = (startTile.row + 0.5) * TILE_SIZE;
  player.heading = 0;
  monster.x = (MONSTER_START.col + 0.5) * TILE_SIZE;
  monster.y = (MONSTER_START.row + 0.5) * TILE_SIZE;
  monster.path = [];
  monster.revealedUntil = 0;
  monster.isAlerted = false;
  monster.mode = "idle";
  monster.searchCenter = null;
  monster.searchEndsAt = 0;
  monster.nextSearchAt = 0;
  hunter.x = (HUNTER_START.col + 0.5) * TILE_SIZE;
  hunter.y = (HUNTER_START.row + 0.5) * TILE_SIZE;
  hunter.path = [];
  hunter.revealedUntil = 0;
  hunter.nextPathUpdateAt = 0;
  placeKeyRandomly();
  keyHintAngle = 0;
  keyHintUntil = 0;
  lockedMessageUntil = 0;
  sonarPulses.length = 0;
  revealedTiles.clear();
  sonarReadyAt = 0;
  keysDown.clear();
  gameState = "playing";
  updateCamera();
}

function updateSonar(currentTime) {
  for (const pulse of sonarPulses) {
    const elapsedSeconds = Math.min((currentTime - pulse.lastUpdatedAt) / 1000, 0.05);
    pulse.lastUpdatedAt = currentTime;
    const frameDistance = SONAR_RAY_SPEED * elapsedSeconds;

    for (const ray of pulse.rays) {
      if (!ray.active) continue;
      const substeps = Math.max(1, Math.ceil(frameDistance / 4));
      const stepDistance = frameDistance / substeps;

      for (let step = 0; step < substeps && ray.active; step += 1) {
        let nextX = ray.x + ray.dx * stepDistance;
        let nextY = ray.y + ray.dy * stepDistance;
        const hitHorizontal = isWallAt(nextX, ray.y);
        const hitVertical = isWallAt(ray.x, nextY);

        if (hitHorizontal || hitVertical || isWallAt(nextX, nextY)) {
          if (hitHorizontal) ray.dx *= -1;
          if (hitVertical) ray.dy *= -1;
          if (!hitHorizontal && !hitVertical) {
            ray.dx *= -1;
            ray.dy *= -1;
          }
          ray.bounces += 1;
          if (ray.bounces > SONAR_MAX_BOUNCES) {
            ray.active = false;
            break;
          }
          nextX = ray.x + ray.dx * stepDistance;
          nextY = ray.y + ray.dy * stepDistance;
        }

        ray.x = nextX;
        ray.y = nextY;
        ray.traveled += stepDistance;
        if (ray.traveled >= SONAR_MAX_RADIUS) ray.active = false;

        const col = Math.floor(ray.x / TILE_SIZE);
        const row = Math.floor(ray.y / TILE_SIZE);
        if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
          revealedTiles.set(`${col},${row}`, currentTime + SONAR_REVEAL_TIME);
        }
        if (Math.hypot(ray.x - monster.x, ray.y - monster.y) <= MONSTER_RADIUS + 7) {
          monster.revealedUntil = currentTime + SONAR_REVEAL_TIME;
        }
        if (Math.hypot(ray.x - hunter.x, ray.y - hunter.y) <= HUNTER_RADIUS + 7) {
          hunter.revealedUntil = currentTime + SONAR_REVEAL_TIME;
        }
        if (!keyItem.collected && Math.hypot(ray.x - keyItem.x, ray.y - keyItem.y) <= 15) {
          keyItem.revealedUntil = currentTime + SONAR_REVEAL_TIME;
        }

        const lastPoint = ray.trail[ray.trail.length - 1];
        if (Math.hypot(ray.x - lastPoint.x, ray.y - lastPoint.y) >= 8) {
          ray.trail.push({ x: ray.x, y: ray.y });
          if (ray.trail.length > 26) ray.trail.shift();
        }
      }
    }
  }

  while (sonarPulses.length && currentTime - sonarPulses[0].startedAt > SONAR_EXPAND_TIME + 550) {
    sonarPulses.shift();
  }

  for (const [tile, revealEndsAt] of revealedTiles) {
    if (currentTime >= revealEndsAt) revealedTiles.delete(tile);
  }
}

function drawWater(time) {
  const maximumCameraDepth = ROWS * TILE_SIZE - VIEWPORT_HEIGHT;
  const depthRatio = maximumCameraDepth > 0 ? camera.y / maximumCameraDepth : 0;
  const water = context.createLinearGradient(0, 0, 0, canvas.height);
  water.addColorStop(0, "#0d4960");
  water.addColorStop(0.48, "#082e40");
  water.addColorStop(1, "#031722");
  context.fillStyle = water;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // The whole view becomes colder and darker as the camera follows the player down.
  context.fillStyle = `rgba(0, 7, 16, ${depthRatio * 0.48})`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.globalAlpha = 0.07;
  context.strokeStyle = "#83e3ee";
  context.lineWidth = 2;
  for (let row = 1; row < ROWS; row += 3) {
    context.beginPath();
    for (let x = 0; x <= canvas.width; x += 16) {
      const y = row * TILE_SIZE + Math.sin(x * 0.018 + time * 0.00045 + row) * 7;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

function drawSurface(time) {
  const waveY = SURFACE_Y;

  const surfaceGlow = context.createLinearGradient(0, 0, 0, 230);
  surfaceGlow.addColorStop(0, "rgba(155, 239, 255, .72)");
  surfaceGlow.addColorStop(0.22, "rgba(49, 171, 202, .22)");
  surfaceGlow.addColorStop(1, "rgba(20, 105, 140, 0)");
  context.fillStyle = surfaceGlow;
  context.fillRect(0, 0, COLS * TILE_SIZE, 230);

  // Sunbeams begin at the surface and disappear naturally when it leaves the camera.
  context.save();
  context.globalCompositeOperation = "screen";
  const beamOffset = Math.sin(time * 0.0003) * 18;
  for (let beam = 0; beam < 7; beam += 1) {
    const topX = 55 + beam * 205 + beamOffset;
    const beamGradient = context.createLinearGradient(0, waveY, 0, waveY + 470);
    beamGradient.addColorStop(0, "rgba(157, 241, 255, .16)");
    beamGradient.addColorStop(1, "rgba(57, 157, 184, 0)");
    context.fillStyle = beamGradient;
    context.beginPath();
    context.moveTo(topX, waveY);
    context.lineTo(topX + 42, waveY);
    context.lineTo(topX + 155, waveY + 470);
    context.lineTo(topX + 45, waveY + 470);
    context.closePath();
    context.fill();
  }
  context.restore();

  context.fillStyle = "#79dceb";
  context.fillRect(0, 0, COLS * TILE_SIZE, 20);
  context.strokeStyle = "#c7f8ff";
  context.lineWidth = 3;
  context.beginPath();
  for (let x = 0; x <= COLS * TILE_SIZE; x += 8) {
    const y = waveY + Math.sin(x * 0.035 + time * 0.0022) * 4;
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  context.fillStyle = "rgba(221, 252, 255, .65)";
  for (let x = 18; x < COLS * TILE_SIZE; x += 74) {
    const foamY = waveY + Math.sin(x + time * 0.002) * 3;
    context.beginPath();
    context.arc(x, foamY, 2.5, 0, Math.PI * 2);
    context.fill();
  }
}

function drawSeabed() {
  for (let row = 1; row < ROWS - 1; row += 1) {
    for (let col = 1; col < COLS - 1; col += 1) {
      if (level[row][col] === "#") continue;
      const seed = seeded(row * COLS + col);
      if (seed < 0.82) continue;
      const x = (col + 0.2 + seed * 0.55) * TILE_SIZE;
      const y = (row + 0.25 + seeded(col * 31 + row) * 0.5) * TILE_SIZE;
      context.fillStyle = seed > 0.93 ? "rgba(83,125,116,.34)" : "rgba(52,93,98,.3)";
      context.beginPath();
      context.ellipse(x, y, 2 + seed * 3, 1.5 + seed * 2, seed * 3, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawRock(col, row) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const seed = seeded(row * COLS + col + 17);
  const gradient = context.createRadialGradient(x + 10, y + 8, 2, x + 16, y + 17, 25);
  gradient.addColorStop(0, seed > 0.5 ? "#3d625e" : "#345755");
  gradient.addColorStop(0.65, "#1b3c42");
  gradient.addColorStop(1, "#102c35");
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(x - 1, y - 1, TILE_SIZE + 2, TILE_SIZE + 2, 8 + seed * 6);
  context.fill();

  context.fillStyle = "rgba(115,160,132,.22)";
  context.beginPath();
  context.ellipse(x + 8 + seed * 10, y + 8, 5 + seed * 3, 2.5, seed, 0, Math.PI * 2);
  context.fill();
}

function drawRocks() {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      // The top collision boundary is drawn as the water surface, not as rock.
      if (row !== 0 && level[row][col] === "#") drawRock(col, row);
    }
  }
}

function drawExit(time) {
  const x = (exitTile.col + 0.5) * TILE_SIZE;
  const y = (exitTile.row + 0.5) * TILE_SIZE;
  const glow = context.createRadialGradient(x, y, 2, x, y, 34);
  glow.addColorStop(0, keyItem.collected ? "rgba(112,255,180,.7)" : "rgba(255,190,65,.58)");
  glow.addColorStop(1, keyItem.collected ? "rgba(45,204,112,0)" : "rgba(230,130,35,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, 34, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(x, y);
  const pulse = 1 + Math.sin(time * 0.004) * 0.08;
  context.scale(pulse, pulse);
  context.fillStyle = keyItem.collected ? "#174f45" : "#4f3817";
  context.strokeStyle = keyItem.collected ? "#8affbe" : "#ffd477";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, 12, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = keyItem.collected ? "#8affbe" : "#ffd477";
  if (keyItem.collected) {
    context.fillRect(-2, -7, 4, 14);
    context.fillRect(-7, -2, 14, 4);
  } else {
    context.fillRect(-7, -1, 14, 10);
    context.strokeRect(-5, -9, 10, 11);
  }
  context.restore();
}

function drawKey(time) {
  if (keyItem.collected) return;
  const bob = Math.sin(time * 0.004) * 3;
  context.save();
  context.translate(keyItem.x, keyItem.y + bob);
  context.rotate(Math.sin(time * 0.002) * 0.12);

  const glow = context.createRadialGradient(0, 0, 1, 0, 0, 24);
  glow.addColorStop(0, "rgba(255, 216, 92, .5)");
  glow.addColorStop(1, "rgba(255, 181, 42, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, 24, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffe27a";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(-5, 0, 6, 0, Math.PI * 2);
  context.moveTo(1, 0);
  context.lineTo(13, 0);
  context.lineTo(13, 5);
  context.moveTo(8, 0);
  context.lineTo(8, 5);
  context.stroke();
  context.restore();
}

function drawParticles(time) {
  for (const particle of particles) {
    const x = particle.x + Math.sin(time * 0.0007 + particle.y) * 7;
    const y = (particle.y - time * 0.004 * particle.speed + VIEWPORT_HEIGHT * 20) % VIEWPORT_HEIGHT;
    context.fillStyle = `rgba(170,226,231,${particle.opacity})`;
    context.beginPath();
    context.arc(x, y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function cutLightHole(targetContext, x, y, radius, strength = 1) {
  const gradient = targetContext.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  gradient.addColorStop(0.68, `rgba(0, 0, 0, ${strength * 0.92})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  targetContext.fillStyle = gradient;
  targetContext.beginPath();
  targetContext.arc(x, y, radius, 0, Math.PI * 2);
  targetContext.fill();
}

function cutOrganicLightHole(targetContext, x, y, radius, strength, time, seed = 0) {
  const breathe = 1 + Math.sin(time * 0.0015 + seed) * 0.035;
  cutLightHole(targetContext, x, y, radius * 0.78 * breathe, strength * 0.88);

  // Overlapping, slowly moving lobes keep the edge soft and uneven like suspended fog.
  for (let lobe = 0; lobe < 7; lobe += 1) {
    const angle = seed + lobe * (Math.PI * 2 / 7) + Math.sin(time * 0.00055 + lobe) * 0.16;
    const distance = radius * (0.25 + seeded(seed * 10 + lobe) * 0.13);
    const lobeRadius = radius * (0.42 + seeded(seed * 20 + lobe) * 0.17);
    cutLightHole(
      targetContext,
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      lobeRadius,
      strength * 0.58,
    );
  }
}

function drawFogClouds(currentTime) {
  for (const cloud of fogClouds) {
    const travel = currentTime * 0.001 * cloud.speed;
    const x = ((cloud.x + travel + cloud.radius) % (VIEWPORT_WIDTH + cloud.radius * 2)) - cloud.radius;
    const y = cloud.y + Math.sin(currentTime * 0.00018 + cloud.phase) * 24;

    darknessContext.save();
    darknessContext.translate(x, y);
    darknessContext.scale(1, cloud.stretch);
    const cloudGradient = darknessContext.createRadialGradient(0, 0, 0, 0, 0, cloud.radius);
    cloudGradient.addColorStop(0, `rgba(32, 78, 91, ${cloud.alpha})`);
    cloudGradient.addColorStop(0.48, `rgba(15, 51, 67, ${cloud.alpha * 0.72})`);
    cloudGradient.addColorStop(1, "rgba(2, 16, 25, 0)");
    darknessContext.fillStyle = cloudGradient;
    darknessContext.beginPath();
    darknessContext.arc(0, 0, cloud.radius, 0, Math.PI * 2);
    darknessContext.fill();
    darknessContext.restore();
  }
}

function drawDarkness(currentTime) {
  if (getDepthInMeters() < DARKNESS_START_DEPTH) return;

  darknessContext.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  const fogBase = darknessContext.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  fogBase.addColorStop(0, "rgba(1, 12, 20, .94)");
  fogBase.addColorStop(0.5, "rgba(0, 7, 15, .975)");
  fogBase.addColorStop(1, "rgba(0, 3, 10, .99)");
  darknessContext.fillStyle = fogBase;
  darknessContext.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  drawFogClouds(currentTime);

  darknessContext.globalCompositeOperation = "destination-out";

  const playerScreenX = player.x - camera.x;
  const playerScreenY = player.y - camera.y;
  cutOrganicLightHole(
    darknessContext,
    playerScreenX,
    playerScreenY,
    LOCAL_LIGHT_RADIUS * 1.12,
    0.97,
    currentTime,
    3.7,
  );

  for (const [tile, revealEndsAt] of revealedTiles) {
    const [col, row] = tile.split(",").map(Number);
    const screenX = (col + 0.5) * TILE_SIZE - camera.x;
    const screenY = (row + 0.5) * TILE_SIZE - camera.y;
    if (screenX < -TILE_SIZE || screenX > VIEWPORT_WIDTH + TILE_SIZE) continue;
    if (screenY < -TILE_SIZE || screenY > VIEWPORT_HEIGHT + TILE_SIZE) continue;
    const strength = Math.max(0, Math.min(1, (revealEndsAt - currentTime) / SONAR_REVEAL_TIME));
    cutOrganicLightHole(
      darknessContext,
      screenX,
      screenY,
      TILE_SIZE * 1.08,
      strength * 0.82,
      currentTime,
      col * 0.73 + row * 1.31,
    );
  }

  if (monster.revealedUntil > currentTime) {
    const strength = (monster.revealedUntil - currentTime) / SONAR_REVEAL_TIME;
    cutOrganicLightHole(
      darknessContext,
      monster.x - camera.x,
      monster.y - camera.y,
      TILE_SIZE * 1.25,
      strength,
      currentTime,
      9.4,
    );
  }

  if (hunter.revealedUntil > currentTime) {
    const strength = (hunter.revealedUntil - currentTime) / SONAR_REVEAL_TIME;
    cutOrganicLightHole(
      darknessContext,
      hunter.x - camera.x,
      hunter.y - camera.y,
      TILE_SIZE * 1.2,
      strength,
      currentTime,
      14.2,
    );
  }

  if (!keyItem.collected && keyItem.revealedUntil > currentTime) {
    const strength = (keyItem.revealedUntil - currentTime) / SONAR_REVEAL_TIME;
    cutOrganicLightHole(
      darknessContext,
      keyItem.x - camera.x,
      keyItem.y - camera.y,
      TILE_SIZE * 1.05,
      strength,
      currentTime,
      21.7,
    );
  }

  for (const pulse of sonarPulses) {
    const age = currentTime - pulse.startedAt;
    const alpha = Math.max(0, 1 - age / (SONAR_EXPAND_TIME + 550));
    darknessContext.save();
    darknessContext.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.78})`;
    darknessContext.lineWidth = 22;
    darknessContext.shadowColor = "rgba(0, 0, 0, .9)";
    darknessContext.shadowBlur = 14;
    for (const ray of pulse.rays) {
      if (ray.trail.length < 2) continue;
      darknessContext.beginPath();
      ray.trail.forEach((point, index) => {
        const x = point.x - camera.x;
        const y = point.y - camera.y;
        if (index === 0) darknessContext.moveTo(x, y);
        else darknessContext.lineTo(x, y);
      });
      darknessContext.stroke();
    }
    darknessContext.restore();
  }

  darknessContext.globalCompositeOperation = "source-over";
  context.drawImage(darknessCanvas, 0, 0);
}

function drawSonarWaves(currentTime) {
  for (const pulse of sonarPulses) {
    const age = currentTime - pulse.startedAt;
    const alpha = Math.max(0, 1 - age / (SONAR_EXPAND_TIME + 550));

    context.save();
    context.shadowColor = `rgba(83, 226, 255, ${alpha})`;
    context.shadowBlur = 13;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const ray of pulse.rays) {
      if (ray.trail.length < 2) continue;
      context.strokeStyle = `rgba(100, 235, 255, ${alpha * 0.65})`;
      context.lineWidth = ray.bounces > 0 ? 1.7 : 1.25;
      context.beginPath();
      ray.trail.forEach((point, index) => {
        const x = point.x - camera.x;
        const y = point.y - camera.y;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }
    context.restore();
  }
}

function drawSonarStatus(currentTime) {
  const remaining = Math.max(0, sonarReadyAt - currentTime);
  const ready = remaining === 0;
  context.fillStyle = "rgba(1, 12, 20, .72)";
  context.strokeStyle = ready ? "rgba(103, 232, 255, .7)" : "rgba(112, 152, 165, .35)";
  context.beginPath();
  context.roundRect(18, 18, 132, 54, 8);
  context.fill();
  context.stroke();

  context.textAlign = "left";
  context.fillStyle = "#7ad9eb";
  context.font = "700 10px system-ui, sans-serif";
  context.fillText("SONAR  [SPACE]", 32, 38);
  context.fillStyle = ready ? "#dffbff" : "#718b95";
  context.font = "700 16px system-ui, sans-serif";
  context.fillText(ready ? "READY" : `${(remaining / 1000).toFixed(1)} s`, 32, 61);
}

function drawKeyGuidance(currentTime) {
  context.fillStyle = "rgba(1, 12, 20, .72)";
  context.strokeStyle = keyItem.collected ? "rgba(122, 255, 182, .62)" : "rgba(255, 211, 91, .42)";
  context.beginPath();
  context.roundRect(162, 18, 116, 54, 8);
  context.fill();
  context.stroke();
  context.textAlign = "left";
  context.fillStyle = keyItem.collected ? "#8affbe" : "#ffd66b";
  context.font = "700 10px system-ui, sans-serif";
  context.fillText("ACCESS KEY", 176, 38);
  context.font = "700 15px system-ui, sans-serif";
  context.fillText(keyItem.collected ? "ACQUIRED" : "MISSING", 176, 60);

  if (keyItem.collected || currentTime >= keyHintUntil) return;
  const fade = Math.min(1, (keyHintUntil - currentTime) / 350);
  const centerX = VIEWPORT_WIDTH / 2;
  const centerY = 58;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(keyHintAngle);
  context.shadowColor = `rgba(255, 210, 70, ${fade})`;
  context.shadowBlur = 13;
  context.fillStyle = `rgba(255, 218, 88, ${fade})`;
  context.beginPath();
  context.moveTo(31, 0);
  context.lineTo(10, -10);
  context.lineTo(14, -3);
  context.lineTo(-18, -3);
  context.lineTo(-18, 3);
  context.lineTo(14, 3);
  context.lineTo(10, 10);
  context.closePath();
  context.fill();
  context.restore();

  context.textAlign = "center";
  context.fillStyle = `rgba(255, 225, 133, ${fade})`;
  context.font = "700 10px system-ui, sans-serif";
  context.fillText("APPROXIMATE KEY SIGNAL", centerX, 84);
}

function drawLockedMessage(currentTime) {
  if (currentTime >= lockedMessageUntil || keyItem.collected) return;
  const alpha = Math.min(1, (lockedMessageUntil - currentTime) / 250);
  context.textAlign = "center";
  context.fillStyle = `rgba(255, 207, 94, ${alpha})`;
  context.font = "800 18px system-ui, sans-serif";
  context.fillText("ACCESS KEY REQUIRED", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT - 38);
}

function drawResultScreen() {
  if (gameState === "playing") return;
  const won = gameState === "won";
  context.fillStyle = "rgba(0, 5, 10, .82)";
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  const glow = context.createRadialGradient(
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2,
    10,
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2,
    230,
  );
  glow.addColorStop(0, won ? "rgba(53, 230, 142, .18)" : "rgba(230, 53, 80, .18)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  context.textAlign = "center";
  context.fillStyle = won ? "#88ffc0" : "#ff91a2";
  context.font = "800 15px system-ui, sans-serif";
  context.fillText(won ? "MISSION COMPLETE" : "SIGNAL LOST", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 52);
  context.fillStyle = "#ecfbff";
  context.font = "800 44px system-ui, sans-serif";
  context.fillText(won ? "ESCAPE SUCCESSFUL" : "GAME OVER", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 3);
  context.fillStyle = "#91aab4";
  context.font = "500 16px system-ui, sans-serif";
  context.fillText(
    won ? "The rescue beacon has been reached." : "The creature caught your submarine.",
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2 + 39,
  );
  context.fillStyle = "#c8f5ff";
  context.font = "700 14px system-ui, sans-serif";
  context.fillText("Press R to dive again", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 82);
}

function drawDepthDisplay() {
  const depthInMeters = Math.round(getDepthInMeters());
  const meterX = VIEWPORT_WIDTH - 112;

  context.fillStyle = "rgba(1, 12, 20, .72)";
  context.strokeStyle = "rgba(112, 215, 234, .35)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(meterX, 18, 94, 54, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "#7ad9eb";
  context.font = "700 10px system-ui, sans-serif";
  context.textAlign = "right";
  context.fillText("DEPTH", VIEWPORT_WIDTH - 32, 37);
  context.fillStyle = "#e0faff";
  context.font = "700 20px system-ui, sans-serif";
  context.fillText(`${depthInMeters} m`, VIEWPORT_WIDTH - 32, 61);

  context.strokeStyle = "#7ad9eb";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(meterX + 18, 31);
  context.lineTo(meterX + 18, 56);
  context.lineTo(meterX + 12, 49);
  context.moveTo(meterX + 18, 56);
  context.lineTo(meterX + 24, 49);
  context.stroke();
}

function drawSubmarine() {
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.heading);
  context.fillStyle = "rgba(73,221,245,.14)";
  context.beginPath();
  context.arc(0, 0, 18, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#e3a92f";
  context.strokeStyle = "#ffe28a";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#72d8ea";
  context.beginPath();
  context.arc(4, -1, 3.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c88721";
  context.fillRect(-4, -11, 3, 5);
  context.beginPath();
  context.moveTo(-10, 0);
  context.lineTo(-16, -7);
  context.lineTo(-16, 7);
  context.closePath();
  context.fill();
  context.restore();
}

function drawMonster(time) {
  context.save();
  context.translate(monster.x, monster.y);
  const breathe = 1 + Math.sin(time * 0.004) * 0.05;
  context.scale(breathe, breathe);
  context.fillStyle = monster.isAlerted ? "#9c2947" : "#562a4c";
  context.strokeStyle = "#f184a6";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(0, -7, 24, 31, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = "#8f365c";
  context.lineWidth = 4;
  context.lineCap = "round";
  for (let tentacle = -3; tentacle <= 3; tentacle += 1) {
    context.beginPath();
    context.moveTo(tentacle * 6, 15);
    const wave = Math.sin(time * 0.005 + tentacle) * 10;
    context.quadraticCurveTo(tentacle * 8 + wave, 35, tentacle * 5 - wave, 55);
    context.stroke();
  }

  context.fillStyle = "#ffd5a3";
  context.beginPath();
  context.arc(-9, -13, 4, 0, Math.PI * 2);
  context.arc(9, -13, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHunter(time) {
  context.save();
  context.translate(hunter.x, hunter.y);
  const nextTarget = hunter.path[0];
  if (nextTarget) context.rotate(Math.atan2(nextTarget.y - hunter.y, nextTarget.x - hunter.x));
  context.rotate(Math.sin(time * 0.003) * 0.04);

  context.fillStyle = "#536b7a";
  context.strokeStyle = "#a8c6d2";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(31, 0);
  context.quadraticCurveTo(8, -20, -24, -11);
  context.quadraticCurveTo(-31, 0, -24, 11);
  context.quadraticCurveTo(8, 20, 31, 0);
  context.fill();
  context.stroke();

  context.fillStyle = "#405866";
  context.beginPath();
  context.moveTo(-21, 0);
  context.lineTo(-40, -18);
  context.lineTo(-36, 0);
  context.lineTo(-40, 18);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(-2, -13);
  context.lineTo(-11, -29);
  context.lineTo(9, -14);
  context.closePath();
  context.fill();

  context.fillStyle = "#dff8ff";
  context.beginPath();
  context.arc(17, -5, 3, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#d8eff5";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(22, 5);
  context.lineTo(12, 8);
  context.stroke();
  context.restore();
}

function drawVignette() {
  const vignette = context.createRadialGradient(
    canvas.width / 2, canvas.height / 2, canvas.height * 0.2,
    canvas.width / 2, canvas.height / 2, canvas.width * 0.65,
  );
  vignette.addColorStop(0, "rgba(0,8,13,0)");
  vignette.addColorStop(1, "rgba(0,5,10,.58)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

let previousTime = performance.now();
function gameLoop(currentTime) {
  const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
  previousTime = currentTime;
  updatePlayer(deltaTime);
  updateMonster(deltaTime, currentTime);
  updateHunter(deltaTime, currentTime);
  updateSonar(currentTime);
  checkGameOutcome(currentTime);
  updateCamera();
  drawWater(currentTime);

  context.save();
  context.translate(-camera.x, -camera.y);
  drawSurface(currentTime);
  drawSeabed();
  drawRocks();
  drawExit(currentTime);
  drawKey(currentTime);
  drawMonster(currentTime);
  drawHunter(currentTime);
  drawSubmarine();
  context.restore();

  drawParticles(currentTime);
  drawDarkness(currentTime);
  drawSonarWaves(currentTime);
  drawVignette();
  drawSonarStatus(currentTime);
  drawKeyGuidance(currentTime);
  drawDepthDisplay();
  drawLockedMessage(currentTime);
  drawResultScreen();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
