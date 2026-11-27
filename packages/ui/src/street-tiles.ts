import type * as Leaflet from "leaflet";
export function addStreetTiles(L: typeof Leaflet, map: Leaflet.Map) {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}
