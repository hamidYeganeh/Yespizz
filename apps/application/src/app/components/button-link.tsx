import Link from "next/link";
import { buttonVariants } from "@heroui/styles";
import type { ComponentProps } from "react";

export function ButtonLink({ className, size = "sm", ...props }: ComponentProps<typeof Link> & { size?: "sm" | "lg" }) {
  return <Link {...props} className={buttonVariants({ variant: "secondary", size, className })} />;
}
