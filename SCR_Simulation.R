##############################################################################
#  Spatial Capture-Recapture (SCR) Simulation & Animation
# --------------------------------------------------------------------------
#  PURPOSE : Teaching tool – animates animals moving through a camera-trap
#            array and highlights "captures" when an animal passes close to
#            a trap.
#
#  OUTPUT  : An animated GIF saved to the working directory.
#
#  AUTHOR  : Auto-generated for population-ecology-games
#  DATE    : 2026-02-18
##############################################################################

# ── 0. Packages ──────────────────────────────────────────────────────────────
# Use a local library folder to avoid OneDrive write-permission issues.
local_lib <- file.path(getwd(), "r_libs")
if (!dir.exists(local_lib)) dir.create(local_lib, recursive = TRUE)
.libPaths(c(local_lib, .libPaths()))

repo <- "https://cloud.r-project.org"

# Helper: install a specific CRAN version if not already present.
# We pin versions compatible with R 4.1.0.
ensure_pkg <- function(pkg, ver = NULL) {
  if (requireNamespace(pkg, quietly = TRUE)) return(invisible())
  if (is.null(ver)) {
    install.packages(pkg, lib = local_lib, repos = repo)
  } else {
    if (!requireNamespace("remotes", quietly = TRUE))
      install.packages("remotes", lib = local_lib, repos = repo)
    remotes::install_version(pkg, version = ver,
                             lib = local_lib, repos = repo,
                             upgrade = "never")
  }
}

# Install compatible package versions for R 4.1.0
ensure_pkg("tibble")
ensure_pkg("dplyr")
ensure_pkg("gifski")
ensure_pkg("ggplot2", "3.4.4")    # last version without S7 dependency
ensure_pkg("gganimate", "1.0.8")  # works with ggplot2 3.4.x

library(ggplot2)
library(gganimate)
library(tibble)
library(dplyr)
library(gifski)   # renderer for high-quality GIF output

# ── 1. USER-ADJUSTABLE PARAMETERS ───────────────────────────────────────────
# Change these values to explore different scenarios.

N            <- 5       # Number of individual animals
sigma        <- 8       # Home-range scale (std dev of movement steps)
n_steps      <- 100     # Number of time steps to simulate
capture_dist <- 3       # Distance threshold for a "capture" event

# Landscape bounds
x_min <- 0;  x_max <- 100
y_min <- 0;  y_max <- 100

# Camera-trap grid specification
trap_rows <- 4          # Number of trap rows
trap_cols <- 4          # Number of trap columns
# Traps are placed evenly in the central 60 % of the landscape
trap_x_range <- c(20, 80)
trap_y_range <- c(20, 80)

set.seed(42)            # For reproducibility (remove for random runs)

# ── 2. CREATE THE TRAP ARRAY ────────────────────────────────────────────────
trap_x <- seq(trap_x_range[1], trap_x_range[2],
              length.out = trap_cols)
trap_y <- seq(trap_y_range[1], trap_y_range[2],
              length.out = trap_rows)

traps <- expand.grid(trap_x = trap_x, trap_y = trap_y) |>
  as_tibble()

cat("Trap array:", nrow(traps), "traps placed.\n")

# ── 3. SIMULATE ANIMAL MOVEMENT ─────────────────────────────────────────────
# Each animal has a fixed "Activity Center" drawn at random.
# At each time step the animal takes a biased random walk:
#   new_position = activity_center + rnorm(sigma)
# This keeps the animal within roughly ±2·sigma of its center,
# mimicking a home-range constraint.

activity_centers <- tibble(
  animal_id = 1:N,
  ac_x      = runif(N, x_min + 15, x_max - 15),
  ac_y      = runif(N, y_min + 15, y_max - 15)
)

# Build the full movement table (one row per animal per time step)
movements <- tibble()

for (i in 1:N) {
  ac_x_i <- activity_centers$ac_x[i]
  ac_y_i <- activity_centers$ac_y[i]

  # Generate positions as draws from a bivariate normal centred on the

  # activity centre.  This is equivalent to a "biased random walk" that
  # always pulls the animal back toward its centre.
  xs <- pmin(pmax(ac_x_i + rnorm(n_steps, 0, sigma), x_min), x_max)
  ys <- pmin(pmax(ac_y_i + rnorm(n_steps, 0, sigma), y_min), y_max)

  movements <- bind_rows(
    movements,
    tibble(
      animal_id = i,
      step      = 1:n_steps,
      x         = xs,
      y         = ys
    )
  )
}

# Add a label for pretty legends
movements <- movements |>
  mutate(animal_label = paste("Animal", animal_id))

cat("Movement tracks generated:",
    N, "animals ×", n_steps, "steps.\n")

# ── 4. DETECT CAPTURES ──────────────────────────────────────────────────────
# For every (animal, step) pair check if the animal is within
# `capture_dist` of ANY trap.

detect_capture <- function(ax, ay, traps_df, dist_thresh) {
  dists <- sqrt((traps_df$trap_x - ax)^2 +
                (traps_df$trap_y - ay)^2)
  any(dists <= dist_thresh)
}

movements <- movements |>
  rowwise() |>
  mutate(
    captured = detect_capture(x, y, traps, capture_dist)
  ) |>
  ungroup()

n_captures <- sum(movements$captured)
cat("Total capture events:", n_captures, "\n")

# ── 5. BUILD THE ANIMATION ──────────────────────────────────────────────────
# Colour palette for individual animals
animal_colours <- c(
  "#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e"
)
# Extend palette if more than 5 animals
if (N > length(animal_colours)) {
  animal_colours <- rep_len(animal_colours, N)
}

# Map each animal to its colour for captured/uncaptured states
movements <- movements |>
  mutate(
    display_colour = ifelse(
      captured, "Captured", animal_label
    )
  )

# Prepare colour scale (animals + capture highlight)
colour_values <- setNames(animal_colours[1:N],
                          paste("Animal", 1:N))
colour_values["Captured"] <- "red"

p <- ggplot() +

  # ── Landscape background
  annotate("rect",
           xmin = x_min, xmax = x_max,
           ymin = y_min, ymax = y_max,
           fill = "#f0f7e8", colour = "grey60") +

  # ── Camera traps (black squares)
  geom_point(data = traps,
             aes(x = trap_x, y = trap_y),
             shape = 15, size = 3, colour = "black") +

  # ── Capture "ring" (larger translucent red circle)
  geom_point(
    data = movements |> filter(captured),
    aes(x = x, y = y),
    shape  = 21,
    size   = 6,
    colour = "red",
    fill   = NA,
    stroke = 1.5
  ) +

  # ── Animal dots

  geom_point(
    data = movements,
    aes(x = x, y = y, colour = display_colour),
    size = 3
  ) +

  # ── Activity centres (cross-hairs, faint)
  geom_point(
    data = activity_centers,
    aes(x = ac_x, y = ac_y),
    shape = 3, size = 4,
    colour = "grey40", alpha = 0.5
  ) +

  # ── Scales & labels
  scale_colour_manual(
    values = colour_values,
    name   = "Individual"
  ) +
  labs(
    title    = "Spatial Capture-Recapture Simulation",
    subtitle = "Step {closest_state} of {n_steps}",
    x        = "X coordinate",
    y        = "Y coordinate",
    caption  = paste0(
      "N = ", N, "  |  sigma = ", sigma,
      "  |  traps = ", nrow(traps),
      "  |  capture dist = ", capture_dist
    )
  ) +
  coord_equal(xlim = c(x_min, x_max),
              ylim = c(y_min, y_max)) +
  theme_minimal(base_size = 13) +
  theme(
    plot.title    = element_text(face = "bold", hjust = 0.5),
    plot.subtitle = element_text(hjust = 0.5),
    legend.position = "right",
    panel.grid.minor = element_blank()
  ) +

  # ── gganimate: transition across time steps
  transition_states(step, transition_length = 1,
                    state_length = 1) +
  ease_aes("cubic-in-out") +
  shadow_wake(wake_length = 0.08, alpha = 0.3)

# ── 6. RENDER & SAVE ────────────────────────────────────────────────────────
out_file <- "SCR_Simulation.gif"
cat("Rendering animation to:", out_file, "...\n")

anim <- animate(
  p,
  nframes  = n_steps * 2,   # smoother animation
  fps      = 12,
  width    = 700,
  height   = 650,
  renderer = gifski_renderer(out_file)
)

cat("Done! Animation saved as", out_file, "\n")
