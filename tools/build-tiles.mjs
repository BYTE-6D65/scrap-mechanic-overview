#!/usr/bin/env bun
/*
 * build-tiles.mjs — pre-render the Scrap Mechanic world map into a {z}/{x}/{y}.webp
 * tile pyramid, consumed by the React/Leaflet viewer.
 *
 * Pipeline:
 *   1. Read cells.json + the source tile images.
 *   2. Build a tiny 1px-per-cell color base (cell terrain-type colors).
 *   3. Nearest-neighbor upscale it to full resolution (PPC px per cell).
 *   4. Composite every cell's tile image (rotated) + road segments on top — ONE pass.
 *   5. For each zoom level, downscale the full composite and slice it into 256px tiles.
 *   6. Write viewer/public/tiles/{z}/{x}/{y}.webp + manifest.json.
 *
 * North is up: cell (x,y) with y increasing northward is drawn higher (smaller pixel row).
 *
 * Usage:  bun tools/build-tiles.mjs [path/to/cells.json] [--ppc 256]
 * Defaults: cells = viewer/public/data/cells.json, ppc = 256
 */
import sharp from "sharp";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "fs";
import { dirname, join, resolve as pathResolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = pathResolve(__dirname, "..");
const VIEWER_PUBLIC = join(REPO, "viewer", "public");
const IMG_DIR = join(VIEWER_PUBLIC, "img");
const TILES_SRC = join(IMG_DIR, "tiles");
const OUT_TILES = join(VIEWER_PUBLIC, "tiles");

// --- config from args ---
const argCells = process.argv.slice(2).find(a => !a.startsWith("--"));
const argPpc = (() => {
  const i = process.argv.indexOf("--ppc");
  return i > 0 ? parseInt(process.argv[i + 1], 10) : 256;
})();
const CELLS_JSON = argCells || join(VIEWER_PUBLIC, "data", "cells.json");
const PPC = argPpc;

// --- terrain types + colors (matches legacy/style.css) ---
const TAGS = ["NONE","MEADOW","FOREST","DESERT","FIELD","BURNTFOREST","AUTUMNFOREST","MOUNTAIN","LAKE"];
const COLOR = {
  NONE:[0,255,143], MEADOW:[0,232,93], FOREST:[0,188,27], DESERT:[255,222,147],
  FIELD:[164,224,126], BURNTFOREST:[158,138,92], AUTUMNFOREST:[242,187,7],
  MOUNTAIN:[141,191,172], LAKE:[0,186,242],
};
// rotation value -> clockwise degrees (matches legacy CSS rot-N classes)
const ROT = { 0:0, 1:270, 2:180, 3:90 };
const ctype = f => (Math.floor(f) & 0xf000) >> 12;

// road flags
const RN=0x0200, RS=0x0800, RE_=0x0100, RW=0x0400, MASKR=0x0f00;
function roads(f){ const r=Math.floor(f)&MASKR; let s=""; if(r&RN)s+="N"; if(r&RS)s+="S"; if(r&RE_)s+="E"; if(r&RW)s+="W"; return s; }

// valid tile set + special start-area tiles (port of legacy getTileURL)
const legacyJS = join(REPO, "legacy", "assets", "js", "sm_overview_map.js");
let validTiles = new Set();
try {
  const src = readFileSync(legacyJS, "utf8");
  validTiles = new Set([...src.match(/var tiles = \[([\s\S]*?)\];/)[1].matchAll(/\d+/g)].map(x => +x[0]));
} catch { console.warn("warn: couldn't parse legacy tile list; image cells will be skipped"); }
const START = {
  "-37,-39":"start_crashsite_-37_-39.jpg","-37,-40":"start_crashsite_-37_-40.jpg",
  "-36,-40":"start_crashsite_-36_-40.jpg","-36,-41":"start_crashsite_-36_-41.jpg",
};
function tileImg(id, x, y){
  const st = START[`${x},${y}`];
  if (st) return join(IMG_DIR, st);     // start_crashsite_-3x_-4x live in img/ root, not img/tiles/
  if (validTiles.has(id)) return join(TILES_SRC, `${id}.jpg`);
  return null;
}

// --- POIs (port of legacy cellparser POIS + sm_overview_map POI_SIZES/getPoiUrl) ---
const POIS = {
  101:"POI_CRASHSITE_AREA",102:"POI_HIDEOUT_XL",103:"POI_SILODISTRICT_XL",104:"POI_RUINCITY_XL",
  105:"POI_CRASHEDSHIP_LARGE",106:"POI_CAMP_LARGE",107:"POI_CAPSULESCRAPYARD_MEDIUM",108:"POI_LABYRINTH_MEDIUM",
  109:"POI_MECHANICSTATION_MEDIUM",110:"POI_PACKINGSTATIONVEG_MEDIUM",111:"POI_PACKINGSTATIONFRUIT_MEDIUM",
  112:"POI_WAREHOUSE2_LARGE",113:"POI_WAREHOUSE3_LARGE",114:"POI_WAREHOUSE4_LARGE",
  501:"POI_BURNTFOREST_FARMBOTSCRAPYARD_LARGE",115:"POI_ROAD",116:"POI_CAMP",117:"POI_RUIN",118:"POI_RANDOM",
  201:"POI_FOREST_CAMP",202:"POI_FOREST_RUIN",203:"POI_FOREST_RANDOM",301:"POI_DESERT_RANDOM",
  119:"POI_FARMINGPATCH",401:"POI_FIELD_RUIN",402:"POI_FIELD_RANDOM",502:"POI_BURNTFOREST_CAMP",
  503:"POI_BURNTFOREST_RUIN",504:"POI_BURNTFOREST_RANDOM",601:"POI_AUTUMNFOREST_CAMP",602:"POI_AUTUMNFOREST_RUIN",
  603:"POI_AUTUMNFOREST_RANDOM",801:"POI_LAKE_RANDOM",120:"POI_RUIN_MEDIUM",121:"POI_CHEMLAKE_MEDIUM",
  122:"POI_BUILDAREA_MEDIUM",204:"POI_FOREST_RUIN_MEDIUM",802:"POI_LAKE_UNDERWATER_MEDIUM",
};
const POI_SIZES = {
  POI_CRASHSITE_AREA:2, POI_BUILDAREA_MEDIUM:2, POI_MECHANICSTATION_MEDIUM:2, POI_LABYRINTH_MEDIUM:2,
  POI_CHEMLAKE_MEDIUM:2, POI_RUIN_MEDIUM:2, POI_FOREST_RUIN_MEDIUM:2, POI_CAPSULESCRAPYARD_MEDIUM:2,
  POI_PACKINGSTATIONVEG_MEDIUM:2, POI_PACKINGSTATIONFRUIT_MEDIUM:2, POI_LAKE_UNDERWATER_MEDIUM:2,
  POI_CAMP_LARGE:4, POI_CRASHEDSHIP_LARGE:4, POI_BURNTFOREST_FARMBOTSCRAPYARD_LARGE:4,
  POI_WAREHOUSE2_LARGE:4, POI_WAREHOUSE3_LARGE:4, POI_WAREHOUSE4_LARGE:4,
  POI_HIDEOUT_XL:8, POI_RUINCITY_XL:8, POI_SILODISTRICT_XL:8,
};
function getPoiType(id){ const t = Math.floor(id / 100); return t < 10000 ? (POIS[t] || null) : null; }
function getPoiUrl(poiType, tileid, x, y){
  const img = f => join(IMG_DIR, f);
  switch (poiType){
    case "POI_MECHANICSTATION_MEDIUM": return img("mechanic_station.jpg");
    case "POI_HIDEOUT_XL": return img("hideout.jpg");
    case "POI_CAMP_LARGE": return img("camp_large.jpg");
    case "POI_WAREHOUSE4_LARGE": return img("warehouse4.jpg");
    case "POI_WAREHOUSE3_LARGE": return img("warehouse3_large.jpg");
    case "POI_WAREHOUSE2_LARGE": return img("warehouse2.jpg");
    case "POI_SILODISTRICT_XL": return img("silodistrict.jpg");
    case "POI_RUINCITY_XL": return img("scrapcity.jpg");
    case "POI_PACKINGSTATIONVEG_MEDIUM": return img("packing_veg.jpg");
    case "POI_PACKINGSTATIONFRUIT_MEDIUM": return img("packing_fruit.jpg");
    case "POI_CHEMLAKE_MEDIUM":
      if (tileid === 12103) return img("chemlake_medium_3.jpg");
      if (tileid === 12102) return img("chemlake_medium_2.jpg");
      return img("chemlake_medium_1.jpg");
    case "POI_RUIN_MEDIUM": return img(tileid === 12003 ? "ruin_medium_3.jpg" : "ruin_medium_4.jpg");
    case "POI_FOREST_RUIN_MEDIUM": return img(tileid === 20402 ? "forest_ruin_medium_2.jpg" : "forest_ruin_medium_1.jpg");
    case "POI_LAKE_UNDERWATER_MEDIUM":
      if (tileid === 80203) return img("underwater_med_3.jpg");
      if (tileid === 80204 || tileid === 80202) return img("underwater_med_4.jpg");
      return null;
    case "POI_CRASHSITE_AREA":
      if (tileid === 10103) return img("start_crashsite3.jpg");
      if (tileid === 10102) return img("start_crashsite2.jpg");
      if (tileid === 10101 && x === -38 && y === -42) return img("start_crashsite1.jpg");
      return null;
    case "POI_CAPSULESCRAPYARD_MEDIUM": return img("capsule_scrapyard.jpg");
    case "POI_BURNTFOREST_FARMBOTSCRAPYARD_LARGE": return img("burntforest_farmbot_scrapyard.jpg");
    case "POI_CRASHEDSHIP_LARGE": return img("crashed_ship.jpg");
    case "POI_LABYRINTH_MEDIUM": return img("labyrinth.jpg");
    case "POI_BUILDAREA_MEDIUM": return img("buildarea.jpg");
    default: return null;
  }
}

// --- concurrency pool ---
async function pool(items, worker, concurrency = 8){
  let i = 0, done = 0;
  const total = items.length;
  async function run(){
    while (i < total) {
      const idx = i++;
      await worker(items[idx], idx);
      done++;
      if (done % 500 === 0 || done === total) process.stdout.write(`\r    ${done}/${total} tiles`);
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, total)}, run));
  process.stdout.write("\n");
}

async function main(){
  const tStart = Date.now();
  if (!existsSync(CELLS_JSON)) { console.error("cells.json not found:", CELLS_JSON); process.exit(1); }
  const cells = JSON.parse(readFileSync(CELLS_JSON, "utf8"));
  const b = cells[0].bounds;
  const W = (b.xMax - b.xMin + 1) | 0;
  const H = (b.yMax - b.yMin + 1) | 0;
  const seed = cells[0].seed;
  const fullW = W * PPC, fullH = H * PPC;
  // pixel coords (north-up): x -> right, y -> up
  const px = x => (x - b.xMin) * PPC;
  const py = y => (b.yMax - y) * PPC;
  console.log(`world: ${W}x${H} cells, seed ${seed}, PPC=${PPC}, full image ${fullW}x${fullH} (${(fullW*fullH/1e6).toFixed(0)}MP)`);

  // 1. color base (1px/cell)
  console.log("building color base…");
  const colorBuf = Buffer.alloc(W * H * 4);
  for (const c of cells){
    const t = ctype(c.flags);
    const col = COLOR[TAGS[t]] || COLOR.NONE;
    const cx = c.x - b.xMin, cy = b.yMax - c.y; // north-up row
    const i = (cy * W + cx) * 4;
    colorBuf[i]=col[0]; colorBuf[i+1]=col[1]; colorBuf[i+2]=col[2]; colorBuf[i+3]=255;
  }

  // 2. build composite layers (rotated tile images + roads)
  console.log("preparing composite layers…");
  const tLayers = Date.now();
  const layers = [];
  let nImg = 0, nRoad = 0;
  for (const c of cells){
    const p = tileImg(c.tileid, c.x, c.y);
    const left = px(c.x), top_ = py(c.y);
    if (p && existsSync(p)){
      const deg = ROT[c.rotation] ?? 0;
      const buf = await sharp(p).rotate(deg).resize(PPC, PPC, { fit:"fill" }).toBuffer();
      layers.push({ input: buf, left, top: top_ });
      nImg++;
    } else {
      const rd = roads(c.flags);
      if (rd){
        const hw = Math.max(2, Math.round(PPC * 0.04));
        const mid = Math.round(PPC / 2);
        for (const dir of rd){
          let r;
          if (dir === "N")      r = { left: left+mid-hw,      top: top_,              width: hw*2, height: mid };
          else if (dir === "S") r = { left: left+mid-hw,      top: top_+mid,          width: hw*2, height: mid };
          else if (dir === "E") r = { left: left+mid,         top: top_+mid-hw,       width: mid,  height: hw*2 };
          else                  r = { left: left,             top: top_+mid-hw,       width: mid,  height: hw*2 };
          const rb = await sharp({ create:{ width:r.width, height:r.height, channels:4,
            background:{ r:120, g:120, b:120, alpha:1 } } }).png().toBuffer();
          layers.push({ input: rb, ...r });
          nRoad++;
        }
      }
    }
  }
  console.log(`  ${nImg} images + ${nRoad} road segments prepared in ${((Date.now()-tLayers)/1000).toFixed(1)}s`);

  // 2b. POI overlays (baked in): one image per POI anchor, sized SxS cells, rotated
  console.log("preparing POI overlays…");
  const pois = [];
  const found = new Set();
  for (const c of cells){
    const poiType = getPoiType(c.tileid);
    if (!poiType) continue;
    const S = POI_SIZES[poiType];
    if (S === undefined) continue;
    const key = `${c.x},${c.y}`;
    if (found.has(key)) continue; // already covered by an earlier anchor
    const url = getPoiUrl(poiType, c.tileid, c.x, c.y);
    // mark this POI's cells as found (so we don't double-render)
    for (let ix = 0; ix < S; ix++) for (let iy = 0; iy < S; iy++) found.add(`${c.x+ix},${c.y+iy}`);
    if (!url || !existsSync(url)) continue;
    const left = (c.x - b.xMin) * PPC;
    const top = py(c.y + S - 1);          // north edge of cell (y+S-1); anchor (x,y) is the SW corner
    const deg = ROT[c.rotation] ?? 0;
    const buf = await sharp(url).rotate(deg).resize(S*PPC, S*PPC, { fit:"fill" }).toBuffer();
    layers.push({ input: buf, left, top });
    pois.push({ x: c.x, y: c.y, name: poiType, size: S, rotation: c.rotation });
  }
  console.log(`  ${pois.length} POIs baked in`);

  // 3. materialize the full composite to a raw RGBA buffer (one pass)
  console.log("compositing full map…");
  const tComp = Date.now();
  let pipeline = sharp(colorBuf, { raw:{ width:W, height:H, channels:4 } })
    .resize(fullW, fullH, { kernel:"nearest" });
  if (layers.length) pipeline = pipeline.composite(layers);
  const baseRaw = await pipeline.raw().toBuffer();
  console.log(`  composited to raw ${fullW}x${fullH} in ${((Date.now()-tComp)/1000).toFixed(1)}s (${(baseRaw.length/1e9).toFixed(1)}GB)`);

  // 4. determine zoom range
  const maxZoom = Math.max(0, Math.ceil(Math.log2(Math.max(fullW, fullH) / 256)));
  console.log(`pyramid zoom levels 0..${maxZoom}`);

  // 5. generate tiles per zoom (downscale baseRaw, slice into 256px tiles)
  // Clear the output dir's CHILDREN but keep the directory itself. Replacing the
  // dir inode breaks a running Vite dev server's static middleware (it stops
  // finding anything under /tiles/ and returns index.html — the SPA fallback).
  if (existsSync(OUT_TILES)) {
    for (const entry of readdirSync(OUT_TILES)) rmSync(join(OUT_TILES, entry), { recursive:true, force:true });
  } else {
    mkdirSync(OUT_TILES, { recursive:true });
  }
  const TS = 256;

  for (let z = maxZoom; z >= 0; z--){
    const scale = 2 ** (maxZoom - z);
    const zw = Math.max(1, Math.round(fullW / scale));
    const zh = Math.max(1, Math.round(fullH / scale));
    const tilesX = Math.ceil(zw / TS), tilesY = Math.ceil(zh / TS);

    // raw buffer for this zoom
    let zoomRaw, zwEff, zhEff;
    if (z === maxZoom){ zoomRaw = baseRaw; zwEff = fullW; zhEff = fullH; }
    else {
      zoomRaw = await sharp(baseRaw, { raw:{ width:fullW, height:fullH, channels:4 }, limitInputPixels:false })
        .resize(zw, zh, { kernel:"lanczos3" }).raw().toBuffer();
      zwEff = zw; zhEff = zh;
    }

    // build tile tasks
    const tasks = [];
    for (let ty = 0; ty < tilesY; ty++)
      for (let tx = 0; tx < tilesX; tx++)
        tasks.push({ tx, ty });

    await pool(tasks, async ({ tx, ty }) => {
      const out = Buffer.alloc(TS * TS * 4);
      const x0 = tx * TS, y0 = ty * TS;
      const inside = (x0 + TS <= zwEff) && (y0 + TS <= zhEff);
      if (inside){
        // rows are contiguous -> one copy per row (fast path, covers all max-zoom tiles)
        for (let r = 0; r < TS; r++){
          const si = ((y0 + r) * zwEff + x0) * 4;
          zoomRaw.copy(out, r * TS * 4, si, si + TS * 4);
        }
      } else {
        // edge tile: clamp per pixel so padding mirrors the edge seamlessly
        for (let r = 0; r < TS; r++){
          const sy = Math.min(zhEff - 1, y0 + r);
          for (let c = 0; c < TS; c++){
            const sx = Math.min(zwEff - 1, x0 + c);
            const si = (sy * zwEff + sx) * 4;
            zoomRaw.copy(out, (r * TS + c) * 4, si, si + 4);
          }
        }
      }
      const dir = join(OUT_TILES, String(z), String(tx));
      mkdirSync(dir, { recursive:true });
      await sharp(out, { raw:{ width:TS, height:TS, channels:4 } })
        .webp({ quality: 80 }).toFile(join(dir, `${ty}.webp`));
    }, 12);

    if (z !== maxZoom) zoomRaw = null; // release (baseRaw kept)
    console.log(`  z${z}: ${tilesX}x${tilesY} tiles (${zw}x${zh}px)`);
  }

  // 6. manifest
  const manifest = {
    seed, bounds: b, cellsW: W, cellsH: H, ppc: PPC,
    fullW, fullH, maxZoom,
    tilesXAtMax: Math.ceil(fullW / TS), tilesYAtMax: Math.ceil(fullH / TS),
    tileSize: TS, pois, generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(OUT_TILES, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n✓ done in ${((Date.now()-tStart)/1000).toFixed(1)}s — ${OUT_TILES}`);
  console.log(`  manifest.json: maxZoom=${maxZoom}, ${fullW}x${fullH}px`);
}

main().catch(e => { console.error("build failed:", e); process.exit(1); });
