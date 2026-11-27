"use client";
import { Icon } from "@repo/icons";
import { Button, Sheet } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { disconnectNativePush } from "@/lib/native-push";

export function Logout({initiallyOpen = false}: {initiallyOpen?: boolean}) {
  const [open,setOpen] = useState(initiallyOpen);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  const t = useTranslations("Application.settings");
  const p = useTranslations("Application.profile");
  return <><button type="button" className="profile-row w-full text-danger" onClick={() => {setFailed(false); setOpen(true);}}>
    <span className="grid size-9 place-items-center rounded-full bg-danger/5"><Icon name="arrow-sign-out-1" /></span><span className="grow text-start">{p("logout")}</span><Icon name="chevron-right" />
  </button><Sheet placement="bottom" isOpen={open} onOpenChange={setOpen}>
    <Sheet.Backdrop><Sheet.Content className="mx-auto max-w-(--app-width)"><Sheet.Dialog className="logout-sheet">
      <Sheet.Handle /><Sheet.CloseTrigger /><Sheet.Header><Sheet.Heading>{p("logout")}</Sheet.Heading></Sheet.Header>
      <Sheet.Body>{t("logoutPrompt")}{failed && <p role="alert">Could not sign out. Please try again.</p>}</Sheet.Body>
      <Sheet.Footer><Button variant="outline" onPress={()=>setOpen(false)}>{t("cancel")}</Button><Button isPending={pending} onPress={async () => {
        setPending(true);
        try {
          await disconnectNativePush().catch(() => {});
          const result = await authClient.signOut();
          if (result.error) throw new Error();
          router.replace("/auth");
          router.refresh();
        } catch { setFailed(true); } finally { setPending(false); }
      }}>{t("logoutYes")}</Button></Sheet.Footer>
    </Sheet.Dialog></Sheet.Content>
  </Sheet.Backdrop></Sheet></>;
}
