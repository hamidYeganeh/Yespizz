"use client";
import "../../../../../../../packages/staff/forms.css";
import { Location } from "./location";
import { useState } from "react";
export default function RestaurantForm() {
  const [resend, setResend] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="admin-login-pane">
      <form
        className="admin-login-form staff-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const body = {
            email: data.get("email"),
            name: data.get("name"),
            resend,
            ...Object.fromEntries(
              ["commission", "ovens", "latitude", "longitude"].map((key) => [
                key,
                Number(data.get(key)),
              ]),
            ),
          };
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch("/api/v1/admin/restaurants", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const result = await response.json();
            setMessage(
              response.ok
                ? (result.delivered
                    ? "Invitation emailed."
                    : "Email delivery failed. You can resend the invitation.") +
                    " One-time password: " +
                    result.oneTimePassword
                : result.error || "Request failed.",
            );
          } catch {
            setMessage("Could not complete the request.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>{resend ? "Resend invitation" : "Create restaurant"}</h1>
        <label>
          Business email
          <input required name="email" type="email" />
        </label>
        {!resend && (
          <>
            <label>
              Restaurant name
              <input required name="name" maxLength={200} />
            </label>
            <label>
              Commission (%)
              <input
                required
                type="number"
                name="commission"
                min="0"
                max="100"
                step="any"
              />
            </label>
            <label>
              Ovens
              <input required type="number" name="ovens" min="1" />
            </label>
            <Location />
          </>
        )}
        <button disabled={busy}>
          {resend ? "Send new password" : "Create and email password"}
        </button>
        <button
          disabled={busy}
          type="button"
          onClick={() => {
            setResend(!resend);
            setMessage("");
          }}
        >
          {resend ? "Create restaurant" : "Resend an existing invitation"}
        </button>
        <output>{message}</output>
        <a href="/dashboard">Dashboard</a>
      </form>
    </main>
  );
}
