import { createAdminClient } from "../lib/supabase/admin";
import { isPlatformAdmin, normalizeEmail } from "../lib/auth";

export { isPlatformAdmin, normalizeEmail };
export const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export async function activateCustomer(customerId: string) {
  const db = createAdminClient();
  const { data: customer, error } = await db
    .from("customer_accounts")
    .select("*")
    .eq("id", customerId)
    .single();
  if (error || !customer) throw new Error("Cliente não encontrado.");
  let organizationId = customer.organization_id as string | null;
  const activatedAt = new Date();

  if (!organizationId) {
    organizationId = makeId("org");
    const { error: orgError } = await db.from("organizations").insert({
      id: organizationId,
      name: customer.company || customer.name,
      industry: "Vários sectores",
      country: "Moçambique",
      currency: "MZN",
      timezone: "Africa/Maputo",
      created_at: activatedAt.toISOString(),
    });
    if (orgError) throw orgError;
    const { error: subError } = await db.from("subscriptions").insert({
      id: makeId("sub"),
      organization_id: organizationId,
      plan: customer.plan,
      status: "active",
      monthly_amount: Number(customer.monthly_amount),
      next_billing_at: new Date(
        activatedAt.getTime() + 30 * 86400000,
      ).toISOString(),
      created_at: activatedAt.toISOString(),
    });
    if (subError) throw subError;
  } else {
    const { error: subError } = await db
      .from("subscriptions")
      .update({
        status: "active",
        plan: customer.plan,
        monthly_amount: Number(customer.monthly_amount),
        next_billing_at: new Date(
          activatedAt.getTime() + 30 * 86400000,
        ).toISOString(),
      })
      .eq("organization_id", organizationId);
    if (subError) throw subError;
  }

  const { error: updateError } = await db
    .from("customer_accounts")
    .update({
      organization_id: organizationId,
      access_status: "active",
      payment_status: "paid",
      activated_at: activatedAt.toISOString(),
    })
    .eq("id", customerId);
  if (updateError) throw updateError;
  return organizationId;
}
