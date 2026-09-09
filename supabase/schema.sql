-- NexSell — esquema inicial para Supabase/PostgreSQL
-- Execute este ficheiro uma única vez no SQL Editor do Supabase.

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  industry text not null default 'Serviços',
  country text not null default 'Moçambique',
  currency text not null default 'MZN',
  timezone text not null default 'Africa/Maputo',
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  display_name text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique(user_email)
);

create table if not exists public.leads (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  company text not null default '',
  phone text not null,
  email text not null default '',
  source text not null default 'Website',
  interest text not null default 'Informação',
  stage text not null default 'novo',
  score integer not null default 50,
  temperature text not null default 'morno',
  owner text not null default 'Sem responsável',
  value numeric(14,2) not null default 0,
  location text not null default 'Maputo',
  last_contact_at timestamptz,
  next_action text not null default 'Contactar pelo WhatsApp',
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text not null references public.leads(id) on delete cascade,
  type text not null,
  channel text not null default 'whatsapp',
  direction text not null default 'outbound',
  body text not null,
  status text not null default 'registado',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text references public.leads(id) on delete set null,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'pendente',
  priority text not null default 'média',
  created_at timestamptz not null default now()
);

create table if not exists public.automations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  trigger text not null,
  action text not null,
  status text not null default 'ativa',
  runs integer not null default 0,
  success_rate numeric(6,2) not null default 100,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text not null references public.leads(id) on delete cascade,
  code text not null,
  title text not null,
  amount numeric(14,2) not null,
  status text not null default 'rascunho',
  payment_option text not null default '50% adiantado',
  due_date timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  lead_id text references public.leads(id) on delete set null,
  proposal_id text references public.proposals(id) on delete set null,
  provider text not null,
  amount numeric(14,2) not null,
  reference text not null default '',
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null,
  status text not null default 'ativa',
  spend numeric(14,2) not null default 0,
  leads integer not null default 0,
  sales integer not null default 0,
  revenue numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'por_configurar',
  label text not null,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id, provider)
);

create table if not exists public.subscriptions (
  id text primary key,
  organization_id text not null unique references public.organizations(id) on delete cascade,
  plan text not null default 'Growth',
  status text not null default 'trial',
  monthly_amount numeric(14,2) not null default 4990,
  next_billing_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_accounts (
  id text primary key,
  organization_id text references public.organizations(id) on delete set null,
  name text not null,
  email text not null unique,
  phone text not null default '',
  company text not null default '',
  plan text not null default 'Growth',
  access_status text not null default 'pending',
  payment_method text not null default 'M-Pesa',
  payment_status text not null default 'pending',
  monthly_amount numeric(14,2) not null default 4990,
  external_payment_reference text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table if not exists public.billing_payments (
  id text primary key,
  customer_id text references public.customer_accounts(id) on delete set null,
  organization_id text references public.organizations(id) on delete set null,
  provider text not null default 'Pagar',
  provider_payment_id text not null default '',
  reference text not null unique,
  method text not null,
  amount numeric(14,2) not null,
  currency text not null default 'MZN',
  status text not null default 'pending',
  checkout_url text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_leads_organization_updated on public.leads(organization_id, updated_at desc);
create index if not exists idx_activities_organization_created on public.activities(organization_id, created_at desc);
create index if not exists idx_tasks_organization_due on public.tasks(organization_id, due_at);
create index if not exists idx_billing_payments_customer on public.billing_payments(customer_id, created_at desc);
create index if not exists idx_billing_provider_payment on public.billing_payments(provider_payment_id);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.automations enable row level security;
alter table public.proposals enable row level security;
alter table public.payments enable row level security;
alter table public.campaigns enable row level security;
alter table public.integrations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.billing_payments enable row level security;
alter table public.webhook_events enable row level security;

-- As tabelas são acedidas apenas pelas rotas seguras da Vercel com a Service Role.
-- Não crie políticas públicas para estas tabelas.

insert into storage.buckets (id, name, public)
values ('nexsell-uploads', 'nexsell-uploads', false)
on conflict (id) do nothing;

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
-- Pagamentos manuais: funções acessíveis apenas pelo servidor.
alter table public.billing_payments add column if not exists proof_path text;
alter table public.billing_payments add column if not exists transfer_reference text;
alter table public.billing_payments add column if not exists review_note text;
alter table public.billing_payments add column if not exists reviewed_by text;
alter table public.billing_payments add column if not exists reviewed_at timestamptz;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,3145728,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.manual_checkout(p_email text,p_name text,p_phone text,p_company text,p_plan text,p_method text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c customer_accounts; b billing_payments; price numeric; plan_name text;
begin
 perform pg_advisory_xact_lock(hashtext(p_email));
 price:=case p_plan when 'starter' then 2490 when 'growth' then 4990 when 'scale' then 8990 end;
 plan_name:=initcap(p_plan);
 if price is null or p_method not in ('EMOLA','BCI') then raise exception 'Invalid plan or method'; end if;
 select * into c from customer_accounts where email=p_email for update;
 if c.access_status='active' then raise exception 'Already active'; end if;
 if c.id is not null then
 select * into b from billing_payments where customer_id=c.id and provider='Manual' and status in ('pending','under_review','rejected') order by created_at desc limit 1;
 if b.id is not null then return jsonb_build_object('reference',b.reference,'status',b.status,'method',b.method,'amount',b.amount,'message',b.review_note);end if;
 end if;
 insert into customer_accounts(id,name,email,phone,company,plan,monthly_amount,payment_method)
 values('customer_'||gen_random_uuid(),p_name,p_email,p_phone,p_company,plan_name,price,p_method)
 on conflict(email) do update set name=p_name,phone=p_phone,company=p_company,plan=plan_name,monthly_amount=price,payment_method=p_method returning * into c;
 insert into billing_payments(id,customer_id,provider,reference,method,amount,status)
 values('billing_'||gen_random_uuid(),c.id,'Manual','NXS-'||gen_random_uuid(),p_method,price,'pending') returning * into b;
 return jsonb_build_object('reference',b.reference,'status',b.status,'method',b.method,'amount',b.amount);
end $$;

create or replace function public.submit_manual_proof(p_payment text,p_customer text,p_path text,p_transaction text)
returns void language plpgsql security definer set search_path=public as $$
declare b billing_payments;
begin
 select * into b from billing_payments where id=p_payment and customer_id=p_customer and provider='Manual' for update;
 if b.id is null or b.status not in ('pending','rejected') then raise exception 'Invalid payment state';end if;
 update billing_payments set proof_path=p_path,transfer_reference=p_transaction,status='under_review',review_note=null where id=b.id;
 update customer_accounts set payment_status='under_review' where id=p_customer;
end $$;

create or replace function public.review_manual_payment(p_payment text,p_approve boolean,p_note text,p_actor text)
returns void language plpgsql security definer set search_path=public as $$
declare b billing_payments;c customer_accounts;o text;
begin
 select * into b from billing_payments where id=p_payment and provider='Manual' for update;
 if b.id is null or b.status<>'under_review' or b.proof_path is null then raise exception 'Payment already reviewed or missing proof';end if;
 select * into c from customer_accounts where id=b.customer_id for update;
 if not p_approve then
 if length(trim(p_note))<3 then raise exception 'Reason required';end if;
 update billing_payments set status='rejected',review_note=p_note,reviewed_by=p_actor,reviewed_at=now() where id=b.id;
 update customer_accounts set payment_status='rejected' where id=c.id;
 return;
 end if;
 perform pg_advisory_xact_lock(hashtext(b.method||':'||b.transfer_reference));
 if exists(select 1 from billing_payments where id<>b.id and method=b.method and transfer_reference=b.transfer_reference and status='paid') then raise exception 'Transfer reference already used';end if;
 o:=c.organization_id;
 if o is null then
 o:='org_'||gen_random_uuid();
 insert into organizations(id,name) values(o,coalesce(nullif(c.company,''),c.name));
 end if;
 if exists(select 1 from subscriptions where organization_id=o) then
 update subscriptions set plan=c.plan,status='active',monthly_amount=c.monthly_amount,next_billing_at=greatest(next_billing_at,now())+interval '30 days' where organization_id=o;
 else
 insert into subscriptions(id,organization_id,plan,status,monthly_amount,next_billing_at) values('sub_'||gen_random_uuid(),o,c.plan,'active',c.monthly_amount,now()+interval '30 days');
 end if;
 update customer_accounts set organization_id=o,access_status='active',payment_status='paid',activated_at=now() where id=c.id;
 update billing_payments set organization_id=o,status='paid',paid_at=now(),reviewed_at=now(),reviewed_by=p_actor,review_note=p_note where id=b.id;
end $$;
revoke all on function public.manual_checkout(text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.submit_manual_proof(text,text,text,text) from public,anon,authenticated;
revoke all on function public.review_manual_payment(text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.manual_checkout(text,text,text,text,text,text) to service_role;
grant execute on function public.submit_manual_proof(text,text,text,text) to service_role;
grant execute on function public.review_manual_payment(text,boolean,text,text) to service_role;
