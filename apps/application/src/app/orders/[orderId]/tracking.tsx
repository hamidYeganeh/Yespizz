"use client";

import { startTransition, useEffect, useLayoutEffect, useState, useSyncExternalStore, useRef } from "react";
import { useRouter } from "next/navigation";
import { orderHref } from "../order-href";
import Image from "next/image";
import { BackLink } from "../../components/back-link";
import { useTranslations } from "next-intl";
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number";
import { Modal } from "@heroui/react/modal";
import { Button, buttonVariants } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Icon } from "@repo/icons";
import { Link as HeroLink } from "@heroui/react/link";
import {
  PageTransition,
  PageTransitionShared,
} from "../../components/page-transition";
import { AnimatePresence, motion } from "motion/react";
import { transition, useTempoTransition, useShouldReduceMotion } from "@animate-ui/react/utils/motion";
import { DeliveryMap } from "./delivery-map";

const name = "Rayford Chenail",
  model = "Yamaha MX King",
  plate = "HSW 4736 XK",
  phone = "+1-202-555-0161";

function Portrait({ size }: { size: number }) {
  return (
    <Image
      className="driver-portrait"
      src="/orders/driver.webp"
      alt=""
      width={size}
      height={size}
    />
  );
}

function subscribeOrder(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("order-cancelled", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("order-cancelled", listener);
  };
}

function StatusText({ text }: { text: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const initial = useRef(text);
  useLayoutEffect(() => {
    const el = node.current;
    if (!el || el.textContent === text) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = text; return; }
    el.classList.add("is-exit");
    const duration = parseFloat(getComputedStyle(el).getPropertyValue("--text-swap-dur"));
    const timer = window.setTimeout(() => {
      el.textContent = text;
      el.classList.remove("is-exit");
      el.classList.add("is-enter-start");
      void el.offsetHeight;
      el.classList.remove("is-enter-start");
    }, duration);
    return () => { clearTimeout(timer); el.classList.remove("is-exit"); };
  }, [text]);
  return <span ref={node} className="t-text-swap">{initial.current}</span>;
}

const milestones = [
  { at: 0, label: "heading", icon: "chef-hat" },
  { at: .22, label: "pickedUp", icon: "shopping-bag" },
  { at: .35, label: "onWay", icon: "motorcycle" },
  { at: 1, label: "delivered", icon: "check-circle" },
] as const;
const demoDuration = 120000;

export function OrderTracking({ orderId }: { orderId: string }) {
  const t = useTranslations("Application.order");
  const backLabel = useTranslations("Application.profile")("back");
  const [profile, setProfile] = useState(false);
  const [avatarSource, setAvatarSource] = useState("courier-card-avatar");
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const showProfile = (open: boolean, source = "courier-card-avatar") =>
    startTransition(() => {
      if (open) setAvatarSource(source);
      setProfile(open);
    });
  const key = `yespiz-cancelled-${orderId}`;
  const cancelled = useSyncExternalStore(
    subscribeOrder,
    () => localStorage.getItem(key) === "yes",
    () => false,
  );
  const [history, setHistory] = useState(false);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(0);
  const stagger = useTempoTransition(transition.reveal);
  const reveal = useTempoTransition(transition.disclosure);
  const reduce = useShouldReduceMotion();
  useEffect(() => {
    const startKey = "yespiz-tracking-start-" + orderId;
    const start = Number(localStorage.getItem(startKey)) || Date.now();
    localStorage.setItem(startKey, String(start));
    setStarted(start);
    const stopped = cancelled ? Number(localStorage.getItem(key + "-at")) || start : 0;
    let timer = 0;
    const tick = () => {
      const fraction = Math.min(1, Math.max(0, ((stopped || Date.now()) - start) / demoDuration));
      setProgress(fraction);
      if (fraction === 1 && !cancelled) {
        localStorage.setItem("yespiz-delivered-" + orderId, "yes");
        if(process.env.NEXT_PUBLIC_YESPIZ_OFFLINE!=="1")void fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference:orderId,status:"completed"})}).catch(()=>{});
        window.dispatchEvent(new Event("storage"));
      } else if (!cancelled) timer = window.setTimeout(tick, reduce ? 1000 : 200);
    };
    tick();
    return () => clearTimeout(timer);
  }, [orderId, cancelled, key, reduce]);
  const reached = milestones.filter(step => step.at <= progress);
  const state = reached[reached.length - 1]!;
  return (
    <main className="order-screen">
      <PageTransition
        effect="slide"
        pageKey={profile ? "driver" : "tracking"}
        className="order-view"
      >
        {profile ? (
          <>
            <header className="driver-header">
              <Button
                size="lg"
                isIconOnly
                aria-label={t("tracking")}
                onPress={() => showProfile(false)}
              >
                <Icon name="chevron-left" />
              </Button>
              <h1>{t("profile")}</h1>
            </header>
            <div className="driver-identity">
              <button className="portrait-trigger" aria-label={t("viewPortrait",{name})} onClick={()=>setPortraitOpen(true)}>
              <PageTransitionShared
                name={avatarSource}
                className="courier-avatar"
              >
                <Portrait size={116} />
              </PageTransitionShared></button>
              <h2>
                <PageTransitionShared name="courier-name">
                  {name}
                </PageTransitionShared>
              </h2>
              <div>
                {phone}{" "}
                <Button
                  variant="ghost"
                  size="lg"
                  isIconOnly
                  aria-label={t("copy")}
                  onPress={async () => {
                    try {
                      await navigator.clipboard.writeText(phone);
                      setCopied(true);
                    } catch {
                      window.prompt(t("copy"), phone);
                    }
                  }}
                >
                  <Icon name={copied ? "check" : "copy-1"} />
                </Button>
              </div>
            </div>
            <div className="driver-stats">
              {(
                [
                  ["star-full", "4.8", "ratings"],
                  ["shopping-bag", "425", "orders"],
                  ["clock", "4", "years"],
                ] as const
              ).map(([icon, value, label]) => (
                <Card key={label}>
                  <Icon name={icon} />
                  <strong><SlidingNumber number={Number(value)} decimalPlaces={label === "ratings" ? 1 : 0} inView /></strong>
                  <span>{t(label)}</span>
                </Card>
              ))}
            </div>
            <Card className="driver-details">
              <dl>
                {(
                  [
                    ["since", t("date")],
                    ["model", model],
                    ["plate", plate],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{t(label)}</dt>
                    <dd>
                      {label === "since" ? (
                        value
                      ) : (
                        <PageTransitionShared name={`courier-${label}`}>
                          {value}
                        </PageTransitionShared>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </>
        ) : (
          <>
            <BackLink
              className="tracking-back"
              href="/orders"
              aria-label={backLabel}
            >
              <Icon name="chevron-left" />
            </BackLink>
            <DeliveryMap progress={progress}
              openDriver={() => showProfile(true, "courier-pin-avatar")}
            />
            <section className="delivery-sheet">
              <div className="tracking-status"><h1 aria-live="polite"><Icon name={cancelled ? "close-x" : state.icon} /><StatusText text={t(cancelled ? "cancelled" : state.label)} /></h1>
                <Button size="sm" variant="secondary" aria-expanded={history} aria-controls="order-history" onPress={() => setHistory(!history)}>
                  {t("history")} <Icon name={history ? "chevron-up" : "chevron-down"} />
                </Button></div>
              <AnimatePresence initial={false}>{history && <motion.div id="order-history" style={{overflow:"hidden"}}
                initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={reduce ? {duration:0} : reveal}>
                <ol className="order-timeline">{reached.map((step, index) => <motion.li key={step.label}
                  initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ ...stagger, delay: Math.min(index, 5) * .08 }}><Icon name={step.icon} />{t(step.label)}
                  {started > 0 && <time>{new Date(started + demoDuration * step.at).toLocaleTimeString(document.documentElement.lang,{hour:"2-digit",minute:"2-digit"})}</time>}</motion.li>)}
                  {cancelled && <li><Icon name="close-x" />{t("cancelled")}</li>}</ol>
              </motion.div>}</AnimatePresence>
              <button
                className="driver-row"
                onClick={() => showProfile(true)}
                aria-label={t("profile")}
              >
                <PageTransitionShared
                  name="courier-card-avatar"
                  className="courier-avatar"
                >
                  <Portrait size={68} />
                </PageTransitionShared>
                <span>
                  <b>
                    <PageTransitionShared name="courier-name">
                      {name}
                    </PageTransitionShared>
                  </b>
                  <small>
                    <PageTransitionShared name="courier-model">
                      {model}
                    </PageTransitionShared>
                  </small>
                </span>
                <span>
                  <b>
                    <i>
                      <Icon name="star-full" />
                    </i>{" "}
                    4.5
                  </b>
                  <small>
                    <PageTransitionShared name="courier-plate">
                      {plate}
                    </PageTransitionShared>
                  </small>
                </span>
              </button>
            </section>
          </>
        )}
      </PageTransition>
      <footer className="contact-footer">
        <div>
          <Button
            variant="danger"
            className="cancel-order"
            isDisabled={cancelled || progress >= 1}
            onPress={() => router.push(orderHref(orderId, true), {transitionTypes:["slide"]})}
          >
            <Icon name="close-x" />
            {t(cancelled ? "cancelled" : "cancel")}
          </Button>
          <HeroLink className={buttonVariants({variant:"secondary",className:"call-driver"})} href={`tel:${phone}`} aria-label={t("call")}>
            <Icon name="telephone-1" />
          </HeroLink>
          <HeroLink className={buttonVariants({variant:"primary"})} href={`sms:${phone}`} aria-label={t("message")}>
            <Icon name="chat-dot" />
          </HeroLink>
        </div>
      </footer>
      <Modal.Backdrop isOpen={portraitOpen} onOpenChange={setPortraitOpen} isDismissable>
        <Modal.Container><Modal.Dialog className="portrait-lightbox" aria-label={name}>
          <Modal.CloseTrigger /><Image src="/orders/driver.webp" alt={name} width={480} height={480} />
        </Modal.Dialog></Modal.Container>
      </Modal.Backdrop>

    </main>
  );
}
