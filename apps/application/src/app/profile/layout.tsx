import type { ReactNode } from "react";
import { PageTransition } from "../components/page-transition";
import "./profile.css";
import "./settings.css";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <PageTransition effect="slide">{children}</PageTransition>;
}
