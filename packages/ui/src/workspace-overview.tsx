"use client";
import { Choice } from "./workspace-fields";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Bike, Clock3, Receipt, Store } from "lucide-react";
import { Card } from "@heroui/react";
import type { Records } from "./workspace-data";
export function Overview({
  records,
  open,
  business,
}: {
  records: Records;
  open: (page: string) => void;
  business: boolean;
}) {
  const [period, setPeriod] = useState("This week");
  const sales =
    period === "This week"
      ? [312, 405, 360, 548, 490, 685, 735]
      : [285, 337, 306, 428, 505, 583, 618];
  const scale = business ? 0.64 : 1;
  const points = sales.map((value, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    Sales: Math.round(value * scale),
  }));
  const active = records.Orders!.filter(
    (r) => !["Delivered", "Cancelled"].includes(r.status),
  );
  const palette = [
    "--accent",
    "--success",
    "--warning",
    "--foreground",
    "--muted",
    "--danger",
  ];
  const distribution = [
    "Received",
    "Preparing",
    "Ready",
    "On route",
    "Delivered",
    "Cancelled",
  ].map((label, i) => ({
    label,
    color: "var(" + palette[i] + ")",
    count: records.Orders!.filter((r) => r.status === label).length,
  }));
  let end = 0;
  const arcs = distribution
    .filter((part) => part.count)
    .map((part) => {
      const begin = end;
      end += (360 * part.count) / records.Orders!.length;
      return part.color + " " + begin + "deg " + end + "deg";
    })
    .join(",");
  const stats = [
    {
      title: "Weekly sales",
      value: "€" + points.reduce((n, d) => n + d.Sales, 0).toLocaleString(),
      sub: period,
      icon: Receipt,
      page: "Transactions",
    },
    {
      title: "Open orders",
      value: active.length,
      sub: "In the kitchen & on route",
      icon: Clock3,
      page: "Orders",
    },
    {
      title: "Couriers available",
      value: records.Couriers!.filter((r) => r.status === "Available").length,
      sub: "Ready for assignment",
      icon: Bike,
      page: "Couriers",
    },
    {
      title: "Kitchens open",
      value: records.Kitchens!.filter((r) => r.status === "Open").length,
      sub: "Accepting orders",
      icon: Store,
      page: "Kitchens",
    },
  ];
  return (
    <>
      <div className="yp-stats">
        {stats.map((s) => (
          <button key={s.title} onClick={() => open(s.page)}>
            <s.icon size={18} />
            <span>{s.title}</span>
            <strong>{s.value}</strong>
            <small>{s.sub}</small>
          </button>
        ))}
      </div>
      <div className="yp-panels">
        <Card className="yp-card">
          <div className="yp-between">
            <h2>Sales performance</h2>
            <Choice
              label="Sales period"
              options={["This week", "Last week"]}
              value={period}
              change={setPeriod}
            />
          </div>
          <div className="yp-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points}
                margin={{ left: -12, right: 12, top: 16 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--success)"
                      stopOpacity={0.45}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--success)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--separator)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis unit="€" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Sales"
                  stroke="var(--success)"
                  fill="url(#salesFill)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="yp-card">
          <h2>Order distribution</h2>
          <div
            className="studio-ring"
            style={{
              background: arcs
                ? "conic-gradient(" + arcs + ")"
                : "var(--separator)",
            }}
          >
            <span>
              <b>{records.Orders!.length}</b>orders
            </span>
          </div>
          <div className="studio-legend">
            {distribution.map((item) => (
              <div key={item.label}>
                <i style={{ background: item.color }} />
                {item.label}
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="yp-card">
        <div className="yp-between">
          <h2>Kitchen queue</h2>
          <button onClick={() => open("Orders")}>
            View orders <ArrowUpRight size={14} />
          </button>
        </div>
        {active.map((r) => (
          <div className="yp-queue" key={r.id}>
            <b>{r.values[0]}</b>
            <span>{r.values[2]}</span>
            <em>{r.status}</em>
          </div>
        ))}
      </Card>
    </>
  );
}
