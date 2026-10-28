"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

const FINDER = "https://developers.google.com/maps/documentation/places/web-service/place-id";
const PLACE_ID = /^[A-Za-z0-9_-]{10,}$/;

export function reviewLink(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

/**
 * Step 1: set the link. The plate becomes PENDING (not final yet).
 * The rep finds the shop's Google Place ID, pastes it here, and the review link is generated.
 * With editing=true it changes the link of the rep's own pending plate.
 */
export default function ActivateForm({
  number, editing, current, onDone,
}: { number: number; editing: boolean; current: string | null; onDone?: () => void }) {
  const router = useRouter();
  const [shop, setShop] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const id = placeId.trim();
  const valid = PLACE_ID.test(id);
  const link = valid ? reviewLink(id) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ kind: "err", text: "Could not copy. Press and hold the link to copy it." });
    }
  }

  async function save() {
    if (!valid || !shop.trim()) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await browserClient().rpc(editing ? "edit_pending_plate" : "activate_plate", {
      p_number: number,
      p_place_id: id,
      p_shop_name: shop.trim(),
      p_shop_address: null,
      p_review_url: link,
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: error.message.includes("Invalid review link")
        ? "That Place ID does not make a valid Google review link."
        : "Could not save. Check your connection and try again." });
      return;
    }
    if (!data?.ok) {
      setMsg({ kind: "err", text: data?.error || "Could not save." });
      return;
    }
    // The page now moves on to step 2 (test the QR and confirm).
    if (onDone) onDone();
    router.refresh();
  }

  return (
    <div className="card">
      <h1>{editing ? `Change link for plate ${number}` : `Set link for plate ${number}`}</h1>
      <p className="muted">
        {editing
          ? `Currently ${current}. You can change it until you confirm.`
          : "Step 1 of 2. After saving you will test the QR, then confirm."}
      </p>

      <h2>1. Find the shop&apos;s Place ID</h2>
      <p className="muted">Open the finder, search the shop name, copy its Place ID, then come back here.</p>
      <a className="btn" href={FINDER} target="_blank" rel="noreferrer">Search Google Place ID</a>

      <h2 style={{ marginTop: 20 }}>2. Paste the Place ID</h2>
      <label htmlFor="sn">Shop name</label>
      <input id="sn" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. NG Ayurveda Vaishali Nagar" />
      <label htmlFor="pid">Place ID</label>
      <input id="pid" value={placeId} onChange={(e) => setPlaceId(e.target.value.replace(/\s/g, ""))}
        placeholder="ChIJ..." autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      {id && !valid && <div className="msg err">This does not look like a Place ID. Copy it again from the finder.</div>}

      {valid && (
        <>
          <h2 style={{ marginTop: 20 }}>3. Google review link (made for you)</h2>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="ghost" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            <a className="btn ghost" href={link} target="_blank" rel="noreferrer">Preview review page</a>
          </div>
        </>
      )}

      {msg && <div className={`msg ${msg.kind}`} role="alert">{msg.text}</div>}

      <div className="row" style={{ marginTop: 16 }}>
        <button onClick={save} disabled={!valid || !shop.trim() || busy}>
          {busy ? "Saving..." : editing ? "Save new link" : "Set link"}
        </button>
        {editing && onDone
          ? <button className="ghost" onClick={onDone}>Cancel</button>
          : <Link className="btn ghost" href="/rep">Cancel</Link>}
      </div>
    </div>
  );
}
