import Link from "next/link";
import { serverClient } from "@/lib/supabase";
import JumpToPlate from "@/components/JumpToPlate";

export const dynamic = "force-dynamic";

type Plate = { number: number; review_url: string | null; activated_by: string | null; locked: boolean };

export default async function RepHome({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "free" } = await searchParams;
  const sb = await serverClient();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user!.id;

  const { data: plates } = await sb
    .from("plates")
    .select("number,review_url,activated_by,locked")
    .order("number")
    .limit(10000);
  const all = (plates ?? []) as Plate[];

  const { data: mine } = await sb
    .from("plates")
    .select("number,shop_name,activated_at")
    .eq("activated_by", uid)
    .order("activated_at", { ascending: false })
    .limit(50);

  const shown = all.filter((p) =>
    show === "all" ? true : show === "mine" ? p.activated_by === uid : p.review_url === null
  );
  const freeCount = all.filter((p) => p.review_url === null).length;

  return (
    <>
      <div className="card">
        <h1>Activate a plate</h1>
        <p className="muted">Scan the plate with your phone camera, or type its number.</p>
        <JumpToPlate />
      </div>

      <div className="card">
        <div className="row">
          <h2 className="grow">Plates ({freeCount} free)</h2>
          <Link className={`btn ${show === "free" ? "" : "ghost"}`} href="/rep?show=free">Free</Link>
          <Link className={`btn ${show === "mine" ? "" : "ghost"}`} href="/rep?show=mine">Mine</Link>
          <Link className={`btn ${show === "all" ? "" : "ghost"}`} href="/rep?show=all">All</Link>
        </div>
        {shown.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            {show === "mine" ? "You have not activated any plates yet." : "No plates to show."}
          </p>
        ) : (
          <div className="grid" style={{ marginTop: 12 }}>
            {shown.slice(0, 600).map((p) => (
              <Link
                key={p.number}
                href={`/rep/activate/${p.number}`}
                className={`cell ${p.locked ? "locked" : p.review_url ? "on" : "free"}`}
                aria-label={`Plate ${p.number}${p.review_url ? ", activated" : ", free"}`}
              >
                {p.number}
              </Link>
            ))}
          </div>
        )}
        {shown.length > 600 && (
          <p className="muted" style={{ marginTop: 12 }}>
            Showing the first 600. Type a plate number above to open any other plate.
          </p>
        )}
      </div>

      <div className="card">
        <h2>My recent activations</h2>
        {(mine ?? []).length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Plate</th><th>Shop</th><th>When</th></tr></thead>
              <tbody>
                {(mine ?? []).map((m) => (
                  <tr key={m.number}>
                    <td><Link href={`/rep/activate/${m.number}`}>{m.number}</Link></td>
                    <td>{m.shop_name}</td>
                    <td>{m.activated_at ? new Date(m.activated_at).toLocaleString("en-IN") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
