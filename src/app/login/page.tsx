"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

// Reps log in with phone number + PIN. Behind the scenes the phone becomes
// a private login id (no SMS needed). The admin logs in with email + password.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const sb = browserClient();
    const email = id.includes("@") ? id.trim() : `${id.replace(/\D/g, "")}@reps.taprizz.in`;
    const { error } = await sb.auth.signInWithPassword({ email, password: secret });
    if (error) {
      setErr("Phone number or PIN is incorrect. Check and try again.");
      setBusy(false);
      return;
    }
    const { data: u } = await sb.auth.getUser();
    const { data: p } = await sb.from("profiles").select("role,active").eq("id", u.user!.id).single();
    if (!p || !p.active) {
      await sb.auth.signOut();
      setErr("This account is switched off. Contact the admin.");
      setBusy(false);
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : p.role === "admin" ? "/admin" : "/rep");
    router.refresh();
  }

  return (
    <div className="wrap narrow">
      <div className="card">
        <h1>Taprizz Plates</h1>
        <p className="muted">Log in to activate plates.</p>
        <form onSubmit={submit}>
          <label htmlFor="id">Phone number (admin: email)</label>
          <input id="id" inputMode="text" autoComplete="username" value={id}
            onChange={(e) => setId(e.target.value)} required />
          <label htmlFor="secret">PIN (admin: password)</label>
          <input id="secret" type="password" autoComplete="current-password" value={secret}
            onChange={(e) => setSecret(e.target.value)} required />
          {err && <div className="msg err" role="alert">{err}</div>}
          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
