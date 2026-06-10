import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { adminRpc } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await adminRpc("inchka_admin_stats");
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("inchka_admin") || msg.includes("PGRST202")) {
      return NextResponse.json(
        { error: "Run migrations/0013_admin_rpc.sql in Supabase SQL editor" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
