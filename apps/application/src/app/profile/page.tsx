import { getTranslations } from "next-intl/server";
import { ProfileMenu } from "./profile-menu";

export async function generateMetadata() {
  const t = await getTranslations("Application.profile");
  return { title: `Yespiz · ${t("title")}` };
}

export default function ProfilePage() { return <ProfileMenu />; }

