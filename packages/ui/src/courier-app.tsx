"use client";
import { useEffect, useRef, useState } from "react";
import { Navigation, Phone, Package, Route } from "lucide-react";
import { ProgressRing } from "./courier-ring";
type Job = ReturnType<typeof import("./couriers").jobs>[number];

export default function CourierApp(){
  const [jobs,setJobs]=useState<Job[]|null>(null),[loading,setLoading]=useState(true);
  const [code,setCode]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [route,setRoute]=useState(false),[selected,select]=useState("");
  const sequence=useRef(0);
  async function refresh(){
    const version=++sequence.current;
    try {
      const response=await fetch("/api/courier",{cache:"no-store"});
      if(response.status!==401 && !response.ok)throw Error("Cannot load deliveries.");
      const data=response.ok?await response.json():null;
      if(sequence.current===version)setJobs(data);
    } catch {if(version===sequence.current)setError("Connection unavailable.");}
    finally {if(version===sequence.current)setLoading(false);}
  }
  useEffect(()=>{void refresh();const timer=setInterval(refresh,4000);return()=>{clearInterval(timer);sequence.current++;};},[]);
  async function act(action:string,reference?:string){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/courier",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,reference,code:code.trim()})});
      if(!response.ok)throw Error((await response.json()).error);
      setCode("");await refresh();
    } catch(e){setError(e instanceof Error?e.message:"Connection unavailable.");} finally{setBusy(false);}
  }
  const job=jobs?.find(o=>o.reference===selected)??jobs?.[0];
  const point=job?.address.point;
  const address=job && [job.address.line,job.address.unit,job.address.postalCode,job.address.city].filter(Boolean).join(", ");
  const destination=point?[point.lat,point.lng].join(","):address??"";
  return <main className="courier-shell"><header><strong>Yespizz <small>Courier</small></strong>{jobs&&<button disabled={busy} onClick={()=>act("logout")}>End shift</button>}</header>
    {error&&<p role="alert">{error}</p>}
    {loading?<p>Loading shift…</p>:!jobs?<form onSubmit={e=>{e.preventDefault();void act("login");}}><span className="courier-icon"><Package/></span><h1>Start your shift</h1><label>Restaurant shift code<input required autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)}/></label><button className="primary" disabled={busy}>Activate shift</button></form>:<>
    <section className="courier-summary"><ProgressRing value={jobs.length} total={3}/><div><small>Active shift</small><h1>{route?"Current route":"Active delivery"}</h1></div></section>
    {!job?<article className="courier-empty"><span className="courier-icon"><Package/></span><h2>No assigned deliveries</h2><p>New orders will appear here when your restaurant dispatches them.</p></article>:route?<section>{jobs.map((o,i)=><button className="courier-stop" key={o.reference} onClick={()=>{select(o.reference);setRoute(false);}}><b>{i+1}</b><span>{o.address.line}<small>{o.stage==="ready"?"Awaiting pickup":"Out for delivery"}</small></span></button>)}</section>:<>
    {point && job.stage==="out_for_delivery" && <iframe title="Delivery destination" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${point.lng-.009},${point.lat-.006},${point.lng+.009},${point.lat+.006}&layer=mapnik&marker=${point.lat},${point.lng}`}/>}
    <article><small>{job.stage==="ready"?"Awaiting pickup · Delivery address":"Delivery destination"}</small><h2>{address}</h2><small>{job.reference}</small>{job.address.deliveryNotes && <aside className="courier-notes"><strong>Delivery notes</strong><p>{job.address.deliveryNotes}</p></aside>}{job.stage==="out_for_delivery" && <nav><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`} target="_blank" rel="noreferrer"><Navigation/>Navigate</a>{job.phone&&<a href={"tel:"+job.phone}><Phone/>Call</a>}</nav>}<button disabled={busy} className="primary" onClick={()=>act(job.stage==="ready"?"pickup":"deliver",job.reference)}>{job.stage==="ready"?"Confirm pickup":"Confirm delivery"}</button></article></>}
    <footer className="courier-tabs"><button aria-pressed={!route} onClick={()=>setRoute(false)}><Package/>Delivery</button><button aria-label="Current route" aria-pressed={route} onClick={()=>setRoute(true)}><Route/>Route</button></footer></>}
  </main>;
}
