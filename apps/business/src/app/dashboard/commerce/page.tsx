import { CommerceConsole } from "../../../../../../packages/ui/src/commerce-console";
import { restaurant } from "@/lib/profile";
import "../../../../../../packages/ui/styles/dispatch.css";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; collection?: string }> }) {
  const [{ tab, collection }, { role }] = await Promise.all([searchParams, restaurant()]);
  return <CommerceConsole role="business" staffRole={role} initialTab={tab} initialCollection={collection} />;
}
