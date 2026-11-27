import { RatingStars } from "../../../components/rating-stars";
import { PageTransitionShared } from "../../../components/page-transition";
import { Icon } from "@repo/icons";
import Image from "next/image";
import { BackLink } from "../../../components/back-link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SpinningCounter } from "./spinning-counter";
import { EmojiReactions } from "../../../components/EmojiReactions";
import { ProgressBar } from "@heroui/react/progress-bar";
import { Card } from "@heroui/react/card";
import { menu } from "../catalog";
import { ProgressiveBlur } from "../progressive-blur";
import { LiveReviews } from "./live-reviews";
import "./reviews.css";

const authors = ["Henry, Arthur", "Esther Howard", "Sofia"];
const messages = ["review1", "review2", "review3"] as const;

export default async function Reviews({
  params,
}: PageProps<"/menu/[id]/reviews">) {
  const { id } = await params;
  if (process.env.NEXT_PUBLIC_YESPIZ_OFFLINE !== "1") return <main className="ratings-page"><LiveReviews item={id} /></main>;
  const dish = menu.find((item) => item.id === id);
  if (!dish) notFound();
  const t = await getTranslations("Application.menu");
  return (
    <main className="ratings-page">
      <header>
        <ProgressiveBlur direction="top" />
        <BackLink
          href={`/menu/${id}`}
         
          aria-label={t(dish.key)}
        >
          <Icon name="chevron-left" />
        </BackLink>
        <h1>{t("reviewTitle")}</h1>
      </header>
      <section className="rating-overview" aria-label={t("reviewTitle")}>
        <div className="rating-average">
          <strong><PageTransitionShared name={`review-score-${id}`}><SpinningCounter value={dish.rating} /></PageTransitionShared></strong>
          <RatingStars value={dish.rating} />
          <span className="review-count">
            <span>(</span><PageTransitionShared name={`review-count-${id}`}><SpinningCounter value={dish.ratings} /></PageTransitionShared>
            <span className="review-count-label">{t("reviews").toLocaleLowerCase()})</span>
          </span>
        </div>
        <ol className="rating-bars" reversed>
          {dish.starCounts.map((count, index) => (
            <li key={index}>
              <b>{5 - index}</b>
              <ProgressBar aria-label={`${5 - index} ★`} value={count} maxValue={dish.ratings} size="sm" color="accent">
                <ProgressBar.Track><ProgressBar.Fill className="rating-bar-fill" /></ProgressBar.Track>
              </ProgressBar>
            </li>
          ))}
        </ol>
      </section>
      {messages.map((key, i) => (
        <article className="review-entry" key={key}>
        <Card className="rating-card">
          <Card.Header>
            <Image
              src={`/menu/reviewer-${i + 1}.webp`}
              alt=""
              width={32}
              height={32}
            />
            <Card.Title>{authors[i]}</Card.Title>
            <RatingStars value={dish.rating} />
          </Card.Header>
          <Card.Content>{t(key)}</Card.Content>
          <Card.Footer>
            <small>{t("days", { count: 8 - i })}</small>
          </Card.Footer>
        </Card>
        <EmojiReactions reviewId={`${id}-${key}`} />
        </article>
      ))}
    </main>
  );
}

export async function generateStaticParams() { return menu.map(({id}) => ({id})); }
