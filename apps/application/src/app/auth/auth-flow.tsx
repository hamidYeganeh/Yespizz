"use client";

import { signInReturn, withSignInReturn } from "@/lib/sign-in-return";

import { Button, Input, Label, Separator, TextField } from "@heroui/react";
import { Effects } from "@animate-ui/react/primitives/effects/effect";
import { Eye, EyeOff, ChevronLeft, Check, Mail, MessageSquareMore, Smartphone, LockKeyhole, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addTransitionType, startTransition, useEffect, useState } from "react";
import { PageTransition } from "../components/page-transition";
import { authClient } from "@/lib/auth-client";
import { sileo, Toaster } from "sileo";
import "sileo/styles.css";
import { resetVerifiedPassword, verifyRecoveryCode, needsPassword, saveContactPhone } from "./actions";
import { OneTimeCode } from "./OneTimeCode";
import "./auth.css";
import "./one-time-code.css";

type Step = "welcome" | "methods" | "email" | "password" | "signin" | "verify" | "phone" | "forgot" | "reset";

async function authRequest(action:string, body:Record<string,string>) {
  const response=await fetch("/api/v1/auth/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if (!response.ok) throw new Error((await response.json().catch(()=>({}))).message || "Authentication failed.");
  return {error:null};
}

function Wordmark() {
  return <Image className="auth-wordmark" src="/auth/wordmark.png" alt="Yespiz" width={331} height={90} priority />;
}

function Pattern() {
  return <div className="auth-pattern" aria-hidden="true">
    {Array.from({ length: 8 }, (_, i) => <span key={i}>Yespiz Yespiz Yespiz Yespiz</span>)}
  </div>;
}

function PasswordInput({ label, current = false }: { label: string; current?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-password-input">
    <Input type={visible ? "text" : "password"} autoComplete={current ? "current-password" : "new-password"} placeholder={label} />
    <Button type="button" variant="ghost" isIconOnly size="lg" aria-label={(visible ? "Hide " : "Show ") + label.toLowerCase()} onPress={() => setVisible(!visible)}>
      {visible ? <EyeOff /> : <Eye />}
    </Button>
  </div>;
}

function PasswordStep({ finish, busy, children, ready = true }: { children?: React.ReactNode; ready?: boolean; finish: (password: string) => void; busy: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const rules = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Use uppercase and lowercase letters and numbers", valid: /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) },
  ];
  return <form className="auth-form" onSubmit={event => {
    event.preventDefault();
    setSubmitted(true);
    if (ready && rules.every(rule => rule.valid) && confirm === password) finish(password);
  }}>

    {children}
    <TextField isRequired value={password} onChange={setPassword}>
      <Label>Password</Label><PasswordInput label="Password" />
    </TextField>
    <TextField isRequired value={confirm} onChange={setConfirm}>
      <Label>Password Confirm</Label><PasswordInput label="Password Confirm" />
    </TextField>
    <ul className="auth-rules">{rules.map(({ label, valid }) => <li key={label} data-valid={valid}>
      {valid ? <Check aria-label="Met" /> : <X aria-label="Unmet" />}{label}
    </li>)}</ul>
    {submitted && (confirm !== password || rules.some(rule => !rule.valid)) && <p role="alert">Check the password requirements and make sure both passwords match.</p>}
    <footer><Button isPending={busy} isDisabled={!ready || !rules.every(rule => rule.valid) || confirm !== password} type="submit" className="auth-primary">Next</Button></footer>
  </form>;
}

export default function AuthFlow({ oauthFailed = false, initialStep = "welcome" }: { oauthFailed?: boolean; initialStep?: Step }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(oauthFailed ? "methods" : initialStep);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [phase, setPhase] = useState<"type" | "check" | "ok" | "no">("type");
  const [code, setCode] = useState("");
  const recovering = initialStep === "forgot";
  useEffect(() => {
    if (oauthFailed) sileo.error({ title: "Sign-in was cancelled or could not be completed." });
  }, [oauthFailed]);
  const [busy, setBusy] = useState(false);
  function move(next: Step, back = false) {

    const paths = { email: "/auth/sign-up", signin: "/auth/sign-in", forgot: "/auth/forgot-password", password: "/auth/set-password?setup=1", methods: "/auth/methods" };
    if (next in paths && next !== initialStep && (next !== "methods" || initialStep !== "welcome")) {
      const destination = withSignInReturn(paths[next as keyof typeof paths], signInReturn());
      if (back) router.replace(destination, {transitionTypes:["nav-back"]});
      else router.push(destination);
      return;
    }
    startTransition(() => {
      if (back) addTransitionType("nav-back");
      setStep(next);
    });
  }
  async function request(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);

    try {
      await operation();
    } catch (cause) {
      sileo.error({ title: cause instanceof Error ? cause.message : "Authentication failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  function issueCode() {
    void request(async () => {
      await authRequest(recovering?"forgot-password":"sign-up",{email:email.trim()});
      setCode("");
      setPhase("type");
      move("verify");
    });
  }
  function finish() {
    router.replace(signInReturn() || "/");
    router.refresh();
  }
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneValid = /^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s()-]/g, ""));
  const stepContent = {
    email: { icon: Mail, title: "Continue with Email", detail: "Sign in or sign up with your email." },
    signin: { icon: LockKeyhole, title: "Sign in", detail: "Enter your email address and password." },
    verify: { icon: MessageSquareMore, title: "Enter Verification Code", detail: "We sent a verification code to your email" },
    phone: { icon: Smartphone, title: "Add Your Phone", detail: "Add a contact number to your Yespiz account." },
    forgot: { icon: Mail, title: "Forgot Password", detail: "Enter your account email to request a reset code." },
    reset: { icon: LockKeyhole, title: "Set a New Password", detail: "Choose a new password for your account." },
    password: { icon: LockKeyhole, title: "Set Your Password", detail: "Choose a password for your account." },
  };
  const content = step === "welcome" || step === "methods" ? null : stepContent[step];
  return <main className="auth-shell">
    <Toaster position="top-center" />
    <PageTransition effect="slide" pageKey={step}>
      {step === "welcome" && <section className="auth-screen auth-welcome">
        <Pattern /><Wordmark />
        <h1>Say<br />Yes<span> to </span>Pizza</h1>
        <div className="auth-art" aria-hidden="true">
          <Effects asChild fade zoom={{ initialScale: 0.76 }} slide={{ direction: "up", offset: 30 }} holdDelay={95}>
            {(["board", "pizza", "chili", "pepper", "leaf"] as const).map(item => (
              <span className={`auth-art__item auth-art__${item}`} key={item}>
                <Image src={item === "pizza" ? "/menu/margherita-cutout.webp" : `/auth/${item}.webp`} fill sizes="(max-width: 544px) 100vw, 544px" alt="" loading="eager" />
              </span>
            ))}
          </Effects>
        </div>
        <Button className="auth-primary" onPress={() => process.env.NEXT_PUBLIC_YESPIZ_OFFLINE === "1" ? finish() : move("methods")}>Let&apos;s go</Button>
      </section>}
      {step === "methods" && <section className="auth-screen auth-methods">
        <div className="auth-hero">
          <Pattern /><Wordmark />
          <Image className="auth-portrait" src="/auth/pizza-portrait.webp" width={500} height={664} sizes="(max-width: 544px) 66vw, 360px" alt="" loading="eager" />
        </div>
        <div className="auth-options">
          <h1>Let’s you in</h1>
          {(["Apple", "Google"] as const).map(name => <Button key={name} className="auth-provider" variant="secondary" isDisabled={busy} onPress={() => request(async () => {
              const result = await authClient.signIn.social({ provider: name === "Apple" ? "apple" : "google", callbackURL: signInReturn() || "/", errorCallbackURL: withSignInReturn("/auth?error=oauth", signInReturn()) });
              if (result.error) throw new Error(result.error.message || name + " sign-in could not start. Please try again later.");
            })}>
            <Image src={`/profile/${name.toLowerCase()}.png`} width={24} height={24} alt="" />Continue with {name}
          </Button>)}
          
          <div className="auth-divider">or</div>
          <Button className="auth-primary" onPress={() => move("email")}>Continue with Email</Button>
        </div>
      </section>}
      {content && <section className="auth-screen auth-register" data-step={step}>
        <header className="auth-step-nav">
          <Button isDisabled={busy} isIconOnly size="lg" variant="outline" aria-label="Go back" onPress={() => move((step === "email" || step === "signin") ? "methods" : (step === "reset" || (step === "verify" && recovering)) ? "forgot" : step === "forgot" ? "signin" : "email", true)}><ChevronLeft /></Button>
          {step === "phone" && <Button variant="secondary" isDisabled={busy} onPress={() => move("password")}>Skip</Button>}
        </header>
        <div className="auth-intro">
          <span className="auth-step-icon"><content.icon aria-hidden="true" /></span>
          <h1>{content.title}</h1><p>{content.detail}{step === "verify" && <strong>{email.trim()}.</strong>}</p>
        </div>
        {(step === "password" || step === "reset") ? <PasswordStep busy={busy} finish={password => request(async () => {
          if (step === "reset") {
            const response = await resetVerifiedPassword(password);
            if (response.error) throw new Error(response.error);
            router.replace(withSignInReturn("/auth/sign-in", signInReturn()));
            return;
          }
          await authRequest("set-password",{password});
          finish();
        })} /> : <form className="auth-form" onSubmit={event => {
          event.preventDefault();
          if (step === "email" || step === "forgot") return issueCode();
          const submittedCode = new FormData(event.currentTarget).get("otp");
          void request(async () => {
            if (step === "verify") {
              if (phase !== "type" || typeof submittedCode !== "string" || !/^\d{5}$/.test(submittedCode)) return;
              setPhase("check");
              try {
                const result = recovering ? await verifyRecoveryCode(email.trim(), submittedCode) : await authRequest("verify-code",{ email: email.trim(), otp: submittedCode });
                if (result.error) throw new Error(result.error);
                const setup = !recovering && await needsPassword();
                setPhase("ok");
                await new Promise(resolve => setTimeout(resolve, 650));
                if (recovering) router.push(withSignInReturn("/auth/set-password", signInReturn()));
                else if (setup) move("phone"); else finish();
              } catch (cause) {
                setPhase("no");
                await new Promise(resolve => setTimeout(resolve, 950));
                setCode("");
                setPhase("type");
                throw cause;
              }
            } else if (step === "phone") {
              const result = await saveContactPhone(phone);
              if (result.error) throw new Error(result.error);
              move("password");
            } else {
              await authRequest("sign-in",{ email: email.trim(), password: loginPassword });
              finish();
            }
          });
        }}>
          {(step === "email" || step === "signin" || step === "forgot") && <>
            <TextField type="email" aria-label="Email address" isReadOnly={busy} isRequired value={email} onChange={setEmail}>
              <Input autoFocus autoComplete="email" placeholder="Email Address" />
            </TextField>
            {step === "signin" && <TextField aria-label="Password" isRequired value={loginPassword} onChange={setLoginPassword}>
              <PasswordInput label="Password" current />
            </TextField>}
            {step === "signin" && <Button variant="ghost" onPress={() => move("forgot")}>Forgot password?</Button>}
            {step !== "forgot" && <><div className="auth-method-separator"><Separator aria-hidden="true" /><span>or</span><Separator aria-hidden="true" /></div>
            <Button className="auth-alternative" variant="ghost" isDisabled={busy} onPress={() => { setLoginPassword(""); move(step === "email" ? "signin" : "email"); }}>
              {step === "email" ? "Sign in with a password" : "Use an email code"}
            </Button></>}
          </>}
          {step === "verify" && <>
            <OneTimeCode code={code} onChange={setCode} phase={phase} disabled={busy} onComplete={form => form.requestSubmit()} />
            <Button variant="ghost" className="auth-alternative" isDisabled={busy} onPress={issueCode}>Resend code</Button>
          </>}
          {step === "phone" && <TextField aria-label="Phone number including country code" type="tel" isRequired value={phone} onChange={setPhone}>
            <Input autoFocus autoComplete="tel" placeholder="+65 8123 4567" />
          </TextField>}
          
          <footer><Button className="auth-primary" type="submit" isPending={busy} isDisabled={step === "verify" ? code.length !== 5 : step === "phone" ? !phoneValid : !emailValid || (step === "signin" && !loginPassword)}>
            {step === "signin" ? "Sign in" : "Next"}
          </Button></footer>
        </form>}
      </section>}
    </PageTransition>
  </main>;
}
