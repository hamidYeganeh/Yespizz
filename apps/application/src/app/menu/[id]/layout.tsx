import { PageTransition } from "../../components/page-transition";

export default function DishLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition effect="slide">{children}</PageTransition>;
}
