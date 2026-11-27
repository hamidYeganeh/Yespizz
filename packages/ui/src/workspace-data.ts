export type Sheet = {
  title: string;
  fields: string[];
  states: string[];
  samples: string[][];
  group: string;
  business: boolean;
};
const sections: Record<string, Sheet> = {};
function section(
  title: string,
  group: string,
  business: boolean,
  fields: string,
  states: string,
  samples: string[],
) {
  sections[title] = {
    title,
    group,
    business,
    fields: fields.split("|"),
    states: states.split("|"),
    samples: samples.map((row) => row.split("|")),
  };
}
section(
  "Orders",
  "Operations",
  true,
  "Order|Customer|Pizza & extras|Total (€)|Delivery address|Courier",
  "Received|Preparing|Ready|On route|Delivered|Cancelled",
  [
    "#YP-1048|Sofia Weber|2 × Margherita · extra basil|28|Neubaugasse 12|Mila Weiss",
    "#YP-1047|Luca Haas|Diavola · 32 cm|17|Burggasse 34|Jonas Wolf",
    "#YP-1046|Emma Lang|Funghi · extra cheese|19|Westbahnstraße 8|Mila Weiss",
    "#YP-1045|Max König|2 × Napoli|32|Zieglergasse 19|Jonas Wolf",
    "#YP-1044|Eva Hofer|Burrata special|21|Lerchenfelder Straße 25|Mila Weiss",
  ],
);
section(
  "Kitchens",
  "Operations",
  true,
  "Kitchen|District|Manager|Capacity / hour",
  "Open|Busy|Paused",
  [
    "Forno Neubau|1070 Vienna|Sofia Weber|36",
    "Forno Leopoldstadt|1020 Vienna|Eva Hofer|24",
  ],
);
section(
  "Couriers",
  "Operations",
  true,
  "Courier|Vehicle|Zone|Deliveries",
  "Available|Delivering|Off shift",
  ["Mila Weiss|E-bike|Neubau|34", "Jonas Wolf|Bicycle|Leopoldstadt|27"],
);
section(
  "Reviews",
  "Customers",
  true,
  "Review|Order|Subject|Rating|Reply",
  "New|Responded|Hidden",
  [
    "Perfect crust and basil|#YP-1048|Kitchen|5|",
    "Friendly handoff|#YP-1047|Courier|4|Thank you!",
  ],
);
section("Users", "Customers", false, "Name|Email|Role", "Active|Inactive", [
  "Sofia Weber|sofia@example.test|Customer",
  "Eva Hofer|eva@example.test|Manager",
]);
section(
  "Support",
  "Customers",
  true,
  "Issue|Order|Assignee|Resolution",
  "Open|In progress|Resolved",
  [
    "Missing dip|#YP-1046|Alex|",
    "Delivery instructions|#YP-1047|Mila|Contact at entrance",
  ],
);
section(
  "CRM",
  "Customers",
  false,
  "Segment|Audience rule|Channel|Message",
  "Active|Paused",
  [
    "Second slice|One completed order|Email|Your next pizza night",
    "Regulars|Five or more orders|Push|Discover the seasonal menu",
  ],
);
section(
  "Menus",
  "Catalog",
  true,
  "Menu|Kitchen|Serving hours",
  "Published|Draft",
  [
    "Dinner menu|Forno Neubau|17:00–22:00",
    "Weekend specials|Forno Neubau|12:00–22:00",
  ],
);
section(
  "Menu items",
  "Catalog",
  true,
  "Pizza|Category|Price (€)|Size|Ingredients",
  "Available|Sold out",
  [
    "Margherita|Classics|14|32 cm|Tomato · mozzarella · basil",
    "Diavola|Classics|17|32 cm|Salami · chili",
    "Burrata special|Seasonal|21|36 cm|Burrata · basil",
  ],
);
section(
  "Categories",
  "Catalog",
  true,
  "Category|Menu|Display order",
  "Active|Inactive",
  ["Classics|Dinner menu|1", "Seasonal|Weekend specials|2"],
);
section(
  "Toppings",
  "Catalog",
  true,
  "Topping|Extra price (€)|Allergens",
  "Available|Sold out",
  ["Buffalo mozzarella|3|Milk", "Roasted mushrooms|2|None declared"],
);
section(
  "Ingredients",
  "Catalog",
  true,
  "Ingredient|Unit|Stock|Allergens",
  "Available|Sold out",
  ["Fior di latte|kg|18|Milk", "San Marzano tomatoes|kg|32|None declared"],
);
section(
  "Cancellation reasons",
  "Catalog",
  false,
  "Reason|Allowed role|Stage",
  "Active|Inactive",
  [
    "Ingredient unavailable|Kitchen|Preparing",
    "Change of plans|Customer|Received",
  ],
);
section(
  "Review options",
  "Catalog",
  false,
  "Option|Subject|Language",
  "Active|Inactive",
  ["Crispy crust|Order|English", "Friendly courier|Courier|English"],
);
section(
  "Promotions",
  "Growth",
  true,
  "Offer|Code|Discount (%)|Minimum spend (€)",
  "Active|Paused|Draft",
  ["First pizza night|FIRST10|10|15", "Lunch club|LUNCH15|15|20"],
);
section(
  "App content",
  "Growth",
  false,
  "Banner|Placement|Headline|Destination",
  "Published|Draft|Paused",
  [
    "Weekend special|Home hero|Burrata is back|/menu",
    "Lunch collection|Home carousel|Lunch in Neubau|/menu",
  ],
);
section(
  "Ads",
  "Growth",
  false,
  "Campaign|Placement|Budget (€)|Audience",
  "Running|Paused|Draft",
  [
    "Forno spotlight|Home feed|350|Vienna",
    "Dinner discovery|Menu search|220|Returning guests",
  ],
);
section(
  "Transactions",
  "Finance",
  true,
  "Reference|Order|Amount (€)|Method",
  "Paid|Pending|Refunded",
  ["TX-8712|#YP-1048|28|Card", "TX-8711|#YP-1047|17|Cash"],
);
section(
  "Reports",
  "Insights",
  true,
  "Report|Frequency|Metric|Recipient",
  "Scheduled|Paused",
  [
    "Shift summary|Daily|Completed orders|Kitchen manager",
    "Weekly sales|Weekly|Net sales|Owner",
  ],
);
section(
  "KPI targets",
  "Insights",
  true,
  "Indicator|Target|Unit|Owner",
  "Tracking|Paused",
  [
    "On-time delivery|95|%|Dispatch lead",
    "Preparation time|15|minutes|Kitchen lead",
  ],
);
section(
  "Service areas",
  "Operations",
  true,
  "Zone|Postcode|Minimum spend (€)|Delivery fee (€)",
  "Active|Paused",
  ["Neubau|1070|15|3", "Josefstadt|1080|20|4"],
);
section(
  "Shift board",
  "Operations",
  true,
  "Shift|Station|Team member|Hours",
  "On duty|Scheduled|Finished",
  [
    "Dinner service|Oven|Luca Haas|16:00–22:00",
    "Evening handoff|Dispatch|Mila Weiss|17:00–22:00",
  ],
);
section(
  "Team access",
  "Operations",
  true,
  "Name|Email|Role|Scope",
  "Active|Inactive",
  [
    "Alex Bauer|alex@example.test|Shift manager|Forno Neubau",
    "Luca Haas|luca@example.test|Kitchen staff|Forno Neubau",
  ],
);
section(
  "Payouts",
  "Finance",
  true,
  "Settlement|Beneficiary|Amount (€)|Period",
  "Pending|Settled|On hold",
  ["ST-118|Forno Neubau|1120|This week", "ST-117|Mila Weiss|184|Last week"],
);
section(
  "Notifications",
  "Customers",
  false,
  "Template|Event|Channel|Message",
  "Active|Draft",
  [
    "Pickup ready|Ready|Push|Your pizza is ready for pickup.",
    "Refund receipt|Refunded|Email|Your refund has been issued.",
  ],
);
section(
  "Follow-ups",
  "Customers",
  false,
  "Task|Customer|Owner|Due date|Channel|Priority|Segment|Outcome",
  "Scheduled|In progress|Completed|Cancelled",
  [
    "Check delivery experience|Sofia Weber|Alex Bauer|2026-11-27|Call|High|Second slice|",
    "Invite back for dinner|Eva Hofer|Luca Haas|2026-11-28|Email|Normal|Regulars|",
  ],
);
export const additionalFields: Record<string, string[]> = {
  Orders: [
    "Kitchen",
    "Payment status",
    "Delivery date",
    "Delivery time",
    "Kitchen instructions",
  ],
  Kitchens: [
    "Contact email",
    "Opening hours",
    "Commission (%)",
    "Minimum spend (€)",
  ],
  Couriers: ["Shift", "Document expiry date"],
  Reviews: ["Moderator", "Moderation reason"],
  Users: ["Preferred language", "Marketing consent"],
  Support: ["Priority", "Due date"],
  CRM: ["Owner", "Start date", "End date"],
  Menus: ["Start date", "End date"],
  "Menu items": ["Preparation minutes", "Allergens"],
  Categories: ["Description"],
  Toppings: ["Maximum quantity"],
  Ingredients: ["Reorder level"],
  "Cancellation reasons": ["Refund policy"],
  "Review options": ["Minimum rating"],
  Promotions: [
    "Start date",
    "End date",
    "Redemption limit",
    "Maximum discount (€)",
    "Discount scope",
    "Combinable",
  ],
  "App content": ["Start date", "End date", "Language"],
  Ads: [
    "Start date",
    "End date",
    "Impression limit",
    "Attribution window",
    "Attribution days",
    "Spend (€)",
    "Clicks",
    "Conversions",
  ],
  Transactions: ["Provider reference", "Refund reason"],
  Payouts: ["Settlement date", "Provider reference"],
  Reports: ["Next run date", "Format"],
  "KPI targets": ["Alert threshold", "Frequency"],
  "Service areas": ["Estimated minutes"],
  "Shift board": ["Shift date", "Break minutes"],
  "Team access": ["Permission level"],
  Notifications: ["Language", "Audience"],
};
export { sections };
export type Entry = {
  id: string;
  values: string[];
  status: string;
  active?: boolean;
  extra?: Record<string, string>;
  history?: { at: string; note: string }[];
};
export type Records = Record<string, Entry[]>;
export function initialRecords(business: boolean): Records {
  return Object.fromEntries(
    Object.values(sections).map((s) => [
      s.title,
      s.samples
        .filter((_, i) => !(business && s.title === "Kitchens" && i > 0))
        .map((values, i) => ({
          id: s.title + i,
          values,
          status: s.states[i % s.states.length]!,
        })),
    ]),
  );
}
