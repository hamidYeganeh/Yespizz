"use client";
import "./forms.css";
import { useState } from "react";
export function PasswordForm({
  role,
  initial = "sign-in",
}: {
  role: "admin" | "business";
  initial?: "forgot-password" | "sign-in";
}) {
  const [step, setStep] = useState<
    "sign-in" | "forgot-password" | "set-password"
  >(initial);
  const [setup, setSetup] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className={
        role === "admin"
          ? "admin-login-form staff-form"
          : "studio-form staff-form"
      }
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        if (step === "set-password" && data.password !== data.confirm) {
          setMessage("Passwords do not match.");
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/v1/" + role + "/auth/" + step, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, token: setup || data.token }),
          });
          const result = await response.json();
          if (!response.ok)
            setMessage(result.message || result.error || "Request failed.");
          else if (result.setupToken) {
            setSetup(result.setupToken);
            setStep("set-password");
          } else if (step === "forgot-password") {
            setStep("set-password");
            setMessage(
              "If your account exists, check your email for a reset code.",
            );
          } else if (step === "set-password") {
            setSetup("");
            setStep("sign-in");
            setMessage("Password saved. Sign in with your new password.");
          } else
            location.assign(role === "admin" ? "/dashboard" : "/onboarding");
        } catch {
          setMessage("Could not complete the request.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {step === "sign-in"
          ? "Sign in"
          : step === "forgot-password"
            ? "Forgot password"
            : "Set password"}
      </h2>
      {step !== "set-password" && (
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
      )}
      {step === "set-password" && !setup && (
        <label>
          Email reset code
          <input required name="token" autoComplete="one-time-code" />
        </label>
      )}
      {step !== "forgot-password" && (
        <label>
          Password
          <input
            key={step}
            required
            name="password"
            type="password"
            minLength={step === "set-password" ? 8 : 1}
            maxLength={128}
            autoComplete={
              step === "sign-in" ? "current-password" : "new-password"
            }
          />
        </label>
      )}
      {step === "set-password" && (
        <label>
          Confirm new password
          <input
            required
            name="confirm"
            type="password"
            autoComplete="new-password"
          />
        </label>
      )}
      <button disabled={busy}>
        {step === "sign-in"
          ? "Sign in"
          : step === "forgot-password"
            ? "Email reset code"
            : "Save password"}
      </button>
      <button
        disabled={busy}
        type="button"
        onClick={() => {
          setSetup("");
          setMessage("");
          setStep(step === "sign-in" ? "forgot-password" : "sign-in");
        }}
      >
        {step === "sign-in" ? "Forgot password?" : "Back to sign in"}
      </button>
      <output role="status">{message}</output>
    </form>
  );
}
