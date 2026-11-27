export const groups = {
  sort: ["recommended", "popularity", "rating", "distance"],
  cuisines: ["dessert", "beverages"],
} as const;

export type Group = keyof typeof groups;
export type Filters = {
  sort: string;
  promo: boolean;
  cuisines: string[];
};

export const defaults: Filters = {
  sort: "recommended", promo: false, cuisines: [],
};

type Offer = {
  distance: number;
  promo: boolean;
  cuisines: string[];
  vegetarian: boolean;
};

// Restaurant offers for the local pizza catalog.
export const offers: Record<string, Offer> = {
  "1": { distance: 2, promo: true, cuisines: ["dessert", "beverages"], vegetarian: false },
  "2": { distance: 1, promo: true, cuisines: ["beverages"], vegetarian: true },
  "3": { distance: 4, promo: true, cuisines: ["dessert"], vegetarian: true },
  "4": { distance: 3, promo: true, cuisines: ["beverages"], vegetarian: false },
  "5": { distance: 1.5, promo: false, cuisines: ["dessert"], vegetarian: true },
  "6": { distance: 6, promo: false, cuisines: ["beverages"], vegetarian: false },
};

export function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
