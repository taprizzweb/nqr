import { serverClient } from "@/lib/supabase";
import { CreateRep, RepRow } from "@/components/RepManager";

export const dynamic = "force-dynamic";

export default async function AdminReps() {
  const sb = await serverClient();
  const { data } = await sb.from("profiles").select("id,full_name,phone,active").eq("role", "rep").order("created_at");
  return (
    <>
      <h1>Reps</h1>
      <div className="card">
        <h2>Add a rep</h2>
        <CreateRep />
      </div>
      <div className="card">
        <h2>Your reps</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((r) => <RepRow key={r.id} rep={r} />)}
              {(data ?? []).length === 0 && <tr><td colSpan={4} className="muted">No reps yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
