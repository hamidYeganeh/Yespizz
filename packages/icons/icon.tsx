import type { ComponentProps } from "react";
import glyphs from "./glyphs.json";

type GlyphProps = ComponentProps<"span"> & { size?: number | string };

export function Icon({ name, size, className, style, ...props }: GlyphProps & { name: keyof typeof glyphs }) {
  return <span {...props} aria-hidden="true" className={["freud-icon", className].filter(Boolean).join(" ")}
    style={{ fontSize: size, ...style }}>{String.fromCodePoint(glyphs[name])}</span>;
}

function glyph(name: keyof typeof glyphs) {
  return function Glyph(props: GlyphProps) { return <Icon name={name} {...props} />; };
}

export const Eye = glyph("eye");
export const EyeOff = glyph("eye-slash");
export const ChevronLeft = glyph("chevron-left");
export const Check = glyph("check");
export const Mail = glyph("envelope-1");
export const MessageSquareMore = glyph("chat-dot");
export const Smartphone = glyph("mobile");
export const LockKeyhole = glyph("lock-1");
export const X = glyph("close-x");
export const Bell = glyph("bell-1");
export const MapPin = glyph("map-pin-1");
export const Pizza = glyph("pizza");
export const RotateCw = glyph("arrow-rotate-clockwise-1");
export const ArrowUpRight = glyph("arrow-up-right");
export const Sparkle = glyph("star-four");
export const SmilePlus = glyph("smile-happy");
export const Star = glyph("star-full");
export const Minus = glyph("minus");
export const Plus = glyph("plus");
export const Send = glyph("paper-plane-diagonal");
export const Bike = glyph("motorcycle");
export const ArrowLeft = glyph("arrow-left");
export const QrCode = glyph("qr-code");
export const CalendarDays = glyph("calendar-1");
export const ShoppingBag = glyph("shopping-bag");
export const ShoppingBasket = glyph("shopping-cart-1");
export const PackageOpen = glyph("box-cube");
export const Pencil = glyph("pencil-1");
export const BadgePercent = glyph("percentage-circle");
export const CreditCard = glyph("credit-card");
