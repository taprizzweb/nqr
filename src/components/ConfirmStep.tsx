"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";
import ActivateForm from "@/components/ActivateForm";

/**
 * Step 2: the link is set but the plate is still PENDING.
 * The rep must scan the real plate QR (or tap the test link), see the right review page,
 * come back and confirm. The server only accepts the confirm if it saw that scan.
 */
export default function ConfirmStep({
  number, shop, address, reviewUrl,
}: { number: number; shop: string; address: string; reviewUrl: string }) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);

  if (changing) {
    return <ActivateForm number={number} editing current={shop} onDone={() => setChanging(false)} />;
  }

  async function confirm() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await browserClient().rpc("confirm_plate", { p_number: number });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: "Could not confirm. Check your connection and try again." });
    if (!data?.ok) return setMsg({ kind: data?.code === "no_scan" ? "warn" : "err", text: data?.error || "Could not confirm." });
    setMsg({ kind: "ok", text: `Plate ${number} is confirmed and live.` });
    setTimeout(() => { router.push("/rep"); router.refresh(); }, 1200);
  }

  return (
    <div className="card">
      <h1>Check plate {number}</h1>
      <p className="muted">Step 2 of 2. The link is saved but not final yet.</p>

      <div className="msg ok">
        <b>{shop}</b>
        {address && <div>{address}</div>}
      </div>

      <h2 style={{ marginTop: 16 }}>Do this now</h2>
      <ol>
        <li>Scan the QR on the plate with your phone camera. You can also tap the button below.</li>
        <li>Check that the <b>correct shop&apos;s review page</b> opens.</li>
        <li>Come back here and tap <b>Confirm</b>.</li>
      </ol>

      <div className="row">
        <a className="btn ghost" href={`${typeof window !== "undefined" ? window.location.origin : ""}/qr/${number}`}
          target="_blank" rel="noreferrer">Test plate link</a>
        <a className="btn ghost" href={reviewUrl} target="_blank" rel="noreferrer">Preview review page</a>
      </div>

      <div className="msg warn" style={{ marginTop: 16 }}>
        After you confirm, you cannot change or remove this plate. Only the admin can.
      </div>

      {msg && <div className={`msg ${msg.kind}`} role="alert">{msg.text}</div>}

      <div className="row" style={{ marginTop: 16 }}>
        <button onClick={confirm} disabled={busy}>{busy ? "Confirming..." : "Confirm - it opened the right page"}</button>
        <button className="ghost" onClick={() => setChanging(true)}>Wrong shop? Change link</button>
        <Link className="btn ghost" href="/rep">Later</Link>
      </div>
    </div>
  );
}
