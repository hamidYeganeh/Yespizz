import { redirect } from "next/navigation";
import { restaurant } from "@/lib/profile";
import { nextStep } from "@/lib/restaurant";
export const dynamic = "force-dynamic";

export default async function Page() {redirect("/onboarding/" + nextStep((await restaurant()).profile));}
