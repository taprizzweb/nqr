import Link from "next/link";
import { serverClient } from "@/lib/supabase";
import AdminPlateRow from "@/components/AdminPlateRow";
import CreatePlates from "@/components/CreatePlates";

export const dynamic = "force-dynamic";
const PAGE = 100;

export default async function AdminPlates({
  searchParams,
}: { searchParams: Promise<{ page?: string; q?: string; show?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const show = sp.show ?? "all";
  const sb = await serverClient();

  let query = sb
    .from("plates")
    .select("number,shop_name,review_url,locked,scan_count,activated_by", { count: "exact" })
    .order("number")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (/^\d+$/.test(q)) query = query.eq("number", Number(q));
  else if (q) query = query.ilike("shop_name", `%${q.replace(/[%,]/g, "")}%`);
  if (show === "free") query = query.is("review_url", null);
  if (show === "active") query = query.not("review_url", "is", null);

  const { data, count } = await query;
  const { data: profs } = await sb.from("profiles").select("id,full_name");
  const names = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (pg: number) => `/admin/plates?page=${pg}&q=${encodeURIComponent(q)}&show=${show}`;

  return (
    <>
      <h1>Plates</h1>
      <div className="card">
        <h2>Add plate numbers</h2>
        <p className="muted">Creates numbers in the range. Existing numbers are left untouched.</p>
        <CreatePlates />
      </div>

      <div className="card">
        <form className="row" action="/admin/plates">
          <div className="grow"><label htmlFor="q">Search number or shop</label>
            <input id="q" name="q" defaultValue={q} /></div>
          <div><label htmlFor="show">Show</label>
            <select id="show" name="show" defaultValue={show}>
              <option value="all">All</option><option value="active">Activated</option><option value="free">Free</option>
            </select></div>
          <button type="submit" style={{ alignSelf: "flex-end" }}>Search</button>
          <a className="btn ghost" style={{ alignSelf: "flex-end" }} href="/api/admin/export">Export CSV</a>
        </form>

        <div className="tablewrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>No.</th><th>Shop</th><th>Rep</th><th>Scans</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((p) => (
                <AdminPlateRow key={p.number} p={{
                  number: p.number, shop_name: p.shop_name, review_url: p.review_url, locked: p.locked,
                  scan_count: p.scan_count, rep_name: p.activated_by ? names.get(p.activated_by) ?? null : null,
                }} />
              ))}
              {(data ?? []).length === 0 && <tr><td colSpan={5} className="muted">No plates found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {page > 1 && <Link className="btn ghost" href={href(page - 1)}>Previous</Link>}
          <span className="muted">Page {page} of {pages} ({count ?? 0} plates)</span>
          {page < pages && <Link className="btn ghost" href={href(page + 1)}>Next</Link>}
        </div>
      </div>
    </>
  );
}
