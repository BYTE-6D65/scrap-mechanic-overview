import { useEffect, useState, useCallback } from "react";
import type { Marker } from "./types";

const KEY = "sm_overview_markers_v1";

function load(): Marker[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch { /* ignore */ }
  return [];
}

export function useMarkers() {
  const [markers, setMarkers] = useState<Marker[]>(() => load());

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(markers)); } catch { /* ignore */ }
  }, [markers]);

  const addMarker = useCallback((m: Omit<Marker, "id" | "createdAt">) => {
    const full: Marker = { ...m, id: crypto.randomUUID(), createdAt: Date.now() };
    setMarkers(prev => [...prev, full]);
    return full;
  }, []);

  const updateMarker = useCallback((id: string, patch: Partial<Marker>) => {
    setMarkers(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const removeMarker = useCallback((id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  }, []);

  return { markers, addMarker, updateMarker, removeMarker };
}
