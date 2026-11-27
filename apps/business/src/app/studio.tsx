import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const scenes = {
  signIn: ["auth-dining.webp", "auth-pizza.webp", "auth-chef.webp"],
  signUp: ["auth-chef.webp", "auth-oven.webp", "auth-dining.webp"],
  dining:["dining-room.webp","margherita.jpg","portrait.webp"],
  kitchen:["portrait.webp","pizza.webp","dining-room.webp"],
  menu:["margherita.jpg","dining-room.webp","pizza.webp"],
};
export function Studio({scene,back,children}:{scene:string;back?:string;children:React.ReactNode}) {
  const images = scene === "sign-in" ? scenes.signIn
    : scene === "sign-up" ? scenes.signUp
    : scene === "handle" || scene === "specialties" ? scenes.menu
    : scene === "location" ? scenes.kitchen : scenes.dining;
  return <main className="studio">
    <section className="studio-pane"><header>{back && <Link replace href={back} aria-label="Previous step"><ChevronLeft size={22}/></Link>}
      <Image className="studio-wordmark" alt="Yespiz" src="/studio/wordmark.png" width={105} height={35}/></header>
      <div className="studio-center">{children}</div><footer><span>Business</span></footer>
    </section>
    <aside className={"studio-art scene-"+scene} aria-hidden="true"><div className="studio-prints">{images.map(src=><Image key={src} alt="" src={"/studio/"+src} width={450} height={520} sizes="(min-width: 720px) 25vw, 0px" />)}</div></aside>
  </main>;
}
