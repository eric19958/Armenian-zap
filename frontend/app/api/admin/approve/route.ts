import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { adminRpc } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { candidate_id } = await req.json();
  try {
    await adminRpc("inchka_admin_approve_match", {
      p_candidate_id: candidate_id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
