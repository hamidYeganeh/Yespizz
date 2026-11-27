import { getFormatter, getTranslations } from "next-intl/server";
import { menu } from "../../menu/[id]/catalog";
import { offers } from "../../menu/menu-filters";
import { offerAmount, offerCode } from "../../payment/discount";

const promotionalItems = menu.filter(item => offers[item.id]?.promo);
export const offerIds = ["basket-discount", ...promotionalItems.map(item => item.id)];
export async function getTickets() {
  const [t, dish, fmt] = await Promise.all([
    getTranslations("Application.offerTicket"), getTranslations("Application.menu"), getFormatter(),
  ]);
  const money = (value: number) => fmt.number(value, {style:"currency", currency:"EUR", minimumFractionDigits:0, maximumFractionDigits:2});
  return [
    {
      id: "basket-discount", title: t("basket"), kind: t("voucher"), image: "/profile/brand-mark.png",
      facts: [[t("save"), money(offerAmount)], [t("use"), t("checkout")]],
      code: offerCode, href: "/payment",
    },
    ...promotionalItems.map(item => ({
      id: item.id, title: dish(item.key), kind: t("special"), image: item.image,
      facts: [[t("price"), money(item.price)]],
      code: "", href: "/menu/" + item.id,
    })),
  ];
}
export type Ticket = Awaited<ReturnType<typeof getTickets>>[number];
