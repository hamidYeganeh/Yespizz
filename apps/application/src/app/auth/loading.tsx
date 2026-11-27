"use client";

import { Spinner } from "@heroui/react";
import Image from "next/image";
import "./auth.css";

export default function Loading() {
  return <main className="auth-shell">
    <section className="auth-screen auth-splash" aria-label="Loading Yespiz">
      <Image className="auth-wordmark" src="/auth/wordmark.png" width={331} height={90} alt="Yespiz" priority />
      <Spinner />
    </section>
  </main>;
}
