import { serverClient } from "@/lib/supabase";
import RestoreButton from "@/components/RestoreButton";

export const dynamic = "force-dynamic";

export default async function AdminHistory() {
  const sb = await serverClient();
  const [{ data: rows }, { data: profs }] = await Promise.all([
    sb.from("plate_history")
      .select("id,plate_number,action,actor,old_shop_name,new_shop_name,old_review_url,created_at")
      .order("created_at", { ascending: false }).limit(200),
    sb.from("profiles").select("id,full_name"),
  ]);
  const names = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

  return (
    <>
      <h1>History</h1>
      <p className="muted">Every activation and change. If a rep or anyone changed a plate by mistake, restore the previous link.</p>
      <div className="card">
        <div className="tablewrap">
          <table>
            <thead><tr><th>When</th><th>Plate</th><th>Action</th><th>By</th><th>Shop</th><th></th></tr></thead>
            <tbody>
              {(rows ?? []).map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleString("en-IN")}</td>
                  <td>{h.plate_number}</td>
                  <td>{h.action}</td>
                  <td>{h.actor ? names.get(h.actor) ?? "" : ""}</td>
                  <td>{h.old_shop_name && h.new_shop_name && h.old_shop_name !== h.new_shop_name
                    ? `${h.old_shop_name} → ${h.new_shop_name}` : h.new_shop_name ?? h.old_shop_name}</td>
                  <td>{h.old_review_url && <RestoreButton id={h.id} plate={h.plate_number} />}</td>
                </tr>
              ))}
              {(rows ?? []).length === 0 && <tr><td colSpan={6} className="muted">No changes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
