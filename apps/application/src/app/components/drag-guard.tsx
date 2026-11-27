"use client";
import { useEffect } from "react";

export function DragGuard() {
  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault();
    document.addEventListener("dragstart", prevent, true);
    return () => document.removeEventListener("dragstart", prevent, true);
  }, []);
  return null;
}
