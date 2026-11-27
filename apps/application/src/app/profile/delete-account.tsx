"use client";

import { Button } from "@heroui/react";
import { useLocale } from "next-intl";
import { useState } from "react";
import { commerceApi } from "@/lib/commerce-client";

export function DeleteAccount() {
  const german = useLocale().startsWith("de");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1") return null;
  return <section className="mt-4 rounded-3xl bg-surface-secondary p-5">
    <Button variant="danger" isDisabled={busy} onPress={() => {
      if (!window.confirm(german ? "Link zur Kontolöschung per E-Mail anfordern?" : "Request an account deletion link by email?")) return;
      setBusy(true); setMessage("");
      void commerceApi("me", "DELETE", {}).then(() => setMessage(german ? "Bitte bestätige die Löschung per E-Mail." : "Check your email to confirm the deletion."))
        .catch(error => setMessage(error.message)).finally(() => setBusy(false));
    }}>{german ? "Konto löschen" : "Delete account"}</Button>
    {message && <p role="status">{message}</p>}
  </section>;
}
