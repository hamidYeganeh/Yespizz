import { PageTransition } from "../components/page-transition";
import Link from "next/link";
import { Header, Notice, notifications } from "./notifications";

export default function NotificationsPage() {
  return <PageTransition effect="slide" pageKey={"notifications"}><main><Header href="/" /><ul className="divide-y divide-border">
    {notifications.map(item => <li key={item.id}><Link transitionTypes={["slide"]} className="block rounded-sm focus-visible:outline-focus" href={`/notifications/${item.id}`}><Notice item={item} /></Link></li>)}
  </ul></main></PageTransition>;
}
