import { Suspense } from "react";
import { OrderReviewForm } from "./review-form";
import "../../payment/checkout.css";
export const metadata = { title: "Order review", referrer: "no-referrer" } as const;
export default function Page() {
  return <Suspense><OrderReviewForm /></Suspense>;
}
