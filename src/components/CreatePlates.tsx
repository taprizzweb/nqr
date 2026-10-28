"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

export default function CreatePlates() {
  const router = useRouter();
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("100");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const { data, error } = await browserClient().rpc("admin_create_plates", {
          p_from: Number(from), p_to: Number(to),
        });
        setBusy(false);
        if (error) setMsg({ kind: "err", text: "Could not create plates. Check the range (max 20,000 at once)." });
        else { setMsg({ kind: "ok", text: `${data} new plate numbers created.` }); router.refresh(); }
      }}
    >
      <div className="row">
        <div><label htmlFor="cf">From</label><input id="cf" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} /></div>
        <div><label htmlFor="ct">To</label><input id="ct" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} /></div>
        <button type="submit" disabled={busy} style={{ alignSelf: "flex-end" }}>{busy ? "Creating..." : "Create plates"}</button>
      </div>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </form>
  );
}
