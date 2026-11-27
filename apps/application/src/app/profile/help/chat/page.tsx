"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { VoiceNote } from "../../../components/voice-note";
import { Button, Card, Input } from "@heroui/react";
import { Icon } from "@repo/icons";
import { useTranslations } from "next-intl";
import { ButtonLink } from "../../../components/button-link";
import { BackLink } from "../../../components/back-link";
import { useEffect, useRef, useState } from "react";

type Message = { text: string; url?: string; kind: "text"|"audio"|"image"|"video"|"file"; time: string };
export default function Chat() {
  const t = useTranslations("Application.settings");
  const p = useTranslations("Application.profile");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [micError, setMicError] = useState(false);

  async function openVoiceComposer() {
    setRequestingMic(true);
    setMicError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setVoiceMode(true);
    } catch {
      setMicError(true);
    } finally {
      setRequestingMic(false);
    }
  }
  const reduced = useReducedMotion();
  const travel = reduced ? 0 : 18;
  const urls = useRef<string[]>([]);
  const attachment = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return () => {
      urls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => { if(messages.length) end.current?.scrollIntoView({block:"end"}); }, [messages]);
  function add(text:string, kind:Message["kind"], blob?:Blob) {
    const url = blob && URL.createObjectURL(blob);
    if(url) urls.current.push(url);
    setMessages(current => [...current,{ text,kind,url,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
  }
  return <main className="profile chat-page">
    <header className="chat-header"><BackLink className="settings-back" href="/profile/help" aria-label={p("back")}><Icon name="chevron-left" /></BackLink><h1>{p("help")}</h1></header>
    <div className="chat-log" role="log" aria-label={t("customer")}>
      <Card className="chat-bubble incoming"><Card.Content>{t("chatIntro")}</Card.Content></Card>
      <div className="chat-media"><img src="/menu/american.webp" alt={t("pizzaPhoto")} /></div>
      {messages.map((m,i)=><Card key={i} className="chat-bubble"><Card.Content>{m.kind==="audio" ? <audio controls src={m.url}/> : m.kind==="image" ? <img src={m.url} alt={m.text}/> : m.kind==="video" ? <video controls src={m.url}/> : m.kind==="file" && m.url ? <ButtonLink download={m.text} href={m.url}>{m.text}</ButtonLink> : m.text}<small>{m.time}</small></Card.Content></Card>)}
      <div ref={end} />
    </div>
    <footer>{micError && <p role="alert" className="px-3 pb-2 text-sm text-danger">{t("micAccess")}</p>}<AnimatePresence initial={false} mode="wait">{voiceMode ? <motion.div key="voice" initial={{opacity:0,x:travel}} animate={{opacity:1,x:0}} exit={{opacity:0,x:travel}} transition={{duration:.16}} className="chat-compose">
      <Button isIconOnly size="lg" variant="secondary" aria-label={t("cancel")} onPress={() => setVoiceMode(false)}><Icon name="close-x" /></Button>
      <VoiceNote onSend={blob => {add(t("voice"), "audio", blob);setVoiceMode(false);}} />
    </motion.div> :
    <motion.form key="message" initial={{opacity:0,x:-travel}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-travel}} transition={{duration:.16}} className="chat-compose" onSubmit={e=>{e.preventDefault();if(input.trim()){add(input.trim(),"text");setInput("");}}}>
      <Button isIconOnly size="lg" variant="secondary" aria-label={t("attach")} onPress={()=>attachment.current?.click()}><Icon name="file-plus" /></Button>
      <input ref={attachment} hidden type="file" onChange={e=>{const f=e.target.files?.[0];if(f) add(f.name,f.type.startsWith("image/")?"image":f.type.startsWith("video/")?"video":f.type.startsWith("audio/")?"audio":"file",f);e.target.value="";}}/>
      <Input aria-label={t("message")} placeholder={t("message")} value={input} onChange={e=>setInput(e.target.value)} />
      {input.trim() ? <Button key="send" isIconOnly size="lg" type="submit" aria-label={t("send")}><Icon name="paper-plane-horizontal"/></Button>
        : <Button key="record" isIconOnly size="lg" isDisabled={requestingMic} onPress={openVoiceComposer} aria-label={t("voice")}><Icon name="microphone"/></Button>}
    </motion.form>}</AnimatePresence></footer>
  </main>;
}
