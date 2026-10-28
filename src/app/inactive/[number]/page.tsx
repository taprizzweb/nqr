import Link from "next/link";
import { currentProfile } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Shown when someone scans a plate that has no shop yet.
// A logged-in rep also gets a shortcut to activate it.
export default async function Inactive({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number.parseInt(number, 10);
  const me = await currentProfile();
  const valid = Number.isInteger(n) && n > 0;

  return (
    <div className="wrap narrow">
      <div className="card">
        <h1>{valid ? `Plate ${n} is not activated yet` : "This plate is not valid"}</h1>
        <p className="muted">
          {valid
            ? "This Taprizz plate has not been linked to a shop yet. Please check back soon."
            : "Please check the QR code and try again."}
        </p>
        {me && valid && (
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn" href={`/rep/activate/${n}`}>Activate plate {n}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
