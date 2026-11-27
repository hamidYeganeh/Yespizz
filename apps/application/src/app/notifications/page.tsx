import { PageTransition } from "../components/page-transition";
import Link from "next/link";
import { Header, Notice, notifications } from "./notifications";
import { LiveNotices } from "./live-notices";

export default function NotificationsPage() {
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") return <PageTransition effect="slide" pageKey="notifications"><main><Header href="/" /><LiveNotices /></main></PageTransition>;
  return <PageTransition effect="slide" pageKey={"notifications"}><main><Header href="/" /><ul className="divide-y divide-border">
    {notifications.map(item => <li key={item.id}><Link transitionTypes={["slide"]} className="block rounded-sm focus-visible:outline-focus" href={`/notifications/${item.id}`}><Notice item={item} /></Link></li>)}
  </ul></main></PageTransition>;
}
