import Image from "next/image";
import { BackLink } from "../../components/back-link";
import { ChevronLeft, ShoppingBag, TicketPercent } from "lucide-react";
import type { Ticket } from "./tickets";

export function TicketHeader({href, back, title, parents}: {href:string; back:string; title:string;parents?:readonly string[]}) {
  return <header className="ticket-header"><BackLink href={href} parents={parents} aria-label={back}><ChevronLeft size={20}/></BackLink><h1>{title}</h1></header>;
}
export function TicketIdentity({ticket}: {ticket:Ticket}) {
  return <div className="ticket-identity"><Image alt="" src={ticket.image} width={44} height={44}/><div><strong>{ticket.title}</strong><small>{ticket.kind}</small></div></div>;
}
export function TicketFacts({ticket, list = false}: {ticket:Ticket; list?:boolean}) {
  return <div className="ticket-facts"><dl>{ticket.facts.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{list ? <span className="offer-open-bag" aria-hidden="true"><ShoppingBag size={22}/></span> : <TicketPercent aria-hidden="true" size={20}/>}</div>;
}
