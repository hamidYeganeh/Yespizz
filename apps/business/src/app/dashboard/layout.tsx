import { restaurant } from "@/lib/profile";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await restaurant();
  return children;
}
