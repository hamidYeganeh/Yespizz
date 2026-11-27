"use client";
import { useState } from "react";
import { Button, Card } from "@heroui/react";

import { WorkspaceMap } from "@repo/ui/workspace-map";
import "@repo/ui/styles/workspace.css";
const stops = [
  {
    place: "Forno Neubau",
    detail: "Picked up · 18:35",
    lat: 48.2044,
    lng: 16.3448,
  },
  {
    place: "Mila · your courier",
    detail: "On the way · arriving in 8 min",
    lat: 48.2022,
    lng: 16.3473,
  },
  {
    place: "Your address",
    detail: "Neubaugasse 12 · ring bell 4",
    lat: 48.2001,
    lng: 16.3491,
  },
];
export default function DeliveryPreview() {
  const [stop, select] = useState(1);
  const current = stops[stop]!;
  return (
    <main
      style={{
        maxWidth: 560,
        margin: "auto",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <a href="/orders">← Orders</a>
      <small>Demo order #YP-1048</small>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>
        Your pizza is on its way
      </h1>
      <WorkspaceMap
        locations={stops.map((s, i) => ({
          ...s,
          label: s.place,
          id: String(i),
        }))}
        selected={String(stop)}
        choose={(id) => select(Number(id))}
      />
      <Card className="yp-card">
        <Card.Header>
          <Card.Title>{current.place}</Card.Title>
          <Card.Description>{current.detail}</Card.Description>
        </Card.Header>
        <Card.Content>
          <Button
            variant="secondary"
            onPress={() => select((stop + 1) % stops.length)}
          >
            Next stop
          </Button>
        </Card.Content>
      </Card>
    </main>
  );
}
