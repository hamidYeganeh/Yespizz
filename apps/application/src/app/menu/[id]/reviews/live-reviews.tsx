"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, ProgressBar } from "@heroui/react";
import { ChevronLeft, MessageSquareMore } from "@repo/icons";
import { useLocale, useTranslations } from "next-intl";
import { commerceApi } from "@/lib/commerce-client";
import { RatingStars } from "../../../components/rating-stars";
import { BackLink } from "../../../components/back-link";
import { ProgressiveBlur } from "../progressive-blur";
import { menu } from "../catalog";

type Review = { id: string; rating: number; text: string; at: string; reply?: string; demo?: boolean };

export function LiveReviews({ item, compact = false }: { item: string; compact?: boolean }) {
  const t = useTranslations("Application.menu");
  const locale = useLocale();
  const de = locale.startsWith("de");
  const [state, setState] = useState<"loading"|"ready"|"error">("loading");
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => {
    let active = true;
    setState("loading");
    commerceApi<Review[]>(`reviews?item=${encodeURIComponent(item)}`).then(value => {
      if (active) { setReviews(value.sort((a,b) => b.at.localeCompare(a.at))); setState("ready"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [item]);
  const path = "/menu/" + encodeURIComponent(item);
  const dish = menu.find(dish => dish.id === item);
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  if (compact) return <section className="dish-reviews"><Link className="review-summary" href={path+"/reviews"}>{t("reviewTitle")}{state === "ready" && <> · {reviews.length}</>}</Link></section>;
  return <>
    <header><ProgressiveBlur direction="top"/><BackLink href={path} aria-label={dish ? t(dish.key) : de ? "Zur Speisekarte" : "Back to menu"}><ChevronLeft/></BackLink><h1>{t("reviewTitle")}</h1></header>
    {state === "ready" && reviews.length > 0 && <section className="rating-overview" aria-label={t("reviewTitle")}>
      <div className="rating-average"><strong>{average.toLocaleString(locale,{minimumFractionDigits:1,maximumFractionDigits:1})}</strong><RatingStars value={average}/><span className="review-count">{reviews.length} {t("reviews")}</span></div>
      <ol className="rating-bars">{[5,4,3,2,1].map(star => <li key={star}><b>{star}</b><ProgressBar aria-label={star+" ★"} value={reviews.filter(review=>review.rating===star).length} maxValue={reviews.length} size="sm" color="accent"><ProgressBar.Track><ProgressBar.Fill className="rating-bar-fill"/></ProgressBar.Track></ProgressBar></li>)}</ol>
    </section>}
    {state === "ready" && reviews.map(review => <article className="review-entry" key={review.id}><Card className="rating-card live-rating-card">
      <Card.Header><span className="review-avatar"><MessageSquareMore/></span><Card.Title>{review.demo ? (de ? "Demo-Bewertung" : "Demo review") : (de ? "Kundenbewertung" : "Customer review")}</Card.Title><RatingStars value={review.rating}/></Card.Header>
      <Card.Content>{review.text}{review.reply && <blockquote>{review.reply}</blockquote>}</Card.Content>
      <Card.Footer><small><time dateTime={review.at}>{new Date(review.at).toLocaleDateString(locale,{day:"numeric",month:"short",year:"numeric",timeZone:"Europe/Vienna"})}</time></small></Card.Footer>
    </Card></article>)}
    {(state !== "ready" || !reviews.length) && <p className="review-placeholder" role="status">{state === "loading" ? (de ? "Wird geladen …" : "Loading reviews…") : state === "error" ? (de ? "Bewertungen konnten nicht geladen werden." : "Could not load reviews.") : (de ? "Noch keine Bewertungen." : "No reviews yet.")}</p>}
  </>;
}
