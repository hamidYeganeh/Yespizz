"use client";
import { useEffect, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useTranslations } from "next-intl";
type Contact = { name?: string[]; tel?: string[] };
type Picker = {
  select: (
    fields: string[],
    options: { multiple: boolean },
  ) => Promise<Contact[]>;
};
export function Friends() {
  const t = useTranslations("Application.settings");
  const { data: session, isPending } = authClient.useSession();
  const code = (session?.user as { inviteCode?: string } | undefined)
    ?.inviteCode;
  const [rows, setRows] = useState<Contact[]>([]),
    [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false),
    [notice, setNotice] = useState("");
  const [picker, setPicker] = useState<Picker>();
  useEffect(
    () => setPicker((navigator as Navigator & { contacts?: Picker }).contacts),
    [],
  );
  useEffect(() => {
    if (copied) {
      const id = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(id);
    }
  }, [copied]);
  if (isPending) return null;
  if (!code) return <Link href="/auth/sign-in">{t("inviteSignIn")}</Link>;
  const message = t("inviteMessage", { code });
  function invite(number: string) {
    const href =
      "sms:" +
      number.replace(/[^0-9+]/g, "") +
      "?body=" +
      encodeURIComponent(message);
    return (
      <a className="button button--primary" href={href}>
        {t("inviteAction")}
      </a>
    );
  }
  return (
    <div className="grid gap-4">
      <Card className="rounded-full px-5 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={String(copied)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex min-h-10 items-center justify-between gap-2"
            aria-live="polite"
          >
            {copied ? (
              t("codeCopied")
            ) : (
              <>
                <strong>{code}</strong>
                <Button
                  size="sm"
                  onPress={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                      setCopied(true);
                    } catch {
                      setNotice(t("copyManually"));
                    }
                  }}
                >
                  {t("copy")}
                </Button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
      {picker && (
        <Button
          onPress={async () => {
            try {
              setRows(await picker.select(["name", "tel"], { multiple: true }));
              setNotice("");
            } catch {
              setNotice(t("contactsUnavailable"));
            }
          }}
        >
          {t("chooseContacts")}
        </Button>
      )}
      {rows.flatMap((row) =>
        (row.tel ?? []).map((number) => (
          <div key={number} className="settings-card">
            <div className="grow">
              <strong>{row.name?.[0]}</strong>
              <small>{number}</small>
            </div>
            {invite(number)}
          </div>
        )),
      )}
      <label>
        {t("phoneNumber")}
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {/^[+\d][\d ()-]{5,20}$/.test(phone) && invite(phone)}
      <p role="status">{notice}</p>
    </div>
  );
}
