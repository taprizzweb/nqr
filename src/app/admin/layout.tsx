import Link from "next/link";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await currentProfile();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/rep");
  return (
    <div className="wrap">
      <div className="nav">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/plates">Plates</Link>
        <Link href="/admin/reps">Reps</Link>
        <Link href="/admin/generate">QR generator</Link>
        <Link href="/admin/history">History</Link>
        <Link href="/rep">Rep view</Link>
        <span className="grow" />
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
