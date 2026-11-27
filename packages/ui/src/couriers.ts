import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { withCommerce, findOrder, saveOrder, transition, CommerceError, type Order } from "./commerce-store";
import { settleDelivery } from "./commerce-payment";
import { sendOrderPush } from "./commerce-push";

const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function shiftCode(owner:string,id:string) {
  const code=randomBytes(8).toString("hex");
  withCommerce(db=>{
    if(!db.prepare("SELECT 1 FROM commerce_records WHERE scope=? AND collection='couriers' AND id=?").get(owner,id)) throw new CommerceError(404,"Register the courier first.");
    db.prepare("INSERT INTO courier_sessions(owner,courier,code,expires) VALUES(?,?,?,?) ON CONFLICT(owner,courier) DO UPDATE SET code=excluded.code,expires=excluded.expires").run(owner,id,hash(code),Date.now()+900000);
  },true);
  return code;
}
export function activateShift(code:string) {
  const token=randomBytes(32).toString("hex");
  withCommerce(db=>{
    if(!db.prepare("UPDATE courier_sessions SET code=NULL,token=?,until=? WHERE code=? AND expires>?").run(hash(token),Date.now()+43200000,hash(code.trim().toLowerCase()),Date.now()).changes) throw new CommerceError(401,"Invalid or expired code.");
  },true);
  return token;
}
export function session(token:string) {
  const row=withCommerce(db=>db.prepare("SELECT owner,courier FROM courier_sessions WHERE token=? AND until>?").get(hash(token),Date.now()));
  if(!row) throw new CommerceError(401,"Enter a shift code.");
  return {owner:String(row.owner),courier:String(row.courier)};
}
export function endShift(token:string) {
  withCommerce(db=>db.prepare("UPDATE courier_sessions SET token=NULL,until=0 WHERE token=?").run(hash(token)),true);
}
function distance(a:Order,b:Order) {
  const p=a.address.point,q=b.address.point,r=Math.PI/180;
  if(!p || !q) return Infinity;
  return Math.sin((p.lat-q.lat)*r/2)**2+Math.cos(p.lat*r)*Math.cos(q.lat*r)*Math.sin((p.lng-q.lng)*r/2)**2;
}
export function plan(owner:string,courier:string,confirm?:string[]) {
  return withCommerce(db=>{
    const active=db.prepare("SELECT courier FROM courier_sessions WHERE owner=? AND until>? ORDER BY courier").all(owner,Date.now()).map(r=>String(r.courier));
    const registered = db.prepare("SELECT id, json_extract(data,'$.name') AS name FROM commerce_records WHERE scope=? AND collection='couriers' ORDER BY id").all(owner)
      .map(row => ({ id: String(row.id), name: typeof row.name === "string" && row.name.trim() ? row.name : String(row.id) }));
    const assigned=db.prepare("SELECT reference FROM commerce_orders WHERE owner=? AND courierId=? AND stage IN ('ready','out_for_delivery')").all(owner,courier).map(r=>findOrder(db,String(r.reference))!);
    const candidates=db.prepare("SELECT reference FROM commerce_orders WHERE owner=? AND courierId IS NULL AND stage='ready' ORDER BY date,reference").all(owner).map(r=>findOrder(db,String(r.reference))!);
    const batch:Order[]=[];
    while(active.includes(courier) && candidates.length && assigned.length+batch.length<3) {
      const group=[...assigned,...batch];
      if(group.length) {
        const separation=(o:Order)=>Math.max(...group.map(b=>distance(o,b)));
        candidates.sort((a,b)=>separation(a)-separation(b));
        // Haversine's squared half-chord for a three-kilometre maximum separation.
        if(separation(candidates[0]) > Math.sin(3/(2*6371))**2) break;
      }
      batch.push(candidates.shift()!);
    }
    if(confirm) {
      if(!batch.length || JSON.stringify(confirm)!==JSON.stringify(batch.map(o=>o.reference))) throw new CommerceError(409,"The suggestion changed. Refresh and try again.");
      for(const order of batch){order.courierId=courier;saveOrder(db,order);}
    }
    return {active,registered,batch:batch.map(o=>({reference:o.reference,address:o.address.line}))};
  },!!confirm);
}
export function jobs(owner:string,courier:string) {
  return withCommerce(db=>db.prepare("SELECT reference FROM commerce_orders WHERE owner=? AND courierId=? AND stage IN ('ready','out_for_delivery') ORDER BY date").all(owner,courier).map(row=>{
    const o=findOrder(db,String(row.reference))!;
    return {reference:o.reference,address:o.address,stage:o.stage,phone:o.phone};
  }));
}
export async function handoff(owner:string,courier:string,id:string,deliver:boolean) {
  const order=withCommerce(db=>findOrder(db,id));
  if(!order || order.owner!==owner || order.courierId!==courier || order.stage!==(deliver?"out_for_delivery":"ready")) throw new CommerceError(409,"Order unavailable.");
  if(deliver) await settleDelivery(order);
  const updated=withCommerce(db=>{
    const o=findOrder(db,id)!;
    if(o.courierId!==courier || o.owner!==owner || o.stage!==order.stage) throw new CommerceError(409,"Refresh the order.");
    transition(o,deliver?"delivered":"out_for_delivery"); saveOrder(db,o); return o;
  },true);
  await sendOrderPush(updated,updated.stage);
}
