import { serverClient } from "@/lib/supabase";
import { CreateRep, RepRow } from "@/components/RepManager";

export const dynamic = "force-dynamic";

// 1,2,3,5,6 -> "1-3, 5-6"
function ranges(nums: number[]) {
  const out: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? `${nums[i]}-${nums[j]}` : `${nums[i]}`);
    i = j + 1;
  }
  return out.join(", ");
}

export default async function AdminReps() {
  const sb = await serverClient();
  const { data } = await sb.from("profiles").select("id,full_name,phone,active").eq("role", "rep").order("created_at");

  const done = new Map<string, number[]>();
  const wait = new Map<string, number[]>();
  for (let from = 0; ; from += 1000) {
    const { data: rows } = await sb.from("plates").select("number,activated_by,confirmed_at")
      .not("activated_by", "is", null).order("number").range(from, from + 999);
    (rows ?? []).forEach((r) => {
      const m = r.confirmed_at ? done : wait;
      m.set(r.activated_by!, [...(m.get(r.activated_by!) ?? []), r.number]);
    });
    if (!rows || rows.length < 1000) break;
  }
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
            <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Plates set</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((r) => <RepRow key={r.id} rep={r}
                confirmed={ranges(done.get(r.id) ?? [])} confirmedCount={(done.get(r.id) ?? []).length}
                pending={ranges(wait.get(r.id) ?? [])} pendingCount={(wait.get(r.id) ?? []).length} />)}
              {(data ?? []).length === 0 && <tr><td colSpan={5} className="muted">No reps yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
