export const NEXSELL_PLANS = [
  {
    key: "starter",
    name: "Starter",
    monthlyAmount: 2490,
    audience: "Para começar a organizar as vendas",
    badge: "Entrada acessível",
    featured: false,
    features: [
      "2 utilizadores e 1.000 contactos",
      "CRM, funil e tarefas comerciais",
      "Captação de leads do website",
      "3 automações essenciais",
      "Registo manual de contactos e atividades",
      "1 agente IA e 500 respostas por mês",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    monthlyAmount: 4990,
    audience: "Para vender mais com automação",
    badge: "Vendas e automação",
    featured: true,
    features: [
      "5 utilizadores e 5.000 contactos",
      "Tudo do Starter",
      "WhatsApp, 2 agentes IA e automações n8n",
      "1.000 respostas de agentes por mês",
      "Propostas, pagamentos e relatórios",
      "Onboarding + 3 fluxos n8n incluídos",
    ],
  },
  {
    key: "scale",
    name: "Scale",
    monthlyAmount: 8990,
    audience: "Para equipas com maior volume",
    badge: "Maior capacidade",
    featured: false,
    features: [
      "15 utilizadores e 20.000 contactos",
      "Tudo do Growth",
      "5 agentes IA e 10.000 respostas por mês",
      "Automações e permissões avançadas",
      "Metas, desempenho e suporte prioritário",
      "Migração inicial de contactos incluída",
    ],
  },
] as const;

export type PlanKey = (typeof NEXSELL_PLANS)[number]["key"];

export type PlanFeature =
  | "crm"
  | "basic_automations"
  | "whatsapp"
  | "n8n"
  | "proposals"
  | "payments"
  | "reports"
  | "connections"
  | "ai"
  | "campaigns"
  | "team";

export const PLAN_ACCESS: Record<
  PlanKey,
  {
    features: readonly PlanFeature[];
    limits: {
      users: number;
      contacts: number;
      activeAutomations: number;
      agents: number;
      knowledgeResources: number;
      catalogItems: number;
      monthlyAgentMessages: number;
    };
  }
> = {
  starter: {
    features: ["crm", "basic_automations", "ai"],
    limits: {
      users: 2,
      contacts: 1000,
      activeAutomations: 3,
      agents: 1,
      knowledgeResources: 10,
      catalogItems: 20,
      monthlyAgentMessages: 500,
    },
  },
  growth: {
    features: [
      "crm",
      "basic_automations",
      "whatsapp",
      "n8n",
      "proposals",
      "payments",
      "reports",
      "connections",
      "ai",
    ],
    limits: {
      users: 5,
      contacts: 5000,
      activeAutomations: 25,
      agents: 2,
      knowledgeResources: 50,
      catalogItems: 100,
      monthlyAgentMessages: 1000,
    },
  },
  scale: {
    features: [
      "crm",
      "basic_automations",
      "whatsapp",
      "n8n",
      "proposals",
      "payments",
      "reports",
      "connections",
      "ai",
      "campaigns",
      "team",
    ],
    limits: {
      users: 15,
      contacts: 20000,
      activeAutomations: 100,
      agents: 5,
      knowledgeResources: 250,
      catalogItems: 1000,
      monthlyAgentMessages: 10000,
    },
  },
};

export const VIEW_FEATURES: Partial<Record<string, PlanFeature>> = {
  dashboard: "crm",
  leads: "crm",
  pipeline: "crm",
  inbox: "whatsapp",
  automations: "basic_automations",
  proposals: "proposals",
  campaigns: "campaigns",
  reports: "reports",
  connections: "connections",
  agents: "ai",
  knowledge: "ai",
  catalog: "ai",
  approvals: "ai",
};

export const ACTION_FEATURES: Partial<Record<string, PlanFeature>> = {
  create_task: "crm",
  create_automation: "basic_automations",
  create_campaign: "campaigns",
  create_lead: "crm",
  update_stage: "crm",
  send_message: "whatsapp",
  toggle_automation: "basic_automations",
  create_proposal: "proposals",
  record_payment: "payments",
  test_n8n: "n8n",
};

export function getNexSellPlan(key: string) {
  return NEXSELL_PLANS.find((plan) => plan.key === key) ?? null;
}

export function normalizePlanKey(value: string | null | undefined): PlanKey {
  const normalized = (value ?? "").trim().toLowerCase();
  return NEXSELL_PLANS.some((plan) => plan.key === normalized)
    ? (normalized as PlanKey)
    : "starter";
}

export function planHasFeature(plan: PlanKey, feature: PlanFeature) {
  return PLAN_ACCESS[plan].features.includes(feature);
}

export function minimumPlanFor(feature: PlanFeature) {
  return (
    NEXSELL_PLANS.find((plan) =>
      PLAN_ACCESS[plan.key].features.includes(feature),
    ) ?? NEXSELL_PLANS[2]
  );
}
