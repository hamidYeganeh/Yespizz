import { PageTransition } from "../../components/page-transition";
import { notFound } from "next/navigation";
import { Header, Notice, notifications } from "../notifications";

export default async function NotificationPage({ params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const item = notifications.find(notification => notification.id === notificationId);
  if (!item) notFound();
  return <PageTransition effect="slide" pageKey={notificationId}><main><Header href="/notifications" /><Notice item={item} /></main></PageTransition>;
}

export async function generateStaticParams() { return notifications.map(({id}) => ({notificationId: id})); }
