import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTickets, offerIds } from "../tickets";
import { TicketHeader, TicketIdentity, TicketFacts } from "../ticket-parts";
import { PageTransition } from "../../../components/page-transition";
import { TicketCode } from "../ticket-code";
import { Suspense } from "react";
import { LiveOffers } from "../live-offers";

export default async function OfferDetail({params}: {params:Promise<{offerId:string}>}) {
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") return <Suspense><LiveOffers offerId={(await params).offerId} /></Suspense>;
  const [{offerId}, tickets, t, profile] = await Promise.all([params,getTickets(),getTranslations("Application.offerTicket"),getTranslations("Application.profile")]);
  const ticket = tickets.find(item => item.id === offerId);
  if (!ticket) notFound();
  return <PageTransition effect="slide"><main className="offer-page offer-detail">
    <TicketHeader href="/profile/offers" back={profile("back")} title={t("title")}/>
    <div aria-hidden="true" className="ticket-watermark">Yespiz</div>
    <TicketCode ticket={ticket}>
      <TicketIdentity ticket={ticket}/><TicketFacts ticket={ticket}/>
    </TicketCode>
  </main></PageTransition>;
}

export async function generateStaticParams() { return offerIds.map(offerId => ({offerId})); }
