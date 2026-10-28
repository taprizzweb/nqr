import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentProfile();
  if (!me) redirect("/login");
  redirect(me.role === "admin" ? "/admin" : "/rep");
}
