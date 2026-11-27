"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { previousAppPath } from "../../components/back-link";
import { checkoutOfferDraft } from "../../payment/discount";

export function SelectOffer({code, children}: {code:string; children:ReactNode}) {
  const router = useRouter();
  return <Link href="/payment?offerSheet=1" replace transitionTypes={["nav-back", "slide"]} onNavigate={event => {
    sessionStorage.setItem(checkoutOfferDraft, code);
    if (previousAppPath() === "/payment") {
      event.preventDefault();
      router.back();
    }
  }}>{children}</Link>;
}
