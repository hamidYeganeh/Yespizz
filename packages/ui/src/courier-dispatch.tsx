"use client";
import { Button } from "@heroui/react";
import { useState,useEffect } from "react";
type Plan={active:string[];registered:{id:string;name:string}[];batch:{reference:string;address:string}[]};
export function CourierDispatch(){
  const [id,setId]=useState(""),[courier,select]=useState(""),[code,setCode]=useState(""),[plan,setPlan]=useState<Plan>({active:[],registered:[],batch:[]}),[error,setError]=useState("");
  const base="/api/v1/business/courier-dispatch";
  useEffect(()=>{
    let live=true;
    async function refresh(){try{const r=await fetch(base+"?courier="+encodeURIComponent(courier),{cache:"no-store"});if(r.ok && live){const data=await r.json();if(live)setPlan(data);}}catch{if(live)setError("Could not refresh dispatch.");}}
    void refresh();const t=setInterval(refresh,3000);return()=>{live=false;clearInterval(t);};
  },[courier]);
  async function submit(action:string){
    try{const r=await fetch(base+"/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courier:action==="code"?id:courier,references:plan.batch.map(o=>o.reference)})});
    const data=await r.json();if(!r.ok)throw Error(data.error);setError("");if(action==="code")setCode(data.code);else setPlan({...plan,batch:[]});}catch(e){setError(String(e));}
  }
  return <section><h2>Courier dispatch</h2><p><a href="/courier">Open courier app</a></p>
    <label>Registered courier <select value={id} onChange={e=>{setId(e.target.value);setCode("");}}><option value="">Select courier</option>{plan.registered.map(record=><option key={record.id} value={record.id}>{record.name}</option>)}</select></label> <Button variant="secondary" isDisabled={!id} onPress={()=>submit("code")}>Issue shift code</Button>
    {code && <p>One-time shift code (15 minutes): <strong>{code}</strong></p>}
    <label>Active courier <select value={courier} onChange={e=>{select(e.target.value);setPlan({...plan,batch:[]});}}><option value="">Select courier</option>{plan.active.map(id=><option key={id} value={id}>{plan.registered.find(record=>record.id===id)?.name ?? id}</option>)}</select></label>
    {courier && <><ul>{plan.batch.map(o=><li key={o.reference}>{o.reference} · {o.address}</li>)}</ul><Button isDisabled={!plan.batch.length} onPress={()=>submit("assign")}>Dispatch suggested orders</Button></>}{error && <p role="alert">{error}</p>}</section>;
}
