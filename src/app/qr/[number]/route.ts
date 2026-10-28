import { NextRequest, NextResponse } from "next/server";
import { anonClient } from "@/lib/supabase";

// Public redirect used by both the printed QR and the NFC tag.
// 302 (not 301) so the destination can be changed later without cache problems.
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const origin = req.nextUrl.origin;

  if (!/^\d{1,6}$/.test(number) || Number.parseInt(number, 10) < 1) {
    return NextResponse.redirect(`${origin}/inactive/0`, 302);
  }
  const n = Number.parseInt(number, 10);

  const { data: url } = await anonClient().rpc("resolve_plate", {
    p_number: n,
    p_ua: req.headers.get("user-agent"),
  });

  if (typeof url === "string" && url.startsWith("https://")) {
    return NextResponse.redirect(url, 302);
  }
  return NextResponse.redirect(`${origin}/inactive/${n}`, 302);
}
