import { NextResponse } from "next/server";
import { currentProfile, serverClient } from "@/lib/supabase";

// CSV of every plate and its permanent short link, for the NFC tag supplier.
// Also usable as a backup of which shop each plate points to.
export const dynamic = "force-dynamic";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const me = await currentProfile();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const domain = process.env.NEXT_PUBLIC_SHORT_DOMAIN || "r.taprizz.in";
  const sb = await serverClient();
  const rows: string[] = ["number,short_link,shop_name,review_url"];

  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("plates")
      .select("number,shop_name,review_url")
      .order("number")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    data.forEach((p) =>
      rows.push([p.number, `https://${domain}/qr/${p.number}`, esc(p.shop_name), esc(p.review_url)].join(","))
    );
    if (data.length < 1000) break;
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="taprizz-plates-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
