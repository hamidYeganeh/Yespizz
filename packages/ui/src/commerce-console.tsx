"use client";
import {CourierDispatch} from "./courier-dispatch";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, TextArea } from "@heroui/react";
import { Inbox, CookingPot, Bike, PackageCheck, Store, Layers, MessagesSquare, Receipt, ChartColumn, Users, Pizza, MapPin } from "lucide-react";
import type { PublicOrder, Stage } from "./commerce-store";

type Row = Record<string, unknown> & { id: string };
type StaffOrder = PublicOrder & { name: string; phone: string; courierId: string | null };
type SalesReport = { from: string; through: string; daily: { day: string; orders: number; net: number; refunded: number }[] };
type TeamMember = { id: string; name: string; email: string; role: string; active: number };
const teamRoles = ["manager", "kitchen", "dispatch"];
const blank = { accepting: false, minimum: 0, fee: 0, etaMinutes: 40, slotCapacity: 10, line: "", phone: "", opening: {}, closedDates: [] };
const workflow: Partial<Record<Stage, Stage[]>> = {
  received: ["accepted", "rejected"], accepted: ["preparing", "cancelled"], preparing: ["ready"],
  ready: ["out_for_delivery", "delivered"], out_for_delivery: ["delivered"],
};
const collections = ["delivery-zones", "menu-items", "toppings", "ingredients", "menus", "categories", "couriers", "shifts",
  "team", "promotions", "reviews", "review-options", "cancellation-reasons", "content", "ads", "crm", "follow-ups",
  "notification-templates", "reports", "kpis", "payouts"];
const defaults: Record<string, Record<string, unknown>> = {
  "delivery-zones": { name: "Delivery zone", prefixes: [], active: true },
  "menu-items": { id: "", name: "", price: 0, available: true, ingredients: [], allergens: [], sizes: [], toppings: [], removable: [] },
  toppings: { name: "", price: 0, available: true }, promotions: { name: "", code: "", amount: 0, minimum: 0, active: true },
};
const money = (cents: number) => new Intl.NumberFormat("en-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
const label = (value: string) => value.replaceAll("_", " ").replaceAll("-", " ");
const navIcons = { orders: Inbox, restaurant: Store, restaurants: Store, records: Layers, support: MessagesSquare, transactions: Receipt, reports: ChartColumn, team: Users };
const queues = [
  { title: "Incoming", stages: ["received"], icon: Inbox },
  { title: "In kitchen", stages: ["accepted", "preparing"], icon: CookingPot },
  { title: "Ready for pickup", stages: ["ready"], icon: PackageCheck },
  { title: "On the road", stages: ["out_for_delivery"], icon: Bike },
];

export function CommerceConsole({ role, staffRole = "owner", initialTab, initialCollection }: { role: "business" | "admin"; staffRole?: string; initialTab?: string; initialCollection?: string }) {
  const owner = role === "business" && staffRole === "owner";
  const restricted = role === "business" && ["kitchen", "dispatch"].includes(staffRole);
  const tabs = restricted ? ["orders"] : ["orders", role === "business" ? "restaurant" : "restaurants", "records", "support", "transactions", "reports", ...(owner ? ["team"] : [])];
  const [tab, setTab] = useState(initialTab && tabs.includes(initialTab) ? initialTab : "orders");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [queue, setQueue] = useState("");
  const currentQueue = queues.find(group => group.title === queue);
  const visibleOrders = currentQueue ? orders.filter(order => currentQueue.stages.includes(order.stage)) : orders;
  const [venues, setVenues] = useState<{ owner: string; name: string }[]>([]);
  const [venue, setVenue] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [collection, chooseCollection] = useState(initialCollection && collections.includes(initialCollection) ? initialCollection : collections[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [tickets, setTickets] = useState<Row[]>([]);
  const [editId, setEditId] = useState("");
  const [editor, setEditor] = useState("");
  const [settings, setSettings] = useState<typeof blank | null>(null);
  const [selectedStage, setSelectedStage] = useState("");
  const [active, setActive] = useState("");
  const [ticket, chooseTicket] = useState("");
  const [connect, setConnect] = useState<{ enabled: boolean; ready: boolean }>();
  const [report, setReport] = useState<SalesReport>();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [inviteMessage, setInviteMessage] = useState("");
  const api = useCallback(async <T,>(path: string, method = "GET", data?: unknown): Promise<T> => {
    const response = await fetch(`/api/v1/${role}/${path}`, { method, cache: "no-store",
      ...(data !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw new Error(value?.error ?? "The request failed.");
    return value;
  }, [role]);
  const failure = (cause: unknown) => setError(cause instanceof Error ? cause.message : "The request failed.");
  const loadOrders = useCallback(() => api<StaffOrder[]>("orders").then(setOrders).catch(failure), [api]);
  const suffix = role === "admin" && venue ? `?restaurant=${encodeURIComponent(venue)}` : "";
  const loadRows = useCallback(() => api<Row[]>(`${collection}${suffix}`).then(setRows).catch(failure), [api, collection, suffix]);
  const loadSupport = useCallback(() => api<Row[]>("support").then(setTickets).catch(failure), [api]);
  useEffect(() => {
    if (role === "admin") api<typeof venues>("restaurants").then(setVenues).catch(failure);
    else if (!restricted) {
      api<typeof blank | null>("restaurant").then(data => setSettings({ ...blank, ...data })).catch(failure);
      if (owner) api<{ enabled: boolean; ready: boolean }>("connect").then(setConnect).catch(failure);
    }
  }, [api, role, owner, restricted]);
  useEffect(() => {
    if (tab !== "orders" && tab !== "transactions") return;
    if (role === "business" && tab === "orders") {
      const stream = new EventSource("/api/v1/business/orders/stream");
      stream.onmessage = event => setOrders(JSON.parse(event.data));
      stream.onerror = () => { void loadOrders(); };
      return () => stream.close();
    }
    void loadOrders();
    const timer = setInterval(loadOrders, 10000);
    return () => clearInterval(timer);
  }, [loadOrders, tab, role]);
  useEffect(() => {
    if (tab === "records") void loadRows();
    if (tab === "support") void loadSupport();
    if (tab === "reports") void api<SalesReport>("reports/sales").then(setReport).catch(failure);
    if (tab === "team" && owner) void api<TeamMember[]>("team").then(setTeam).catch(failure);
  }, [api, loadRows, loadSupport, tab, owner]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); setNotice("Saved"); } catch (cause) { failure(cause); }
    finally { setBusy(false); }
  }

  function shareLocation(reference: string) {
    if (!navigator.geolocation) { setError("Location is unavailable on this device."); return; }
    navigator.geolocation.getCurrentPosition(position => void run(async () => {
      await api(`orders/${encodeURIComponent(reference)}/location`, "PUT", { lat: position.coords.latitude, lng: position.coords.longitude });
      await loadOrders();
    }), () => setError("Allow location access to send the courier’s position."));
  }

  const selectedTicket = tickets.find(row => row.id === ticket);
  function stagesFor(stage: Stage) {
    if (stage === "ready" || stage === "out_for_delivery") return [];
    const options = workflow[stage] ?? [];
    if (staffRole === "kitchen") return options.filter(value => ["accepted", "rejected", "preparing", "ready"].includes(value));
    if (staffRole === "dispatch") return options.filter(value => ["out_for_delivery", "delivered"].includes(value));
    return options;
  }
  return <div className="commerce-workspace"><aside className="commerce-sidebar">
    <div className="commerce-brand"><span><Pizza size={24}/></span>Yespizz</div>
    <nav aria-label="Commerce">{tabs.map(key => {
      const Icon = navIcons[key as keyof typeof navIcons];
      return <Button key={key} variant={tab === key ? "primary" : "ghost"} aria-current={tab === key ? "page" : undefined}
        onPress={() => { setTab(key); setError(""); setNotice(""); }}><Icon size={18}/>{label(key)}</Button>;
    })}</nav></aside>
    <main className="dispatch commerce-main">
    <header className="commerce-heading"><div><small>{role === "business" ? "Restaurant workspace" : "Administration"}</small>
      <h1>{tab === "orders" ? "Order overview" : label(tab)}</h1></div>
      {staffRole !== "kitchen" && <a href="/dashboard/dispatch"><MapPin size={16}/> Delivery map</a>}</header>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {tab === "orders" && <div className="commerce-metrics">{queues.map(({title, stages, icon: Icon}) =>
      <Button key={title} variant="secondary" aria-pressed={queue === title} onPress={() => setQueue(queue === title ? "" : title)}>
        <span><Icon size={18}/>{title}</span><strong>{orders.filter(order => stages.includes(order.stage)).length}</strong>
      </Button>)}</div>}
    <div className={tab === "orders" && role === "business" && staffRole !== "kitchen" ? "commerce-columns" : undefined}>
    <div className="commerce-content">
    {tab === "orders" && <header><h2>{queue || "All orders"}</h2>{queue && <Button size="sm" variant="ghost" onPress={() => setQueue("")}>Show all</Button>}</header>}
    {tab === "orders" && (visibleOrders.length ? visibleOrders.map(order => <Card key={order.reference}><Card.Content>
      <small className="commerce-ref">{order.reference}</small><h2>{order.owner === "yespizz" && order.stage === "received" ? "Awaiting restaurant acceptance" : label(order.stage)}</h2>
      <p>{money(order.total)} · {label(order.paymentStatus)} · {[order.address.line, order.address.postalCode, order.address.city].filter(Boolean).join(", ")}</p>
      <Button size="sm" variant="secondary" onPress={() => { setSelectedStage(""); setActive(active === order.reference ? "" : order.reference); }}>Order details</Button>
      {active === order.reference && <>
        <p>{order.name} {order.phone}</p><p>{order.address.deliveryNotes}</p>
        <ul>{order.lines.map((line, index) => <li key={`${line.id}-${index}`}>{line.quantity} × {line.name}{line.size && ` · ${line.size}`}{line.toppings.length > 0 && ` · +${line.toppings.join(", ")}`}{line.removed.length > 0 && ` · −${line.removed.join(", ")}`}</li>)}</ul>
        {stagesFor(order.stage).length > 0 && <form onSubmit={event => {
          event.preventDefault(); const data = new FormData(event.currentTarget); const stage = data.get("stage");
          void run(async () => {
            await api(`orders/${encodeURIComponent(order.reference)}/status`, "PATCH", { stage, reason: data.get("reason") ?? "", ...(data.get("eta") && { etaMinutes: Number(data.get("eta")) }) });
            await loadOrders();
          });
        }}>
          <label>Status <select key={order.stage} name="stage" onChange={event => setSelectedStage(event.target.value)}>{stagesFor(order.stage).map(stage => <option value={stage} key={stage}>{label(stage)}</option>)}</select></label>
          {order.stage === "received" && <label>ETA (minutes)<Input name="eta" type="number" min={5} max={240} /></label>}
          {stagesFor(order.stage).includes(selectedStage as Stage) && ["rejected", "cancelled"].includes(selectedStage) && <label>Reason for declining or cancelling<Input name="reason" maxLength={500} /></label>}
          <Button type="submit" size="sm" isDisabled={busy}>Update status</Button>
        </form>}

        {staffRole !== "kitchen" && order.stage === "out_for_delivery" && order.courierId && <Button size="sm" variant="outline" onPress={() => shareLocation(order.reference)} isDisabled={busy}>Share current location</Button>}
        {role === "admin" && ["paid", "refund_failed"].includes(order.paymentStatus) && ["cancelled", "rejected", "delivered"].includes(order.stage) &&
          <Button variant="danger" size="sm" isDisabled={busy} onPress={() => { if (window.confirm("Issue a full refund for this order?")) void run(async () => { await api(`orders/${encodeURIComponent(order.reference)}/refunds`, "POST", {}); await loadOrders(); }); }}>Refund</Button>}
      </>}
    </Card.Content></Card>) : <p className="commerce-empty"><Inbox size={24}/>{queue ? "No orders in this stage." : "No orders yet."}</p>)}
    {tab === "restaurant" && !settings && !error && <p role="status">Loading restaurant settings…</p>}
    {tab === "restaurant" && settings && <Card><Card.Content><form onSubmit={event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      void run(async () => {
        const updated = await api<typeof blank>("restaurant", "PATCH", { ...settings, accepting: fields.has("accepting"),
          line: fields.get("line"), phone: fields.get("phone"), etaMinutes: Number(fields.get("etaMinutes")),
          slotCapacity: Number(fields.get("slotCapacity")), minimum: Math.round(Number(fields.get("minimum")) * 100),
          opening: JSON.parse(String(fields.get("opening"))), closedDates: JSON.parse(String(fields.get("closedDates"))) });
        setSettings({ ...blank, ...updated });
      });
    }}><h2>Order availability</h2>
      <label><input type="checkbox" name="accepting" defaultChecked={settings.accepting}/> Accept incoming orders</label>
      <div className="commerce-fields">
        <label>Preparation and delivery (minutes)<Input type="number" name="etaMinutes" min={5} max={240} required defaultValue={String(settings.etaMinutes)}/></label>
        <label>Orders per time slot<Input type="number" name="slotCapacity" min={1} max={500} required defaultValue={String(settings.slotCapacity)}/></label>
        <label>Minimum order (€)<Input type="number" name="minimum" min={0} max={1000} step=".01" required defaultValue={String(settings.minimum / 100)}/></label>
        <label>Restaurant phone<Input type="tel" name="phone" defaultValue={settings.phone}/></label>
      </div>
      <label>Restaurant address<Input name="line" defaultValue={settings.line}/></label>
      <details><summary>Opening hours and closures</summary>
        <label>Weekly hours (Vienna time)<TextArea rows={4} name="opening" defaultValue={JSON.stringify(settings.opening, null, 2)}/></label>
        <label>Closed dates (YYYY-MM-DD list)<TextArea rows={2} name="closedDates" defaultValue={JSON.stringify(settings.closedDates)}/></label>
      </details>
      <Button type="submit" isDisabled={busy}>Save restaurant settings</Button>
    </form></Card.Content></Card>}
    {tab === "restaurants" && <div><a className="commerce-link" href="/dashboard/restaurants/new">Add restaurant</a><ul className="commerce-list">{venues.map(shop => <li key={shop.owner}>{shop.name}{" "}<Button size="sm" onPress={() => { setVenue(shop.owner); setTab("records"); }}>Manage records</Button>{" "}<Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void run(async () => { await api(`restaurants/${encodeURIComponent(shop.owner)}`, "PATCH", { accepting: false }); })}>Pause orders</Button></li>)}</ul></div>}
    {tab === "records" && <Card><Card.Content>
      {role === "admin" && <label>Restaurant <select value={venue} onChange={event => { setVenue(event.target.value); setEditor(""); }}><option value="">Global</option>{venues.map(shop => <option key={shop.owner} value={shop.owner}>{shop.name}</option>)}</select></label>}
      <label>Records <select value={collection} onChange={event => { chooseCollection(event.target.value); setEditId(""); setEditor(""); }}>{collections.filter(value => role === "admin" || value !== "team").map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      {collection === "reviews" ? <ul className="commerce-list">{rows.filter(row => typeof row.text === "string").map(row => <li key={row.id}><div><strong>{String(row.rating)}/5</strong><p>{String(row.text)}</p><small>{row.published ? "Published" : "Awaiting approval"}</small></div><Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void run(async () => { await api(`${collection}/${encodeURIComponent(row.id)}${suffix}`, "PATCH", { published: !row.published }); await loadRows(); })}>{row.published ? "Unpublish" : "Publish review"}</Button></li>)}</ul> : <ul>{rows.map(row => <li key={row.id}><Button size="sm" variant="secondary" onPress={() => { setEditId(row.id); setEditor(JSON.stringify(row, null, 2)); }}>{String(row.name || row.id)}</Button></li>)}</ul>}
      {editor ? <form onSubmit={event => { event.preventDefault(); void run(async () => {
        const value = JSON.parse(editor) as Row; const id = editId || value.id;
        await api(`${collection}${id ? `/${encodeURIComponent(id)}` : ""}${suffix}`, id ? "PATCH" : "POST", value);
        setEditor(""); setEditId(""); await loadRows();
      }); }}><label>Record fields (JSON)<TextArea rows={10} value={editor} onChange={event => setEditor(event.target.value)} /></label>
        <Button type="submit" isDisabled={busy}>Save record</Button>{" "}
        {editId && <Button variant="danger" isDisabled={busy} onPress={() => { if (window.confirm("Delete this record?")) void run(async () => { await api(`${collection}/${encodeURIComponent(editId)}${suffix}`, "DELETE"); setEditor(""); await loadRows(); }); }}>Delete</Button>}
      </form> : <Button onPress={() => { setEditId(""); setEditor(JSON.stringify(defaults[collection] ?? { name: "" }, null, 2)); }}>Add record</Button>}
    </Card.Content></Card>}
    {tab === "support" && <Card><Card.Content>{tickets.length === 0 && <p>No support tickets.</p>}<ul>{tickets.map(row => <li key={row.id}><Button size="sm" variant="secondary" onPress={() => chooseTicket(row.id)}>{String(row.reference || row.id)} · {String(row.status)}</Button></li>)}</ul>
      {selectedTicket && <form key={ticket} onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        void run(async () => { await api(`support/${encodeURIComponent(ticket)}`, "PATCH", { status: data.get("status"), text: data.get("reply") }); form.reset(); await loadSupport(); });
      }}><ol>{(Array.isArray(selectedTicket.messages) ? selectedTicket.messages : []).map((message, index) => <li key={index}>{String(message.by)}: {String(message.text)}{message.attachment && <a download href={`/api/v1/${role}/support/attachments/${encodeURIComponent(message.attachment.id)}`}>{message.attachment.name}</a>}</li>)}</ol>
        <label>Reply<TextArea name="reply" /></label><label>Status <select name="status" defaultValue={String(selectedTicket.status)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
        <Button type="submit" isDisabled={busy}>Update ticket</Button>
      </form>}
    </Card.Content></Card>}
    {tab === "transactions" && <>{connect?.enabled && <p>{connect.ready ? "Stripe payouts connected" : <Button isDisabled={busy} onPress={() => void run(async () => {
      const { url } = await api<{ url: string }>("connect", "POST", {}); window.location.assign(url);
    })}>Set up Stripe payouts</Button>}</p>}
      <ul className="commerce-list">{orders.map(order => <li key={order.reference}><span>{order.reference}<small>{label(order.paymentStatus)}</small></span><strong>{money(order.total)}</strong></li>)}</ul>{!orders.length && <p>No transactions yet.</p>}</>}
    {tab === "reports" && !report && !error && <p role="status">Loading sales report…</p>}
    {tab === "reports" && report && <Card><Card.Content>
      <h2>Sales by day</h2><p>{report.from} – {report.through} (UTC)</p>
      {report.daily.length ? <table><thead><tr><th>Date</th><th>Orders</th><th>Payments</th><th>Refunds</th></tr></thead>
        <tbody>{report.daily.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.orders}</td><td>{money(day.net)}</td><td>{money(day.refunded)}</td></tr>)}</tbody></table> : <p>No orders in this period.</p>}
    </Card.Content></Card>}
    {tab === "team" && owner && <Card><Card.Content>
      <form onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
        void run(async () => {
          const result = await api<{ delivered: boolean; oneTimePassword?: string }>("team", "POST", data);
          setInviteMessage(result.delivered ? "Invitation emailed" : `One-time password: ${result.oneTimePassword ?? "Unavailable"}`);
          setTeam(await api<TeamMember[]>("team")); form.reset();
        });
      }}>
        <label>Name<Input name="name" required maxLength={100} /></label><label>Email<Input name="email" required type="email" /></label>
        <label>Role <select name="role">{teamRoles.map(name => <option key={name}>{name}</option>)}</select></label>
        <Button type="submit" isDisabled={busy}>Invite team member</Button>
      </form>
      {inviteMessage && <p role="status">{inviteMessage}</p>}
      {team.map(member => <form key={`${member.id}-${member.role}-${member.active}`} onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        void run(async () => {
          await api("team", "POST", { id: member.id, role: data.get("role"), active: data.has("active") });
          setTeam(await api<TeamMember[]>("team"));
        });
      }}><p>{member.name} · {member.email}</p>
        <label>Role <select name="role" defaultValue={member.role}>{teamRoles.map(name => <option key={name}>{name}</option>)}</select></label>
        <label><input name="active" type="checkbox" defaultChecked={Boolean(member.active)} /> Active</label>
        <Button size="sm" type="submit" isDisabled={busy}>Save access</Button>
      </form>)}
    </Card.Content></Card>}
    </div>
    {tab === "orders" && role === "business" && staffRole !== "kitchen" && <CourierDispatch/>}
    </div></main></div>;
}
