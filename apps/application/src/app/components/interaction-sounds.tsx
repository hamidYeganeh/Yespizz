"use client";

import { useEffect } from "react";
import { playUiSound } from "../ui-sounds";

const pressable = [
  "button", "a[href]", "summary", "input[type=button]", "input[type=submit]",
  "[role=button]", "[role=link]", "[role=tab]", "[role=option]", "[role=menuitem]",
  "[role=checkbox]", "[role=switch]", "[role=radio]", "[aria-pressed]",
].join(", ");

export function InteractionSounds() {
  useEffect(() => {
    function activate(event: Event) {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest(pressable);
      if (!control || control.closest(':disabled,[aria-disabled=true],[inert],[data-own-sound]')) return;
      // Associated labels dispatch another activation to their native input.
      if (control.matches("input[type=checkbox],input[type=radio]") || control.closest("label")?.control) return;
      if (control.matches("a[href],[role=link]")) playUiSound("navigate");
      else if (control.matches("[aria-pressed],[role=tab],[role=option],[role=switch],[role=radio]")) playUiSound("select");
      else playUiSound("press");
    }

    function change(event: Event) {
      const field = event.target;
      if (!(field instanceof Element) || field.closest("[data-own-sound],:disabled,[inert]")) return;
      if (field.matches("select,input[type=checkbox],input[type=radio],input[type=range],input[type=file]")) playUiSound("select");
    }

    document.addEventListener("click", activate, true);
    document.addEventListener("change", change, true);
    return () => {
      document.removeEventListener("click", activate, true);
      document.removeEventListener("change", change, true);
    };
  }, []);
  return null;
}
