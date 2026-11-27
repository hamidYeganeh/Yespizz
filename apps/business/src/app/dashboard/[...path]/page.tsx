import { notFound, redirect } from "next/navigation";
import { commerceDestination } from "../../../../../../packages/ui/src/commerce-navigation";

export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const destination = path.length === 1 && commerceDestination(path[0], true);
  if (!destination) notFound();
  redirect(destination);
}
