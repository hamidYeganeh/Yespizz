"use client";
import { PhotoCrop } from "../../components/ui/photo-crop";
import { PageTransitionShared } from "../components/page-transition";
import { parseDate, today, getLocalTimeZone } from "@internationalized/date";
import { Button, Calendar, DateField, DatePicker, Input, Label, ListBox, Select } from "@heroui/react";
import { Icon } from "@repo/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { initialAccount, useProfileValue } from "./profile-data";
import { commerceApi } from "@/lib/commerce-client";

const offline = process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1";
const emptyAccount = { name: "", email: "", birth: "", gender: "unspecified", photo: "" };

function useAccount() {
  const [local, saveLocal, localReady] = useProfileValue("account", initialAccount);
  const [remote, setRemote] = useState<typeof initialAccount | null>(null);
  useEffect(() => {
    if (offline) return;
    let active = true;
    commerceApi<Partial<typeof initialAccount>>("me").then(data => {
      if (active) setRemote({ ...emptyAccount, ...data, photo: data.photo || "/profile/brand-mark.png" });
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function save(value: typeof initialAccount) {
    if (offline) { saveLocal(value); return; }
    await commerceApi("me", "PATCH", { name: value.name, birth: value.birth, gender: value.gender, photo: value.photo });
    setRemote(value);
  }
  return [offline ? local : remote ?? emptyAccount, save, offline ? localReady : Boolean(remote)] as const;
}

export function AccountSummary() {
  const [account] = useAccount();
  return <><img className="account-photo small" src={account.photo || "/profile/brand-mark.png"} alt="" />
    <div className="min-w-0 flex-1"><strong><PageTransitionShared name="profile-title-account">{account.name}</PageTransitionShared></strong><p className="break-all text-sm">{account.email}</p></div></>;
}

export function Account() {
  const t = useTranslations("Application.settings");
  const [saved, save, ready] = useAccount();
  const [draft, setDraft] = useState<typeof saved | null>(null);
  const [status, setStatus] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<File | null>(null);
  const account = draft ?? saved;
  function update(key: keyof typeof saved, value: string) {
    setDraft({ ...account, [key]: value });
    setStatus("");
  }
  return <form className="settings-form" onSubmit={async event => {
    event.preventDefault();
    try { await save(account); setDraft(null); setStatus(t("saved")); } catch { setStatus(t("saveError")); }
  }}>
    <div className="photo-editor"><img className="account-photo" src={account.photo || "/profile/brand-mark.png"} alt="" />
      <Button className="photo-button" isIconOnly size="lg" aria-label={t("photo")} onPress={() => file.current?.click()}><Icon name="camera-1" /></Button>
      <input hidden ref={file} type="file" accept="image/*" onChange={async event => {
        const selected = event.target.files?.[0];
        if (!selected) return;
        setSource(selected); event.target.value = "";
      }} />
    </div>
    {source && <PhotoCrop source={source} close={()=>setSource(null)} apply={photo=>update("photo",photo)}/>}
    <label>{t("name")}<Input required maxLength={100} value={account.name} onChange={e => update("name", e.target.value)} /></label>
    <DatePicker value={account.birth ? parseDate(account.birth) : null} maxValue={today(getLocalTimeZone())}
      validationBehavior="native" onChange={date => update("birth", date?.toString() ?? "")}>
      <Label>{t("birth")}</Label>
      <DateField.Group fullWidth className="min-h-12 rounded-2xl bg-surface-secondary">
        <DateField.Input>{segment => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix><DatePicker.Trigger><DatePicker.TriggerIndicator /></DatePicker.Trigger></DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label={t("birth")}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger><Calendar.YearPickerTriggerHeading /><Calendar.YearPickerTriggerIndicator /></Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" /><Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{date => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid><Calendar.YearPickerGridBody>{({year}) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody></Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
    <Select value={account.gender} onChange={key => { if (key !== null) update("gender", String(key)); }}>
      <Label>{t("gender")}</Label>
      <Select.Trigger className="min-h-12 rounded-2xl bg-surface-secondary"><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover className="gender-options"><ListBox>
        {(["male", "female", "unspecified"] as const).map(key =>
          <ListBox.Item key={key} id={key} textValue={t(key)}>{t(key)}<ListBox.ItemIndicator /></ListBox.Item>)}
      </ListBox></Select.Popover>
    </Select>
    <label>{t("email")}<Input type="email" readOnly={!offline} required={offline} value={account.email} onChange={e => update("email", e.target.value)} /></label>
    <p role="status">{status}</p>
    <footer className="settings-action"><Button type="submit" isDisabled={!ready || !account.name.trim() || JSON.stringify(saved) === JSON.stringify(account)}>{t("update")}</Button></footer>
  </form>;
}
