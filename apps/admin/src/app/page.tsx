import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

const photos = ["auth-dining.webp", "auth-pizza.webp", "auth-chef.webp"];

export default async function Home() {
  const t = await getTranslations("Admin.login");

  return (
    <main className="admin-login">
      <section className="admin-login-pane">
        <header><Image src="/studio/wordmark.png" alt="Yespiz" width={105} height={35} /></header>
        <div className="admin-login-center">
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
          <LoginForm />
        </div>
        <footer><a href="/dashboard">Order dashboard</a></footer>
      </section>
      <aside className="admin-login-art" aria-hidden="true">
        <div className="admin-login-prints">
          {photos.map(photo => (
            <Image key={photo} src={"/studio/" + photo} alt="" width={450} height={450}
              sizes="(min-width: 720px) 24vw, 0px" />
          ))}
        </div>
      </aside>
    </main>
  );
}
