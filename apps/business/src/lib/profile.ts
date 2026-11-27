import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { store } from "./store";
import type { Profile } from "./restaurant";

export async function restaurant() {
  const {auth,db} = await store();
  const session = await auth.api.getSession({headers:await headers()});
  if (!session) redirect("/auth/sign-in");
  const owner = session.user.id;
  db.prepare("INSERT OR IGNORE INTO restaurant_profile(owner) VALUES (?)").run(owner);
  const row = db.prepare("SELECT name,city,handle,specialties FROM restaurant_profile WHERE owner=?").get(owner);
  const profile:Profile = {name:row.name, city:row.city, handle:row.handle || "", specialties:JSON.parse(row.specialties)};
  const terms = db.prepare("SELECT commission,latitude,longitude,ovens FROM restaurant_terms WHERE owner=?").get(owner) as {commission:number;latitude:number;longitude:number;ovens:number}|undefined;
  return { db, owner, profile, terms };
}
