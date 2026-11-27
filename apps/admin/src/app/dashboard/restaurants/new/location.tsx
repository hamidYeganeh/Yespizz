"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { addStreetTiles } from "../../../../../../../packages/ui/src/street-tiles";
export function Location() {
  const host = useRef<HTMLDivElement>(null);
  const [latitude, setLatitude] = useState(""),
    [longitude, setLongitude] = useState("");
  const map = useRef<import("leaflet").Map | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !host.current) return;
      const instance = L.map(host.current).setView([48.21, 16.37], 12);
      map.current = instance;
      addStreetTiles(L, instance);
      instance.on("click", (event) => {
        setLatitude(event.latlng.lat.toFixed(6));
        setLongitude(event.latlng.lng.toFixed(6));
      });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (
      !instance ||
      !latitude ||
      !longitude ||
      Math.abs(Number(latitude)) > 90 ||
      Math.abs(Number(longitude)) > 180
    )
      return;
    let cancelled = false;
    let marker: import("leaflet").CircleMarker | undefined;
    void import("leaflet").then((L) => {
      if (!cancelled)
        marker = L.circleMarker([Number(latitude), Number(longitude)], {
          radius: 8,
        }).addTo(instance);
    });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [latitude, longitude]);
  return (
    <>
      <div
        ref={host}
        aria-label="Select restaurant location"
        style={{ height: 240 }}
      />
      <label>
        Latitude
        <input
          required
          type="number"
          name="latitude"
          min="-90"
          max="90"
          step="any"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
        />
      </label>
      <label>
        Longitude
        <input
          required
          type="number"
          name="longitude"
          min="-180"
          max="180"
          step="any"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
        />
      </label>
    </>
  );
}
