import { Button } from "@heroui/react";
import { operations, type Operation } from "./workspace-workflows";
import {
  ArrowUpRight,
  Bike,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  FileChartColumn,
  MapPinned,
  MessageSquare,
  Package,
  Pizza,
  Radio,
  ShieldCheck,
  Star,
  Target,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Entry, Sheet, Records } from "./workspace-data";
import { WorkspaceMap } from "./workspace-map";
import { Choice } from "./workspace-fields";
type Layout =
  | "board"
  | "profile"
  | "catalog"
  | "ledger"
  | "creative"
  | "inbox"
  | "metric"
  | "map"
  | "schedule";
type Design = {
  layout: Layout;
  icon: LucideIcon;
  singular: string;
  facet: number;
  feature: number;
  split: number;
};
function view(
  layout: Layout,
  icon: LucideIcon,
  singular: string,
  facet: number,
  feature: number,
  split: number,
): Design {
  return { layout, icon, singular, facet, feature, split };
}
export const designs: Record<string, Design> = {
  Orders: view("board", Ticket, "Order", 5, 2, 4),
  Kitchens: view("profile", ChefHat, "Kitchen", 1, 3, 2),
  Couriers: view("profile", Bike, "Courier", 2, 3, 2),
  Reviews: view("inbox", Star, "Review", 2, 3, 3),
  Users: view("profile", Users, "User", 2, 1, 2),
  Support: view("board", MessageSquare, "Case", 2, 1, 2),
  "Follow-ups": view("schedule", CalendarDays, "Follow-up", 2, 3, 4),
  CRM: view("creative", Users, "Segment", 2, 3, 2),
  Menus: view("catalog", Pizza, "Menu", 1, 2, 2),
  "Menu items": view("catalog", Pizza, "Menu item", 1, 2, 3),
  Categories: view("catalog", Package, "Category", 1, 2, 2),
  Toppings: view("catalog", Pizza, "Topping", 2, 1, 2),
  Ingredients: view("catalog", Package, "Ingredient", 1, 2, 2),
  "Cancellation reasons": view(
    "inbox",
    ShieldCheck,
    "Cancellation reason",
    1,
    2,
    2,
  ),
  "Review options": view("inbox", Star, "Review option", 1, 2, 2),
  Promotions: view("creative", Ticket, "Promotion", 2, 2, 2),
  "App content": view("creative", Radio, "Banner", 1, 2, 2),
  Ads: view("creative", Radio, "Campaign", 1, 2, 2),
  Transactions: view("ledger", CircleDollarSign, "Transaction", 3, 2, 2),
  Payouts: view("ledger", CircleDollarSign, "Settlement", 3, 2, 2),
  Reports: view("schedule", FileChartColumn, "Report", 1, 2, 2),
  "KPI targets": view("metric", Target, "KPI target", 3, 1, 2),
  "Service areas": view("map", MapPinned, "Service area", 1, 3, 2),
  "Shift board": view("schedule", CalendarDays, "Shift", 1, 3, 2),
  "Team access": view("profile", ShieldCheck, "Team member", 2, 3, 2),
  Notifications: view("inbox", MessageSquare, "Notification", 2, 3, 2),
};
export function recordLink(page: string, id?: string) {
  return (
    "/dashboard" +
    (page === "Overview"
      ? ""
      : "/" +
        [page.toLowerCase().replaceAll(" ", "-"), ...(id ? [id] : [])]
          .map(encodeURIComponent)
          .join("/"))
  );
}
function formatted(sheet: Sheet, r: Entry, i: number) {
  const v = r.values[i];
  return sheet.fields[i]?.includes("€")
    ? "€" + v
    : sheet.fields[i]?.includes("%")
      ? v + "%"
      : v;
}
export function RecordDetail({
  sheet,
  row,
  records,
  edit,
  act,
  update,
}: {
  sheet: Sheet;
  row: Entry;
  records: Records;
  act: (op: Operation) => void;
  edit: () => void;
  update: (r: Entry) => void;
}) {
  const d = designs[sheet.title]!,
    Icon = d.icon;
  const orders = records.Orders ?? [],
    clients = records.Users ?? [];
  const customerOrders = orders.filter(
    (order) => order.values[1] === row.values[0],
  );
  const audience =
    sheet.title === "CRM"
      ? clients.filter((customer) => {
          const purchases = orders.filter(
            (order) =>
              order.status === "Delivered" &&
              order.values[1] === customer.values[0],
          ).length;
          const rule = row.values[1]?.toLowerCase();
          return rule === "one completed order"
            ? purchases === 1
            : rule === "five or more orders"
              ? purchases >= 5
              : false;
        })
      : [];
  const related = Object.entries(records)
    .filter(([p]) => p !== sheet.title)
    .flatMap(([page, entries]) =>
      entries
        .filter(
          (r) =>
            r.values.slice(1).includes(row.values[0]!) ||
            row.values.slice(1).includes(r.values[0]!),
        )
        .map((r) => ({ page, r })),
    );
  const timeline = [
    ...(row.history ?? []),
    ...related
      .filter(
        (link) =>
          link.page === "Follow-ups" && ["CRM", "Users"].includes(sheet.title),
      )
      .flatMap((link) =>
        (link.r.history ?? []).map((event) => ({
          ...event,
          note: link.r.values[0] + " · " + event.note,
        })),
      ),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="studio-detail">
      <section className="studio-detail-main">
        <a href={recordLink(sheet.title)}>← {sheet.title}</a>
        <div className="studio-detail-heading">
          <span className="studio-icon">
            <Icon />
          </span>
          <em>{row.status}</em>
        </div>
        <h2>{row.values[0]}</h2>
        <p>
          {sheet.fields[d.feature]} · {formatted(sheet, row, d.feature)}
        </p>
        {d.layout === "map" && (
          <div className="studio-mini-map">
            <WorkspaceMap
              locations={[
                {
                  id: row.id,
                  label: row.values[0]!,
                  lat: row.values[1] === "1080" ? 48.21 : 48.202,
                  lng: 16.348,
                },
              ]}
              selected={row.id}
            />
          </div>
        )}
        {sheet.title === "Orders" && (
          <ol className="studio-steps">
            {sheet.states
              .filter((s) => s !== "Cancelled" || row.status === s)
              .map((s) => (
                <li
                  key={s}
                  aria-current={s === row.status ? "step" : undefined}
                >
                  {s}
                </li>
              ))}
          </ol>
        )}
        {d.layout === "creative" && (
          <div
            className={
              "studio-proof " +
              (sheet.title === "App content" ? "with-photo" : "")
            }
          >
            <small>
              {sheet.title === "Promotions" ? row.values[1] : row.values[0]}
            </small>
            <strong>{formatted(sheet, row, d.feature)}</strong>
            <span>
              {sheet.title === "Promotions"
                ? "Minimum spend €" + row.values[3]
                : row.values[1]}
            </span>
          </div>
        )}
        {sheet.title === "Reviews" && (
          <blockquote className="studio-response">
            <b>
              {row.values[3]} / 5 · {row.values[2]}
            </b>
            <p>{row.values[4] || "Awaiting reply"}</p>
          </blockquote>
        )}
        {sheet.title === "Menu items" && (
          <div className="studio-tags">
            {row.values[4]?.split(/[·,]/).map((s, i) => (
              <em key={i}>{s.trim()}</em>
            ))}
          </div>
        )}
        {d.layout === "ledger" && (
          <div className="studio-receipt">
            <span>{row.values[1]}</span>
            <strong>{formatted(sheet, row, 2)}</strong>
            <small>{row.values[3]}</small>
          </div>
        )}
        {sheet.title === "Kitchens" && (
          <div
            className="studio-kitchen-photo"
            role="img"
            aria-label="Kitchen interior"
          />
        )}
        {sheet.title === "KPI targets" && (
          <div className="studio-receipt">
            <span>Target</span>
            <strong>
              {row.values[1]} {row.values[2]}
            </strong>
          </div>
        )}
        {sheet.title === "Users" && (
          <div className="studio-receipt">
            <span>Order history</span>
            <strong>{customerOrders.length} orders</strong>
            <small>
              €
              {customerOrders
                .filter((o) => o.status === "Delivered")
                .reduce((sum, o) => sum + Number(o.values[3] || 0), 0)
                .toFixed(2)}{" "}
              delivered value
            </small>
          </div>
        )}
        {sheet.title === "CRM" && (
          <section>
            <h3>Audience preview</h3>
            {audience.length ? (
              audience.map((c) => (
                <p key={c.id}>
                  <a href={recordLink("Users", c.id)}>{c.values[0]} ↗</a>
                </p>
              ))
            ) : (
              <p>No customers match this segment in the mock order history.</p>
            )}
          </section>
        )}
        <dl>
          {sheet.fields.slice(1).map((f, i) => (
            <div key={f}>
              <dt>{f}</dt>
              <dd>{formatted(sheet, row, i + 1) || "—"}</dd>
            </div>
          ))}
          {Object.entries(row.extra ?? {})
            .filter(([, v]) => v)
            .map(([l, v]) => (
              <div key={l}>
                <dt>{l}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        {["CRM", "Users", "Follow-ups"].includes(sheet.title) && (
          <a
            href={
              recordLink("Follow-ups") +
              "?new=1&customer=" +
              encodeURIComponent(
                sheet.title === "Users"
                  ? row.values[0]!
                  : sheet.title === "Follow-ups"
                    ? row.values[1]!
                    : "",
              ) +
              "&segment=" +
              encodeURIComponent(
                sheet.title === "CRM"
                  ? row.values[0]!
                  : sheet.title === "Follow-ups"
                    ? row.values[6]!
                    : "",
              )
            }
          >
            Schedule follow-up →
          </a>
        )}
        {!!timeline.length && (
          <section>
            <h3>Activity history</h3>
            {timeline.map((h, i) => (
              <p key={i}>
                <time>{new Date(h.at).toLocaleString()}</time> · {h.note}
              </p>
            ))}
          </section>
        )}
      </section>
      <section className="studio-inspector">
        <h3>{d.singular} controls</h3>
        <Button variant="secondary" onPress={edit}>
          Edit {d.singular.toLowerCase()}
        </Button>
        {operations(sheet.title, row)
          .filter((op) => op.maximum === undefined || op.maximum > 0)
          .map((op) => (
            <Button key={op.title} variant="secondary" onPress={() => act(op)}>
              {op.title}
            </Button>
          ))}
        <Choice
          label="Workflow status"
          value={row.status}
          options={sheet.states}
          change={(status) => {
            if (
              sheet.title === "Follow-ups" &&
              status === "Completed" &&
              !row.values[7]
            )
              edit();
            else update({ ...row, status });
          }}
        />
        {related.length > 0 && (
          <>
            <h3>Linked records</h3>
            {related.map(({ page, r }) => (
              <a key={page + r.id} href={recordLink(page, r.id)}>
                {r.values[0]} <small>{page} ↗</small>
              </a>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
