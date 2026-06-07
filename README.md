# Scrap Mechanic Overview

Export your **Scrap Mechanic** Survival world into an interactive, zoomable map.

This packages the [**sm_overview**](https://github.com/the1killer/sm_overview) viewer by **The1Killer** with a streamlined, **fully automated** workflow that works on game versions **0.6.6 and later** (including 0.7.x), where Scrap Mechanic blocked the original `sm.json.save` export method.

---

## What it does

1. **Two small game-file patches** make the game dump your world's cell data (terrain type, POIs, roads) as JSON into the game log — once, automatically, while the world loads.
2. **`extract_cells.py`** pulls that JSON out of the log for you — no manual copy-paste or online minifier.
3. **`serve.sh`** runs a zero-dependency local web server that renders the data as an interactive [Leaflet](https://leafletjs.com/) map with terrain tiles, POI markers, and click-to-inspect cell info (coordinates, type, tile ID — handy for the in-game `/tp` / `/cell` chat commands).

```
scrap-mechanic-overview/
├── game-patches/
│   ├── tile_database.lua      # replace game's (adds GetLegacyID lookup)
│   └── export_block.lua       # snippet to paste into terrain_overworld.lua
├── tools/
│   ├── extract_cells.py       # game log  ->  viewer cells.json
│   └── serve.sh               # local web viewer
└── viewer/                    # The1Killer's Leaflet map (index.html + assets)
```

---

## Requirements

- Scrap Mechanic (Survival mode) on Steam — Windows, or Linux via Proton
- Python 3 (extraction + viewer server)
- A web browser

---

## Setup

### 1. Back up your save (!!!)

**Really, back it up first.** You're editing game script files; if something goes wrong you'll want your world intact.

- **Windows:** `%localappdata%\Axolot Games\Scrap Mechanic\UserData\`
- **Linux/Proton:** `~/.local/share/Steam/steamapps/compatdata/387990/pfx/drive_c/users/steamuser/AppData/Local/Axolot Games/Scrap Mechanic/UserData/`

Also back up the two game files you're about to edit (see paths in step 2).

### 2. Patch the game files

Game script locations:

- **Windows:** `C:\Program Files (x86)\Steam\steamapps\common\Scrap Mechanic\Survival\Scripts\terrain\`
- **Linux/Proton:** `~/.local/share/Steam/steamapps/common/Scrap Mechanic/Survival/Scripts/terrain/`

**(a)** Replace `overworld/tile_database.lua` with [`game-patches/tile_database.lua`](game-patches/tile_database.lua).
This adds the `GetLegacyID` lookup the exporter needs.

**(b)** Open `terrain_overworld.lua` and find the `Load()` function. Inside the
`if sm.terrainData.exists() then` block, paste the contents of
[`game-patches/export_block.lua`](game-patches/export_block.lua) **immediately after** the line:

```lua
		CreateCellTileStorageKeys()
```

and **before** the line:

```lua
		return true
```

The block runs once per session, is wrapped in `pcall()`, and logs any error — so it can't break your game's load.

### 3. Export your world

1. Launch Scrap Mechanic and **load your Survival save**.
2. Let the world finish loading. The data is written to the newest game log once, automatically — nothing to do in-game.
3. Quit to the menu / close the game.

> The export runs **once per game session**. To re-export, fully restart the game first.

### 4. Extract the data

```bash
python3 tools/extract_cells.py
# auto-finds the newest game log. Or pass one explicitly:
python3 tools/extract_cells.py "path/to/game-YYYYMMDD-HHMMSS.log"
```

Writes `viewer/assets/json/cells.json` and prints your seed and bounds.

> Can't find the log? Set `STEAM_COMMON` to your `steamapps/common` directory, or pass the log path explicitly. On Linux/Proton the logs live in `…/Scrap Mechanic/Logs/game-*.log`.

### 5. View your map

```bash
bash tools/serve.sh
```

Open **http://localhost:8080**. Click any cell for coordinates/type/tile info; use the **Map Statistics** panel to see your seed and terrain breakdown. Ctrl+C to stop the server.

---

## Notes

- **Game updates wipe the patches** (Steam verifies/overwrites game files). Re-apply step 2 after a game update.
- **To remove the patches** when you're not mapping (they add a brief pause on world load): restore your backups, or use Steam → right-click the game → Properties → Installed Files → *Verify integrity of game files*.
- Terrain height isn't represented; some road/cliff/ruin tiles render blank as colored cells. See the upstream project's notes.
- Your `cells.json` contains your world's seed and layout — don't share it publicly if you consider that private.

---

## How it works (0.6.6+ workaround)

Before 0.6.6, the upstream tool used `sm.json.save(cells, "$SURVIVAL_DATA/cells.json")`. The 0.6.6 update blocked that with:

```
'$SURVIVAL_DATA/cells.json' is not located in the same content id as the caller
```

The workaround serializes the cells with `sm.json.writeJsonString()` and `sm.log.info()`s them to the game log between `START COPYING` / `STOP COPYING` markers; `extract_cells.py` then strips the log-line prefixes and parses the JSON.

---

## Credits & license

This is a **derivative** of [**sm_overview**](https://github.com/the1killer/sm_overview) by **The1Killer**, including:

- the entire `viewer/` (Leaflet map, tile rendering, POI/road/cliff logic, cell parser),
- the full tile image set (`viewer/assets/img/`),
- the `tile_database.lua` modification (by **Arkanorian**, adds `GetLegacyID`), and
- the cell-export logic.

**Added here:** the 0.6.6+ log-based export block (with `pcall` error handling), the automated `extract_cells.py` log parser, the `serve.sh` runner, and this packaging/documentation.

The upstream project is licensed under [**CC BY-NC-SA 4.0**](https://creativecommons.org/licenses/by-nc-sa/4.0/). In accordance with its ShareAlike terms, this derivative is released under the **same license** (see [LICENSE](LICENSE)): free for non-commercial use with attribution; derivatives must use the same license.

*Scrap Mechanic is property of Axolot Games AB. This project is unaffiliated.*
