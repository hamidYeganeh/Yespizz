"use client";

import { Button, Form, TextField, Input, Label } from "@heroui/react";
import { PasswordForm } from "../../../../packages/staff/password-form";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const t = useTranslations("Admin.login");
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [recover, setRecover] = useState(false);
  if (recover) return <PasswordForm role="admin" initial="forgot-password" />;
  return (
    <Form
      className="admin-login-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (
          (
            await fetch("/api/v1/admin/auth/sign-in", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(form)),
            }).catch(() => null)
          )?.ok
        )
          location.assign("/dashboard");
        else setSubmitted(true);
      }}
    >
      <TextField type="email" name="email" isRequired>
        <Label>{t("email")}</Label>
        <Input autoComplete="username" />
      </TextField>
      <TextField
        type={visible ? "text" : "password"}
        name="password"
        isRequired
      >
        <Label>{t("password")}</Label>
        <Input autoComplete="current-password" />
      </TextField>
      <Button
        type="button"
        variant="ghost"
        onPress={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
        {t(visible ? "hide" : "show")}
      </Button>
      <Button type="submit">{t("submit")}</Button>
      <Button type="button" variant="ghost" onPress={() => setRecover(true)}>
        Forgot password?
      </Button>
      {submitted && <p role="status">{t("unavailable")}</p>}
    </Form>
  );
}
