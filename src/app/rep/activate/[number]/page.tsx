import Link from "next/link";
import { serverClient } from "@/lib/supabase";
import ActivateForm from "@/components/ActivateForm";

export const dynamic = "force-dynamic";

export default async function ActivatePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number.parseInt(number, 10);
  if (!Number.isInteger(n) || n < 1) {
    return <div className="card"><h1>Invalid plate number</h1><Link href="/rep">Back to plates</Link></div>;
  }

  const sb = await serverClient();
  const { data: u } = await sb.auth.getUser();
  const { data: plate } = await sb
    .from("plates")
    .select("number,shop_name,shop_address,review_url,activated_by,activated_at,locked")
    .eq("number", n)
    .maybeSingle();

  if (!plate) {
    return (
      <div className="card">
        <h1>Plate {n} does not exist</h1>
        <p className="muted">Check the number printed under the QR code.</p>
        <Link className="btn ghost" href="/rep">Back to plates</Link>
      </div>
    );
  }

  const mine = plate.activated_by === u.user!.id;
  const withinWindow =
    !!plate.activated_at && Date.now() - new Date(plate.activated_at).getTime() < 60 * 60 * 1000;

  // Taken by someone else, locked, or past the fix window: read-only.
  if (plate.review_url && !(mine && withinWindow && !plate.locked)) {
    return (
      <div className="card">
        <h1>Plate {n} is already activated</h1>
        <p><b>{plate.shop_name}</b></p>
        <p className="muted">{plate.shop_address}</p>
        <div className="msg warn">
          {plate.locked
            ? "This plate is locked. Only the admin can change it."
            : "Only the admin can change an activated plate."}
        </div>
        <div className="row">
          <a className="btn ghost" href={plate.review_url} target="_blank" rel="noreferrer">Open review page</a>
          <Link className="btn ghost" href="/rep">Back to plates</Link>
        </div>
      </div>
    );
  }

  if (plate.locked) {
    return (
      <div className="card">
        <h1>Plate {n} is locked</h1>
        <p className="muted">Ask the admin to unlock it.</p>
        <Link className="btn ghost" href="/rep">Back to plates</Link>
      </div>
    );
  }

  return <ActivateForm number={n} fixing={!!plate.review_url} current={plate.shop_name} />;
}
