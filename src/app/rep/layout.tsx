import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function RepLayout({ children }: { children: React.ReactNode }) {
  const me = await currentProfile();
  if (!me) redirect("/login");
  return (
    <div className="wrap">
      <div className="nav">
        <Link href="/rep">Plates</Link>
        {me.role === "admin" && <Link href="/admin">Admin</Link>}
        <span className="grow" />
        <span className="muted" style={{ alignSelf: "center" }}>{me.full_name}</span>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
