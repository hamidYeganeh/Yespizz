import { Logout } from "./logout";
import { Fragment } from "react";
import { ThemeSwitch } from "../theme-switch";
import { PageTransitionShared } from "../components/page-transition";
import { AccountSummary } from "./account";
import { Icon } from "@repo/icons";
import { Heart } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { BackButton } from "./back-button";
import { groups } from "./sections";

export async function ProfileMenu({ behindLogout = false }: { behindLogout?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("Application.profile"), getLocale()]);
  return (
    <main className="profile mx-auto min-h-dvh max-w-(--app-width) bg-surface px-(--page-gutter) py-3 text-surface-foreground">
      <h1 className="sr-only">{t("title")}</h1>
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-2xl font-black italic">
          <Image src="/auth/wordmark.png" alt="Yespiz" width={90} height={30} />
        </Link>
        <BackButton label={t("back")} />
      </header>
      <Link href="/profile/account" className="profile-row my-2">
        <AccountSummary />
        <Icon name="chevron-right" />
      </Link>
      {groups.map((rows, index) => (
        <ul key={rows[0][0]} className={index === 0 ? "space-y-1 border-y border-separator py-2" : "space-y-1 py-2"}>
          {rows.map(([key, icon]) => key === "logout" ? <li key={key}><Logout initiallyOpen={behindLogout} /></li> : (
            <Fragment key={key}><li>
              <Link href={`/profile/${key}`} className="profile-row">
                <span className="grid size-9 shrink-0 place-items-center rounded-full text-2xl bg-surface-secondary">
                  {icon === "heart" ? <Heart aria-hidden="true" size={20} /> : <Icon name={icon} />}
                </span>
                <span className="flex-1"><PageTransitionShared name={`profile-title-${key}`}>{t(key)}</PageTransitionShared></span>
                {key === "language" && <small>{locale === "en" ? "English (US)" : "Deutsch (Österreich)"}</small>}
                <Icon name="chevron-right" />
              </Link>
            </li>
            {key === "language" && <li><ThemeSwitch row /></li>}</Fragment>
          ))}
        </ul>
      ))}
    </main>
  );
}
