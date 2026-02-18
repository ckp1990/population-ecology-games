# 🌿 Population Ecology Games

Educational tools for teaching population ecology concepts through interactive simulations and games.

---

## 1. SCR Simulation (R)

An animated **Spatial Capture-Recapture** visualization that simulates animals moving through a camera-trap array.

| Feature | Detail |
|---|---|
| **Language** | R |
| **Output** | Animated GIF (`SCR_Simulation.gif`) |
| **Packages** | ggplot2, gganimate, gifski, dplyr, tibble |

### How to Run

```r
setwd("path/to/population-ecology-games")
source("SCR_Simulation.R")
```

### Key Parameters

| Parameter | Default | Description |
|---|---|---|
| `N` | 5 | Number of animals |
| `sigma` | 8 | Home-range scale |
| `n_steps` | 100 | Time steps |
| `capture_dist` | 3 | Detection distance |
| `trap_rows` / `trap_cols` | 4 / 4 | Trap grid size |

📖 Full guide: [SCR_Simulation_Guide.md](SCR_Simulation_Guide.md)

---

## 2. Capture-Recapture Multiplayer Game (Web)

A real-time **multiplayer browser game** where students play as animals roaming a forest while hidden cameras detect them. A live **Scientist Dashboard** calculates the population estimate using the **Lincoln-Petersen Index**.

| Feature | Detail |
|---|---|
| **Engine** | Phaser 3 |
| **Multiplayer** | Socket.io (real-time) |
| **Backend** | Node.js + Express |
| **Location** | `Animal Games/` |

### How to Run

```bash
cd "Animal Games"
npm install
node server.js
```

Then open **http://localhost:3000** in a browser. Share the URL with students on the same network.

### Game Flow

1. **Join** — Each student enters a name and joins the game.
2. **Phase 1 (Capture)** — Students move around the map (arrow keys / WASD). Cameras detect nearby players and mark them as **captured**.
3. **Phase 2 (Recapture)** — The teacher clicks "Next Phase". Players continue moving; cameras now record **recaptures**.
4. **Results** — The dashboard applies the Lincoln-Petersen formula:

   > **N̂ = (M × C) / R**
   >
   > M = marked in 1st sample · C = caught in 2nd sample · R = recaptured marks

### Project Structure

```
Animal Games/
├── server.js          # Node.js + Socket.io backend
├── package.json       # Dependencies
└── public/
    ├── index.html     # Game page + Dashboard
    ├── game.js        # Phaser 3 frontend logic
    └── style.css      # Dashboard styling
```

---

## Requirements

| Tool | Version |
|---|---|
| **R** | ≥ 4.1.0 (for SCR Simulation) |
| **Node.js** | ≥ 16 (for Multiplayer Game) |

---

## License

Open for educational use.
