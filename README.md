# Scrap Mechanic Overview

Export your **Scrap Mechanic** Survival world into a fast, interactive, zoomable map — with markers you can place and keep.

This packages [**sm_overview**](https://github.com/the1killer/sm_overview) by **The1Killer** with a streamlined, **fully automated** workflow that works on game versions **0.6.6 and later** (including 0.7.x), and a **rewritten viewer** built on React + Leaflet.

![overview architecture](https://img.shields.io/badge/viewer-React%20%2B%20Leaflet-61dafb) ![build](https://img.shields.io/badge/pre--render-Sharp%20tile%20pyramid-99cc00)

---

## Why this is fast

The original viewer created **~16,000 DOM nodes** (one `<div>` per world cell, each with an image) and rebuilt them on every pan/zoom — slow, and blurry when zoomed out.

This viewer **pre-renders the entire map once into a `{z}/{x}/{y}` tile pyramid** (Sharp, server-side), then displays it with Leaflet's native `L.tileLayer`. That's GPU-composited, only paints the visible viewport, and shows **full detail at every zoom level**. Panning and zooming are instant, and you can place **persistent markers** (saved to `localStorage`).

```
scrap-mechanic-overview/
├── game-patches/
│   ├── tile_database.lua      # replace game's (adds GetLegacyID lookup)
│   └── export_block.lua       # snippet to paste into terrain_overworld.lua
├── tools/
│   ├── extract_cells.py       # game log  ->  viewer cells.json
│   ├── build-tiles.mjs        # cells.json + img  ->  tile pyramid (Sharp)
│   └── serve.sh               # install + build(if needed) + dev server
├── viewer/                    # React + Vite + TS + Leaflet app
│   ├── public/img/            # source tile + POI images
│   └── src/…
└── legacy/                    # the original vanilla viewer (reference)
```

---

## Requirements

- Scrap Mechanic (Survival mode) on Steam — Windows, or Linux via Proton
- [Bun](https://bun.sh) (runs the viewer + tile builder)
- Python 3 (extraction only)
- ~10 GB free RAM for the tile build (one-time, per world)
- A web browser

---

## Setup

### 1. Back up your save (!!!)

You're editing game script files; back up first.

- **Windows:** `%localappdata%\Axolot Games\Scrap Mechanic\UserData\`
- **Linux/Proton:** `…/steamapps/compatdata/387990/pfx/drive_c/users/steamuser/AppData/Local/Axolot Games/Scrap Mechanic/UserData/`

Also back up the two game files in step 2.

### 2. Patch the game files

Game script root:

- **Windows:** `C:\Program Files (x86)\Steam\steamapps\common\Scrap Mechanic\Survival\Scripts\terrain\`
- **Linux/Proton:** `~/.local/share/Steam/steamapps/common/Scrap Mechanic/Survival/Scripts/terrain/`

**(a)** Replace `overworld/tile_database.lua` with [`game-patches/tile_database.lua`](game-patches/tile_database.lua) (adds the `GetLegacyID` lookup the exporter needs).

**(b)** In `terrain_overworld.lua`, find `Load()`. Inside the `if sm.terrainData.exists() then` block, paste [`game-patches/export_block.lua`](game-patches/export_block.lua) **immediately after** `CreateCellTileStorageKeys()` and **before** `return true`.

The block runs once per session, is wrapped in `pcall()`, and logs any error — so it can't break your game's load. (Game updates wipe these patches; re-apply after updates, or verify game files to remove them.)

### 3. Export your world

Launch Scrap Mechanic, **load your Survival save**, let the world finish loading, then quit. The data is written to the newest game log once automatically. Then:

```bash
python3 tools/extract_cells.py
# -> writes viewer/public/data/cells.json  (your seed + all cells)
```

> Can't find the log? Pass it explicitly, or set `STEAM_COMMON`. On Linux/Proton logs live in `…/Scrap Mechanic/Logs/game-*.log`.

### 4. Build the tile pyramid + run the viewer

```bash
bash tools/serve.sh
```

This installs deps, **builds the tile pyramid** (`tools/build-tiles.mjs` — composites the full map once and slices it into ~21k tiles, ~1–2 min), and starts the dev server. Open **http://localhost:8080**.

`serve.sh` only rebuilds the pyramid when your `cells.json` is newer than the last build, so subsequent runs are instant until you export new data. You can force a rebuild anytime with `bun tools/build-tiles.mjs`.

> **Tile detail:** the pyramid renders at 256 px per cell by default. Pass `--ppc 128` for a smaller/faster build (less detail), or higher for more. POIs (stations, warehouses, hideout, …) are baked into the map at full fidelity.

---

## Using the map

- **Pan / zoom** — instant. Full detail at every zoom level.
- **Click a cell** — inspect its coordinates, terrain type, tile ID, rotation, and POI. The cell coords map directly to the in-game `/cell x,y,z` chat command.
- **Markers** — the “Selected” tab has an **Add marker here** form (label + color). Markers are saved to your browser (`localStorage`) and listed under the **Markers** tab (click to fly, edit, delete).
- **POIs** — toggle POI name labels from the “Selected” tab; the POI imagery itself is part of the rendered map. The **POIs** tab lists every point of interest on your world.

---

## How it works

**Export (0.6.6+ workaround):** Scrap Mechanic 0.6.6 blocked `sm.json.save` to arbitrary paths (`'$SURVIVAL_DATA/cells.json' is not located in the same content id as the caller`). The export block instead serializes cells with `sm.json.writeJsonString()` and `sm.log.info()`s them to the game log between `START COPYING` / `STOP COPYING` markers; `extract_cells.py` strips the log-line prefixes and parses the JSON.

**Pre-render (`build-tiles.mjs`):** builds a 1-px-per-cell terrain-color base, nearest-neighbor upscales it to full resolution (256 px/cell), composites every cell's rotated tile image + road segments + POI overlays in a **single Sharp pass**, then downsamples and slices the result into a standard Leaflet `{z}/{x}/{y}.webp` pyramid. North is up.

**Viewer:** React + Vite + TypeScript. Vanilla Leaflet with `L.CRS.Simple` displays the pre-rendered pyramid via `L.tileLayer`; cell ↔ lat/lng conversion is derived from the pyramid geometry. Markers persist in `localStorage`.

---

## Credits & license

Derivative of [**sm_overview**](https://github.com/the1killer/sm_overview) by **The1Killer**, including: the cell/POI/road parsing logic, the full tile + POI image set (`viewer/public/img/`), the `tile_database.lua` modification (by **Arkanorian**, adds `GetLegacyID`), and the cell-export concept. The original vanilla viewer is preserved in [`legacy/`](legacy) for reference.

**Added here:** the 0.6.6+ log-based export block (with `pcall` error handling), the automated `extract_cells.py` log parser, the Sharp **pre-render tile-pyramid builder**, and the **React/Leaflet viewer** with persistent markers.

Released under [**CC BY-NC-SA 4.0**](https://creativecommons.org/licenses/by-nc-sa/4.0/) — same license as upstream (see [LICENSE](LICENSE)): free for non-commercial use with attribution; derivatives must use the same license.

*Scrap Mechanic is property of Axolot Games AB. This project is unaffiliated.*
