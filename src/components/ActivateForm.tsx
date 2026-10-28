"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

type Result = { place_id: string; name: string; address: string; review_url: string };

// Same rule as the database. The database check is the one that counts.
const REVIEW_LINK =
  /^https:\/\/(search\.google\.com\/local\/writereview\?placeid=[A-Za-z0-9_-]+|g\.page\/r\/[A-Za-z0-9_-]+\/review|www\.google\.com\/maps\/.+|maps\.app\.goo\.gl\/.+|goo\.gl\/maps\/.+)$/i;

export default function ActivateForm({
  number, fixing, current,
}: { number: number; fixing: boolean; current: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"search" | "paste">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [picked, setPicked] = useState<Result | null>(null);
  const [searching, setSearching] = useState(false);
  const [pName, setPName] = useState("");
  const [pLink, setPLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setPicked(null);
    setSearching(true);
    try {
      const r = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Search failed.");
      setResults(j.results);
      if (j.results.length === 0) setMsg({ kind: "err", text: "No shops found. Add the area to the name, or paste the link instead." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Search failed." });
    }
    setSearching(false);
  }

  const chosen =
    mode === "search"
      ? picked
      : pName.trim() && REVIEW_LINK.test(pLink.trim())
      ? { place_id: "", name: pName.trim(), address: "", review_url: pLink.trim() }
      : null;

  async function save() {
    if (!chosen) return;
    setBusy(true);
    setMsg(null);
    const sb = browserClient();
    const fn = fixing ? "fix_own_plate" : "activate_plate";
    const { data, error } = await sb.rpc(fn, {
      p_number: number,
      p_place_id: chosen.place_id || null,
      p_shop_name: chosen.name,
      p_shop_address: chosen.address || null,
      p_review_url: chosen.review_url,
    });
    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: error.message.includes("Invalid review link")
        ? "That is not a valid Google review link."
        : "Could not save. Check your connection and try again." });
      return;
    }
    if (!data?.ok) {
      setMsg({ kind: "err", text: data?.error || "Could not save." });
      return;
    }
    setMsg({ kind: "ok", text: `Plate ${number} is now linked to ${chosen.name}.` });
    setTimeout(() => { router.push("/rep"); router.refresh(); }, 1200);
  }

  return (
    <div className="card">
      <h1>{fixing ? `Fix plate ${number}` : `Activate plate ${number}`}</h1>
      {fixing && <div className="msg warn">Currently linked to {current}. You can fix your own mistake for 1 hour after activating.</div>}

      <div className="row" style={{ marginBottom: 8 }}>
        <button className={mode === "search" ? "" : "ghost"} onClick={() => { setMode("search"); setMsg(null); }}>Search shop</button>
        <button className={mode === "paste" ? "" : "ghost"} onClick={() => { setMode("paste"); setMsg(null); }}>Paste link</button>
      </div>

      {mode === "search" ? (
        <>
          <form onSubmit={search}>
            <label htmlFor="q">Shop name and area</label>
            <div className="row">
              <input id="q" className="grow" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. NG Ayurveda Vaishali Nagar Jaipur" required minLength={3} />
              <button type="submit" disabled={searching}>{searching ? "Searching..." : "Search"}</button>
            </div>
          </form>
          {results.map((r) => (
            <button key={r.place_id} className={`pick ${picked?.place_id === r.place_id ? "sel" : ""}`}
              onClick={() => setPicked(r)}>
              {r.name}<small>{r.address}</small>
            </button>
          ))}
        </>
      ) : (
        <>
          <label htmlFor="pn">Shop name</label>
          <input id="pn" value={pName} onChange={(e) => setPName(e.target.value)} />
          <label htmlFor="pl">Google review link</label>
          <input id="pl" inputMode="url" value={pLink} onChange={(e) => setPLink(e.target.value)}
            placeholder="https://search.google.com/local/writereview?placeid=..." />
          {pLink && !REVIEW_LINK.test(pLink.trim()) && (
            <div className="msg err">Only Google review or Google Maps links are accepted.</div>
          )}
        </>
      )}

      {chosen && (
        <div className="msg ok" style={{ marginTop: 16 }}>
          <b>{chosen.name}</b>
          {chosen.address && <div>{chosen.address}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <a className="btn ghost" href={chosen.review_url} target="_blank" rel="noreferrer">Test review link</a>
          </div>
        </div>
      )}

      {msg && <div className={`msg ${msg.kind}`} role="alert">{msg.text}</div>}

      <div className="row" style={{ marginTop: 16 }}>
        <button onClick={save} disabled={!chosen || busy}>{busy ? "Saving..." : fixing ? "Save fix" : `Save plate ${number}`}</button>
        <Link className="btn ghost" href="/rep">Cancel</Link>
      </div>
    </div>
  );
}
