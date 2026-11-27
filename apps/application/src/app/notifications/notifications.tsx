import { BackLink } from "../components/back-link";
import { Icon } from "@repo/icons";
import { Chip } from "@heroui/react/chip";
import { getLocale, getTranslations } from "next-intl/server";

export const notifications = [
  { id: "order-cancelled", icon: "close-x-circle", tone: "bg-danger/10 text-danger", date: "2022-12-19T20:50", fresh: true },
  { id: "order-successful", icon: "shopping-bag", tone: "bg-success/10 text-success", date: "2022-12-19T20:49", fresh: true },
  { id: "new-services", icon: "ticket", tone: "bg-warning/10 text-warning", date: "2022-12-14T10:52", fresh: false },
  { id: "card-connected", icon: "wallet", tone: "bg-blue-500/10 text-blue-500", date: "2022-12-12T15:38", fresh: false },
  { id: "account-setup", icon: "user", tone: "bg-success/10 text-success", date: "2022-12-12T14:27", fresh: false },
] as const;

export async function Header({ href }: { href: string }) {
  const t = await getTranslations("Application");
  return <header className="flex items-center gap-4">
    <BackLink href={href} parents={href === "/" ? ["/orders"] : []} aria-label={t("profile.back")} className="grid size-12 place-items-center rounded-full bg-surface-secondary text-2xl"><Icon name="chevron-left" /></BackLink>
    <h1 className="text-lg font-bold">{t("notifications.title")}</h1>
  </header>;
}

export async function Notice({ item }: { item: typeof notifications[number] }) {
  const [t, locale] = await Promise.all([getTranslations("Application.notifications"), getLocale()]);
  const date = new Date(item.date + ":00Z");
  return <article className="py-4">
    <div className="flex items-center gap-4">
      <span className={`grid size-[60px] shrink-0 place-items-center rounded-full text-2xl ${item.tone}`}><Icon name={item.icon} /></span>
      <div className="flex-1">
        <h2 className="font-bold">{t(`${item.id}.title`)}</h2>
        <time dateTime={item.date} className="text-sm text-muted">{date.toLocaleDateString(locale === "en" ? "en-GB" : locale, {day:"numeric", month:"short", year:"numeric", timeZone:"UTC"})} | {item.date.slice(11)}</time>
      </div>
      {item.fresh && <Chip color="danger" variant="primary" size="sm">{t("new")}</Chip>}
    </div>
    <p className="mt-3 text-sm leading-5">{t(`${item.id}.body`)}</p>
  </article>;
}

