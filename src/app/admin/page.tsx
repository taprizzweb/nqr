import { serverClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sb = await serverClient();

  const [{ count: total }, { count: active }, { count: scans }, { data: reps }, { data: recent }, { data: top }, { count: pending }] =
    await Promise.all([
      sb.from("plates").select("*", { count: "exact", head: true }),
      sb.from("plates").select("*", { count: "exact", head: true }).not("review_url", "is", null),
      sb.from("scans").select("*", { count: "exact", head: true }),
      sb.from("profiles").select("id,full_name,role,active"),
      sb.from("plates").select("activated_by,activated_at").not("activated_by", "is", null)
        .gte("activated_at", new Date(Date.now() - 7 * 86400000).toISOString()).limit(5000),
      sb.from("plates").select("number,shop_name,scan_count").gt("scan_count", 0)
        .order("scan_count", { ascending: false }).limit(10),
      sb.from("plates").select("*", { count: "exact", head: true }).not("review_url", "is", null).is("confirmed_at", null),
    ]);

  const perRep = new Map<string, { week: number; today: number }>();
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  (recent ?? []).forEach((r) => {
    const e = perRep.get(r.activated_by!) ?? { week: 0, today: 0 };
    e.week++;
    if (new Date(r.activated_at!) >= startToday) e.today++;
    perRep.set(r.activated_by!, e);
  });

  return (
    <>
      <h1>Overview</h1>
      <div className="stats">
        <div className="stat"><b>{total ?? 0}</b>Total plates</div>
        <div className="stat"><b>{(active ?? 0) - (pending ?? 0)}</b>Confirmed</div>
        <a className="stat" href="/admin/plates?show=pending"><b>{pending ?? 0}</b>Pending check</a>
        <div className="stat"><b>{(total ?? 0) - (active ?? 0)}</b>Still free</div>
        <div className="stat"><b>{scans ?? 0}</b>Total scans</div>
      </div>

      <div className="card">
        <h2>Activations per rep</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Rep</th><th>Today</th><th>Last 7 days</th><th>Status</th></tr></thead>
            <tbody>
              {(reps ?? []).filter((r) => r.role === "rep").map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{perRep.get(r.id)?.today ?? 0}</td>
                  <td>{perRep.get(r.id)?.week ?? 0}</td>
                  <td>{r.active ? "Active" : "Switched off"}</td>
                </tr>
              ))}
              {(reps ?? []).filter((r) => r.role === "rep").length === 0 && (
                <tr><td colSpan={4} className="muted">No reps yet. Add one under Reps.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Most scanned shops</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Plate</th><th>Shop</th><th>Scans</th></tr></thead>
            <tbody>
              {(top ?? []).map((t) => (
                <tr key={t.number}><td>{t.number}</td><td>{t.shop_name}</td><td>{t.scan_count}</td></tr>
              ))}
              {(top ?? []).length === 0 && <tr><td colSpan={3} className="muted">No scans yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
