"use client";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MapPinned,
  ChartNoAxesCombined,
  Pizza,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import type { DispatchOrder } from "./dispatch-data";
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

const money = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
});
function DispatchMap({
  orders,
  selected,
}: {
  orders: DispatchOrder[];
  selected: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function render() {
      const L = await import("leaflet");
      if (cancelled || !container.current) return;
      const view = L.map(container.current, { scrollWheelZoom: false }).setView(
        [48.207, 16.37],
        13,
      );
      map.current = view;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(view);
      const points = orders.filter(
        (o): o is DispatchOrder & { lat: number; lng: number } =>
          o.status === "active" &&
          typeof o.lat === "number" &&
          typeof o.lng === "number",
      );
      for (const o of points) {
        const label = document.createElement("span");
        label.textContent = o.reference + " · " + o.district;
        L.circleMarker([o.lat, o.lng], {
          radius: 9,
          color: "var(--foreground)",
          fillColor: "var(--accent)",
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(view)
          .bindPopup(label);
      }
      const chosen = points.find((o) => o.reference === selected);
      if (chosen) view.setView([chosen.lat, chosen.lng], 15);
      else if (points.length)
        view.fitBounds(L.latLngBounds(points.map((o) => [o.lat, o.lng])), {
          padding: [34, 34],
          maxZoom: 15,
        });
    }
    void render();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [orders, selected]);
  return (
    <div
      className="dispatch-map"
      ref={container}
      aria-label="Active delivery destinations"
    />
  );
}
export function DispatchDashboard({
  orders: preview,
  title,
  demo = false,
}: {
  orders: DispatchOrder[];
  title: string;
  demo?: boolean;
}) {
  const orders = preview;
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);
  const [tab, setTab] = useState<"map" | "analytics">("analytics");
  const [query, setQuery] = useState(""),
    [selected, select] = useState("");
  const active = orders.filter((o) => o.status === "active");
  const completed = orders.filter((o) => o.status === "completed");
  const cancelled = orders.length - active.length - completed.length;
  const shown = (tab === "map" ? active : orders).filter((o) =>
    (o.reference + " " + o.district)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const latest = orders.reduce(
    (max, o) => Math.max(max, Date.parse(o.placedAt)),
    Date.now(),
  );
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(latest - (6 - i) * 86400000).toISOString().slice(0, 10),
  );
  const volume = days.map((day) => ({
    day: day.slice(5),
    orders: orders.filter((o) => o.placedAt.startsWith(day)).length,
  }));
  const breakdown = [
    { name: "Active", value: active.length, fill: "var(--accent)" },
    { name: "Completed", value: completed.length, fill: "var(--success)" },
    { name: "Cancelled", value: cancelled, fill: "var(--danger)" },
  ];
  return (
    <div className="operations-shell">
      <aside className="operations-rail">
        <b>
          <Pizza /> Yespiz
        </b>
        <small>WORKSPACE</small>
        <Button variant="ghost" onPress={() => setTab("analytics")}>
          <LayoutDashboard /> Overview
        </Button>
        <Button variant="ghost" onPress={() => setTab("map")}>
          <MapPinned /> Delivery map
        </Button>
        <Button variant="ghost"
          onPress={() =>
            document.querySelector(".dispatch-row-list")?.scrollIntoView()
          }
        >
          <ChartNoAxesCombined /> Order history
        </Button>
      </aside>
      <section className="dispatch">
        <div className="operations-bar">
          Workspace / Dashboard {demo && <a href="/">Admin sign in ↗</a>}
        </div>
        <header>
          <div>
            <small>ORDER MANAGEMENT</small>
            <h1>{title}</h1>
          </div>
          <div className="dispatch-tabs">
            {(["map", "analytics"] as const).map((key) => (
              <Button
                key={key}
                aria-pressed={tab === key}
                variant={tab === key ? "primary" : "secondary"}
                onPress={() => {
                  setTab(key);
                  setQuery("");
                }}
              >
                {key === "map" ? "Delivery map" : "Analytics"}
              </Button>
            ))}
          </div>
        </header>
        <div className="dispatch-metrics">
          {[
            ["Active orders", active.length],
            ["Completed", completed.length],
            ["Cancelled", cancelled],
            [
              "Completed sales",
              money.format(completed.reduce((sum, o) => sum + o.total, 0)),
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </Card>
          ))}
        </div>
        {tab === "map" ? (
          <DispatchMap orders={orders} selected={selected} />
        ) : (
          <div className="dispatch-analytics">
            <Card>
              <h2>Order volume</h2>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={volume}>
                  <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    stroke="var(--muted)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                    }}
                  />
                  <Bar
                    dataKey="orders"
                    fill="var(--accent)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h2>Order status</h2>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={39}
                    outerRadius={63}
                    stroke="var(--surface)"
                  />
                  <Tooltip contentStyle={{ background: "var(--surface)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="dispatch-legend">
                {breakdown.map((row) => (
                  <span key={row.name}>
                    <i style={{ background: row.fill }} />
                    {row.name} {row.value}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        )}
        <section className="dispatch-row-list">
          <header>
            <h2>{tab === "map" ? "Active deliveries" : "Order history"}</h2>
            <Input
              aria-label="Find an order"
              type="search"
              placeholder="Find an order or district"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </header>
          {!shown.length && (
            <div className="dispatch-empty">
              <MapPinned />
              <strong>
                {query
                  ? "No matching orders"
                  : demo
                    ? "Sign in to view orders"
                    : "No orders yet"}
              </strong>
              <p>
                {query
                  ? "Try another order number or district."
                  : demo
                    ? "Your administrator account has access to all restaurants."
                    : "New deliveries appear here when customers check out."}
              </p>
            </div>
          )}
          {shown.map((o) => (
            <Card key={o.reference} className="dispatch-row">
              <div>
                <strong>{o.reference}</strong>
                <small>{o.district}</small>
              </div>
              <span>{money.format(o.total)}</span>
              {o.status === "active" && o.lat !== null ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    select(o.reference);
                    setTab("map");
                    document
                      .querySelector(".dispatch")
                      ?.scrollIntoView({ block: "start" });
                  }}
                >
                  Locate
                </Button>
              ) : (
                <small>{o.status}</small>
              )}
            </Card>
          ))}
        </section>
      </section>
    </div>
  );
}

