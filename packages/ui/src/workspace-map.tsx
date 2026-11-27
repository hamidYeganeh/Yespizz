"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { addStreetTiles } from "./street-tiles";
import type { Entry } from "./workspace-data";
type Point = { id: string; label: string; lat: number; lng: number };
const coordinates: Record<string, [number, number]> = {
  "Neubaugasse 12": [48.2001, 16.3491],
  "Burggasse 34": [48.2039, 16.3495],
  "Westbahnstraße 8": [48.2012, 16.3442],
  "Zieglergasse 19": [48.1995, 16.3466],
  "Lerchenfelder Straße 25": [48.2078, 16.3511],
};
export function mockLocations(rows: Entry[]): Point[] {
  return rows.flatMap((r) => {
    const p = coordinates[r.values[4] ?? ""];
    return p ? [{ id: r.id, label: r.values[0]!, lat: p[0], lng: p[1] }] : [];
  });
}
export function WorkspaceMap({
  locations,
  selected,
  choose,
}: {
  locations: Point[];
  selected: string;
  choose?: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify(locations);
  const callback = useRef(choose);
  useEffect(() => {
    callback.current = choose;
  }, [choose]);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !host.current) return;
      map = L.map(host.current, { scrollWheelZoom: false }).setView(
        [48.204, 16.348],
        14,
      );
      addStreetTiles(L, map);
      const points: Point[] = JSON.parse(signature);
      for (const p of points) {
        const label = document.createElement("span");
        label.textContent = p.label;
        L.circleMarker([p.lat, p.lng], {
          radius: selected === p.id ? 11 : 7,
          color: "var(--foreground)",
          fillColor: "var(--accent)",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip(label)
          .on("click", () => callback.current?.(p.id));
        if (p.id === selected) map.panTo([p.lat, p.lng]);
      }
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(host.current);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
    };
  }, [signature, selected]);
  return (
    <div
      ref={host}
      className="workspace-street-map"
      aria-label="Street map of mock delivery locations"
    />
  );
}
