"use client";

import { Button, Card, Sheet } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

function localDay(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function ScheduleOrder({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const locale = useLocale();
  const t = useTranslations("Application.checkout");
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const now = new Date();
  const dates = Array.from({ length: 92 }, (_, offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  const draft = new Date(day + "T" + time);
  function edit() {
    const initial = value && Date.parse(value) > Date.now() ? new Date(value) : new Date(Date.now() + 3600000);
    setDay(localDay(initial));
    setTime(initial.toTimeString().slice(0, 5));
    setOpen(true);
  }
  return <Card className="checkout-schedule">
    <div className="checkout-schedule-row">
      <button type="button" role="switch" aria-checked={!!value || open}
        className="checkout-schedule-switch" onClick={() => { if (value) onChange(""); else onChange(new Date(Date.now()+3600000).toISOString()); }}>
        {t("schedule")}<span aria-hidden="true" />
      </button>
    </div>
    <AnimatePresence initial={false}>{value && <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><Button type="button" variant="secondary" onPress={edit}>{new Date(value).toLocaleString(locale)}</Button></motion.div>}</AnimatePresence>
    <Sheet placement="bottom" isOpen={open} onOpenChange={setOpen}><Sheet.Backdrop><Sheet.Content className="mx-auto max-w-(--app-width)"><Sheet.Dialog>
      <Sheet.Handle /><Sheet.CloseTrigger /><Sheet.Header><Sheet.Heading>{t("schedule")}</Sheet.Heading></Sheet.Header>
      <Sheet.Body className="grid gap-4" data-lenis-prevent>
        <strong>{new Date(day + "T12:00").toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
        <div className="flex gap-2 overflow-x-auto py-2">
          {dates.map(date => {
            const key = localDay(date);
            return <motion.button type="button" key={key} aria-label={date.toLocaleDateString(locale, {dateStyle:"full"})} aria-pressed={day === key}
              className="grid shrink-0 justify-items-center rounded-full px-3 py-2 bg-surface-secondary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
              whileTap={{scale:0.95}} onClick={() => setDay(key)}>
              <small>{date.toLocaleDateString(locale, {weekday:"short"})}</small>{date.getDate()}
            </motion.button>;
          })}
        </div>
        <label className="grid gap-2">{t("orderTime")}<input className="rounded-xl bg-surface-secondary p-3" type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      </Sheet.Body><Sheet.Footer><Button fullWidth isDisabled={!(draft.getTime() > Date.now())} onPress={() => {
        if (draft.getTime() > Date.now()) { onChange(draft.toISOString()); setOpen(false); }
      }}>{t("save")}</Button></Sheet.Footer>
    </Sheet.Dialog></Sheet.Content></Sheet.Backdrop></Sheet>
  </Card>;
}
