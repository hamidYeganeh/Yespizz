import { menu } from "../menu/[id]/catalog";

export type Basket = Record<string, number>;
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
