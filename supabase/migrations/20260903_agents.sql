-- Construtor de agentes e recursos
create table if not exists public.ai_agents (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  role text not null,
  objective text not null,
  tone text not null default 'profissional',
  language text not null default 'Português',
  instructions text not null default '',
  handoff_message text not null default 'Vou encaminhar a sua conversa para um membro da equipa.',
  handoff_keywords jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  last_tested_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_resources (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  resource_type text not null,
  content_text text not null default '',
  source_url text not null default '',
  storage_key text not null default '',
  mime_type text not null default '',
  file_size bigint not null default 0,
  status text not null default 'processing',
  error_message text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_items (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  item_type text not null default 'Produto',
  price numeric(14,2) not null default 0,
  currency text not null default 'MZN',
  description text not null default '',
  image_keys jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_resources (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  agent_id text not null references public.ai_agents(id) on delete cascade,
  resource_id text not null,
  resource_kind text not null,
  created_at timestamptz not null default now(),
  unique(agent_id, resource_id, resource_kind)
);

create table if not exists public.agent_approvals (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  agent_id text not null references public.ai_agents(id) on delete cascade,
  lead_id text references public.leads(id) on delete set null,
  conversation_id text not null default '',
  reason text not null,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  resolution_note text not null default '',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  agent_id text not null references public.ai_agents(id) on delete cascade,
  lead_id text references public.leads(id) on delete set null,
  conversation_id text not null default '',
  channel text not null default 'test',
  input_text text not null,
  output_text text not null default '',
  status text not null default 'completed',
  handed_off boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agent_runs add column if not exists conversation_id text not null default '';

create index if not exists idx_agents_organization on public.ai_agents(organization_id, updated_at desc);
create index if not exists idx_knowledge_organization on public.knowledge_resources(organization_id, created_at desc);
create index if not exists idx_catalog_organization on public.catalog_items(organization_id, created_at desc);
create index if not exists idx_agent_resources_agent on public.agent_resources(agent_id);
create index if not exists idx_agent_approvals_status on public.agent_approvals(organization_id, status, created_at desc);
create index if not exists idx_agent_runs_month on public.agent_runs(organization_id, created_at desc);
create index if not exists idx_agent_runs_conversation on public.agent_runs(organization_id, agent_id, conversation_id, created_at desc);

alter table public.ai_agents enable row level security;
alter table public.knowledge_resources enable row level security;
alter table public.catalog_items enable row level security;
alter table public.agent_resources enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_runs enable row level security;
