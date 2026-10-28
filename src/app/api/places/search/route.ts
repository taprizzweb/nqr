import { NextRequest, NextResponse } from "next/server";
import { currentProfile } from "@/lib/supabase";

// Shop search for reps. The Google key stays on the server.
export async function GET(req: NextRequest) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ results: [] });
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "Search is not set up yet." }, { status: 500 });
  }

  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: q, regionCode: "IN", pageSize: 8 }),
  });
  if (!r.ok) {
    return NextResponse.json({ error: "Search failed. Try again or paste the link." }, { status: 502 });
  }
  const j = (await r.json()) as {
    places?: { id: string; displayName?: { text: string }; formattedAddress?: string }[];
  };
  const results = (j.places ?? []).map((p) => ({
    place_id: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    review_url: `https://search.google.com/local/writereview?placeid=${p.id}`,
  }));
  return NextResponse.json({ results });
}
