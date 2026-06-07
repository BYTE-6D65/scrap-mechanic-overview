export interface Bounds {
  xMin: number; xMax: number; yMin: number; yMax: number;
}
export interface Manifest {
  seed: number;
  bounds: Bounds;
  cellsW: number;
  cellsH: number;
  ppc: number;
  fullW: number;
  fullH: number;
  maxZoom: number;
  tileSize: number;
  pois: Poi[];
  generatedAt: string;
}
export interface Poi {
  x: number; y: number; name: string; size: number; rotation: number;
}
export interface Cell {
  x: number; y: number; tileid: number; flags: number; rotation: number;
}
export interface Marker {
  id: string;
  cellX: number;
  cellY: number;
  label: string;
  color: string;
  createdAt: number;
}
export interface CellInfo {
  cellX: number;
  cellY: number;
  type: string;
  tileid: number;
  rotation: number;
  poi?: string;
}
