"use server";
import { restaurant } from "@/lib/profile";
import { groups, nextStep, steps, type Step } from "@/lib/restaurant";
import { redirect } from "next/navigation";

export async function saveStep(step:Step, value:string|string[]) {
  const {db,owner,profile} = await restaurant();
  const current = nextStep(profile);
  if (!steps.includes(step) || (current !== "complete" && steps.indexOf(step) > steps.indexOf(current))) redirect("/onboarding/" + current);
  if (step === "specialties") {
    if (!Array.isArray(value) || !value.length || value.some(v => !Object.values(groups).flat().includes(v))) return "Choose at least one specialty.";
    db.prepare("UPDATE restaurant_profile SET specialties=? WHERE owner=?").run(JSON.stringify([...new Set(value)]),owner);
  } else {
    if (typeof value !== "string" || !value.trim() || value.length > 80) return "Enter a value of up to 80 characters.";
    const text = value.trim();
    if (step === "handle" && !/^[a-z0-9][a-z0-9-]{2,29}$/.test(text)) return "Use 3–30 lowercase letters, numbers or hyphens.";
    const column = {name:"name",location:"city",handle:"handle"}[step];
    try { db.prepare("UPDATE restaurant_profile SET "+column+"=? WHERE owner=?").run(text,owner); }
    catch (error) {
      if(step==="handle" && error instanceof Error && error.message.includes("UNIQUE")) return "That handle is taken. Try another.";
      throw error;
    }
  }
  redirect("/onboarding/"+(steps[steps.indexOf(step)+1] || "complete"));
}
