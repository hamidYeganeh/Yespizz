"use client";
import { Accordion, Card, Tabs } from "@heroui/react";
import { Icon } from "@repo/icons";
import { useTranslations } from "next-intl";
import Link from "next/link";


const channels = [
  ["customer","headphone-1","/profile/help/chat"], ["WhatsApp","chat",process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP],
  ["Website","globe","/"], ["Facebook","globe",process.env.NEXT_PUBLIC_SUPPORT_FACEBOOK],
  ["Twitter","globe",process.env.NEXT_PUBLIC_SUPPORT_TWITTER], ["Instagram","camera-1",process.env.NEXT_PUBLIC_SUPPORT_INSTAGRAM],
] as const;
const topics = ["about","pay","cancelOrder","deleteAccount","exit"] as const;
export function Help() {
  const t = useTranslations("Application.settings");

  return <Tabs defaultSelectedKey="faq" className="help-center">
    <Tabs.ListContainer><Tabs.List aria-label={t("contact")} className="help-tab-list">{(["faq","contact"] as const).map(k =>
      <Tabs.Tab id={k} key={k}>{t(k)}<Tabs.Indicator /></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
    <Tabs.Panel id="faq">
      <Accordion defaultExpandedKeys={["about"]} className="settings-list" hideSeparator>
        {topics.map(k => <Accordion.Item key={k} id={k} className="help-topic">
          <Accordion.Heading><Accordion.Trigger>{t(k)}<Accordion.Indicator /></Accordion.Trigger></Accordion.Heading>
          <Accordion.Panel><Accordion.Body>{t(`${k}Answer`)}</Accordion.Body></Accordion.Panel>
        </Accordion.Item>)}
      </Accordion>
    </Tabs.Panel>
    <Tabs.Panel id="contact" className="settings-list">{channels.map(([k,icon,url]) => {
      const label = k==="customer" ? t(k) : k;
      const content = <><span className="contact-icon"><Icon name={icon} /></span><span className="grow">{label}</span></>;
      return <Card key={k} className="contact-card">{url
        ? <Link className="settings-card" href={url}>{content}<Icon name="chevron-right" /></Link>
        : <div className="settings-card">{content}<small>{t("unavailable")}</small></div>}</Card>;
    })}
    </Tabs.Panel>
  </Tabs>;
}
