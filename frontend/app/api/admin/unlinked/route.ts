import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { adminRpc } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  try {
    const data = await adminRpc("inchka_admin_unlinked_offers", {
      p_limit: limit,
    });
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
