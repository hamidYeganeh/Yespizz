"use client";

import { offerCode, offerAmount, checkoutOfferDraft } from "./discount";
import type { StoredOrder } from "../orders/order-data";
import { addTransitionType, useEffect, useRef, useState, useSyncExternalStore, startTransition } from "react";
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number";
import { Button, Card, Input, Sheet } from "@heroui/react";
import {
  Icon as AppIcon,
  QrCode,
  CalendarDays,
  ShoppingBag,
  ShoppingBasket,
  PackageOpen,
  MapPin,
  Pencil,
  BadgePercent,
  CreditCard,
  Check,
  Plus,
  X,
} from "@repo/icons";
import Image from "next/image";
import { ButtonLink } from "../components/button-link";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { playUiSound } from "../ui-sounds";
import { PageTransition } from "../components/page-transition";
import { menu } from "../menu/[id]/catalog";
import { ScheduleOrder } from "../../components/ui/calendar-widget";
import { useProfileValue } from "../profile/profile-data";
import { previousAppPath } from "../components/back-link";
import { MenuCard } from "../menu/menu-card";
import { RollingCounter } from "../components/rolling-counter";
import { readBasket } from "./cart";
import "../profile/settings.css";
import { defaultCards, wallets, addressLine, AddressForm, initialAddresses, SavedAddressRow, type Address } from "../profile/address-payment";
import "../profile/settings.css";
import "./checkout.css";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { commerceApi } from "@/lib/commerce-client";

type CheckoutQuote = { total: number; subtotal: number; discount: number; deliveryFee: number; etaMinutes: number };

type Screen = "items" | "delivery" | "address" | "payment" | "done";
type Receipt = {
  approved: boolean;
  reference: string;
  date: Date;
  subtotal: number;
  discount: number;
  total: number;
};

const empty = () => "";
const snapshot = () => localStorage.getItem("yespiz-basket") ?? "{}";
function subscribe(update: () => void) {
  window.addEventListener("storage", update);
  return () => window.removeEventListener("storage", update);
}

function PaymentAmount({
  value,
  reserve,
  currency,
}: {
  value: number;
  reserve: number;
  currency: Intl.NumberFormat;
}) {
  const parts = currency.formatToParts(value);
  const group = currency
    .formatToParts(10000)
    .find((part) => part.type === "group")?.value;
  return (
    <span className="payment-number">
      <span className="payment-number-space" aria-hidden="true">
        {currency.format(reserve)}
      </span>
      <span className="payment-number-value">
        {parts.map((part, i) => {
          if (
            part.type === "integer" &&
            !parts.slice(0, i).some((previous) => previous.type === "integer")
          ) {
            return (
              <SlidingNumber
                key="digits"
                number={value}
                decimalPlaces={
                  parts.find((p) => p.type === "fraction")?.value.length ?? 0
                }
                decimalSeparator={
                  parts.find((p) => p.type === "decimal")?.value
                }
                thousandSeparator={group}
              />
            );
          }
          return part.type === "currency" || part.type === "literal"
            ? part.value
            : null;
        })}
      </span>
    </span>
  );
}



export function PaymentFlow() {
  const t = useTranslations("Application.checkout");
  const dish = useTranslations("Application.menu");
  const format = useFormatter();
  const locale = useLocale();
  const german = locale.startsWith("de");
  const online = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1";
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const money = (value: number, reserve = value) => (
    <PaymentAmount value={value} reserve={reserve} currency={currency} />
  );
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, snapshot, empty);
  const basket = stored ? readBasket() : {};
  const entries = menu.filter((item) => basket[item.id]);
  const [screen, setScreen] = useState<Screen>("items");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const settings = useTranslations("Application.settings");
  const [addresses, saveAddresses] = useProfileValue<Address[]>("addresses", initialAddresses);
  const [addingAddress, setAddingAddress] = useState(false);
  const [selectedId, saveId] = useProfileValue("delivery-address-id", "");
  const address = addresses.find(entry => entry.id === selectedId) ?? addresses[0];
  const addressForm = useForm({
    defaultValues: { id: "" },
    resolver: zodResolver(z.object({ id: z.string().refine(id => addresses.some(entry => entry.id === id), t("selectAddress")) })),
  });
  const [cards] = useProfileValue("cards",defaultCards);
  const [method, selectMethod] = useState("");
  const methods = [...cards.map(n => "•••• "+n), ...wallets];
  const paymentMethod = methods.includes(method) ? method : methods[0];
  const [code, setCode] = useState("");
  const offerForm = useForm({
    defaultValues: { code: "" },
    resolver: zodResolver(z.object({ code: z.string().trim().max(80).refine(value => online || !value || value === offerCode, t("invalid")) })),
  });
  const [orders, saveOrders] = useProfileValue<StoredOrder[]>("orders", []);
  const sheet = useRef<HTMLDialogElement>(null);
  const count = entries.reduce((sum, item) => sum + basket[item.id]!, 0);
  const subtotal = entries.reduce(
    (sum, item) => sum + basket[item.id]! * item.price,
    0,
  );
  const [scheduledAt, setScheduledAt] = useProfileValue("checkout-scheduled-at", "");
  const discount = code ? Math.min(offerAmount, subtotal) : 0;
  const total = subtotal - discount;

  const { reset: resetOffer } = offerForm;
  useEffect(() => {
    if (!stored || !count) return;
    if (!history.state?.yespizOfferPicker && !new URLSearchParams(location.search).has("offerSheet")) return;
    const draft = sessionStorage.getItem(checkoutOfferDraft);
    if (draft === null) return;
    const applied = sessionStorage.getItem(checkoutOfferDraft + "-applied");
    setCode(applied && (online || applied === offerCode) ? applied : "");
    resetOffer({code:draft});
    setScreen("payment");
  }, [stored, count, resetOffer, online]);

  useEffect(() => {
    if (screen !== "payment" || !sheet.current || sessionStorage.getItem(checkoutOfferDraft) === null) return;
    sheet.current.showModal();
    sessionStorage.removeItem(checkoutOfferDraft);
    sessionStorage.removeItem(checkoutOfferDraft + "-applied");
    const url = new URL(location.href);
    url.searchParams.delete("offerSheet");
    history.replaceState({...history.state, yespizOfferPicker:false}, "", url);
  }, [screen, stored]);

  function show(next: Screen, backward = false) {
    startTransition(() => {
      addTransitionType(backward ? "nav-back" : "slide");
      setScreen(next);
    });
    window.scrollTo(0, 0);
  }
  function back() {
    if (screen === "done" && !receipt?.approved) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState(window.history.state, "", url);
      show("payment", true);
    } else if (screen === "address") show("delivery", true);
    else if (screen === "payment") show("delivery", true);
    else if (screen === "delivery") show("items", true);
    else if (screen === "done") router.replace("/orders");
    else {
      const previous = previousAppPath();
      if (previous && (["/", "/orders", "/menu"].includes(previous) || menu.some(item => previous === "/menu/" + item.id))) router.back();
      else router.replace("/menu");
    }
  }
  const [shops, setShops] = useState<{ owner: string; name: string; accepting: boolean; paymentsAvailable: boolean }[]>([]);
  const [chosen, choose] = useState("");
  const owner = chosen || shops[0]?.owner;
  const [slots, setSlots] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [confirmedQuote, setConfirmedQuote] = useState<{ key: string; price: CheckoutQuote } | null>(null);
  const requestRef = useRef({ key: "", reference: "" });
  const inFlight = useRef(false);
  const [resume, setResume] = useState("");
  const orderInput = { owner, address, scheduledAt, code, items: entries.map(item => ({ id: item.id, quantity: basket[item.id] })) };
  const quoteKey = JSON.stringify(orderInput);
  const currentQuote = confirmedQuote?.key === quoteKey ? confirmedQuote.price : null;
  useEffect(() => {
    if (!online) return;
    setResume(new URLSearchParams(location.search).get("resume") ?? "");
    commerceApi<typeof shops>("restaurants").then(data => setShops(data.filter(shop => shop.accepting))).catch(() => {});
    commerceApi<typeof contact & { contactPhone?: string }>("me").then(data => {
      setContact(previous => ({ name: previous.name || data.name || "", email: previous.email || data.email || "", phone: previous.phone || data.contactPhone || "" }));
    }).catch(() => {});
  }, [online]);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    commerceApi<string[]>(`restaurants/${encodeURIComponent(owner)}/delivery-slots`).then(data => { if (active) setSlots(data); }).catch(() => { if (active) setSlots([]); });
    return () => { active = false; };
  }, [owner]);

  async function handleOnline(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try { await work(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Checkout is unavailable."); }
    finally { inFlight.current = false; setPending(false); }
  }

  async function pay(reference: string) {
    const result = await commerceApi<{ url: string | null }>(`orders/${encodeURIComponent(reference)}/payment`, "POST", {});
    if (result.url) window.location.assign(result.url);
    else router.push(`/orders/${encodeURIComponent(reference)}`);
  }

  async function advance() {
    if (pending) return;
    if (screen === "items") { show("delivery"); return; }
    if (online && address && (screen === "delivery" || screen === "payment")) {
      await handleOnline(async () => {
        if (!currentQuote || screen === "delivery") {
          const price = await commerceApi<CheckoutQuote>("checkout/quote", "POST", orderInput);
          setConfirmedQuote({ key: quoteKey, price });
          if (screen === "delivery") show("payment");
          return;
        }
        if (!contact.name.trim() || !/^\S+@\S+\.\S+$/.test(contact.email.trim()) || contact.phone.trim().length < 5) {
          throw new Error(german ? "Bitte Name, E-Mail und Telefonnummer eingeben." : "Enter your name, email and phone number.");
        }
        const key = JSON.stringify([quoteKey, contact, currentQuote.total]);
        if (requestRef.current.key !== key) requestRef.current = { key, reference: "FIT" + crypto.randomUUID() };
        const { reference } = requestRef.current;
        await commerceApi("orders", "POST", { ...orderInput, ...contact, reference, expectedTotal: currentQuote.total });
        sessionStorage.setItem(`yespizz-checkout-${reference}`, stored);
        await pay(reference);
      });
      return;
    }
    if (screen === "delivery" && address) show("payment");
    if (screen === "payment" && address) {
      if (scheduledAt && Date.parse(scheduledAt) <= Date.now()) { show("delivery"); return; }
      // The demo can exercise a declined payment without consuming the basket.
      let approved =
        new URLSearchParams(window.location.search).get("payment") !==
        "declined";
      const reference = requestRef.current.reference ||= "FIT" + crypto.randomUUID();
      if (approved) {
        try {
          saveOrders([{ point: address.point, paymentMethod, scheduledAt: scheduledAt || undefined, reference, date: new Date().toISOString(), total, address: addressLine(address), items: { ...basket } }, ...orders]);
          setScheduledAt("");
          localStorage.removeItem("yespiz-basket");
          window.dispatchEvent(new Event("storage"));
        } catch {
          approved = false;
        }
      }
      setPending(false);
      playUiSound(approved ? "confirmed" : "select");
      setReceipt({
        approved,
        reference,
        date: new Date(),
        subtotal,
        discount,
        total,
      });
      show("done");
    }
  }
  return (
    <PageTransition pageKey={screen} effect="slide">
      <main className="checkout">
        {error && <p role="alert">{error}</p>}
        {resume && <Card className="checkout-card">
          <Button onPress={() => void handleOnline(() => pay(resume))} isDisabled={pending}>{german ? "Zahlung fortsetzen" : "Resume payment"}</Button>
          <Button variant="outline" onPress={() => setResume("")}>{german ? "Schließen" : "Dismiss"}</Button>
        </Card>}
        <header>
          <Button
            isIconOnly size="lg"
            variant="secondary"
            aria-label={t("back")}
            onPress={back}
          >
            <AppIcon name="chevron-left" />
          </Button>
          <h1>
            {screen === "done"
              ? t("details")
              : screen === "address"
                ? t("selectAddress")
                : t("title")}
          </h1>
        </header>
        {screen === "done" && receipt ? (
          <Card
            className="payment-receipt"
            data-result={receipt.approved ? "success" : "failure"}
          >
            <Card.Header className="receipt-heading">
              <div className="receipt-scene" aria-hidden="true">
                <span className="receipt-window" />
                <span className="receipt-table" />
                <span className="receipt-seal">
                  {receipt.approved ? <Check /> : <X />}
                </span>
              </div>
              <h2 role="status">
                {t(receipt.approved ? "registered" : "failed")}
              </h2>
            </Card.Header>
            <Card.Content className="receipt-content">
              <dl>
                {(
                  [
                    [QrCode, t("trackingCode"), receipt.reference],
                    [
                      CalendarDays,
                      t("paymentDate"),
                      format.dateTime(receipt.date, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }),
                    ],
                    [ShoppingBag, t("amount"), money(receipt.subtotal)],
                    [BadgePercent, t("discount"), money(receipt.discount)],
                    [ShoppingBasket, t("total"), money(receipt.total)],
                  ] as const
                ).map(([Icon, label, value]) => (
                  <div key={label}>
                    <dt>
                      <Icon aria-hidden="true" />
                      {label}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </Card.Content>
            <Button onPress={receipt.approved ? () => router.replace("/orders") : back}>{t(receipt.approved ? "viewOrders" : "back")}</Button>
          </Card>
        ) : !count ? (
          <div className="list-empty" aria-live="polite">{stored && <img src="/empty/basket.webp" alt="" />}
            {stored && dish("empty")}{" "}
            {stored && <ButtonLink href="/menu">{t("menu")}</ButtonLink>}
          </div>
        ) : (
          <>
            {(screen === "items" || screen === "delivery") && (
              <Card className="checkout-summary">
                <h2>
                  <PackageOpen />
                  {t("summary")}
                  <b>
                    <SlidingNumber number={count} />
                  </b>
                </h2>
                <dl>
                  {[
                    [t("amount"), subtotal],
                    ...(discount ? [[t("discount"), discount]] : []),
                    [t("total"), total],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {money(
                          Number(value),
                          label === t("total")
                            ? subtotal
                            : Number(value),
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
            {screen === "items" &&
              entries.map((item) => (
                <MenuCard key={item.id} item={item} basket={{ quantity:basket[item.id]!, controls:(
                  <RollingCounter start={basket[item.id]} value={basket[item.id]} label={dish("quantity")+" · "+dish(item.key)} lessLabel={dish("decrease")} moreLabel={dish("increase")} onChange={quantity => {
                    const next = readBasket();
                    if (quantity) next[item.id] = quantity;
                    else delete next[item.id];
                    localStorage.setItem("yespiz-basket", JSON.stringify(next));
                    window.dispatchEvent(new Event("storage"));
                  }} />
                )}} />
              ))}
            {screen === "delivery" && (
              <Card className="checkout-card">
                <h2>
                  <MapPin />
                  {t("location")}
                  {address && <Button
                    variant="outline" size="sm"
                    onPress={() => {
                      addressForm.reset({ id: address?.id ?? "" });
                      show("address");
                    }}
                  >
                    {t("edit")} <Pencil />
                  </Button>}
                </h2>
                {address ? <div className="checkout-panel"><b>{address.name}</b><p>{addressLine(address)}</p></div> : (
                  <div className="checkout-address-empty">
                    <img className="empty-art" src="/empty/address.webp" alt="" /><strong>{settings("emptyAddress")}</strong>
                    <p>{settings("addressHint")}</p>
                    <Button variant="secondary" onPress={() => setAddingAddress(true)}><Plus />{settings("addAddress")}</Button>
                  </div>
                )}
              </Card>
            )}
            {screen === "delivery" && online && <Card className="checkout-card">
              <label>Restaurant<select className="block w-full rounded-xl bg-surface-secondary p-3" value={owner ?? ""} onChange={e => { choose(e.target.value); setScheduledAt(""); }}>{shops.map(shop => <option key={shop.owner} value={shop.owner}>{shop.name}</option>)}</select></label>
              {!shops.length && <p>{german ? "Derzeit nimmt kein Restaurant Bestellungen an." : "No restaurants are accepting orders yet."}</p>}
              {owner && !shops.find(shop => shop.owner === owner)?.paymentsAvailable && <p>{german ? "Online-Zahlungen sind derzeit nicht verfügbar." : "Online payments are currently unavailable."}</p>}
              <label>{german ? "Lieferzeit" : "Delivery time"}<select className="block w-full rounded-xl bg-surface-secondary p-3" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)}>
                <option value="">{german ? "So bald wie möglich" : "As soon as possible"}</option>
                {slots.map(slot => <option key={slot} value={slot}>{format.dateTime(new Date(slot), { timeZone: "Europe/Vienna", dateStyle: "short", timeStyle: "short" })}</option>)}
              </select></label>
            </Card>}
            {screen === "delivery" && !online && <ScheduleOrder value={scheduledAt} onChange={setScheduledAt} />}
            {screen === "address" && (
              <form
                id="checkout-address"
                className="checkout-form"
                onSubmit={addressForm.handleSubmit(({ id }) => { saveId(id); show("delivery"); })}
              >
                <Controller control={addressForm.control} name="id" render={({ field }) => (
                  <div className="saved-address-list settings-list" role="group" aria-label={t("selectAddress")}>
                    {addresses.map(entry => <SavedAddressRow key={entry.id} item={entry}
                      selected={field.value === entry.id} onPress={() => field.onChange(entry.id)} />)}
                  </div>
                )} />
                <Button type="button" variant="secondary" onPress={() => setAddingAddress(true)}>{settings("addAddress")}</Button>
                {addressForm.formState.errors.id && <p role="alert">{addressForm.formState.errors.id.message}</p>}
              </form>
            )}
            {screen === "payment" && (
              <>
                <Card className="checkout-card">
                  <h2>
                    <BadgePercent />
                    {t("offers")}
                    {code && (
                      <span className="checkout-offer-code">
                        {code}
                        <Check aria-hidden="true" />
                      </span>
                    )}
                    <Button
                      size="sm"
                      onPress={() => {
                        offerForm.reset({ code });
                        sheet.current?.showModal();
                      }}
                    >
                      {t(code ? "edit" : "add")}
                      {code ? <Pencil /> : <Plus />}
                    </Button>
                  </h2>
                </Card>
                <Card className="checkout-card">
                  <h2>
                    <CreditCard />
                    {t("payment")}
                  </h2>
                  {online ? <fieldset className="checkout-form">
                    <label>{german ? "Name" : "Full name"}<Input autoComplete="name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></label>
                    <label>{german ? "E-Mail" : "Email"}<Input type="email" autoComplete="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></label>
                    <label>{german ? "Telefonnummer" : "Phone"}<Input type="tel" autoComplete="tel" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></label>
                    {currentQuote && <p>{german ? "Lieferkosten" : "Delivery"} {currency.format(currentQuote.deliveryFee / 100)} · {currentQuote.etaMinutes} min</p>}
                  </fieldset> : <fieldset aria-label={t("payment")} className="grid gap-2">{methods.map(name =>
                    <label className="checkout-choice cursor-pointer" key={name}>
                      <input type="radio" name="paymentMethod" checked={paymentMethod === name} onChange={() => selectMethod(name)}/>{name}
                    </label>)}</fieldset>}
                </Card>
                <dialog
                  ref={sheet}
                  aria-labelledby="offer-heading"
                  className="offer-sheet"
                >
                  <form
                    onSubmit={offerForm.handleSubmit(values => { setCode(values.code); sheet.current?.close(); })}
                  >
                    <header>
                      <Button
                        isIconOnly
                        size="lg"
                        aria-label={t("close")}
                        onPress={() => sheet.current?.close()}
                      >
                        <X />
                      </Button>
                      <h2 id="offer-heading">{t("offers")}</h2>
                    </header>
                    <label>
                      {t("code")}
                      <Input
                        autoFocus
                        {...offerForm.register("code")}
                        aria-invalid={!!offerForm.formState.errors.code}
                        aria-describedby={offerForm.formState.errors.code ? "code-error" : undefined}
                        placeholder={t("code")}
                      />
                    </label>
                    {offerForm.formState.errors.code && <p id="code-error" role="alert">{offerForm.formState.errors.code.message}</p>}
                    <ButtonLink href="/profile/offers?from=checkout" transitionTypes={["slide"]} onNavigate={() => {
                      history.replaceState({...history.state, yespizOfferPicker:true}, "");
                      sessionStorage.setItem(checkoutOfferDraft, offerForm.getValues("code"));
                      sessionStorage.setItem(checkoutOfferDraft + "-applied", code);
                      sheet.current?.close();
                    }}>{t("browseOffers")}</ButtonLink>
                    <footer>
                      <Button
                        variant="outline"
                        onPress={() => sheet.current?.close()}
                      >
                        {t("continue")}
                      </Button>
                      <Button type="submit">{t("save")}</Button>
                    </footer>
                  </form>
                </dialog>
              </>
            )}
            <Sheet placement="bottom" isOpen={addingAddress} onOpenChange={setAddingAddress}>
              <Sheet.Backdrop><Sheet.Content className="mx-auto max-w-(--app-width)"><Sheet.Dialog>
                <Sheet.Handle /><Sheet.CloseTrigger />
                <Sheet.Header><Sheet.Heading>{settings("addAddress")}</Sheet.Heading></Sheet.Header>
                <Sheet.Body className="overflow-y-auto" data-lenis-prevent>
                  {addingAddress && <AddressForm inSheet initial={{id:"",name:"",line:""}} onSave={draft => {
                    const entry = {...draft, id: crypto.randomUUID()};
                    saveAddresses([...addresses, entry]);
                    saveId(entry.id);
                    setAddingAddress(false);
                    show("delivery");
                  }} />}
                </Sheet.Body>
              </Sheet.Dialog></Sheet.Content></Sheet.Backdrop>
            </Sheet>
            <footer className="checkout-bottom">
              {screen === "address" ? (
                <Button isDisabled={!addresses.length} type="submit" form="checkout-address">
                  {t("confirmAddress")}
                </Button>
              ) : (
                <>
                  <div>
                    <small>{dish("total")}</small>
                    <strong>{money(currentQuote ? currentQuote.total / 100 : total, subtotal)}</strong>
                  </div>
                  <Button isDisabled={pending || (screen === "delivery" && (!address || (online && (!owner || !shops.find(shop => shop.owner === owner)?.paymentsAvailable))))} data-own-sound={screen === "payment" ? "" : undefined} onPress={advance}>
                    {screen === "payment" && online ? currentQuote ? german ? "Zahlungspflichtig bestellen" : "Pay and place order" : german ? "Preis prüfen" : "Review price" : t(screen === "payment" ? "confirmDemo" : "continue")}
                  </Button>
                </>
              )}
            </footer>
          </>
        )}
      </main>
    </PageTransition>
  );
}

