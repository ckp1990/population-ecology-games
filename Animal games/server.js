// ═══════════════════════════════════════════════════════════════════════════
//  server.js — Capture-Recapture Multiplayer Game Server
// ═══════════════════════════════════════════════════════════════════════════
//  Built with Node.js, Express, and Socket.io
//  Tracks "Capture" and "Recapture" phases and computes the
//  Lincoln-Petersen population estimate in real time.
// ═══════════════════════════════════════════════════════════════════════════

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── Serve static files from /public ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Configuration ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

// Camera-trap positions (x, y) on the 2000 × 2000 game map
const CAMERAS = [
  { id: 1, x: 400, y: 400 },
  { id: 2, x: 1600, y: 400 },
  { id: 3, x: 1000, y: 1000 },
  { id: 4, x: 400, y: 1600 },
  { id: 5, x: 1600, y: 1600 },
];

// Detection radius — how close a sprite must be to trigger a capture (pixels)
const CAPTURE_RADIUS = 50;

// ── Game State ──────────────────────────────────────────────────────────────
// phase: "capture" → first survey pass
//        "recapture" → second survey pass
//        "results"   → experiment done
let gamePhase = "capture";

// players: { socketId: { name, x, y, colour } }
const players = {};

// captureDB: { playerName: { captured: bool, recaptured: bool } }
//   captured   = seen by a camera during the CAPTURE phase
//   recaptured = seen by a camera during the RECAPTURE phase
const captureDB = {};

// ── Helper: Lincoln-Petersen Index ──────────────────────────────────────────
//  N̂ = (M × C) / R
//  M = number marked in first sample (captured)
//  C = total caught in second sample (recaptured-phase detections)
//  R = number in second sample that were already marked
function lincolnPetersen() {
  const entries = Object.values(captureDB);
  const M = entries.filter((e) => e.captured).length;        // marked
  const C = entries.filter((e) => e.recaptured).length;      // second-sample size
  const R = entries.filter((e) => e.captured && e.recaptured).length; // recaptured marks

  const estimate = R > 0 ? Math.round((M * C) / R) : null;
  return { M, C, R, estimate, actual: Object.keys(captureDB).length };
}

// ── Helper: broadcast full state to every client ────────────────────────────
function broadcastState() {
  const lp = lincolnPetersen();
  io.emit("state-update", {
    phase: gamePhase,
    players,
    captureDB,
    cameras: CAMERAS,
    lp,
  });
}

// ── Socket.io Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✦ Player connected: ${socket.id}`);

  // ── Player joins and picks a name ────────────────────────────────────────
  socket.on("join", (name) => {
    const trimmed = name.trim().substring(0, 20) || "Anon";
    // Random animal colour
    const colours = [
      "#1abc9c", "#e67e22", "#9b59b6",
      "#e74c3c", "#3498db", "#2ecc71",
      "#f1c40f", "#e84393", "#00cec9",
    ];
    const colour = colours[Object.keys(players).length % colours.length];

    players[socket.id] = {
      name: trimmed,
      x: 1000 + Math.random() * 40 - 20,
      y: 1000 + Math.random() * 40 - 20,
      colour,
    };

    // Initialise capture record
    if (!captureDB[trimmed]) {
      captureDB[trimmed] = { captured: false, recaptured: false };
    }

    console.log(`   → "${trimmed}" joined (${colour})`);
    broadcastState();
  });

  // ── Player moves ─────────────────────────────────────────────────────────
  socket.on("move", (pos) => {
    if (!players[socket.id]) return;
    players[socket.id].x = pos.x;
    players[socket.id].y = pos.y;

    // Broadcast positions to all clients for smooth rendering
    io.emit("players-update", players);
  });

  // ── Camera detection (sent by client when overlap detected) ──────────────
  socket.on("camera-trigger", (data) => {
    const player = players[socket.id];
    if (!player) return;

    const cam = CAMERAS.find((c) => c.id === data.cameraId);
    if (!cam) return;

    // Server-side distance verification (anti-cheat)
    const dx = player.x - cam.x;
    const dy = player.y - cam.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > CAPTURE_RADIUS + 10) return; // small tolerance

    const record = captureDB[player.name];
    if (!record) return;

    if (gamePhase === "capture" && !record.captured) {
      record.captured = true;
      console.log(`📸 CAPTURED: "${player.name}" at camera ${cam.id}`);
      io.emit("capture-event", {
        playerName: player.name,
        cameraId: cam.id,
        phase: "capture",
      });
      broadcastState();
    }

    if (gamePhase === "recapture" && !record.recaptured) {
      record.recaptured = true;
      console.log(`📸 RECAPTURED: "${player.name}" at camera ${cam.id}`);
      io.emit("capture-event", {
        playerName: player.name,
        cameraId: cam.id,
        phase: "recapture",
      });
      broadcastState();
    }
  });

  // ── Admin: advance phase ─────────────────────────────────────────────────
  socket.on("next-phase", () => {
    if (gamePhase === "capture") {
      gamePhase = "recapture";
      console.log("═══ Phase changed → RECAPTURE ═══");
    } else if (gamePhase === "recapture") {
      gamePhase = "results";
      console.log("═══ Phase changed → RESULTS ═══");
    }
    broadcastState();
  });

  // ── Admin: reset everything ──────────────────────────────────────────────
  socket.on("reset-game", () => {
    gamePhase = "capture";
    Object.keys(captureDB).forEach((k) => {
      captureDB[k] = { captured: false, recaptured: false };
    });
    console.log("═══ Game RESET ═══");
    broadcastState();
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const player = players[socket.id];
    if (player) console.log(`✧ Player left: "${player.name}"`);
    delete players[socket.id];
    broadcastState();
  });
});

// ── Start Server ────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🌿 Capture-Recapture Game Server`);
  console.log(`   Running on http://localhost:${PORT}\n`);
});
