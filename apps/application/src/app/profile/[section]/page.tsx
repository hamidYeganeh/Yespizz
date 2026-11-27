import { PageTransitionShared } from "../../components/page-transition";
import { ProfileMenu } from "../profile-menu";
import { Account } from "../account";
import { AddressBook, Payments } from "../address-payment";
import { Sounds, Friends } from "../preferences";
import { Favorites } from "../favorites";
import { Help } from "../help";
import { ButtonLink } from "../../components/button-link";
import { BackLink } from "../../components/back-link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@repo/icons";
import { LanguagePicker } from "../language-picker";
import { groups } from "../sections";

export default async function ProfileSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const key = section === "account" ? "account" : groups.flat().find(([id]) => id === section)?.[0];
  if (!key) notFound();
  const [t, locale] = await Promise.all([
    getTranslations("Application.profile"), getLocale(),
  ]);

  if (key === "logout") return <ProfileMenu behindLogout />;
  return (
    <main className="profile settings-screen mx-auto min-h-dvh max-w-(--app-width) bg-surface px-(--page-gutter) py-3 text-surface-foreground">
      <header className="mb-6 flex items-center gap-3">
        <BackLink href="/profile" aria-label={t("back")} className="grid size-12 place-items-center rounded-full bg-surface-secondary text-2xl">
          <Icon name="chevron-left" />
        </BackLink>
        <h1 className="text-xl font-bold"><PageTransitionShared name={`profile-title-${key}`}>{t(key === "account" ? "title" : key)}</PageTransitionShared></h1>
      </header>
      <p className="mb-5 text-sm text-muted">{t(`intro.${key}`)}</p>
      {key === "account" ? <Account />
        : key === "address" ? <AddressBook />
        : key === "payment" ? <Payments />
        : key === "sounds" ? <Sounds />
        : key === "invite" ? <Friends />
        : key === "help" ? <Help />
        : key === "language" ? <LanguagePicker locale={locale} label={t("language")} />
        : key === "favorites" ? <Favorites />
        : <section className="rounded-3xl bg-surface-secondary p-5">
            <h2 className="font-semibold">{t("password")}</h2>
            <p className="my-3 text-sm">{t("recoveryHint")}</p>
            <ButtonLink href="/auth/forgot-password">{t("resetPassword")}</ButtonLink>
          </section>}
    </main>
  );
}

export async function generateStaticParams() { return ["account", ...groups.flat().map(([id]) => id).filter(id => id !== "offers")].map(section => ({section})); }
