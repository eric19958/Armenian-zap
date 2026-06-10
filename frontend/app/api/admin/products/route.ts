import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";
import { adminRpc } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const data = await adminRpc("inchka_admin_search_products", {
      p_q: q,
      p_limit: 25,
    });
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  if (!isAdminSession()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  try {
    await adminRpc("inchka_admin_update_product", {
      p_product_id: body.product_id,
      p_canonical_name: body.canonical_name ?? "",
      p_brand: body.brand ?? "",
      p_category: body.category ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
