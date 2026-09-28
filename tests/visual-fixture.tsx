// Só é montado por scripts/visual-harness.mjs em desenvolvimento. Nunca publicar a rota /review.
"use client";
import { useEffect, useState } from "react";
import { NexSellApp } from "@/app/nexsell-app";
import { PublicHome } from "@/app/public-home";
import { PLAN_ACCESS } from "@/app/plans";
import { notFound } from "next/navigation";
const now = new Date().toISOString();
const user = {
  displayName: "Equipa de revisão",
  email: "review@example.test",
  fullName: "Equipa de revisão",
};
const leads = [
  {
    id: "lead-qa",
    name: "Contacto de demonstração",
    company: "Empresa de demonstração",
    phone: "840000000",
    email: "contact@example.test",
    source: "Website",
    interest: "Pedido de orçamento",
    stage: "qualificado",
    score: 0,
    temperature: "morno",
    owner: "Equipa",
    value: 2500,
    location: "Maputo",
    nextAction: "Enviar proposta",
    consent: true,
    updatedAt: now,
  },
  {
    id: "lead-qa-2",
    name: "Segundo contacto",
    company: "Dados fictícios",
    phone: "850000000",
    email: "contact2@example.test",
    source: "Indicação",
    interest: "Serviço",
    stage: "novo",
    score: 0,
    temperature: "morno",
    owner: "Equipa",
    value: 0,
    location: "Maputo",
    nextAction: "Marcar conversa",
    consent: false,
    updatedAt: now,
  },
];
const customer = {
  id: "customer-qa",
  name: "Cliente de demonstração",
  email: "client@example.test",
  phone: "840000000",
  company: "Empresa de demonstração",
  plan: "Starter",
  accessStatus: "pending",
  paymentMethod: "EMOLA",
  paymentStatus: "under_review",
  monthlyAmount: 2490,
  externalPaymentReference: "QA-123",
  createdAt: now,
  activatedAt: null,
};
const payment = {
  id: "billing-qa",
  customerId: customer.id,
  provider: "Manual",
  reference: "NXS-EXEMPLO-REVIEW",
  method: "EMOLA",
  amount: 2490,
  status: "under_review",
  createdAt: now,
  paidAt: null,
  proofPath: "fixture.pdf",
  transferReference: "QA-123",
  promoEndsAt: new Date(Date.now() + 3600000).toISOString(),
  landingPageBonus: false,
  paidPlan: "Starter",
};
const snapshot = {
  organization: { name: "Empresa de demonstração" },
  leads,
  activities: [
    {
      id: "activity-qa",
      leadId: "lead-qa",
      direction: "inbound",
      body: "Mensagem fictícia para revisão da interface.",
      status: "recebido",
      createdAt: now,
    },
  ],
  tasks: [],
  automations: [],
  proposals: [],
  payments: [],
  campaigns: [],
  integrations: [],
  subscription: {
    plan: "Growth",
    monthlyAmount: 4990,
    status: "active",
    nextBillingAt: now,
  },
  customers: [customer],
  billingPayments: [payment],
  currentRole: "owner",
  isPlatformAdmin: true,
  planKey: "growth",
  planLimits: PLAN_ACCESS.growth.limits,
  members: [
    {
      id: "member-qa",
      displayName: "Equipa de revisão",
      userEmail: user.email,
      role: "owner",
    },
  ],
};
const agents = {
  agents: [
    {
      id: "agent-qa",
      name: "Agente de demonstração",
      role: "Agente de vendas",
      objective:
        "Responder sobre os serviços da empresa e encaminhar pedidos para a equipa.",
      tone: "consultivo",
      language: "Português",
      status: "draft",
      instructions: "Não inventar.",
      handoff_message: "A equipa irá acompanhar o pedido.",
      handoff_keywords: ["pessoa"],
      last_tested_at: null,
      published_at: null,
      updated_at: now,
      planBlocked: false,
    },
  ],
  resources: [
    {
      id: "resource-qa",
      name: "Informação de demonstração",
      resource_type: "text",
      status: "ready",
      content_text: "Texto de teste",
      source_url: "",
      mime_type: "",
      file_size: 0,
      created_at: now,
    },
  ],
  catalog: [
    {
      id: "item-qa",
      name: "Serviço de demonstração",
      item_type: "Serviço",
      price: 2500,
      currency: "MZN",
      description: "Descrição fictícia para testar a apresentação do catálogo.",
      image_keys: [],
      status: "active",
      created_at: now,
    },
  ],
  approvals: [],
  links: [],
  planKey: "growth",
  limits: PLAN_ACCESS.growth.limits,
  usage: { agentMessages: 0 },
};
export default function VisualFixture() {
  const [ready, setReady] = useState(false),
    [surface, setSurface] = useState("workspace"),
    [mobile, setMobile] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setSurface(q.get("surface") || "workspace");
    setMobile(q.get("mobile") === "1");
    const original = window.fetch;
    window.fetch = async (input, options) => {
      const url = String(input);
      const payload =
        url === "/api/nexsell"
          ? snapshot
          : url === "/api/agents"
            ? agents
            : url === "/api/billing/promotion"
              ? {
                  startsAt: now,
                  endsAt: new Date(Date.now() + 3600000).toISOString(),
                  serverNow: now,
                }
              : url === "/api/billing/status"
                ? { payment: { ...payment, plan: "Starter" } }
                : null;
      if (url.startsWith("/api/"))
        return new Response(
          JSON.stringify(
            payload ?? { error: "Integração desactivada no cenário visual." },
          ),
          {
            status: payload ? 200 : 409,
            headers: { "Content-Type": "application/json" },
          },
        );
      return original(input, options);
    };
    setReady(true);
    return () => {
      window.fetch = original;
    };
  }, []);
  if (process.env.NODE_ENV !== "development") notFound();
  if (!ready) return <p>A preparar o cenário de revisão…</p>;
  return (
    <>
      <div
        style={{
          position: "relative",
          zIndex: 80,
          background: "#352D1A",
          color: "#F6D576",
          padding: 8,
          fontSize: 14,
          textAlign: "center",
        }}
      >
        Revisão visual — dados fictícios, sem acesso a serviços externos.
      </div>
      {mobile ? (
        <iframe
          title="Revisão mobile 390px"
          style={{
            display: "block",
            width: 390,
            height: 844,
            margin: "20px auto",
            border: "1px solid #52677F",
          }}
          src={"/review?surface=" + surface}
        />
      ) : surface === "public" ? (
        <PublicHome />
      ) : surface === "billing" ? (
        <PublicHome signedIn />
      ) : (
        <NexSellApp user={user} />
      )}
    </>
  );
}
