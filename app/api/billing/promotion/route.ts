import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await createAdminClient().rpc(
      "get_landing_campaign",
    );
    if (error) throw error;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Campanha indisponível." },
      { status: 503 },
    );
  }
}
