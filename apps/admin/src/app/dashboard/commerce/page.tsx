import { CommerceConsole } from "../../../../../../packages/ui/src/commerce-console";
import "../../../../../../packages/ui/styles/dispatch.css";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; collection?: string }> }) {
  const { tab, collection } = await searchParams;
  return <CommerceConsole role="admin" initialTab={tab} initialCollection={collection} />;
}
