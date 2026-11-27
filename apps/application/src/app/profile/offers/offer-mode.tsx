"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function OfferMode({ browse, checkout }: { browse: ReactNode; checkout: ReactNode }) {
  return useSearchParams().get("from") === "checkout" ? checkout : browse;
}
