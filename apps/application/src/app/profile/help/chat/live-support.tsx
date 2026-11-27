"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Input } from "@heroui/react";
import { useLocale } from "next-intl";
import { commerceApi } from "@/lib/commerce-client";

type Message = { by: string; text: string; at: string; attachment?: { id: string; name: string } };
type Ticket = { id: string; reference: string; status: string; messages: Message[] };

export function LiveSupport() {
  const query = useSearchParams();
  const reference = query.get("order") ?? "";
  const access = query.get("access") ?? "";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, select] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const german = useLocale().startsWith("de");
  const active = tickets.find(ticket => ticket.id === selected) ?? tickets.find(ticket => reference && ticket.reference === reference);
  useEffect(() => {
    let current = true;
    const load = () => commerceApi<Ticket[]>("support/tickets").then(items => { if (current) setTickets(items); }).catch(() => {});
    void load();
    const interval = setInterval(load, 8000);
    return () => { current = false; clearInterval(interval); };
  }, []);

  async function send() {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true); setError("");
    const path = active ? `support/tickets/${encodeURIComponent(active.id)}` : "support/tickets";
    try {
      let ticket: Ticket;
      if (file) {
        const form = new FormData();
        form.set("file", file); form.set("text", text); form.set("reference", reference); form.set("access", access);
        const response = await fetch(`/api/v1/${path}`, { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        ticket = result;
      } else ticket = await commerceApi<Ticket>(path, "POST", { reference, text, access });
      setTickets(previous => [...previous.filter(item => item.id !== ticket.id), ticket]);
      select(ticket.id); setText(""); setFile(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not send your message."); }
    finally { setBusy(false); }
  }

  return <>
    {tickets.length > 0 && <label>{german ? "Anfragen" : "Conversations"} <select value={active?.id ?? ""} onChange={event => select(event.target.value)}>
      <option value="">{german ? "Neue Anfrage" : "New conversation"}</option>
      {tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{ticket.reference || ticket.id.slice(0, 8)} · {ticket.status}</option>)}
    </select></label>}
    <div className="chat-log" role="log">{active?.messages.map((message, index) => <Card key={index} className={`chat-bubble ${message.by === "support" ? "incoming" : ""}`}><Card.Content>
      <p>{message.text}</p>{message.attachment && <a download={message.attachment.name} href={`/api/v1/support/attachments/${encodeURIComponent(message.attachment.id)}`}>{message.attachment.name}</a>}
      <small>{new Date(message.at).toLocaleTimeString(german ? "de-AT" : "en", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" })}</small>
    </Card.Content></Card>)}</div>
    {error && <p role="alert">{error}</p>}
    <form className="chat-compose support-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
      <Input placeholder={german ? "Nachricht schreiben" : "Write a message"} aria-label={german ? "Nachricht" : "Message"} value={text} maxLength={2000} onChange={event => setText(event.target.value)} />
      <label className="support-attachment"><span aria-hidden="true">＋</span><input aria-label={german ? "Datei anhängen" : "Attach file"} key={file ? "attached" : "empty"} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} />{file && <span>{file.name}</span>}</label>
      <Button type="submit" isDisabled={busy || (!text.trim() && !file)}>{german ? "Senden" : "Send"}</Button>
    </form>
  </>;
}
