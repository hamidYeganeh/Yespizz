"use client";
import { useEffect, useState } from "react";

export const initialAccount = { name: "Andrew Ainsley", email: "yespiz@gmail.com", birth: "", gender: "male", photo: "/profile/andrew.png" };

export function useProfileValue<T>(key: string, fallback: T) {
  const storageKey = "yespiz.profile." + key;
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    function refresh(event?: StorageEvent) {
      if (event?.key && event.key !== storageKey) return;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setValue(JSON.parse(saved));
      } catch { /* Use the initial value when storage is unavailable. */ }
      setReady(true);
    }
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [storageKey]);
  function save(next: T) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setValue(next);
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
  }
  return [value, save, ready] as const;
}
