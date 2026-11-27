import { Icon } from "@repo/icons";
import { BackLink } from "../components/back-link";

export function BackButton({ label }: { label: string }) {
  return <BackLink href="/" parents={["/orders"]} aria-label={label}
    className="grid size-12 place-items-center rounded-full bg-surface-secondary text-2xl text-foreground">
    <Icon name="chevron-right" />
  </BackLink>;
}
