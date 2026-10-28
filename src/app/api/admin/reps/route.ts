import { NextRequest, NextResponse } from "next/server";
import { currentProfile, serviceClient } from "@/lib/supabase";

// Only an admin can create, switch off or reset reps. Uses the service key on the server.
async function adminOnly() {
  const me = await currentProfile();
  return me && me.role === "admin" ? me : null;
}

const loginEmail = (phone: string) => `${phone}@reps.taprizz.in`;

export async function POST(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { full_name, phone, pin } = await req.json();
  const ph = String(phone ?? "").replace(/\D/g, "").slice(-10);
  if (!String(full_name ?? "").trim() || ph.length !== 10) {
    return NextResponse.json({ error: "Enter a name and a 10-digit phone number." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN must be exactly 6 digits." }, { status: 400 });
  }

  const sb = serviceClient();
  const { data, error } = await sb.auth.admin.createUser({
    email: loginEmail(ph), password: String(pin), email_confirm: true,
  });
  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message.includes("already") ? "A rep with this phone number already exists." : "Could not create the rep." },
      { status: 400 }
    );
  }
  const { error: pe } = await sb.from("profiles").insert({
    id: data.user.id, full_name: String(full_name).trim(), phone: ph, role: "rep", active: true,
  });
  if (pe) {
    await sb.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "Could not create the rep." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const me = await adminOnly();
  if (!me) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id, active, pin } = await req.json();
  if (!id || id === me.id) return NextResponse.json({ error: "Invalid rep." }, { status: 400 });

  const sb = serviceClient();
  const { data: target } = await sb.from("profiles").select("role").eq("id", id).single();
  if (!target || target.role !== "rep") return NextResponse.json({ error: "Invalid rep." }, { status: 400 });

  if (typeof active === "boolean") {
    // Switching off blocks new logins and RLS cuts access on the very next request.
    await sb.from("profiles").update({ active }).eq("id", id);
    await sb.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  }
  if (pin !== undefined) {
    if (!/^\d{6}$/.test(String(pin))) return NextResponse.json({ error: "PIN must be exactly 6 digits." }, { status: 400 });
    await sb.auth.admin.updateUserById(id, { password: String(pin) });
  }
  return NextResponse.json({ ok: true });
}
