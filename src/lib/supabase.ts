import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Server client that carries the logged-in user's session (RLS applies). */
export async function serverClient() {
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component: middleware refreshes the session */
        }
      },
    },
  });
}

/** Anonymous client with no session. Used by the public redirect only. */
export function anonClient() {
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Service-role client. Server only. Never import in client components. */
export function serviceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: "admin" | "rep";
  active: boolean;
};

export async function currentProfile(): Promise<Profile | null> {
  const sb = await serverClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await sb.from("profiles").select("*").eq("id", data.user.id).single();
  if (!p || !p.active) return null;
  return p as Profile;
}
