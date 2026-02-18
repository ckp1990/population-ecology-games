# Spatial Capture-Recapture (SCR) Simulation

> An animated teaching tool that visualizes how animals move through a camera-trap array and get "captured."

---

## What Is Spatial Capture-Recapture?

Spatial Capture-Recapture (SCR) is a statistical framework used to estimate **animal abundance and density** while accounting for the spatial locations of both detectors (e.g., camera traps) and individual animals. Unlike traditional capture-recapture, SCR models explicitly incorporate:

| Concept | Description |
|---|---|
| **Activity Centre** | The central point of an individual's home range — where it spends most of its time. |
| **Detection Function** | The probability of detecting an animal decreases with distance from the detector. Controlled by σ (sigma). |
| **Sigma (σ)** | The spatial scale of movement. A larger σ means the animal roams farther from its activity centre. |
| **State Space** | The full landscape over which animals may be distributed. |

---

## What This Simulation Shows

The animation visualizes the core SCR assumptions in action:

1. **Landscape** — A 100 × 100 unit 2D arena (light green background).
2. **Camera Traps** — A regular grid of fixed detectors shown as **black squares**.
3. **Animals** — Coloured dots, each tied to a hidden activity centre (**+** cross-hair).
4. **Movement** — At every time step each animal's position is drawn from a normal distribution centred on its activity centre, simulating a **biased random walk** that keeps it local.
5. **Captures** — When an animal comes within a threshold distance of a trap, a **red ring** appears around it to signal a detection event.

### Movement Model (Biased Random Walk)

```
position(t) = activity_centre + Normal(0, σ)
```

Each coordinate (X, Y) is drawn independently. The animal is "pulled back" toward its centre every step — it doesn't drift away over time like a pure random walk.

---

## Adjustable Parameters

All parameters are clearly labelled at the top of `SCR_Simulation.R`:

| Parameter | Default | What It Controls |
|---|---|---|
| `N` | 5 | Number of individual animals |
| `sigma` | 8 | Home-range scale (movement spread) |
| `n_steps` | 100 | Number of time steps simulated |
| `capture_dist` | 3 | Distance threshold for a capture event |
| `trap_rows` | 4 | Rows in the camera-trap grid |
| `trap_cols` | 4 | Columns in the camera-trap grid |
| `set.seed()` | 42 | Random seed — remove for different runs |

### Things to Try

- **Increase `sigma`** → animals roam more widely, overlap more traps, more captures.
- **Decrease `sigma`** → animals are tightly clustered around their centres, fewer captures.
- **Increase `N`** → more animals, busier animation.
- **Increase `capture_dist`** → traps become more sensitive, more detections.
- **Change `trap_rows` / `trap_cols`** → denser or sparser trap array.

---

## How to Run

### Prerequisites

- **R ≥ 4.1.0** installed
- Internet connection (for first-run package installs)

### Steps

```r
# In R or RStudio, set your working directory:
setwd("d:/population ecology games")

# Run the script:
source("SCR_Simulation.R")
```

The script will:
1. Install any missing packages into a local `r_libs/` folder.
2. Simulate animal movements and detect captures.
3. Render and save `SCR_Simulation.gif` in the working directory.

---

## Output

| File | Description |
|---|---|
| `SCR_Simulation.gif` | Animated GIF showing animals moving through the trap array |

### Visual Legend

| Symbol | Meaning |
|---|---|
| ■ Black square | Camera trap location |
| Coloured dot | Individual animal |
| **+** Grey cross-hair | Activity centre (hidden home-range centre) |
| 🔴 Red ring | Capture event — animal detected by a nearby trap |
| Fading trail | Recent movement path (`shadow_wake`) |

---

## Ecological Relevance

This simulation helps students understand:

- **Why trap placement matters** — animals whose activity centres fall outside the trap array may never be detected.
- **Detection heterogeneity** — animals closer to traps are captured more often.
- **Home-range behaviour** — real animals don't move randomly; they stay within a defined area.
- **The role of σ** — this single parameter controls how "wide-ranging" an animal is and directly affects detection probability.

These are the same principles underlying real-world SCR studies used to estimate populations of tigers, snow leopards, bears, and many other species using camera-trap data.

---

## Dependencies

| Package | Purpose |
|---|---|
| `ggplot2` (3.4.4) | Plotting |
| `gganimate` (1.0.8) | Animation transitions |
| `gifski` | High-quality GIF rendering |
| `tibble` | Tidy data storage |
| `dplyr` | Data manipulation |
| `remotes` | Installing pinned package versions |

---

*Generated for the [population-ecology-games](https://github.com/ckp1990/population-ecology-games) repository.*
