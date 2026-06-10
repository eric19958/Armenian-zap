import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { adminRpc } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { offer_id, product_id } = await req.json();
  try {
    await adminRpc("inchka_link_offer", {
      p_offer_id: offer_id,
      p_product_id: product_id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
