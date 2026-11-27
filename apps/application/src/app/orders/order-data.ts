export type OrderStatus = "active" | "completed" | "cancelled";

export type StoredOrder = {
  point?: { lat:number; lng:number };
  paymentMethod?: string;
  scheduledAt?: string;
  reference: string;
  date: string;
  total: number;
  address: string;
  items?: Record<string, number>;
  status?: OrderStatus;
  distance?: number;
};

function sample(reference: string, dish: string, status: OrderStatus): StoredOrder {
  return { reference, items: { [dish]: 3 }, status, total: 40, distance: 2.4, date: "", address: "" };
}

export const sampleOrders = [
  sample("1", "1", "active"), sample("2", "2", "completed"), sample("3", "4", "completed"),
  sample("4", "1", "cancelled"), sample("5", "3", "cancelled"), sample("6", "6", "cancelled"),
];
