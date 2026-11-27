"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PageTransitionShared } from "../../components/page-transition";
import Image from "next/image";
import { Button } from "@heroui/react/button";
import { Icon } from "@repo/icons";
import { useTranslations } from "next-intl";
import type { LatLngTuple, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

// OSRM driving geometry for the example order in Amsterdam, in latitude/longitude order.
const example: LatLngTuple[] = [
  [52.374893, 4.887107],
  [52.374881, 4.887143],
  [52.37471, 4.887589],
  [52.374084, 4.887029],
  [52.374049, 4.887009],
  [52.374008, 4.886999],
  [52.373665, 4.88696],
  [52.37358, 4.88695],
  [52.373537, 4.886942],
  [52.373293, 4.886917],
  [52.372681, 4.886837],
  [52.37228, 4.886785],
  [52.37108, 4.886694],
  [52.370283, 4.886634],
  [52.370348, 4.88497],
  [52.370351, 4.884882],
  [52.37037, 4.884387],
  [52.370424, 4.882988],
  [52.370813, 4.883026],
];

export function DeliveryMap({ openDriver, progress }: { openDriver: () => void; progress: number }) {
  const t = useTranslations("Application.order");
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const latest = useRef<LatLngTuple | null>(null);
  const [pins, setPins] = useState<HTMLElement[]>([]);
  const paint = useRef<((fraction: number) => void) | null>(null);
  const position = useRef(progress);
  useEffect(() => { position.current = progress; paint.current?.(progress); }, [progress]);
  useEffect(() => {
    if (!container.current) return;
    const node = container.current;
    const controller = new AbortController();
    let observer: ResizeObserver;
    let map: LeafletMap;
    async function mount() {
      const L = await import("leaflet");
      if (controller.signal.aborted) return;
      map = L.map(node, {
        zoomControl: false,
        zoomSnap: 0.1,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;
      map.attributionControl.setPrefix(false);
      if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") {
        node.style.backgroundImage = "linear-gradient(var(--separator) 1px, transparent 1px), linear-gradient(90deg, var(--separator) 1px, transparent 1px)";
        node.style.backgroundSize = "24px 24px";
        map.attributionControl.addAttribution("Simulated delivery route");
      }
      const hosts = [
        document.createElement("div"),
        document.createElement("div"),
      ];
      const markers = hosts.map((html) =>
        L.marker([0, 0], {
          keyboard: false,
          icon: L.divIcon({
            html,
            className: "geo-pin",
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        }),
      );
      const line = L.polyline([], {
        color: "var(--route)",
        weight: 5.5,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      const distances = [0];
      for (let i = 1; i < example.length; i++) {
        distances.push(distances[i - 1]! + L.latLng(example[i - 1]!).distanceTo(example[i]!));
      }
      const length = distances[distances.length - 1]!;
      function pointAt(distance: number): LatLngTuple {
        const next = distances.findIndex(value => value >= distance);
        if (next <= 0) return example[next === 0 ? 0 : example.length - 1]!;
        const ratio = (distance - distances[next - 1]!) / (distances[next]! - distances[next - 1]!);
        const [a, b] = [example[next - 1]!, example[next]!];
        return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
      }
      function section(from: number, to: number): LatLngTuple[] {
        return [pointAt(from), ...example.filter((_, i) => distances[i]! > from && distances[i]! < to), pointAt(to)];
      }
      const travelled = L.polyline([], { ...line.options, color: "var(--route-passed)" }).addTo(map);
      const blend = Array.from({length: 8}, (_, i) => L.polyline([], {
        ...line.options, color: `color-mix(in srgb, var(--route) ${(i + 1) * 100 / 9}%, var(--route-passed))`,
      }).addTo(map));
      markers[0].addTo(map);
      markers[1].setLatLng(example[example.length - 1]!).addTo(map);
      map.fitBounds(L.latLngBounds(example), {paddingTopLeft:[55,92], paddingBottomRight:[55,55], maxZoom:17});
      paint.current = fraction => {
        const distance = length * fraction;
        const transitionLength = fraction === 1 ? 0 : Math.min(distance, length * .035);
        const start = distance - transitionLength;
        travelled.setLatLngs(section(0, start));
        blend.forEach((part, i) => part.setLatLngs(transitionLength ? section(start + transitionLength*i/8, start + transitionLength*(i+1)/8) : []));
        line.setLatLngs(fraction < 1 ? section(distance, length) : []);
        latest.current = pointAt(distance);
        markers[0].setLatLng(latest.current);
      };
      paint.current(position.current);
      setPins(hosts);
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(node);

    }
    void mount();
    return () => {
      paint.current = null;
      controller.abort();
      observer?.disconnect();
      map?.remove();
      latest.current = null;
      mapRef.current = null;
    };
  }, []);
  return (
    <div className="delivery-map">
      <div ref={container} className="geo-map" aria-label={t("tracking")} />
      {pins[0] &&
        createPortal(
          <>
            <button
              className="map-driver"
              onClick={openDriver}
              aria-label={t("profile")}
            >
              <PageTransitionShared
                name="courier-pin-avatar"
                className="courier-avatar"
              >
                <Image
                  src="/orders/driver.webp"
                  alt=""
                  width={38}
                  height={38}
                />
              </PageTransitionShared>
            </button>
            <span className="map-point driver-point">
              <Icon name="motorcycle" />
            </span>
          </>,
          pins[0],
        )}
      {pins[1] &&
        createPortal(
          <span className="map-point destination">
            <Icon name="map-pin-1" />
          </span>,
          pins[1],
        )}
      <Button
        isIconOnly
        size="lg" className="map-focus"
        aria-label={t("focus")}
        onPress={() => {
          if (latest.current) mapRef.current?.setView(latest.current, 17);
        }}
      >
        <Icon name="target-1" />
      </Button>
    </div>
  );
}
