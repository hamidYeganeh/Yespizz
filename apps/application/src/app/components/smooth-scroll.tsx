"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import "lenis/dist/lenis.css";

export function SmoothScroll() {
  useEffect(() => {
    const scroll = new Lenis({
      autoRaf: true,
      allowNestedScroll: true,
      respectReducedMotion: true,
      stopInertiaOnNavigate: true,
      prevent: element => element.matches('[role="dialog"], dialog, .leaflet-container'),
    });
    return () => scroll.destroy();
  }, []);
  return null;
}
