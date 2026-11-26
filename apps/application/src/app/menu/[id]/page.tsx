import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@heroui/react/card";
import { menu } from "./catalog";
import { OrderControls, Recommendation } from "./controls";
import "./menu.css";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = menu.find((entry) => entry.id === id);
  if (!item) notFound();
  const t = await getTranslations("Application.menu");
  const reviewKeys = ["review1", "review2", "review3"] as const;
  const reviewers = ["Henry, Arthur", "Esther", "Sofia"];
  return (
    <main className="dish">
      <header className="dish-hero">
        <div aria-hidden="true" className="wordmark">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>Yespiz Yespiz Yespiz Yespiz</div>
          ))}
        </div>
        <Image
          priority
          className="dish-photo"
          src={item.image}
          alt={t(item.key)}
          width={228}
          height={228}
        />
        <div className="dish-score">
          <span>★</span> {item.rating} ({item.ratings})
        </div>
        <h1>{t(item.key)}</h1>
        <p>{t(`${item.key}Description`)}</p>
      </header>
      <section aria-label={t("reviews")} className="dish-reviews">
        <div className="review-summary">
          <strong>
            <i>★</i> {item.rating}
          </strong>
          <span>
            {t.rich("reviewers", {
              count: 290,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </span>
          <div className="portraits">
            {reviewers.map((name, i) => (
              <Image
                key={name}
                src={`/menu/reviewer-${i + 1}.webp`}
                width={28}
                height={28}
                alt=""
              />
            ))}
          </div>
        </div>
        <div className="review-strip" tabIndex={0} aria-label={t("reviews")}>
          {reviewers.map((name, i) => (
            <Card className="review-card" key={name}>
              <div className="review-author">
                <Image
                  src={`/menu/reviewer-${i + 1}.webp`}
                  width={32}
                  height={32}
                  alt=""
                />
                <b>{name}</b>
                <strong>
                  <i>★</i> {item.rating}
                </strong>
              </div>
              <Card.Content>{t(reviewKeys[i])}</Card.Content>
              <small>{t("days", { count: 8 - i })}</small>
            </Card>
          ))}
        </div>
      </section>
      <Recommendation item={menu.find((entry) => entry.id !== id)!} />
      <OrderControls key={item.id} item={item} />
    </main>
  );
}
