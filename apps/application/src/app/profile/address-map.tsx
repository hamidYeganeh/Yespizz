"use client";
import {addStreetTiles} from "@repo/ui/street-tiles";
import { Minus, Plus } from "@repo/icons";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { Map, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type Point = { lat:number; lng:number };

export function AddressMap({ point, onSelect }: {point?:Point; onSelect:(p:Point)=>void}) {
  const t = useTranslations("Application.settings");
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const initial = useRef(point);
  const select = useRef(onSelect);
  useEffect(()=>{select.current=onSelect;},[onSelect]);
  useEffect(()=>{
    let disposed=false;
    const node=host.current!;
    const resize = new ResizeObserver(() => map.current?.invalidateSize({pan:false}));
    resize.observe(node);
    void import("leaflet").then(L=>{
      if(disposed) return;
      const value=initial.current;
      const view=L.map(node,{scrollWheelZoom:false,zoomControl:false}).setView(value ?? [52.37,4.89],value ? 16 : 12);
      map.current=view;
      view.attributionControl.setPrefix(false);
      addStreetTiles(L,view);
      marker.current=L.circleMarker(value ?? view.getCenter(),{radius:9,color:"var(--accent-foreground)",fillColor:"var(--accent)",fillOpacity:1});
      if(value) marker.current.addTo(view);
      view.on("click",event=>select.current({lat:event.latlng.lat,lng:event.latlng.wrap().lng}));
    });
    return ()=>{disposed=true;resize.disconnect();map.current?.remove();map.current=null;marker.current=null;};
  },[]);
  useEffect(()=>{if(point && map.current) marker.current?.setLatLng(point).addTo(map.current);},[point]);
  return <section className="address-picker"><h2>{t("pinLocation")}</h2>
    <div className="address-map-frame" data-lenis-prevent onPointerDown={event => event.stopPropagation()}>
      <div ref={host} className="address-map tracking-tiles" aria-label={t("pinLocation")} onKeyDown={e=>{
        if(e.key==="Enter"){e.preventDefault();const center=map.current?.getCenter().wrap();if(center) onSelect({lat:center.lat,lng:center.lng});}
      }}/>
      <div className="address-zoom">
        <Button type="button" isIconOnly size="lg" variant="secondary" aria-label={t("zoomIn")} onPress={()=>map.current?.zoomIn()}><Plus /></Button>
        <Button type="button" isIconOnly size="lg" variant="secondary" aria-label={t("zoomOut")} onPress={()=>map.current?.zoomOut()}><Minus /></Button>
      </div>
    </div>
  </section>;
}
