const collections: Record<string, string> = {
  couriers: "couriers", reviews: "reviews", crm: "crm", menus: "menus", "menu-items": "menu-items",
  categories: "categories", toppings: "toppings", ingredients: "ingredients", "cancellation-reasons": "cancellation-reasons",
  "review-options": "review-options", promotions: "promotions", "app-content": "content", ads: "ads", "kpi-targets": "kpis",
  "service-areas": "delivery-zones", "shift-board": "shifts", "team-access": "team", payouts: "payouts",
  notifications: "notification-templates", "follow-ups": "follow-ups",
};

export function commerceDestination(section: string, business = false) {
  if (section === "dispatch-map") return "/dashboard/dispatch";
  if (["orders", "support", "transactions", "reports"].includes(section)) return `/dashboard/commerce?tab=${section}`;
  if (business && section === "team-access") return "/dashboard/commerce?tab=team";
  if (section === "kitchens") return `/dashboard/commerce?tab=${business ? "restaurant" : "restaurants"}`;
  if (Object.hasOwn(collections, section)) return `/dashboard/commerce?tab=records&collection=${collections[section]}`;
  return null;
}
