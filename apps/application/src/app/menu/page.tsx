import { Suspense } from "react";
import { MenuRoute } from "./menu-route";
import "./menu-browser.css";

export default function MenuPage() {
  return <Suspense><MenuRoute /></Suspense>;
}
