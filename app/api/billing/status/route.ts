import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { createAdminClient } from "../../../../lib/supabase/admin";
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Entre na conta." }, { status: 401 });
  const db = createAdminClient();
  const { data: c, error: customerError } = await db
    .from("customer_accounts")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (customerError)
    return NextResponse.json(
      { error: "Não foi possível consultar a conta." },
      { status: 500 },
    );
  if (!c) return NextResponse.json({ payment: null });
  const { data: p, error } = await db
    .from("billing_payments")
    .select(
      "reference,status,method,amount,paid_plan,review_note,proof_path,promo_ends_at,landing_page_bonus",
    )
    .eq("customer_id", c.id)
    .eq("provider", "Manual")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Não foi possível consultar o pedido." },
      { status: 500 },
    );
  return NextResponse.json({
    payment: p
      ? {
          reference: p.reference,
          plan: p.paid_plan,
          status: p.status,
          method: p.method,
          amount: p.amount,
          message: p.review_note,
          hasProof: Boolean(p.proof_path),
          promoEndsAt: p.promo_ends_at,
          landingPageBonus: p.landing_page_bonus,
        }
      : null,
  });
}
