export type DispatchOrder = {
  reference: string;
  status: "active" | "completed" | "cancelled";
  total: number;
  district: string;
  lat: number | null;
  lng: number | null;
  placedAt: string;
};

export function demonstrationOrders(): DispatchOrder[] {
  const stops = [
    ["Neubau", 48.2022, 16.3485],
    ["Josefstadt", 48.2105, 16.3471],
    ["Mariahilf", 48.194, 16.3504],
    ["Wieden", 48.192, 16.367],
    ["Landstraße", 48.198, 16.393],
  ] as const;
  return Array.from({ length: 16 }, (_, i) => {
    const [district, lat, lng] = stops[i % stops.length]!;
    return {
      reference: "DEMO-" + (1042 - i),
      district,
      lat,
      lng,
      total: [38, 24, 18, 42][i % 4]!,
      status: i < 3 ? "active" : i % 6 === 0 ? "cancelled" : "completed",
      placedAt: new Date(Date.now() - i * i * 1200000).toISOString(),
    };
  });
}
