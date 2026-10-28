"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Rep = { id: string; full_name: string; phone: string | null; active: boolean };

export function CreateRep() {
  const router = useRouter();
  const [f, setF] = useState({ full_name: "", phone: "", pin: "" });
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const r = await fetch("/api/admin/reps", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
        });
        const j = await r.json();
        setBusy(false);
        if (!r.ok) return setMsg({ kind: "err", text: j.error || "Could not create the rep." });
        setMsg({ kind: "ok", text: `${f.full_name} added. Share the phone number and PIN with them.` });
        setF({ full_name: "", phone: "", pin: "" });
        router.refresh();
      }}
    >
      <label htmlFor="rn">Name</label>
      <input id="rn" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required />
      <label htmlFor="rp">Phone number (10 digits)</label>
      <input id="rp" inputMode="numeric" value={f.phone}
        onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} required />
      <label htmlFor="rpin">6-digit PIN</label>
      <input id="rpin" inputMode="numeric" value={f.pin}
        onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} required />
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="submit" disabled={busy}>{busy ? "Adding..." : "Add rep"}</button>
      </div>
    </form>
  );
}

export function RepRow({ rep }: { rep: Rep }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/admin/reps", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rep.id, ...body }),
    });
    setBusy(false);
    if (!r.ok) setErr((await r.json()).error || "Could not update.");
    else router.refresh();
  }

  return (
    <tr>
      <td>{rep.full_name}</td>
      <td>{rep.phone}</td>
      <td>{rep.active ? "Active" : "Switched off"}</td>
      <td>
        <div className="row">
          <button className={rep.active ? "danger" : "ghost"} disabled={busy}
            onClick={() => {
              if (rep.active && !confirm(`Switch off ${rep.full_name}? They are logged out and cannot log in.`)) return;
              patch({ active: !rep.active });
            }}>
            {rep.active ? "Switch off" : "Switch on"}
          </button>
          <button className="ghost" disabled={busy}
            onClick={() => {
              const pin = prompt(`New 6-digit PIN for ${rep.full_name}:`);
              if (pin) patch({ pin });
            }}>
            Reset PIN
          </button>
        </div>
        {err && <div className="msg err">{err}</div>}
      </td>
    </tr>
  );
}
