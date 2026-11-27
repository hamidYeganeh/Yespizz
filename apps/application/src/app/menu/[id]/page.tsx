import { ScrollFade } from "@animate-ui/react/primitives/effects/scroll-fade";
import { RatingStar } from "../../components/rating-star";
import { PageTransitionShared } from "../../components/page-transition";
import { SlidingNumber } from "@animate-ui/react/primitives/texts/sliding-number";
import { Icon } from "@repo/icons";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@heroui/react/card";
import { PizzaPreview } from "./pizza-preview";
import { offers } from "../menu-filters";
import { menu } from "./catalog";
import { DishCarousel, OrderControls, Recommendation } from "./controls";
import "../../category-tiles.css";
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
    <OrderControls key={item.id} item={item}>
      <PizzaPreview item={item} promo={offers[id]?.promo ?? false}>
        <div className="dish-score">
          <span className="dish-score-star"><RatingStar /></span>{" "}
          <SlidingNumber number={item.rating} decimalPlaces={1} padStart />{" "}
          (<SlidingNumber number={item.ratings} padStart />)
        </div>
        <h1><PageTransitionShared name={`dish-${id}-name`}>{t(item.key)}</PageTransitionShared></h1>
        <p className="t-stagger-line t-stagger-line--2">{t(`${item.key}Description`)}</p>
        <dl className="pizza-facts">
          <div><dt>{t("crust")}</dt><dd>{t("crisp")}</dd></div>
          <div><dt>{t("flavor")}</dt><dd>{t(item.ingredients[0] === "freshBasil" ? "herbal" : "spiced")}</dd></div>
        </dl>
      </PizzaPreview>
      <section className="dish-ingredients">
        <h2>{t("ingredients")}</h2>
        <ScrollFade asChild orientation="horizontal" size={18}><ul className="category-tiles" tabIndex={0} aria-label={t("ingredients")}>
          {item.ingredients.map(key => <li key={key}><Image src={`/menu/ingredients/${key}.webp`} width={48} height={48} alt="" />{t(key)}</li>)}
        </ul></ScrollFade>
      </section>
      <section aria-label={t("reviews")} className="dish-reviews">
        <Link className="review-summary" href={`/menu/${item.id}/reviews`} aria-label={t("reviewTitle")}>
          <strong>
            <i><RatingStar /></i>{" "}
            <PageTransitionShared name={`review-score-${id}`}>
              <SlidingNumber number={item.rating} decimalPlaces={1} padStart inView />
            </PageTransitionShared>
          </strong>
          <span>
            {t.rich("reviewers", {
              count: item.ratings,
              b: () => <b><PageTransitionShared name={`review-count-${id}`}>
                <SlidingNumber number={item.ratings} padStart inView />
              </PageTransitionShared></b>,
            })}
          </span>
          <div className="portraits">
            {reviewers.map((name, i) => (
              <Image key={name} className="review-portrait"
                src={`/menu/reviewer-${i + 1}.webp`}
                width={28}
                height={28}
                alt=""
              />
            ))}
          </div>
          <span aria-hidden="true"><Icon name="chevron-right" /></span>
        </Link>
        <DishCarousel label={t("reviews")}>
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
                  <i><RatingStar /></i>{" "}
                  <SlidingNumber number={item.rating} decimalPlaces={1} padStart inView />
                </strong>
              </div>
              <Card.Content>{t(reviewKeys[i])}</Card.Content>
              <small>{t("days", { count: 8 - i })}</small>
            </Card>
          ))}
        </DishCarousel>
      </section>
      <Recommendation currentId={id} />
    </OrderControls>
  );
}

export async function generateStaticParams() { return menu.map(({id}) => ({id})); }
