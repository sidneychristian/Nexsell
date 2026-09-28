import { apiError, subscriptionActive } from "../../../lib/api-error";
import { sendWhatsAppText } from "../../../lib/whatsapp-send";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, isPlatformAdmin, normalizeEmail, type NexSellUser, } from "../../../lib/auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { activateCustomer, makeId } from "../../billing";
import { ACTION_FEATURES, NEXSELL_PLANS, PLAN_ACCESS, normalizePlanKey, planHasFeature, minimumPlanFor, } from "../../plans";
export const dynamic = "force-dynamic";
const actionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("create_task"),
        leadId: z.string().min(1),
        title: z.string().trim().min(2).max(160),
        dueAt: z.string().datetime(),
    }),
    z.object({
        action: z.literal("create_automation"),
        name: z.string().trim().min(2).max(120),
        trigger: z.string().trim().min(2).max(200),
        description: z.string().trim().min(2).max(300),
    }),
    z.object({
        action: z.literal("create_campaign"),
        name: z.string().trim().min(2).max(120),
        channel: z.string().trim().min(2).max(50),
        spend: z.number().nonnegative(),
        leads: z.number().int().nonnegative(),
        sales: z.number().int().nonnegative(),
        revenue: z.number().nonnegative(),
    }),
    z.object({
        action: z.literal("add_member"),
        name: z.string().trim().min(2).max(120),
        email: z.string().email(),
    }),
    z.object({
        action: z.literal("review_payment"),
        paymentId: z.string().min(1),
        approve: z.boolean(),
        paidAt: z.string().datetime().optional(),
        note: z.string().max(500).default(""),
    }),
    z.object({
        action: z.literal("create_lead"),
        name: z.string().min(2).max(100),
        company: z.string().max(120).default(""),
        phone: z.string().min(7).max(30),
        email: z.string().email().optional().or(z.literal("")),
        source: z.string().max(50),
        interest: z.string().max(100),
        value: z.number().nonnegative().default(0),
        consent: z.boolean().default(true),
    }),
    z.object({
        action: z.literal("update_stage"),
        leadId: z.string().min(1),
        stage: z.enum([
            "novo",
            "contactado",
            "qualificado",
            "proposta",
            "negociacao",
            "ganho",
            "perdido",
        ]),
    }),
    z.object({
        action: z.literal("send_message"),
        leadId: z.string().min(1),
        body: z.string().min(1).max(2000),
    }),
    z.object({
        action: z.literal("toggle_automation"),
        automationId: z.string().min(1),
        status: z.enum(["ativa", "pausada"]),
    }),
    z.object({
        action: z.literal("create_proposal"),
        leadId: z.string().min(1),
        title: z.string().min(2).max(160),
        amount: z.number().positive(),
        paymentOption: z.string().max(80),
    }),
    z.object({
        action: z.literal("record_payment"),
        leadId: z.string().optional(),
        proposalId: z.string().optional(),
        provider: z.enum(["M-Pesa", "e-Mola", "Transferência"]),
        amount: z.number().positive(),
        reference: z.string().max(100),
    }),
    z.object({ action: z.literal("test_n8n"), automationId: z.string().min(1) }),
    z.object({
        action: z.literal("create_customer"),
        name: z.string().min(2).max(100),
        email: z.string().email().max(160),
        phone: z.string().min(7).max(30),
        company: z.string().max(120).default(""),
        plan: z.enum(["Starter", "Growth", "Scale"]).default("Growth"),
        paidAt: z.string().datetime(),
        paymentMethod: z.enum(["EMOLA", "BCI", "Numerário", "Outro"]),
        amount: z.number().nonnegative().max(1000000).default(4990),
        reference: z.string().min(3).max(100),
        notes: z.string().max(500).default(""),
    }),
    z.object({
        action: z.literal("update_customer_status"),
        customerId: z.string().min(1),
        status: z.enum(["active", "suspended"]),
    }),
    z.object({
        action: z.literal("update_customer_plan"),
        customerId: z.string().min(1),
        plan: z.enum(["Starter", "Growth", "Scale"]),
    }),
]);
type Row = Record<string, unknown>;
const now = () => new Date();
const iso = () => now().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const camelKey = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
function camelRow(row: Row | null) {
    if (!row)
        return null;
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value]));
}
function camelRows(rows: Row[] | null) {
    return (rows ?? []).map((row) => camelRow(row));
}
function configured(provider: string) {
    const groups: Record<string, string[]> = {
        whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
        meta: ["META_APP_SECRET"],
        n8n: ["N8N_WEBHOOK_URL", "N8N_INBOUND_SECRET", "N8N_OUTBOUND_SECRET"],
        mpesa: ["PAGAR_API_KEY", "PAGAR_SIGNING_SECRET", "PAGAR_WEBHOOK_SECRET"],
        emola: ["PAGAR_API_KEY", "PAGAR_SIGNING_SECRET", "PAGAR_WEBHOOK_SECRET"],
        pagar: ["PAGAR_API_KEY", "PAGAR_SIGNING_SECRET", "PAGAR_WEBHOOK_SECRET"],
        ai: ["OPENAI_API_KEY"],
    };
    return Boolean(groups[provider]?.every((key) => process.env[key]));
}
async function seedAdminOrganization(user: NexSellUser) {
    const { data, error } = await createAdminClient().rpc("ensure_admin_workspace", { p_user: user.id, p_email: user.email, p_name: user.displayName });
    if (error)
        throw error;
    return { organizationId: String(data), role: "owner" };
}
async function getOrganization(user: NexSellUser) {
    const db = createAdminClient();
    const { data: byId } = await db
        .from("memberships")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
        .throwOnError();
    if (byId) {
        const { data: subscription } = await db
            .from("subscriptions")
            .select("status,next_billing_at")
            .eq("organization_id", byId.organization_id)
            .maybeSingle()
            .throwOnError();
        if (isPlatformAdmin(user.email) || subscriptionActive(subscription))
            return {
                organizationId: byId.organization_id as string,
                role: byId.role as string,
            };
        return null;
    }
    const { data: byEmail } = await db
        .from("memberships")
        .select("*")
        .eq("user_email", user.email)
        .maybeSingle()
        .throwOnError();
    if (byEmail) {
        const { data: subscription } = await db
            .from("subscriptions")
            .select("status,next_billing_at")
            .eq("organization_id", byEmail.organization_id)
            .maybeSingle()
            .throwOnError();
        if (!isPlatformAdmin(user.email) && !subscriptionActive(subscription))
            return null;
        await db
            .from("memberships")
            .update({ user_id: user.id, display_name: user.displayName })
            .eq("id", byEmail.id)
            .throwOnError();
        return {
            organizationId: byEmail.organization_id as string,
            role: byEmail.role as string,
        };
    }
    const { data: customer } = await db
        .from("customer_accounts")
        .select("*")
        .eq("email", user.email)
        .maybeSingle()
        .throwOnError();
    if (customer?.access_status === "active") {
        const organizationId = customer.organization_id;
        if (!organizationId)
            return null;
        const { data: subscription } = await db
            .from("subscriptions")
            .select("status,next_billing_at")
            .eq("organization_id", organizationId)
            .maybeSingle()
            .throwOnError();
        if (!subscriptionActive(subscription))
            return null;
        await db
            .from("memberships")
            .upsert({
            id: id("member"),
            organization_id: organizationId,
            user_id: user.id,
            user_email: user.email,
            display_name: user.displayName,
            role: "owner",
            created_at: iso(),
        }, { onConflict: "user_email" })
            .throwOnError();
        return { organizationId, role: "owner" };
    }
    if (!isPlatformAdmin(user.email))
        return null;
    return seedAdminOrganization(user);
}
async function snapshot(organizationId: string, role: string, admin: boolean) {
    const db = createAdminClient();
    const subscriptionResult = await db
        .from("subscriptions")
        .select("*", { count: "exact" })
        .eq("organization_id", organizationId)
        .maybeSingle()
        .throwOnError();
    const planKey = normalizePlanKey(String(subscriptionResult.data?.plan ?? "Starter"));
    const allowed = (feature: Parameters<typeof planHasFeature>[1]) => admin || planHasFeature(planKey, feature);
    const [organization, leads, activities, tasks, automations, proposals, payments, campaigns, integrations, subscription, customers, billing,] = await Promise.all([
        db
            .from("organizations")
            .select("*", { count: "exact" })
            .eq("id", organizationId)
            .maybeSingle(),
        db
            .from("leads")
            .select("*", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("updated_at", { ascending: false }),
        allowed("whatsapp")
            ? db
                .from("activities")
                .select("*", { count: "exact" })
                .eq("organization_id", organizationId)
                .order("created_at", { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [] }),
        db
            .from("tasks")
            .select("*", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("due_at"),
        db
            .from("automations")
            .select("*", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false }),
        allowed("proposals")
            ? db
                .from("proposals")
                .select("*", { count: "exact" })
                .eq("organization_id", organizationId)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        allowed("payments")
            ? db
                .from("payments")
                .select("*", { count: "exact" })
                .eq("organization_id", organizationId)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        allowed("campaigns")
            ? db
                .from("campaigns")
                .select("*", { count: "exact" })
                .eq("organization_id", organizationId)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        allowed("connections")
            ? db
                .from("integrations")
                .select("*", { count: "exact" })
                .eq("organization_id", organizationId)
            : Promise.resolve({ data: [] }),
        Promise.resolve(subscriptionResult),
        admin
            ? db
                .from("customer_accounts")
                .select("*", { count: "exact" })
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        admin
            ? db
                .from("billing_payments")
                .select("*", { count: "exact" })
                .order("created_at", { ascending: false })
                .limit(200)
            : Promise.resolve({ data: [] }),
    ]);
    const integrationRows: Row[] = (camelRows(integrations.data as Row[]) as Row[]).map((item) => ({
        ...item,
        status: configured(String(item.provider))
            ? item.lastSyncAt
                ? "verificada"
                : "configurada"
            : "por_configurar",
    }));
    for (const result of [
        organization,
        leads,
        activities,
        tasks,
        automations,
        proposals,
        payments,
        campaigns,
        integrations,
        subscription,
        customers,
        billing,
    ])
        if ("error" in result && result.error)
            throw result.error;
    const { data: members } = await db
        .from("memberships")
        .select("id,display_name,user_email,role")
        .eq("organization_id", organizationId)
        .throwOnError();
    const { data: secrets } = await db
        .from("connection_secrets")
        .select("provider")
        .eq("organization_id", organizationId)
        .throwOnError();
    const connectionRows = ["whatsapp", "n8n", "meta", "ai"].map((provider) => {
        const item = integrationRows.find((i) => i.provider === provider);
        const scoped = provider !== "whatsapp" ||
            process.env.NEXSELL_ORGANIZATION_ID === organizationId;
        const stored = secrets?.some((s) => s.provider === provider);
        return {
            ...item,
            id: item?.id ?? provider,
            provider,
            label: item?.label ?? provider,
            status: stored && process.env.CONNECTIONS_ENCRYPTION_KEY
                ? "verificada"
                : scoped && configured(provider)
                    ? "configurada"
                    : "por_configurar",
        };
    });
    const truncated = [
        leads,
        activities,
        tasks,
        automations,
        proposals,
        payments,
        campaigns,
        customers,
        billing,
    ].some((result) => "count" in result &&
        typeof result.count === "number" &&
        result.count > (result.data?.length ?? 0));
    return {
        truncated,
        contactCount: leads.count ?? leads.data?.length ?? 0,
        organization: camelRow(organization.data as Row),
        leads: camelRows(leads.data as Row[]),
        activities: camelRows(activities.data as Row[]),
        tasks: camelRows(tasks.data as Row[]),
        automations: camelRows(automations.data as Row[]),
        proposals: camelRows(proposals.data as Row[]),
        payments: camelRows(payments.data as Row[]),
        campaigns: camelRows(campaigns.data as Row[]),
        integrations: connectionRows,
        members: camelRows(members as Row[]),
        subscription: camelRow(subscription.data as Row),
        customers: camelRows(customers.data as Row[]),
        billingPayments: camelRows(billing.data as Row[]),
        currentRole: role,
        isPlatformAdmin: admin,
        planKey,
        planLimits: PLAN_ACCESS[planKey].limits,
    };
}
export async function GET() {
    const user = await getCurrentUser();
    if (!user)
        return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
    try {
        const access = await getOrganization(user);
        if (!access)
            return NextResponse.json({ error: "Esta conta ainda não tem uma subscrição ativa." }, { status: 403 });
        return NextResponse.json(await snapshot(access.organizationId, access.role, isPlatformAdmin(user.email)));
    }
    catch (error) {
        return apiError(error);
    }
}
export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user)
        return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
    try {
        const parsed = actionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
            return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
        const access = await getOrganization(user);
        if (!access)
            return NextResponse.json({ error: "Esta conta ainda não tem uma subscrição ativa." }, { status: 403 });
        const admin = isPlatformAdmin(user.email);
        const data = parsed.data;
        if (([
            "create_customer",
            "update_customer_status",
            "update_customer_plan",
            "review_payment",
        ] as string[]).includes(data.action) &&
            !admin)
            return NextResponse.json({ error: "Apenas o administrador pode gerir clientes." }, { status: 403 });
        const db = createAdminClient();
        const organizationId = access.organizationId;
        const changedAt = iso();
        const { data: subscription } = await db
            .from("subscriptions")
            .select("plan,status")
            .eq("organization_id", organizationId)
            .maybeSingle()
            .throwOnError();
        const planKey = normalizePlanKey(String(subscription?.plan ?? "Starter"));
        const requiredFeature = ACTION_FEATURES[data.action];
        if (!admin &&
            requiredFeature &&
            !planHasFeature(planKey, requiredFeature)) {
            const requiredPlan = minimumPlanFor(requiredFeature);
            return NextResponse.json({
                error: `Esta funcionalidade requer o plano ${requiredPlan.name}. Suba o seu pacote para continuar.`,
                code: "PLAN_UPGRADE_REQUIRED",
                requiredPlan: requiredPlan.name,
            }, { status: 403 });
        }
        if (!admin && data.action === "create_lead") {
            const { count } = await db
                .from("leads")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", organizationId)
                .throwOnError();
            if ((count ?? 0) >= PLAN_ACCESS[planKey].limits.contacts)
                return NextResponse.json({
                    error: `Atingiu o limite de ${PLAN_ACCESS[planKey].limits.contacts.toLocaleString("pt-MZ")} contactos do plano. Suba o seu pacote para adicionar mais leads.`,
                    code: "PLAN_LIMIT_REACHED",
                }, { status: 403 });
        }
        if (!admin &&
            data.action === "toggle_automation" &&
            data.status === "ativa") {
            const { count } = await db
                .from("automations")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", organizationId)
                .eq("status", "ativa")
                .throwOnError();
            if ((count ?? 0) >= PLAN_ACCESS[planKey].limits.activeAutomations)
                return NextResponse.json({
                    error: `Atingiu o limite de ${PLAN_ACCESS[planKey].limits.activeAutomations} automações ativas. Suba o seu pacote para continuar.`,
                    code: "PLAN_LIMIT_REACHED",
                }, { status: 403 });
        }
        for (const [key, table] of [
            ["leadId", "leads"],
            ["proposalId", "proposals"],
            ["automationId", "automations"],
        ] as const) {
            if (key in data && (data as Record<string, unknown>)[key]) {
                const { data: owned } = await db
                    .from(table)
                    .select("id")
                    .eq("id", String((data as Record<string, unknown>)[key]))
                    .eq("organization_id", organizationId)
                    .maybeSingle()
                    .throwOnError();
                if (!owned)
                    return NextResponse.json({ error: "Registo não encontrado nesta empresa." }, { status: 404 });
            }
        }
        if (data.action === "add_member") {
            if (access.role !== "owner")
                return NextResponse.json({ error: "Só o proprietário pode adicionar membros." }, { status: 403 });
            const email = normalizeEmail(data.email);
            const { data: exists } = await db
                .from("memberships")
                .select("id")
                .eq("user_email", email)
                .maybeSingle()
                .throwOnError();
            if (exists)
                return NextResponse.json({ error: "Este e-mail já pertence a uma empresa." }, { status: 409 });
            const { data: customer } = await db
                .from("customer_accounts")
                .select("id")
                .eq("email", email)
                .maybeSingle()
                .throwOnError();
            if (customer)
                return NextResponse.json({
                    error: "Este e-mail tem uma subscrição própria. Use outro endereço para o membro.",
                }, { status: 409 });
            await db
                .from("memberships")
                .insert({
                id: id("member"),
                organization_id: organizationId,
                user_email: email,
                display_name: data.name,
                role: "member",
            })
                .throwOnError();
        }
        else if (data.action === "create_task") {
            await db
                .from("tasks")
                .insert({
                id: id("task"),
                organization_id: organizationId,
                lead_id: data.leadId,
                title: data.title,
                due_at: data.dueAt,
            })
                .throwOnError();
            await db
                .from("leads")
                .update({ next_action: data.title, updated_at: changedAt })
                .eq("id", data.leadId)
                .eq("organization_id", organizationId)
                .throwOnError();
        }
        else if (data.action === "create_automation") {
            await db
                .from("automations")
                .insert({
                id: id("auto"),
                organization_id: organizationId,
                name: data.name,
                trigger: data.trigger,
                action: data.description,
                status: "pausada",
                runs: 0,
            })
                .throwOnError();
        }
        else if (data.action === "create_campaign") {
            await db
                .from("campaigns")
                .insert({
                id: id("camp"),
                organization_id: organizationId,
                name: data.name,
                channel: data.channel,
                spend: data.spend,
                leads: data.leads,
                sales: data.sales,
                revenue: data.revenue,
                status: "registada",
            })
                .throwOnError();
        }
        else if (data.action === "review_payment") {
            const { error } = await db.rpc("review_manual_payment", {
                p_payment: data.paymentId,
                p_approve: data.approve,
                p_note: data.note,
                p_actor: user.email,
                p_paid_at: data.paidAt ?? null,
            });
            if (error)
                return NextResponse.json({
                    error: "Verifique a data do pagamento, o comprovativo e se a transferência já foi aprovada.",
                }, { status: 409 });
        }
        else if (data.action === "create_lead") {
            await db
                .from("leads")
                .insert({
                id: id("lead"),
                organization_id: organizationId,
                name: data.name,
                company: data.company,
                phone: data.phone,
                email: data.email ?? "",
                source: data.source,
                interest: data.interest,
                stage: "novo",
                score: 0,
                temperature: "morno",
                owner: user.displayName,
                value: data.value,
                location: "Moçambique",
                next_action: "Contactar pelo WhatsApp",
                consent: data.consent,
                created_at: changedAt,
                updated_at: changedAt,
            })
                .throwOnError();
        }
        else if (data.action === "update_stage") {
            await db
                .from("leads")
                .update({ stage: data.stage, updated_at: changedAt })
                .eq("id", data.leadId)
                .eq("organization_id", organizationId)
                .throwOnError();
        }
        else if (data.action === "send_message") {
            const { data: lead } = await db
                .from("leads")
                .select("*")
                .eq("id", data.leadId)
                .eq("organization_id", organizationId)
                .maybeSingle()
                .throwOnError();
            if (!lead || !lead.consent)
                return NextResponse.json({ error: "O contacto não tem consentimento válido para mensagens." }, { status: 409 });
            const messageId = await sendWhatsAppText(organizationId, String(lead.phone), data.body);
            const status = "enviado";
            await db
                .from("activities")
                .insert({
                id: "wa_" + organizationId + "_" + messageId,
                organization_id: organizationId,
                lead_id: data.leadId,
                type: "mensagem",
                channel: "whatsapp",
                direction: "outbound",
                body: data.body,
                status,
                created_at: changedAt,
            })
                .throwOnError();
            await db
                .from("leads")
                .update({ last_contact_at: changedAt, updated_at: changedAt })
                .eq("id", data.leadId)
                .throwOnError();
        }
        else if (data.action === "toggle_automation") {
            await db
                .from("automations")
                .update({ status: data.status })
                .eq("id", data.automationId)
                .eq("organization_id", organizationId)
                .throwOnError();
        }
        else if (data.action === "create_proposal") {
            await db
                .from("proposals")
                .insert({
                id: id("prop"),
                organization_id: organizationId,
                lead_id: data.leadId,
                code: `NX-${String(Date.now()).slice(-6)}`,
                title: data.title,
                amount: data.amount,
                status: "rascunho",
                payment_option: data.paymentOption,
                due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
                created_at: changedAt,
            })
                .throwOnError();
            await db
                .from("leads")
                .update({
                stage: "proposta",
                value: data.amount,
                updated_at: changedAt,
            })
                .eq("id", data.leadId)
                .eq("organization_id", organizationId)
                .throwOnError();
        }
        else if (data.action === "record_payment") {
            await db
                .from("payments")
                .insert({
                id: id("pay"),
                organization_id: organizationId,
                lead_id: data.leadId ?? null,
                proposal_id: data.proposalId ?? null,
                provider: data.provider,
                amount: data.amount,
                reference: data.reference,
                status: "confirmado",
                created_at: changedAt,
            })
                .throwOnError();
        }
        else if (data.action === "test_n8n") {
            if (!process.env.N8N_WEBHOOK_URL || !process.env.N8N_OUTBOUND_SECRET)
                return NextResponse.json({ error: "Adicione N8N_WEBHOOK_URL na Vercel." }, { status: 409 });
            const response = await fetch(process.env.N8N_WEBHOOK_URL, {
                signal: AbortSignal.timeout(15000),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-nexsell-secret": process.env.N8N_OUTBOUND_SECRET ?? "",
                },
                body: JSON.stringify({
                    event: "manual_test",
                    organizationId,
                    automationId: data.automationId,
                    occurredAt: changedAt,
                }),
            });
            if (!response.ok)
                return NextResponse.json({ error: "O n8n não confirmou o teste." }, { status: 502 });
            await db
                .from("automations")
                .update({ last_run_at: changedAt })
                .eq("id", data.automationId)
                .eq("organization_id", organizationId)
                .throwOnError();
        }
        else if (data.action === "create_customer") {
            const { error } = await db.rpc("create_manual_customer", {
                p_data: { ...data, email: normalizeEmail(data.email) },
                p_actor: user.email,
            });
            if (error)
                throw error;
        }
        else if (data.action === "update_customer_status" ||
            data.action === "update_customer_plan") {
            const { error } = await db.rpc("manage_customer", {
                p_id: data.customerId,
                p_actor: user.email,
                p_plan: data.action === "update_customer_plan" ? data.plan : null,
                p_status: data.action === "update_customer_status" ? data.status : null,
            });
            if (error)
                throw error;
        }
        return NextResponse.json(await snapshot(organizationId, access.role, admin));
    }
    catch (error) {
        return apiError(error);
    }
}
