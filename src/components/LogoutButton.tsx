"use client";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="ghost"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
