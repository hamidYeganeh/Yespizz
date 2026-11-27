"use client";

import { Button, Radio, RadioGroup, Sheet, TextArea } from "@heroui/react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BackLink } from "../../../components/back-link";
import { PageTransition } from "../../../components/page-transition";
import { useProfileValue } from "../../../profile/profile-data";
import { orderHref } from "../../order-href";
import { sampleOrders, type StoredOrder } from "../../order-data";
import "./cancel.css";

const reasons = ["wait", "contact", "destination", "pickup", "address", "price", "changed", "other"] as const;

export function CancelOrder({orderId}: {orderId:string}) {
  const t = useTranslations("Application.cancellation");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [orders,,ready] = useProfileValue<StoredOrder[]>("orders", []);
  const order = [...orders, ...sampleOrders].find(item => item.reference === orderId);
  const key = "yespiz-cancelled-" + orderId;
  function canCancel() {
    return order && (order.status ?? "active") === "active" && localStorage.getItem(key) !== "yes"
      && localStorage.getItem("yespiz-delivered-" + orderId) !== "yes";
  }
  const eligible = ready && (done || (!unavailable && canCancel()));
  function finish() {
    router.replace("/orders?tab=cancelled", {transitionTypes:["nav-back"]});
  }
  return <PageTransition effect="slide"><main className="cancel-screen">
    <header><BackLink href="/orders" parents={[orderHref(orderId).split("?")[0]]} aria-label={t("back")}><ChevronLeft /></BackLink><h1>{t("title")}</h1></header>
    {ready && !eligible && <p role="status">{t("unavailable")}</p>}
    {eligible && <form onSubmit={event => {
      event.preventDefault();
      if (!canCancel()) {setUnavailable(true); return;}
      if (!reason || (reason === "other" && !note.trim())) return;
      localStorage.setItem(key + "-reason", JSON.stringify({reason, note:reason === "other" ? note.trim() : ""}));
      localStorage.setItem(key + "-at", String(Date.now()));
      localStorage.setItem(key, "yes");
        if(process.env.NEXT_PUBLIC_YESPIZ_OFFLINE!=="1")void fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference:orderId,status:"cancelled"})}).catch(()=>{});
      window.dispatchEvent(new Event("order-cancelled"));
      setDone(true);
    }}>
      <p id="reason-label">{t("prompt")}</p>
      <RadioGroup aria-labelledby="reason-label" value={reason} onChange={setReason} className="cancel-reasons">
        {reasons.map(value => <Radio key={value} value={value}><Radio.Control><Radio.Indicator /></Radio.Control><Radio.Content>{t(value)}</Radio.Content></Radio>)}
      </RadioGroup>
      {reason === "other" && <TextArea aria-label={t("other")} placeholder={t("details")} value={note} maxLength={1000} onChange={event => setNote(event.target.value)} />}
      <Button type="submit" isDisabled={done || !reason || (reason === "other" && !note.trim())}>{t("title")}</Button>
    </form>}
    <Sheet placement="bottom" isOpen={done} onOpenChange={open => {if (!open) finish();}}>
      <Sheet.Backdrop><Sheet.Content className="cancel-result"><Sheet.Dialog>
        <Sheet.Handle/><Sheet.CloseTrigger/><Sheet.Header><Sheet.Heading>{t("done")}</Sheet.Heading></Sheet.Header>
        <Sheet.Body>{t("thanks")}</Sheet.Body><Sheet.Footer><Button fullWidth onPress={finish}>OK</Button></Sheet.Footer>
      </Sheet.Dialog></Sheet.Content></Sheet.Backdrop>
    </Sheet>
  </main></PageTransition>;
}
