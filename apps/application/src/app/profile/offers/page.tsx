import { Card } from "@heroui/react";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getTickets } from "./tickets";
import { TicketHeader, TicketIdentity, TicketFacts } from "./ticket-parts";
import { OfferMode } from "./offer-mode";
import { SelectOffer } from "./select-offer";
import { PageTransition } from "../../components/page-transition";
import { LiveOffers } from "./live-offers";

export default async function OffersPage() {
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") return <Suspense><LiveOffers /></Suspense>;
  const [tickets, t] = await Promise.all([getTickets(), getTranslations("Application.profile")]);
  function list(picking: boolean) {
    return <main className="offer-page offer-index">
      <TicketHeader href={picking ? "/payment?offerSheet=1" : "/profile"} parents={picking ? ["/payment"] : []} back={t("back")} title={t("offers")}/>
      <ul className="offer-list">{tickets.filter(ticket => !picking || ticket.code).map(ticket => {
        const card = <Card className="offer-stub"><TicketIdentity ticket={ticket}/><TicketFacts ticket={ticket} list/></Card>;
        return <li key={ticket.id}>{picking
          ? <SelectOffer code={ticket.code}>{card}</SelectOffer>
          : <Link href={"/profile/offers/"+ticket.id} transitionTypes={["slide"]}>{card}</Link>}
        </li>;
      })}</ul>
    </main>;
  }
  return <PageTransition effect="slide"><Suspense fallback={list(false)}>
    <OfferMode browse={list(false)} checkout={list(true)} />
  </Suspense></PageTransition>;
}
