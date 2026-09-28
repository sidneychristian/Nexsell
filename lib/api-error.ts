import { NextResponse } from "next/server";
export function apiError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  const known: Record<string, string> = {
    PLAN_LIMIT_REACHED:
      "Atingiu um limite do pacote. Os seus dados estão guardados. Suba o pacote para continuar.",
    SUBSCRIPTION_INACTIVE:
      "A subscrição está suspensa ou terminou. Consulte o pagamento e contacte a equipa.",
    TENANT_MISMATCH: "Este registo não pertence à sua empresa.",
    TRANSFER_ALREADY_USED:
      "Esta referência já foi usada num pagamento aprovado.",
    PLAN_UPGRADE_REQUIRED: "Esta funcionalidade requer um pacote superior.",
  };
  const code = Object.keys(known).find((key) => message.includes(key));
  if (code)
    return NextResponse.json({ error: known[code], code }, { status: 403 });
  return NextResponse.json(
    {
      error:
        "Não foi possível concluir a operação. Verifique os dados e tente novamente.",
    },
    { status: 500 },
  );
}
export function subscriptionActive(
  s: { status?: string; next_billing_at?: string | null } | null | undefined,
) {
  return (
    !!s &&
    ["active", "trial"].includes(s.status ?? "") &&
    (!s.next_billing_at || Date.parse(s.next_billing_at) > Date.now())
  );
}
