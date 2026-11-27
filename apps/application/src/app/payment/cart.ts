import { menu } from "../menu/[id]/catalog";

export type Basket = Record<string, number>;
export type ConfiguredLine = { key: string; id: string; name: string; quantity: number; unitPrice: number; size?: string; toppings: string[]; removed: string[] };
export const configuredBasketKey = "yespizz-basket-lines";

export function readConfiguredBasket(): ConfiguredLine[] {
  try {
    const lines: unknown = JSON.parse(localStorage.getItem(configuredBasketKey) ?? "[]");
    return Array.isArray(lines) ? lines.filter(line => line && typeof line.id === "string" && typeof line.key === "string"
      && Number.isSafeInteger(line.quantity) && line.quantity > 0 && Array.isArray(line.toppings) && Array.isArray(line.removed)) : [];
  }
  catch { return []; }
}

export function saveConfiguredBasket(lines: ConfiguredLine[]) {
  localStorage.setItem(configuredBasketKey, JSON.stringify(lines));
  window.dispatchEvent(new Event("storage"));
}

export function addConfiguredLine(line: Omit<ConfiguredLine, "key">) {
  const items = readConfiguredBasket();
  const key = JSON.stringify([line.id, line.size, [...line.toppings].sort(), [...line.removed].sort()]);
  const index = items.findIndex(item => item.key === key);
  if (index === -1) items.push({ ...line, key });
  else items[index] = { ...line, key, quantity: items[index].quantity + line.quantity };
  saveConfiguredBasket(items);
}
export function readBasket(): Basket {
  try {
    const stored = JSON.parse(localStorage.getItem("yespiz-basket") || "{}");
    return Object.fromEntries(
      menu.map(({ id }) => [
        id,
        Number.isSafeInteger(stored?.[id]) && stored[id] > 0 ? stored[id] : 0,
      ]),
    );
  } catch {
    return {};
  }
}
