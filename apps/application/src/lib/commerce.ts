import "server-only";
import { z } from "zod";
import { orderLineName } from "../../../../packages/ui/src/order-line-name";
import { menu } from "../app/menu/[id]/catalog";
import { businesses } from "../../../../packages/ui/src/order-store";
import { CommerceError, getRecord, records, withCommerce, type DeliveryAddress, type OrderQuote } from "../../../../packages/ui/src/commerce-store";
import { paymentsAvailable, connectEnabled, localDemo } from "../../../../packages/ui/src/commerce-payment";

const text = (max: number) => z.string().trim().min(1).max(max);
export const addressSchema = z.object({ line: text(180), city: text(80), postalCode: z.string().trim().regex(/^\d{4}$/),
  name: text(80).optional(), region: z.string().trim().max(80).optional(), unit: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(), deliveryNotes: z.string().trim().max(500).optional(),
  point: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
});
export const quoteSchema = z.object({
  owner: text(100), address: addressSchema, scheduledAt: z.iso.datetime({ offset: true }).or(z.literal("")).optional(),
  code: z.string().trim().max(80).optional(),
  items: z.array(z.object({ id: text(80), quantity: z.number().int().min(1).max(20), size: text(80).optional(),
    toppings: z.array(text(80)).max(15).default([]), removed: z.array(text(80)).max(15).default([]) })).min(1).max(50),
});
export const orderSchema = quoteSchema.extend({ reference: z.string().regex(/^FIT[0-9a-f-]{36}$/i), name: text(100),
  email: z.email().max(254), phone: z.string().trim().min(5).max(50), expectedTotal: z.number().int().positive(),
});

const settingsSchema = z.object({ accepting: z.boolean().default(false), minimum: z.number().int().min(0).default(0),
  fee: z.number().int().min(0).default(0), etaMinutes: z.number().int().min(5).max(240).default(40),
  slotCapacity: z.number().int().min(1).max(500).default(10),
  deliveryTaxRate: z.number().int().min(0).max(10000).optional(),
  phone: z.string().max(50).optional(), line: z.string().max(180).optional(),
  opening: z.record(z.string(), z.array(z.tuple([z.string().regex(/^\d\d:\d\d$/), z.string().regex(/^\d\d:\d\d$/)]))).optional(),
  closedDates: z.array(z.string()).optional(),
});
const zoneSchema = z.object({ prefixes: z.array(z.string().regex(/^\d{1,4}$/)).min(1), active: z.boolean().default(true),
  fee: z.number().int().min(0).optional(), minimum: z.number().int().min(0).optional(), etaMinutes: z.number().int().min(5).max(240).optional() });

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new CommerceError(400, result.error.issues[0]?.path.length
    ? `Check the ${result.error.issues[0].path.join(" ")} field.` : "Invalid request data.");
  return result.data;
}

export function restaurantSettings(owner: string) {
  return settingsSchema.parse(getRecord(owner, "restaurant", "settings") ?? {});
}

export function restaurants() {
  return [{ owner: "yespizz", name: "Yespizz", accepting: businesses().some(shop => restaurantSettings(shop.owner).accepting),
    paymentsAvailable: paymentsAvailable(), demoPayment: localDemo() }];
}

const viennaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Vienna", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function openAt(settings: ReturnType<typeof restaurantSettings>, date: Date) {
  const time = Object.fromEntries(viennaTime.formatToParts(date).map(part => [part.type, part.value]));
  if (settings.closedDates?.includes(`${time.year}-${time.month}-${time.day}`)) return false;
  const hour = `${time.hour}:${time.minute}`;
  return settings.opening === undefined || Boolean(settings.opening[time.weekday.toLowerCase()]?.some(([from, until]) => from <= hour && hour < until));
}

type Availability = { minimum: number; fee: number; etaMinutes: number; slotCapacity: number; deliveryTaxRate?: number };

export function eligibleRestaurants(postalCode: string, scheduledAt?: string) {
  return businesses().flatMap(shop => {
    try {
      if (connectEnabled() && !getRecord(shop.owner, "stripe-connect", "account")?.ready) return [];
      const availability = delivery(shop.owner, postalCode, scheduledAt);
      if (scheduledAt && !slots(shop.owner).includes(new Date(scheduledAt).toISOString())) return [];
      return [{ ...shop, availability }];
    } catch (error) {
      if (error instanceof CommerceError && error.status === 409) return [];
      throw error;
    }
  }).sort((a,b) => a.availability.minimum - b.availability.minimum || a.availability.fee - b.availability.fee || a.owner.localeCompare(b.owner));
}

export function delivery(owner: string, postalCode: string, scheduledAt?: string): Availability {
  if (owner === "yespizz") {
    const first = eligibleRestaurants(postalCode, scheduledAt)[0];
    if (!first) throw new CommerceError(409, "No restaurant can deliver this order.");
    return first.availability;
  }
  if (!businesses().some(shop => shop.owner === owner)) throw new CommerceError(404, "This restaurant is unavailable.");
  const settings = restaurantSettings(owner);
  if (!settings.accepting) throw new CommerceError(409, "The restaurant is not accepting orders right now.");
  const zone = records(owner, "delivery-zones").map(row => zoneSchema.safeParse(row))
    .find(result => result.success && result.data.active && result.data.prefixes.some(prefix => postalCode.startsWith(prefix)));
  if (!zone?.success) throw new CommerceError(409, "This address is outside the delivery area.");
  if (scheduledAt) {
    const time = Date.parse(scheduledAt);
    if (!Number.isFinite(time) || time % (30 * 60000) !== 0 || time < Date.now() + 5 * 60000 || time > Date.now() + 7 * 86400000 || !openAt(settings, new Date(time))) {
      throw new CommerceError(409, "This delivery time is unavailable.");
    }
  } else if (!openAt(settings, new Date())) throw new CommerceError(409, "The restaurant is closed. Select a later delivery time.");
  return { minimum: zone.data.minimum ?? settings.minimum, fee: 0,
    etaMinutes: zone.data.etaMinutes ?? settings.etaMinutes, slotCapacity: settings.slotCapacity, deliveryTaxRate: settings.deliveryTaxRate };
}

export function slots(owner: string): string[] {
  if (owner === "yespizz") return [...new Set(businesses().flatMap(shop => slots(shop.owner)))].sort();
  const settings = restaurantSettings(owner);
  if (!settings.accepting) return [];
  const halfHour = 30 * 60000;
  const first = Math.ceil((Date.now() + settings.etaMinutes * 60000) / halfHour) * halfHour;
  const taken = withCommerce(db => db.prepare(`SELECT json_extract(data,'$.scheduledAt') AS slot, COUNT(*) AS n FROM commerce_orders
    WHERE owner=? AND json_extract(data,'$.scheduledAt')>=? AND (stage IN ('received','accepted','preparing','ready','out_for_delivery','delivered')
    OR (stage='pending_payment' AND payment='pending' AND date>=?)) GROUP BY slot`)
    .all(owner, new Date(first).toISOString(), new Date(Date.now() - 35 * 60000).toISOString()));
  const counts = new Map(taken.map(row => [String(row.slot), Number(row.n)]));
  return Array.from({ length: 7 * 48 }, (_, index) => new Date(first + index * halfHour))
    .filter(date => openAt(settings, date)).map(date => date.toISOString())
    .filter(slot => (counts.get(slot) ?? 0) < settings.slotCapacity);
}

const catalogSchema = z.object({ name: text(120).optional(), price: z.number().int().min(1).max(100000),
  available: z.boolean().default(true), category: z.string().max(100).optional(), ingredients: z.array(text(80)).default([]),
  allergens: z.array(text(80)).default([]), sizes: z.array(z.object({ id: text(80), price: z.number().int().min(1) })).default([]),
  toppings: z.array(text(80)).default([]), image: z.string().max(300).optional(), removable: z.array(text(80)).default([]),
  taxRate: z.number().int().min(0).max(10000).optional() });

export function catalog(owner: string) {
  if (owner === "yespizz") owner = "admin";
  const itemReviews = withCommerce(db => db.prepare(`
    SELECT item.value AS id, AVG(json_extract(r.data,'$.rating')) AS rating, COUNT(*) AS count
    FROM commerce_records r, json_each(r.data,'$.items') item
    WHERE r.collection='reviews' AND json_extract(r.data,'$.published')=1
      AND json_extract(r.data,'$.rating') BETWEEN 1 AND 5 AND (?='admin' OR r.scope=?)
    GROUP BY item.value
  `).all(owner, owner));
  const statistics = new Map(itemReviews.map(row => [String(row.id), {
    rating: Number(row.rating), ratingCount: Number(row.count),
  }]));
  const overrides = records(owner, "menu-items");
  const toppings = records(owner, "toppings");
  const configured = overrides.flatMap(row => {
    const parsed = catalogSchema.safeParse(row);
    return parsed.success ? [{ ...parsed.data, id: row.id, addOns: toppings.flatMap(topping =>
      parsed.data.toppings.includes(topping.id) && topping.available === true && typeof topping.price === "number"
        ? [{ id: topping.id, name: typeof topping.name === "string" ? topping.name : topping.id, price: topping.price }] : []) }] : [];
  });
  return [...menu.flatMap(item => overrides.some(row => row.id === item.id) ? [] : [{
    ...catalogSchema.parse({ name: orderLineName(item.id, item.key), price: Math.round(item.price * 100), ingredients: item.ingredients, image: item.image }), id: item.id, addOns: [],
  }]), ...configured].map(item => ({ ...item, ...(statistics.get(item.id) ?? { rating: 0, ratingCount: 0 }) }));
}

export function quote(input: z.output<typeof quoteSchema>): OrderQuote {
  input = { ...input, owner: "yespizz" };
  const availability = delivery(input.owner, input.address.postalCode, input.scheduledAt);
  const items = catalog(input.owner);
  const toppings = records(input.owner === "yespizz" ? "admin" : input.owner, "toppings");
  const promotion = input.code && records(input.owner === "yespizz" ? "admin" : input.owner, "promotions").find(row => row.code === input.code && row.active === true);
  const lines = input.items.map(line => {
    const dish = items.find(item => item.id === line.id);
    if (!dish?.available) throw new CommerceError(409, "An item in the basket is no longer available.");
    const size = line.size && dish.sizes.find(option => option.id === line.size);
    if (line.size && !size) throw new CommerceError(400, "The selected size is unavailable.");
    if (line.removed.some(name => !dish.removable.includes(name))) throw new CommerceError(400, "This ingredient cannot be removed.");
    const extras = [...new Set(line.toppings)];
    const extraPrice = extras.reduce((total, id) => {
      const extra = toppings.find(entry => entry.id === id && entry.available === true);
      if (!dish.toppings.includes(id) || !extra || typeof extra.price !== "number" || !Number.isSafeInteger(extra.price) || extra.price < 0) {
        throw new CommerceError(409, "A selected topping is unavailable.");
      }
      return total + extra.price;
    }, 0);
    return { ...line, toppings: extras, name: dish.name ?? dish.id, unitPrice: (size ? size.price : dish.price) + extraPrice };
  });
  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  if (subtotal < availability.minimum) throw new CommerceError(409, `Minimum order: €${(availability.minimum / 100).toFixed(2)}.`);
  const discount = promotion && typeof promotion.amount === "number" && Number.isSafeInteger(promotion.amount) && promotion.amount > 0
    && subtotal >= (typeof promotion.minimum === "number" ? promotion.minimum : 0) ? Math.min(subtotal, promotion.amount) : 0;
  if (input.code && !discount) throw new CommerceError(400, "This discount code is unavailable for your order.");
  const total = subtotal - discount + availability.fee;
  if (total < 50) throw new CommerceError(400, "The amount to pay must be at least €0.50.");
  const rates = lines.map(line => items.find(item => item.id === line.id)?.taxRate);
  const inclusiveTax = (gross: number, rate: number) => Math.round(gross * rate / (10000 + rate));
  let tax: number | undefined;
  if (rates.every(rate => rate !== undefined) && (!availability.fee || availability.deliveryTaxRate !== undefined)) {
    let cumulativePrice = 0;
    let allocated = 0;
    tax = lines.reduce((sum, line, index) => {
      const gross = line.unitPrice * line.quantity;
      cumulativePrice += gross;
      const proportionalDiscount = Math.round(cumulativePrice * discount / subtotal);
      const net = gross - (proportionalDiscount - allocated);
      allocated = proportionalDiscount;
      return sum + inclusiveTax(net, rates[index]!);
    }, inclusiveTax(availability.fee, availability.deliveryTaxRate ?? 0));
  }
  return { lines, subtotal, discount, deliveryFee: availability.fee, tax, total, currency: "eur",
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : undefined, etaMinutes: availability.etaMinutes };
}

export function addressLabel(address: DeliveryAddress) {
  return [address.line, address.unit, address.city, address.postalCode, address.country].filter(Boolean).join(", ");
}
