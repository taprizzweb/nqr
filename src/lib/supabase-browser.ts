import { createBrowserClient } from "@supabase/ssr";

// Browser-only client. Kept separate from supabase.ts because that file
// imports next/headers, which cannot be bundled into client components.
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
