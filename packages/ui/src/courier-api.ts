import { cookies } from "next/headers";
import { respond,jsonBody,inputText } from "./commerce-http";
import { activateShift,endShift,handoff,jobs,session } from "./couriers";
export function GET(){return respond(async()=>{
  const {owner,courier}=session((await cookies()).get("courier-shift")?.value || "");
  return jobs(owner,courier);
});}
export function POST(request:Request){return respond(async()=>{
  const body=await jsonBody(request), jar=await cookies();
  if(body.action==="login"){
    jar.set("courier-shift",activateShift(inputText(body.code,32,true)),{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/api/courier",maxAge:43200});
  }else{
    const token=jar.get("courier-shift")?.value || "";
    const {owner,courier}=session(token);
    if(body.action==="logout"){endShift(token);jar.delete("courier-shift");}
    else if(body.action==="pickup" || body.action==="deliver") await handoff(owner,courier,inputText(body.reference,100,true),body.action==="deliver");
    else throw Error("Unknown action");
  }
  return {ok:true};
});}
