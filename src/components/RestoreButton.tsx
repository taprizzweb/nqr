"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

export default function RestoreButton({ id, plate }: { id: number; plate: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="ghost" disabled={busy}
      onClick={async () => {
        if (!confirm(`Restore the previous link on plate ${plate}?`)) return;
        setBusy(true);
        await browserClient().rpc("admin_restore_history", { p_history_id: id });
        setBusy(false);
        router.refresh();
      }}>
      Restore previous
    </button>
  );
}
