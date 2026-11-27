"use client";

import { Button, Card } from "@heroui/react";
import { CopyConfirm } from "../../../components/ui/copy-confirm";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Ticket } from "./tickets";

function ticketPayload(ticket: Ticket) {
  return ticket.code || new URL(ticket.href, window.location.origin).href;
}

export function TicketCode({ticket, children}: {ticket:Ticket; children:React.ReactNode}) {
  const t = useTranslations("Application.offerTicket");
  const [qr, setQr] = useState("");
  const [failed, setFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    let current = true;
    setQr("");
    setFailed(false);
    setCopyStatus("idle");
    QRCode.toDataURL(ticketPayload(ticket), {width:320, margin:4, errorCorrectionLevel:"M"})
      .then(src => { if (current) setQr(src); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [ticket]);

  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => clearTimeout(timer);
  }, [copyStatus]);
  const label = t(copyStatus === "copied" ? "copied" : "copy");

  async function copy() {
    try {
      await navigator.clipboard.writeText(ticketPayload(ticket));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }
  return <><Card className="ticket-paper">{children}
    <div className="ticket-tear"><div className="ticket-qr">{qr && <img src={qr} width="144" height="144" alt={t("qr",{title:ticket.title})}/>}</div>
      {failed && <p role="status">{t("error")}</p>}
      {ticket.code && <div><small>{t("code")}</small><strong>{ticket.code}</strong></div>}
    </div>
  </Card><footer className="ticket-actions">
    <Button fullWidth onPress={copy}>
      <CopyConfirm copied={copyStatus === "copied"} label={label}/>
      <span className="sr-only" aria-live="polite">{label}</span>
    </Button>
    {copyStatus === "failed" && <p role="status">{t("copyFailed")} <code>{ticketPayload(ticket)}</code></p>}
  </footer></>;
}
