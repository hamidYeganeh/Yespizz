import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { restaurant } from "@/lib/profile";
import { nextStep } from "@/lib/restaurant";
import { SignOut } from "./sign-out";

export const dynamic = "force-dynamic";

export default async function Complete() {
  const {profile,terms} = await restaurant();
  const next = nextStep(profile);
  if(next !== "complete") redirect("/onboarding/"+next);
  return <main className="restaurant-board">
    <header><Image src="/studio/mark.png" width={36} height={36} alt="Yespiz"/><SignOut/></header>
    <h1>{profile.name}</h1><p>@{profile.handle} · {profile.city}</p>
    <Link className="button button--secondary" href="/dashboard">Order dashboard</Link>
    <div className="board-grid">
      <section><h2>Restaurant profile</h2>{terms && <dl><dt>Commission</dt><dd>{terms.commission}%</dd><dt>Ovens</dt><dd>{terms.ovens}</dd><dt>Location</dt><dd>{terms.latitude}, {terms.longitude}</dd></dl>}<Link className="button button--secondary" href="/onboarding/name">Edit profile</Link></section>
      <Image src="/studio/dining-room.webp" alt="" width={250} height={226}/>
      <section><h2>Specialties & services</h2><ul>{profile.specialties.map(item=><li key={item}>{item}</li>)}</ul></section>
      <Image src="/studio/margherita.jpg" alt="" width={640} height={427}/>
    </div>
  </main>;
}
