import { redirect } from "next/navigation";

export default async function LegacyBasket({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment } = await searchParams;
  redirect(payment === "declined" ? "/payment?payment=declined" : "/payment");
}
