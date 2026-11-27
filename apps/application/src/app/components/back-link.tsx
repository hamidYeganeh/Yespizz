"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// Only traverse a known parent. A direct visit or an unrelated history entry
// uses replacement so that pressing Back never adds the child again.
export function previousAppPath() {
  const navigation = (window as Window & { navigation?: {
    currentEntry: { index: number } | null;
    entries(): { url: string | null }[];
  } }).navigation;
  if (!navigation?.currentEntry) return null;
  const previous = navigation.entries()[navigation.currentEntry.index - 1]?.url;
  if (!previous) return null;
  const url = new URL(previous);
  return url.origin === location.origin ? url.pathname : null;
}

export function BackLink({ href, parents = [], ...props }: Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  parents?: readonly string[];
}) {
  const router = useRouter();
  return <Link {...props} href={href} replace transitionTypes={["nav-back"]} onNavigate={event => {
    const previous = previousAppPath();
    if (previous && (previous === href || parents.includes(previous))) {
      event.preventDefault();
      router.back();
    }
  }} />;
}
