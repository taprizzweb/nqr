import Link from "next/link";
import { serverClient } from "@/lib/supabase";
import ActivateForm from "@/components/ActivateForm";
import ConfirmStep from "@/components/ConfirmStep";

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
    .select("number,shop_name,shop_address,review_url,activated_by,confirmed_at,locked")
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
  const pending = !!plate.review_url && !plate.confirmed_at;

  // Pending and mine: step 2 (test the QR, then confirm) or change the link.
  if (pending && mine && !plate.locked) {
    return (
      <ConfirmStep
        number={n}
        shop={plate.shop_name ?? ""}
        address={plate.shop_address ?? ""}
        reviewUrl={plate.review_url!}
      />
    );
  }

  // Everything else that is already set: read-only for reps.
  if (plate.review_url) {
    return (
      <div className="card">
        <h1>Plate {n} is already set</h1>
        <p><b>{plate.shop_name}</b></p>
        <p className="muted">{plate.shop_address}</p>
        <div className="msg warn">
          {plate.locked
            ? "This plate is locked. Only the admin can change it."
            : pending
            ? "Another rep has set this plate and is still checking it."
            : "This plate is confirmed. Only the admin can change it."}
        </div>
        <div className="row">
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

  return <ActivateForm number={n} editing={false} current={null} />;
}
