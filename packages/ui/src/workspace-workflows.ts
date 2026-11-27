import type { Entry, Records } from "./workspace-data";
export type Operation = {
  title: string;
  field: string;
  kind?: "number" | "date" | "choice";
  options?: string[];
  status?: string;
  index?: number;
  minimum?: number;
  maximum?: number;
};
export function operations(page: string, row: Entry): Operation[] {
  const text = (
    title: string,
    field: string,
    status?: string,
    index?: number,
  ): Operation => ({ title, field, status, index });
  switch (page) {
    case "Orders":
      return [
        ...(row.status === "Received"
          ? [text("Accept order", "Kitchen note", "Preparing")]
          : []),
        ...(["Preparing", "Ready", "On route"].includes(row.status)
          ? [
              text(
                row.status === "Preparing"
                  ? "Mark ready"
                  : row.status === "Ready"
                    ? "Dispatch"
                    : "Confirm delivery",
                row.status === "Ready" ? "Courier" : "Handoff note",
                row.status === "Preparing"
                  ? "Ready"
                  : row.status === "Ready"
                    ? "On route"
                    : "Delivered",
                row.status === "Ready" ? 5 : undefined,
              ),
            ]
          : []),
        ...(!["Cancelled", "Delivered"].includes(row.status)
          ? [text("Cancel order", "Cancellation reason", "Cancelled")]
          : []),
      ];
    case "Reviews":
      return [
        text("Reply to review", "Reply", "Responded", 4),
        text("Moderate review", "Moderation reason", "Hidden"),
      ];
    case "Couriers":
      return [
        text("Start shift", "Dispatch zone", "Available", 2),
        text("End shift", "Handoff note", "Off shift"),
      ];
    case "Kitchens":
      return [
        text("Pause ordering", "Pause reason", "Paused"),
        text("Resume ordering", "Manager note", "Open"),
      ];
    case "Transactions":
      return row.status === "Paid"
        ? [
            {
              title: "Record refund",
              field: "Refund amount (€)",
              kind: "number",
              minimum: 0.01,
              maximum: Math.max(
                0,
                Number(row.values[2]) -
                  Number(row.extra?.["Refunded (€)"] ?? 0),
              ),
            },
          ]
        : [];
    case "Payouts":
      return row.status === "Settled"
        ? []
        : [
            text("Reconcile settlement", "Bank reference", "Settled"),
            text("Hold payout", "Reason", "On hold"),
          ];
    case "Ingredients":
      return [
        {
          title: "Adjust inventory",
          field: "New stock",
          kind: "number",
          minimum: 0,
          index: 2,
        },
      ];
    case "Menu items":
    case "Toppings":
      return [
        text(
          row.status === "Sold out" ? "Restock" : "Mark sold out",
          "Kitchen note",
          row.status === "Sold out" ? "Available" : "Sold out",
        ),
      ];
    case "Menus":
    case "App content":
      return [
        text("Publish revision", "Release note", "Published"),
        text("Return to draft", "Revision note", "Draft"),
      ];
    case "Promotions":
      return [
        {
          title: "Test discount",
          field: "Basket subtotal (€)",
          kind: "number",
          minimum: 0,
        },
      ];
    case "Ads":
      return [
        text(
          row.status === "Running" ? "Pause campaign" : "Launch campaign",
          "Campaign note",
          row.status === "Running" ? "Paused" : "Running",
        ),
      ];
    case "Reports":
      return [
        {
          title: "Run report",
          field: "Dataset",
          kind: "choice",
          options: ["Orders", "Transactions", "Couriers", "Reviews"],
        },
      ];
    case "KPI targets":
      return [
        {
          title: "Record measurement",
          field: "Observed value",
          kind: "number",
          minimum: 0,
        },
      ];
    case "CRM":
      return [text("Log campaign activity", "Campaign note")];
    case "Users":
      return [text("Log contact", "Contact note")];
    case "Follow-ups":
      return row.status === "Completed"
        ? []
        : [
            text("Log contact attempt", "Contact note", "In progress"),
            {
              title: "Reschedule",
              field: "Due date",
              kind: "date",
              index: 3,
              status: "Scheduled",
            },
            text("Complete follow-up", "Outcome", "Completed", 7),
          ];
    case "Support":
      return [
        text("Assign case", "Assignee", "In progress", 2),
        text("Resolve case", "Resolution", "Resolved", 3),
      ];
    case "Notifications":
      return [text("Test delivery", "Test recipient")];
    case "Shift board":
      return [
        text("Start shift", "Station", "On duty", 1),
        text("Close shift", "Shift summary", "Finished"),
      ];
    case "Team access":
      return [text("Change scope", "Scope", undefined, 3)];
    case "Service areas":
      return [
        {
          title: "Set delivery fee",
          field: "Delivery fee (€)",
          kind: "number",
          minimum: 0,
          index: 3,
        },
      ];
    case "Categories":
      return [
        {
          title: "Change display order",
          field: "Display order",
          kind: "number",
          minimum: 0,
          index: 2,
        },
      ];
    case "Cancellation reasons":
      return [text("Revise refund policy", "Refund policy")];
    case "Review options":
      return [text("Update prompt", "Review option", undefined, 0)];
    default:
      return [];
  }
}
export function applyOperation(
  page: string,
  row: Entry,
  op: Operation,
  value: string,
  records: Records,
): { row: Entry; note: string } {
  const values = [...row.values],
    extra = { ...row.extra };
  let status = op.status ?? row.status;
  let note = op.title + " · " + op.field + ": " + value;
  if (op.index !== undefined) values[op.index] = value;
  else extra[op.field] = value;
  if (op.title === "Record refund") {
    const amount =
      Math.round((Number(extra["Refunded (€)"] ?? 0) + Number(value)) * 100) /
      100;
    extra["Refunded (€)"] = String(amount);
    if (amount >= Number(values[2])) status = "Refunded";
  }
  if (op.title === "Test discount") {
    const eligible =
      row.active !== false &&
      status === "Active" &&
      Number(value) >= Number(values[3]);
    const discount = eligible
      ? Math.min(
          Number(value),
          (Number(value) * Number(values[2])) / 100,
          Number(row.extra?.["Maximum discount (€)"] || Infinity),
        )
      : 0;
    note +=
      " · discount €" +
      discount.toFixed(2) +
      " · payable €" +
      (Number(value) - discount).toFixed(2);
  }
  if (op.title === "Run report") {
    const source = records[value] ?? [];
    note +=
      " · " +
      source.length +
      " records · " +
      Object.entries(
        source.reduce<Record<string, number>>((sum, r) => {
          sum[r.status] = (sum[r.status] ?? 0) + 1;
          return sum;
        }, {}),
      )
        .map(([k, n]) => k + " " + n)
        .join(", ");
  }
  if (page === "KPI targets") {
    note +=
      " · target " +
      values[1] +
      " " +
      values[2] +
      " · variance " +
      (Number(value) - Number(values[1])).toFixed(1);
  }
  if (page === "Ingredients")
    status = Number(value) === 0 ? "Sold out" : "Available";
  return { row: { ...row, values, extra, status }, note };
}
