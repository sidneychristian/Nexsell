import type { Customer, BillingPayment } from "./admin-view";
export type User = {
  displayName: string;
  email: string;
  fullName: string | null;
} | null;
export type Lead = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  interest: string;
  stage: string;
  score: number;
  temperature: string;
  owner: string;
  value: number;
  location: string;
  nextAction: string;
  consent: boolean;
  updatedAt: string;
};
export type Automation = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  status: string;
  runs: number;
  successRate: number;
  lastRunAt: string | null;
};
export type Proposal = {
  id: string;
  leadId: string;
  code: string;
  title: string;
  amount: number;
  status: string;
  paymentOption: string;
  dueDate: string;
};
export type Payment = {
  id: string;
  provider: string;
  amount: number;
  reference: string;
  status: string;
  createdAt: string;
};
export type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  spend: number;
  leads: number;
  sales: number;
  revenue: number;
};
export type Integration = {
  id: string;
  provider: string;
  label: string;
  status: string;
  lastSyncAt: string | null;
};
export type Task = {
  id: string;
  leadId: string | null;
  title: string;
  dueAt: string;
  status: string;
  priority: string;
};
export type ActivityRow = {
  id: string;
  leadId: string;
  body: string;
  status: string;
  direction?: string;
  createdAt: string;
};
export type Subscription = {
  plan: string;
  monthlyAmount: number;
  status: string;
  nextBillingAt?: string;
} | null;
export type Snapshot = {
  truncated?: boolean;
  contactCount?: number;
  organization: { name: string } | null;
  leads: Lead[];
  activities: ActivityRow[];
  tasks: Task[];
  automations: Automation[];
  proposals: Proposal[];
  payments: Payment[];
  campaigns: Campaign[];
  integrations: Integration[];
  subscription: Subscription;
  customers: Customer[];
  billingPayments: BillingPayment[];
  members?: {
    id: string;
    displayName: string;
    userEmail: string;
    role: string;
  }[];
  currentRole: string;
  isPlatformAdmin: boolean;
  planKey: string;
  planLimits: {
    users: number;
    contacts: number;
    activeAutomations: number;
    agents: number;
    knowledgeResources: number;
    catalogItems: number;
    monthlyAgentMessages: number;
  };
};
export type PostAction = Record<string, unknown>;
export type PostFn = (body: PostAction) => Promise<boolean>;
