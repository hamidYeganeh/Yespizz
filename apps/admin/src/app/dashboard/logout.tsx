"use client";
export function Logout() {
  return (
    <button
      onClick={async () => {
        const response = await fetch("/api/v1/admin/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (response.ok) location.replace("/");
      }}
    >
      Sign out
    </button>
  );
}
