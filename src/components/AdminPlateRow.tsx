"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

type P = {
  number: number; shop_name: string | null; review_url: string | null; locked: boolean;
  scan_count: number; rep_name: string | null;
};

export default function AdminPlateRow({ p }: { p: P }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(p.shop_name ?? "");
  const [url, setUrl] = useState(p.review_url ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const { error } = await browserClient().rpc(fn, args);
    setBusy(false);
    if (error) {
      setErr(error.message.includes("Invalid review link") ? "Not a valid Google review link." : "Could not save.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <>
      <tr>
        <td><b>{p.number}</b></td>
        <td>{p.shop_name ?? <span className="muted">free</span>}</td>
        <td>{p.rep_name ?? ""}</td>
        <td>{p.scan_count}</td>
        <td>
          <div className="row">
            <button className="ghost" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</button>
            <button className="ghost" disabled={busy}
              onClick={() => run("admin_lock_plate", { p_number: p.number, p_locked: !p.locked })}>
              {p.locked ? "Unlock" : "Lock"}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            <label htmlFor={`n${p.number}`}>Shop name</label>
            <input id={`n${p.number}`} value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor={`u${p.number}`}>Google review link</label>
            <input id={`u${p.number}`} value={url} onChange={(e) => setUrl(e.target.value)} />
            {err && <div className="msg err">{err}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <button disabled={busy || !name.trim() || !url.trim()}
                onClick={async () => {
                  const ok = await run("admin_set_plate", {
                    p_number: p.number, p_place_id: null, p_shop_name: name.trim(),
                    p_shop_address: null, p_review_url: url.trim(),
                  });
                  if (ok) setOpen(false);
                }}>
                Save changes
              </button>
              {p.review_url && (
                <button className="danger" disabled={busy}
                  onClick={async () => {
                    if (!confirm(`Clear plate ${p.number} (${p.shop_name})? The QR and NFC will show "Not activated yet".`)) return;
                    if (await run("admin_clear_plate", { p_number: p.number })) setOpen(false);
                  }}>
                  Clear plate
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
