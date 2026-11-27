import { getTranslations } from "next-intl/server";
import { PaymentFlow } from "./payment-flow";

export async function generateMetadata() {
  const t = await getTranslations("Application.checkout");
  return { title: `Yespiz · ${t("title")}` };
}

export default function PaymentPage() {
  return <PaymentFlow />;
}
