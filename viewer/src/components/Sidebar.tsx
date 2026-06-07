import { useState } from "react";
import type { Manifest, Marker, CellInfo } from "../lib/types";
import { poiDisplayName } from "../lib/cells";

interface Props {
  manifest: Manifest;
  typeCounts: Record<string, number>;
  totalCells: number;
  pois: { name: string; count: number }[];
  markers: Marker[];
  selected: CellInfo | null;
  showPoiLabels: boolean;
  onTogglePoiLabels: (v: boolean) => void;
  onAddMarker: (label: string, color: string) => void;
  onRemoveMarker: (id: string) => void;
  onUpdateMarker: (id: string, patch: Partial<Marker>) => void;
  onFlyToCell: (cellX: number, cellY: number) => void;
}

const COLORS = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#007aff", "#5856d6", "#af52de", "#ff2d55"];

export function Sidebar(props: Props) {
  const { manifest, typeCounts, totalCells, pois, markers, selected } = props;
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLORS[3]);
  const [tab, setTab] = useState<"info" | "pois" | "markers">("info");

  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const sortedPois = [...pois].sort((a, b) => b.count - a.count);

  const addMarker = () => {
    if (!selected) return;
    props.onAddMarker(label.trim() || `(${selected.cellX}, ${selected.cellY})`, color);
    setLabel("");
  };

  return (
    <aside id="sidebar">
      <div className="sb-header">
        <h1>Scrap Mechanic</h1>
        <div className="seed">seed <code>{manifest.seed}</code></div>
        <div className="dims">{manifest.cellsW}×{manifest.cellsH} cells · {totalCells.toLocaleString()} total</div>
      </div>

      <nav className="tabs">
        {(["info", "pois", "markers"] as const).map(t => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "info" ? "Selected" : t === "pois" ? `POIs (${sortedPois.length})` : `Markers (${markers.length})`}
          </button>
        ))}
      </nav>

      <div className="sb-body">
        {tab === "info" && (
          <>
            <label className="toggle-row">
              <input type="checkbox" checked={props.showPoiLabels} onChange={e => props.onTogglePoiLabels(e.target.checked)} />
              <span>Show POI labels</span>
            </label>

            {selected ? (
              <div className="card">
                <div className="card-title">Cell {selected.cellX}, {selected.cellY}</div>
                <dl>
                  <dt>Type</dt><dd>{selected.type === "NONE" ? "NONE (Road/Cliff)" : selected.type}</dd>
                  <dt>TileID</dt><dd>{selected.tileid}</dd>
                  <dt>Rotation</dt><dd>{selected.rotation}</dd>
                  {selected.poi && <><dt>POI</dt><dd>{selected.poi}</dd></>}
                </dl>
                <div className="add-marker">
                  <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Marker label…" onKeyDown={e => e.key === "Enter" && addMarker()} />
                  <div className="swatches">
                    {COLORS.map(c => (
                      <button key={c} className={"sw" + (c === color ? " sel" : "")} style={{ background: c }} onClick={() => setColor(c)} />
                    ))}
                  </div>
                  <button className="primary" onClick={addMarker}>Add marker here</button>
                </div>
              </div>
            ) : (
              <p className="hint">Click the map to inspect a cell, then add a marker.</p>
            )}

            <div className="card">
              <div className="card-title">Terrain breakdown</div>
              <table className="stats">
                <tbody>
                  {sortedTypes.map(([t, n]) => (
                    <tr key={t}><td>{t === "NONE" ? "NONE (Road/Cliff)" : t}</td>
                      <td>{n.toLocaleString()} <span className="pct">{Math.round((n / totalCells) * 100)}%</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "pois" && (
          <ul className="poi-list">
            {sortedPois.map(p => (
              <li key={p.name}>
                <span className="poi-name">{poiDisplayName(p.name)}</span>
                <span className="poi-count">×{p.count}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "markers" && (
          markers.length === 0 ? (
            <p className="hint">No markers yet. Click the map → “Selected” → add one.</p>
          ) : (
            <ul className="marker-list">
              {markers.map(m => (
                <MarkerRow key={m.id} m={m} {...props} />
              ))}
            </ul>
          )
        )}
      </div>
    </aside>
  );
}

function MarkerRow({ m, onRemoveMarker, onFlyToCell, onUpdateMarker }: { m: Marker } & Props) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(m.label);
  return (
    <li className="marker-row">
      <span className="um-dot" style={{ background: m.color }} />
      {editing ? (
        <>
          <input className="mi" value={label} onChange={e => setLabel(e.target.value)} />
          <button onClick={() => { onUpdateMarker(m.id, { label }); setEditing(false); }}>✓</button>
        </>
      ) : (
        <button className="ml-label" title="Fly to" onClick={() => onFlyToCell(m.cellX, m.cellY)}>
          {m.label} <span className="ml-coord">({m.cellX}, {m.cellY})</span>
        </button>
      )}
      <button title="Edit" onClick={() => setEditing(e => !e)}>✎</button>
      <button title="Delete" onClick={() => onRemoveMarker(m.id)}>✕</button>
    </li>
  );
}
