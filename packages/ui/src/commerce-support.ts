import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { CommerceError, withCommerce } from "./commerce-store";

type Message = { text: string; by: "customer" | "support"; at: string; attachment?: { id: string; name: string } };
type Ticket = { id: string; scope: string; owner?: string; reference: string; status: string; assignee?: string; messages: Message[] };
type Attachment = { name: string; mime: string; bytes: Uint8Array };

function getTicket(db: DatabaseSync, id: string) {
  const row = db.prepare("SELECT data FROM commerce_records WHERE scope='admin' AND collection='support' AND id=?").get(id);
  return row ? { ...JSON.parse(String(row.data)), id } as Ticket : null;
}
function safe(ticket: Ticket) { const { scope, ...value } = ticket; return value; }

export function ticketsFor(scope?: string, owner?: string) {
  return withCommerce(db => db.prepare(`SELECT id,data FROM commerce_records WHERE scope='admin' AND collection='support'
    AND (? IS NULL OR json_extract(data,'$.scope')=?) AND (? IS NULL OR json_extract(data,'$.owner')=?)`)
    .all(scope ?? null, scope ?? null, owner ?? null, owner ?? null)
    .map(row => safe({ ...JSON.parse(String(row.data)), id: row.id } as Ticket)));
}

export function ticketFor(id: string, scope: string) {
  return withCommerce(db => { const ticket = getTicket(db, id); return ticket?.scope === scope ? safe(ticket) : null; });
}

export function addSupportMessage(input: { id: string; scope: string; owner?: string; reference: string; text: string; attachment?: Attachment; create: boolean }) {
  return withCommerce(db => {
    const previous = getTicket(db, input.id);
    if ((!previous && !input.create) || (previous && previous.scope !== input.scope)) throw new CommerceError(404, "Ticket not found.");
    const ticket: Ticket = previous ?? { id: input.id, scope: input.scope, owner: input.owner, reference: input.reference, status: "open", messages: [] };
    if (ticket.messages.length >= 200) throw new CommerceError(409, "This conversation is full. Start a new ticket.");
    const file = input.attachment;
    const attachment = file ? { id: crypto.randomUUID(), name: file.name } : undefined;
    if (file && attachment) db.prepare("INSERT INTO commerce_attachments VALUES(?,?,?,?,?)").run(attachment.id, ticket.id, file.name, file.mime, file.bytes);
    ticket.status = "open";
    ticket.messages = [...ticket.messages, { by: "customer", at: new Date().toISOString(), text: input.text, attachment }];
    db.prepare(`INSERT INTO commerce_records VALUES('admin','support',?,?) ON CONFLICT(scope,collection,id)
      DO UPDATE SET data=excluded.data`).run(ticket.id, JSON.stringify(ticket));
    return safe(ticket);
  }, true);
}

export function updateTicket(id: string, owner: string | undefined, data: { text: string; status: string; assignee?: string }) {
  return withCommerce(db => {
    const ticket = getTicket(db, id);
    if (!ticket || (owner !== undefined && ticket.owner !== owner)) throw new CommerceError(404, "Ticket not found.");
    ticket.status = data.status || ticket.status;
    if (data.assignee !== undefined) ticket.assignee = data.assignee;
    if (data.text) {
      if (ticket.messages.length >= 200) throw new CommerceError(409, "This conversation is full.");
      ticket.messages.push({ by: "support", text: data.text, at: new Date().toISOString() });
    }
    db.prepare("UPDATE commerce_records SET data=? WHERE scope='admin' AND collection='support' AND id=?").run(JSON.stringify(ticket), id);
    return safe(ticket);
  }, true);
}

export function supportFile(id: string, permission: { scope: string } | { owner?: string }) {
  return withCommerce(db => {
    const file = db.prepare("SELECT * FROM commerce_attachments WHERE id=?").get(id);
    const ticket = file && getTicket(db, String(file.ticket));
    if (!file || !ticket || ("scope" in permission ? ticket.scope !== permission.scope : permission.owner !== undefined && ticket.owner !== permission.owner)) {
      throw new CommerceError(404, "Attachment not found.");
    }
    return new Response(Uint8Array.from(file.bytes as Uint8Array), { headers: { "Content-Type": "application/octet-stream", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="${String(file.name).replace(/[^a-zA-Z0-9_. -]/g, "_")}"` } });
  });
}

export async function parseAttachment(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) throw new CommerceError(400, "Choose an attachment.");
  if (!file.size || file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
    throw new CommerceError(400, "Choose a JPG, PNG, WebP or PDF up to 2 MB.");
  }
  return { name: file.name.slice(0, 160), mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
}
