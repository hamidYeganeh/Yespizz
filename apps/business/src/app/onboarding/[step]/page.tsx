import { notFound,redirect } from "next/navigation";
import { restaurant } from "@/lib/profile";
import { nextStep, steps, type Step } from "@/lib/restaurant";
import { Studio } from "../../studio";
import { ProfileStep } from "../profile-step";

export const dynamic = "force-dynamic";

export default async function Page({params}:{params:Promise<{step:string}>}) {
  const {step} = await params;
  if (!steps.includes(step as Step)) notFound();
  const {profile} = await restaurant();
  const next = nextStep(profile);
  if (next !== "complete" && steps.indexOf(step as Step) > steps.indexOf(next)) redirect("/onboarding/"+next);
  const index = steps.indexOf(step as Step);
  return <Studio scene={step} back={index>0 ? "/onboarding/"+steps[index-1] : undefined}><ProfileStep key={step} step={step as Step} profile={profile}/></Studio>;
}
