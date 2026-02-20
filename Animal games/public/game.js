/* ═══════════════════════════════════════════════════════════════════════════
 *  game.js — Phaser 3 Frontend for Capture-Recapture Game
 * ═══════════════════════════════════════════════════════════════════════════
 *  Each student controls an animal sprite that roams a 2D forest map.
 *  When the sprite overlaps with a hidden camera, the client tells the
 *  server via Socket.io. The dashboard updates in real time.
 * ═══════════════════════════════════════════════════════════════════════════ */

// ── Socket.io connection ────────────────────────────────────────────────────
const socket = io();

// ── DOM references ──────────────────────────────────────────────────────────
const joinScreen = document.getElementById("join-screen");
const gameContainer = document.getElementById("game-container");
const nameInput = document.getElementById("player-name");
const joinBtn = document.getElementById("join-btn");
const phaseBadge = document.getElementById("phase-badge");
const btnNext = document.getElementById("btn-next");
const btnReset = document.getElementById("btn-reset");
const playerListEl = document.getElementById("player-list");
const eventLogEl = document.getElementById("event-log");

// ── Game constants ──────────────────────────────────────────────────────────
const MAP_W = 2000;
const MAP_H = 2000;
const VIEW_W = 800;   // viewport (canvas) size
const VIEW_H = 600;
const SPEED = 250;
const CAPTURE_RADIUS = 50;

// Camera positions must match server.js (spread across 2000×2000 map)
const CAMERAS = [
    { id: 1, x: 400, y: 400 },
    { id: 2, x: 1600, y: 400 },
    { id: 3, x: 1000, y: 1000 },
    { id: 4, x: 400, y: 1600 },
    { id: 5, x: 1600, y: 1600 },
];

// ── Phaser variables (set after scene starts) ───────────────────────────────
let phaserGame = null;
let mySprite = null;
let cursors = null;
let otherSprites = {}; // { socketId: spriteObj }
let cameraSprites = [];
let nameLabels = {};
let myColour = "#10b981";
let triggerCooldowns = {}; // prevent spamming same camera

// ═══════════════════════════════════════════════════════════════════════════
//  JOIN FLOW
// ═══════════════════════════════════════════════════════════════════════════
function doJoin() {
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();

    socket.emit("join", name);
    joinScreen.style.display = "none";
    gameContainer.style.display = "block";
    startPhaser();
}

joinBtn.addEventListener("click", doJoin);
nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doJoin();
});

// ═══════════════════════════════════════════════════════════════════════════
//  PHASER 3 GAME
// ═══════════════════════════════════════════════════════════════════════════
function startPhaser() {
    const config = {
        type: Phaser.AUTO,
        width: VIEW_W,
        height: VIEW_H,
        parent: "phaser-game",
        backgroundColor: "#1a2e1a",
        scene: { preload, create, update },
        physics: {
            default: "arcade",
            arcade: { gravity: { y: 0 } },
        },
    };
    phaserGame = new Phaser.Game(config);
}

// ── Preload ─────────────────────────────────────────────────────────────────
function preload() {
    // Generate textures procedurally (no external assets required)
    // Animal dot
    const animalGfx = this.make.graphics({ x: 0, y: 0, add: false });
    animalGfx.fillStyle(0xffffff);
    animalGfx.fillCircle(12, 12, 12);
    animalGfx.generateTexture("animal", 24, 24);
    animalGfx.destroy();

    // Camera icon
    const camGfx = this.make.graphics({ x: 0, y: 0, add: false });
    camGfx.fillStyle(0x334433, 0.7);
    camGfx.fillCircle(16, 16, 16);
    camGfx.lineStyle(2, 0x55ff55, 0.6);
    camGfx.strokeCircle(16, 16, 16);
    camGfx.generateTexture("camera", 32, 32);
    camGfx.destroy();

    // Detection ring
    const ringGfx = this.make.graphics({ x: 0, y: 0, add: false });
    ringGfx.lineStyle(3, 0xff4444, 0.8);
    ringGfx.strokeCircle(CAPTURE_RADIUS, CAPTURE_RADIUS, CAPTURE_RADIUS);
    ringGfx.generateTexture("ring", CAPTURE_RADIUS * 2, CAPTURE_RADIUS * 2);
    ringGfx.destroy();

    // Tree texture (decoration)
    const treeGfx = this.make.graphics({ x: 0, y: 0, add: false });
    treeGfx.fillStyle(0x2d5a27, 0.5);
    treeGfx.fillCircle(10, 10, 10);
    treeGfx.generateTexture("tree", 20, 20);
    treeGfx.destroy();
}

// ── Create ──────────────────────────────────────────────────────────────────
function create() {
    const scene = this;

    // Set world bounds to the full 2000×2000 map
    scene.physics.world.setBounds(0, 0, MAP_W, MAP_H);

    // Map border so players can see the edges
    const border = scene.add.graphics();
    border.lineStyle(3, 0x3a5a3a, 0.6);
    border.strokeRect(0, 0, MAP_W, MAP_H);

    // Background forest ambience — scatter more trees for the larger map
    for (let i = 0; i < 300; i++) {
        const tx = Phaser.Math.Between(10, MAP_W - 10);
        const ty = Phaser.Math.Between(10, MAP_H - 10);
        const s = Phaser.Math.FloatBetween(0.6, 1.8);
        scene.add.image(tx, ty, "tree").setScale(s).setAlpha(0.35);
    }

    // Grid lines (subtle, wider spacing for large map)
    const gridGfx = scene.add.graphics();
    gridGfx.lineStyle(1, 0x2a3a2a, 0.3);
    for (let gx = 0; gx <= MAP_W; gx += 200) {
        gridGfx.lineBetween(gx, 0, gx, MAP_H);
    }
    for (let gy = 0; gy <= MAP_H; gy += 200) {
        gridGfx.lineBetween(0, gy, MAP_W, gy);
    }

    // Cameras are HIDDEN from players — no visible sprites or labels.
    // Detection still works via the overlap check in update().

    // Player sprite — spawn at random position
    mySprite = scene.physics.add.image(
        Phaser.Math.Between(100, MAP_W - 100),
        Phaser.Math.Between(100, MAP_H - 100),
        "animal"
    );
    mySprite.setTint(Phaser.Display.Color.HexStringToColor(myColour).color);
    mySprite.setCollideWorldBounds(true);
    mySprite.setDepth(10);

    // Glow around player
    const glow = scene.add.graphics();
    glow.fillStyle(
        Phaser.Display.Color.HexStringToColor(myColour).color,
        0.15
    );
    glow.fillCircle(0, 0, 18);
    glow.setDepth(9);
    scene.myGlow = glow;

    // Viewport camera follows the player across the large map
    scene.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    scene.cameras.main.startFollow(mySprite, true, 0.08, 0.08);

    // Keyboard input
    cursors = scene.input.keyboard.createCursorKeys();
    scene.wasd = scene.input.keyboard.addKeys("W,A,S,D");

    // Detection ring graphic (hidden by default)
    scene.detectionRings = {};
}

// ── Update (runs every frame) ───────────────────────────────────────────────
function update() {
    if (!mySprite || !cursors) return;

    const scene = this;

    // Movement
    let vx = 0,
        vy = 0;
    if (cursors.left.isDown || scene.wasd.A.isDown) vx = -SPEED;
    if (cursors.right.isDown || scene.wasd.D.isDown) vx = SPEED;
    if (cursors.up.isDown || scene.wasd.W.isDown) vy = -SPEED;
    if (cursors.down.isDown || scene.wasd.S.isDown) vy = SPEED;

    // Diagonal normalisation
    if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
    }

    mySprite.setVelocity(vx, vy);

    // Glow follows sprite
    if (scene.myGlow) {
        scene.myGlow.setPosition(mySprite.x, mySprite.y);
    }

    // Send position to server (throttled ~20 fps)
    if (!scene._lastSend || scene.time.now - scene._lastSend > 50) {
        socket.emit("move", { x: mySprite.x, y: mySprite.y });
        scene._lastSend = scene.time.now;
    }

    // Camera overlap check
    CAMERAS.forEach((cam) => {
        const dx = mySprite.x - cam.x;
        const dy = mySprite.y - cam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CAPTURE_RADIUS) {
            // Trigger capture (cooldown prevents spam)
            // No visual ring — cameras are invisible to players
            const now = Date.now();
            if (!triggerCooldowns[cam.id] || now - triggerCooldowns[cam.id] > 2000) {
                triggerCooldowns[cam.id] = now;
                socket.emit("camera-trigger", { cameraId: cam.id });
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  SOCKET.IO — RECEIVE EVENTS
// ═══════════════════════════════════════════════════════════════════════════

// ── Full state update (phase, stats, players) ───────────────────────────────
socket.on("state-update", (data) => {
    // Phase badge
    if (data.phase === "capture") {
        phaseBadge.textContent = "Phase 1 — Capture";
        phaseBadge.className = "phase-badge phase-capture";
    } else if (data.phase === "recapture") {
        phaseBadge.textContent = "Phase 2 — Recapture";
        phaseBadge.className = "phase-badge phase-recapture";
    } else {
        phaseBadge.textContent = "Results";
        phaseBadge.className = "phase-badge phase-results";
    }

    // Lincoln-Petersen stats
    document.getElementById("stat-M").textContent = data.lp.M;
    document.getElementById("stat-C").textContent = data.lp.C;
    document.getElementById("stat-R").textContent = data.lp.R;
    document.getElementById("stat-actual").textContent = data.lp.actual;
    document.getElementById("estimate-value").textContent =
        data.lp.estimate !== null ? data.lp.estimate : "—";

    // Player list
    playerListEl.innerHTML = "";
    Object.values(data.players).forEach((p) => {
        const li = document.createElement("li");
        const record = data.captureDB[p.name] || {};

        let badges = "";
        if (record.captured)
            badges += '<span class="player-badge badge-captured">Captured</span> ';
        if (record.recaptured)
            badges += '<span class="player-badge badge-recaptured">Recaptured</span>';

        li.innerHTML = `
      <span class="player-dot" style="background:${p.colour}"></span>
      <span class="player-name">${escapeHtml(p.name)}</span>
      ${badges}
    `;
        playerListEl.appendChild(li);
    });

    // Store my colour
    const me = data.players[socket.id];
    if (me) {
        myColour = me.colour;
        if (mySprite) {
            mySprite.setTint(
                Phaser.Display.Color.HexStringToColor(myColour).color
            );
        }
    }
});

// ── Other players: intentionally NOT rendered on the map ────────────────────
// Each player only sees their own animal, just like in a real ecology study.
socket.on("players-update", () => { });

// ── Capture event (flash effect) ────────────────────────────────────────────
socket.on("capture-event", (data) => {
    const phase = data.phase === "capture" ? "📸 CAPTURED" : "🔁 RECAPTURED";
    addEventLog(`${phase}: ${data.playerName} at Camera ${data.cameraId}`);

    // Flash the Phaser canvas border
    const el = document.getElementById("phaser-game");
    el.style.boxShadow =
        data.phase === "capture"
            ? "0 0 30px rgba(16, 185, 129, 0.6)"
            : "0 0 30px rgba(59, 130, 246, 0.6)";
    setTimeout(() => {
        el.style.boxShadow =
            "0 0 40px rgba(16, 185, 129, 0.1), 0 4px 20px rgba(0,0,0,0.4)";
    }, 600);
});

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
btnNext.addEventListener("click", () => socket.emit("next-phase"));
btnReset.addEventListener("click", () => {
    if (confirm("Reset the entire game?")) socket.emit("reset-game");
});

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function addEventLog(msg) {
    const div = document.createElement("div");
    div.className = "event";
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${msg}`;
    eventLogEl.prepend(div);
    // Keep max 50 entries
    while (eventLogEl.children.length > 50) eventLogEl.lastChild.remove();
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}
