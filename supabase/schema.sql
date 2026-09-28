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

-- Campanha única de 24 horas. Datas UTC; apresentação em Africa/Maputo.
create table if not exists public.landing_campaign (
 id text primary key check(id='launch-landing-v1'),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 check(ends_at=starts_at+interval '24 hours')
);
alter table public.landing_campaign enable row level security;
revoke all on public.landing_campaign from anon,authenticated;

alter table public.billing_payments add column if not exists promo_starts_at timestamptz;
alter table public.billing_payments add column if not exists promo_ends_at timestamptz;
alter table public.billing_payments add column if not exists paid_plan text;
alter table public.billing_payments add column if not exists landing_page_bonus boolean not null default false;

create or replace function public.get_landing_campaign()
returns jsonb language plpgsql security definer set search_path=public as $$
declare c landing_campaign;
begin
 insert into landing_campaign(id,starts_at,ends_at) values('launch-landing-v1',now(),now()+interval '24 hours') on conflict(id) do nothing;
 select * into c from landing_campaign where id='launch-landing-v1';
 return jsonb_build_object('startsAt',c.starts_at,'endsAt',c.ends_at,'serverNow',clock_timestamp());
end $$;
revoke all on function public.get_landing_campaign() from public,anon,authenticated;
grant execute on function public.get_landing_campaign() to service_role;

create or replace function public.snapshot_landing_offer()
returns trigger language plpgsql security definer set search_path=public as $$
declare campaign landing_campaign; c customer_accounts;
begin
 select * into c from customer_accounts where id=new.customer_id;
 new.paid_plan:=c.plan;
 if new.provider='Manual' and new.status='pending' and c.plan in ('Starter','Growth')
 and not exists(select 1 from billing_payments where customer_id=c.id and status='paid') then
 perform get_landing_campaign();
 select * into campaign from landing_campaign where id='launch-landing-v1';
 if now()>=campaign.starts_at and now()<campaign.ends_at then
 new.promo_starts_at:=campaign.starts_at;new.promo_ends_at:=campaign.ends_at;
 end if;
 end if;
 return new;
end $$;
revoke all on function public.snapshot_landing_offer() from public,anon,authenticated;
drop trigger if exists capture_landing_offer on public.billing_payments;
create trigger capture_landing_offer before insert on public.billing_payments for each row execute function public.snapshot_landing_offer();

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
 if b.id is not null then return jsonb_build_object('reference',b.reference,'status',b.status,'method',b.method,'amount',b.amount,'message',b.review_note,'promoEndsAt',b.promo_ends_at,'landingPageBonus',b.landing_page_bonus);end if;
 end if;
 insert into customer_accounts(id,name,email,phone,company,plan,monthly_amount,payment_method)
 values('customer_'||gen_random_uuid(),p_name,p_email,p_phone,p_company,plan_name,price,p_method)
 on conflict(email) do update set name=p_name,phone=p_phone,company=p_company,plan=plan_name,monthly_amount=price,payment_method=p_method returning * into c;
 insert into billing_payments(id,customer_id,provider,reference,method,amount,status)
 values('billing_'||gen_random_uuid(),c.id,'Manual','NXS-'||gen_random_uuid(),p_method,price,'pending') returning * into b;
 return jsonb_build_object('reference',b.reference,'status',b.status,'method',b.method,'amount',b.amount,'promoEndsAt',b.promo_ends_at,'landingPageBonus',b.landing_page_bonus);
end $$;

drop function if exists public.review_manual_payment(text,boolean,text,text);
create or replace function public.review_manual_payment(p_payment text,p_approve boolean,p_note text,p_actor text,p_paid_at timestamptz default null)
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
 if p_paid_at is null or p_paid_at>clock_timestamp() or p_paid_at<b.created_at-interval '1 day' then raise exception 'Valid payment timestamp required';end if;
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
 update billing_payments set organization_id=o,status='paid',paid_at=p_paid_at,landing_page_bonus=(b.paid_plan in ('Starter','Growth') and b.promo_starts_at is not null and b.promo_ends_at is not null and p_paid_at>=b.promo_starts_at and p_paid_at<b.promo_ends_at and not exists(select 1 from billing_payments other where other.customer_id=c.id and other.id<>b.id and other.landing_page_bonus)),reviewed_at=now(),reviewed_by=p_actor,review_note=p_note where id=b.id;
end $$;

revoke all on function public.manual_checkout(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.manual_checkout(text,text,text,text,text,text) to service_role;
revoke all on function public.review_manual_payment(text,boolean,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.review_manual_payment(text,boolean,text,text,timestamptz) to service_role;

-- Consolidado: 20260911_product_integrity.sql
-- Aplicar depois das migrações anteriores. Transaccional; não elimina registos.
begin;
-- A conta operacional do administrador pode não ter uma data de facturação.
alter table public.subscriptions alter column next_billing_at drop not null;

create table if not exists public.admin_audit (
 id text primary key default gen_random_uuid()::text,
 actor text not null, action text not null, customer_id text,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon,authenticated;

create or replace function public.plan_limits(p_plan text) returns jsonb
language sql immutable set search_path=public as $$
 select case lower(p_plan)
 when 'scale' then '{"agents":5,"knowledge_resources":250,"catalog_items":1000,"leads":20000,"memberships":15,"automations":100,"messages":10000}'::jsonb
 when 'growth' then '{"agents":2,"knowledge_resources":50,"catalog_items":100,"leads":5000,"memberships":5,"automations":25,"messages":1000}'::jsonb
 else '{"agents":1,"knowledge_resources":10,"catalog_items":20,"leads":1000,"memberships":2,"automations":3,"messages":500}'::jsonb end;
$$;

-- A ordem é estável: uma redução preserva todos os dados e permite os N mais antigos.
create or replace function public.agent_allowed(p_org text,p_agent text) returns boolean
language sql stable set search_path=public as $$
 select exists(select 1 from (
   select a.id,row_number() over(order by a.created_at,a.id) as position
   from ai_agents a where a.organization_id=p_org
 ) ranked join subscriptions s on s.organization_id=p_org
 where ranked.id=p_agent and ranked.position<=(plan_limits(s.plan)->>'agents')::int
 and s.status in ('active','trial') and (s.next_billing_at is null or s.next_billing_at>now()));
$$;

create or replace function public.enforce_capacity() returns trigger
language plpgsql set search_path=public as $$
declare s subscriptions; capacity int; used int; dimension text;
begin
 select * into s from subscriptions where organization_id=new.organization_id for update;
 if s.id is null or s.status not in ('active','trial') or s.next_billing_at<=now() then
   raise exception 'SUBSCRIPTION_INACTIVE' using errcode='P0001';
 end if;
 dimension:=case when tg_table_name='ai_agents' then 'agents' else tg_table_name end;
 capacity:=(plan_limits(s.plan)->>dimension)::int;
 if tg_op='UPDATE' then
   if tg_table_name='ai_agents' then
     if new.status='active' and not agent_allowed(new.organization_id,new.id) then raise exception 'PLAN_LIMIT_REACHED';end if;
     return new;
   end if;
   if tg_table_name='automations' and (new.status<>'ativa' or old.status='ativa') then return new;end if;
 end if;
 if tg_table_name='automations' then
   if new.status<>'ativa' then return new;end if;
   select count(*) into used from automations where organization_id=new.organization_id and status='ativa';
 else
   execute format('select count(*) from public.%I where organization_id=$1',tg_table_name) into used using new.organization_id;
 end if;
 if used>=capacity then raise exception 'PLAN_LIMIT_REACHED' using errcode='P0001';end if;
 return new;
end $$;

do $$declare t text;begin
 foreach t in array array['ai_agents','knowledge_resources','catalog_items','leads','memberships','automations'] loop
 execute format('drop trigger if exists enforce_capacity on public.%I',t);
 execute format('create trigger enforce_capacity before insert on public.%I for each row execute function public.enforce_capacity()',t);
 end loop;
end $$;
drop trigger if exists enforce_agent_activation on ai_agents;
create trigger enforce_agent_activation before update of status on ai_agents for each row execute function enforce_capacity();
drop trigger if exists enforce_automation_activation on automations;
create trigger enforce_automation_activation before update of status on automations for each row execute function enforce_capacity();

-- Réserva a franquia antes de chamar a API externa. O bloqueio serializa pedidos concorrentes.
create or replace function public.enforce_agent_run() returns trigger
language plpgsql set search_path=public as $$
declare s subscriptions;used int;
begin
 select * into s from subscriptions where organization_id=new.organization_id for update;
 if not agent_allowed(new.organization_id,new.agent_id) then raise exception 'PLAN_LIMIT_REACHED';end if;
 if new.channel<>'test' and not exists(select 1 from ai_agents where id=new.agent_id and status='active') then raise exception 'AGENT_NOT_ACTIVE';end if;
 if new.channel='whatsapp' and lower(s.plan)='starter' then raise exception 'PLAN_UPGRADE_REQUIRED';end if;
 select count(*) into used from agent_runs where organization_id=new.organization_id
 and created_at>=date_trunc('month',now() at time zone 'Africa/Maputo') at time zone 'Africa/Maputo'
 and status<>'failed';
 if used>=(plan_limits(s.plan)->>'messages')::int then raise exception 'PLAN_LIMIT_REACHED';end if;
 return new;
end $$;
drop trigger if exists enforce_agent_run on agent_runs;
create trigger enforce_agent_run before insert on agent_runs for each row execute function enforce_agent_run();

-- Evita ligações entre empresas mesmo em operações feitas com a chave de serviço.
create or replace function public.check_tenant_links() returns trigger
language plpgsql set search_path=public as $$
declare j jsonb:=to_jsonb(new);key text;t text;parent_org text;
begin
 foreach key in array array['lead_id','proposal_id','agent_id'] loop
 if nullif(j->>key,'') is not null then
 t:=case key when 'lead_id' then 'leads' when 'proposal_id' then 'proposals' else 'ai_agents' end;
 execute format('select organization_id from public.%I where id=$1',t) into parent_org using j->>key;
 if parent_org is distinct from new.organization_id then raise exception 'TENANT_MISMATCH';end if;
 end if;
 end loop;
 if tg_table_name='agent_resources' then
 t:=case new.resource_kind when 'knowledge' then 'knowledge_resources' when 'catalog' then 'catalog_items' end;
 if t is null then raise exception 'INVALID_RESOURCE';end if;
 execute format('select organization_id from public.%I where id=$1',t) into parent_org using new.resource_id;
 if parent_org is distinct from new.organization_id then raise exception 'TENANT_MISMATCH';end if;
 end if;
 return new;
end $$;
do $$declare t text;begin
 foreach t in array array['activities','tasks','proposals','payments','agent_resources','agent_runs','agent_approvals'] loop
 execute format('drop trigger if exists tenant_links on public.%I',t);
 execute format('create trigger tenant_links before insert or update on public.%I for each row execute function public.check_tenant_links()',t);
 end loop;
end $$;

-- Configuração e associações numa única transacção. Editar invalida o teste anterior.
create or replace function public.save_agent(p_org text,p_actor uuid,p_id text,p_data jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare a text:=coalesce(p_id,'agent_'||gen_random_uuid());r text;
begin
 if p_id is not null and not exists(select 1 from ai_agents where id=p_id and organization_id=p_org) then raise exception 'AGENT_NOT_FOUND';end if;
 if p_id is null then
 insert into ai_agents(id,organization_id,name,role,objective,tone,language,instructions,handoff_message,handoff_keywords,created_by,status)
 values(a,p_org,p_data->>'name',p_data->>'role',p_data->>'objective',p_data->>'tone',p_data->>'language',p_data->>'instructions',p_data->>'handoffMessage',p_data->'handoffKeywords',p_actor,'draft');
 else
 update ai_agents set name=p_data->>'name',role=p_data->>'role',objective=p_data->>'objective',tone=p_data->>'tone',language=p_data->>'language',instructions=p_data->>'instructions',handoff_message=p_data->>'handoffMessage',handoff_keywords=p_data->'handoffKeywords',status='draft',last_tested_at=null,updated_at=now() where id=a and organization_id=p_org;
 end if;
 delete from agent_resources where organization_id=p_org and agent_id=a;
 for r in select distinct jsonb_array_elements_text(p_data->'knowledgeIds') loop
 insert into agent_resources(id,organization_id,agent_id,resource_id,resource_kind) values('link_'||gen_random_uuid(),p_org,a,r,'knowledge');
 end loop;
 for r in select distinct jsonb_array_elements_text(p_data->'catalogIds') loop
 insert into agent_resources(id,organization_id,agent_id,resource_id,resource_kind) values('link_'||gen_random_uuid(),p_org,a,r,'catalog');
 end loop;
 return a;
end $$;
revoke all on function public.save_agent(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_agent(text,uuid,text,jsonb) to service_role;

create or replace function public.manage_customer(p_id text,p_actor text,p_plan text default null,p_status text default null)
returns void language plpgsql security definer set search_path=public as $$
declare c customer_accounts; price numeric;
begin
 select * into c from customer_accounts where id=p_id for update;
 if c.id is null then raise exception 'CUSTOMER_NOT_FOUND';end if;
 if p_plan is not null then
 price:=case p_plan when 'Starter' then 2490 when 'Growth' then 4990 when 'Scale' then 8990 end;
 if price is null then raise exception 'INVALID_PLAN';end if;
 update customer_accounts set plan=p_plan,monthly_amount=price where id=p_id;
 update subscriptions set plan=p_plan,monthly_amount=price where organization_id=c.organization_id;
 end if;
 if p_status is not null then
 if p_status not in ('active','suspended') or (p_status='active' and c.access_status<>'suspended') then raise exception 'REVIEW_PAYMENT_FIRST';end if;
 update customer_accounts set access_status=p_status where id=p_id;
 -- Reactivar não prolonga a data de validade.
 update subscriptions set status=p_status where organization_id=c.organization_id;
 end if;
 insert into admin_audit(actor,action,customer_id,details) values(p_actor,'manage_customer',p_id,jsonb_build_object('oldPlan',c.plan,'plan',p_plan,'status',p_status));
end $$;
revoke all on function public.manage_customer(text,text,text,text) from public,anon,authenticated;
grant execute on function public.manage_customer(text,text,text,text) to service_role;

-- Um resultado por cliente; a atribuição continua a depender da transferência verificada.
create unique index if not exists one_landing_bonus_per_customer on billing_payments(customer_id) where landing_page_bonus;
create or replace function public.snapshot_landing_offer()
returns trigger language plpgsql security definer set search_path=public as $$
declare campaign landing_campaign;c customer_accounts;
begin
 select * into c from customer_accounts where id=new.customer_id;
 new.paid_plan:=coalesce(new.paid_plan,c.plan);
 if new.provider='Manual' and new.paid_plan in ('Starter','Growth')
 and not exists(select 1 from billing_payments where customer_id=c.id and status='paid') then
 perform get_landing_campaign();select * into campaign from landing_campaign where id='launch-landing-v1';
 -- Conserva o prazo global mesmo em pedidos posteriores: o pagamento, não a aprovação, decide.
 new.promo_starts_at:=campaign.starts_at;new.promo_ends_at:=campaign.ends_at;
 end if;
 return new;
end $$;

create or replace function public.review_manual_payment(p_payment text,p_approve boolean,p_note text,p_actor text,p_paid_at timestamptz default null)
returns void language plpgsql security definer set search_path=public as $$
declare b billing_payments;c customer_accounts;o text;bonus boolean;
begin
 select * into b from billing_payments where id=p_payment and provider='Manual' for update;
 if b.id is null or b.status<>'under_review' or b.proof_path is null then raise exception 'PAYMENT_NOT_REVIEWABLE';end if;
 select * into c from customer_accounts where id=b.customer_id for update;
 if not p_approve then
 if length(trim(p_note))<3 then raise exception 'REASON_REQUIRED';end if;
 update billing_payments set status='rejected',review_note=p_note,reviewed_by=p_actor,reviewed_at=now() where id=b.id;
 update customer_accounts set payment_status='rejected' where id=c.id;
 insert into admin_audit(actor,action,customer_id,details) values(p_actor,'payment_rejected',c.id,jsonb_build_object('payment',b.id,'reason',p_note));
 return;
 end if;
 if p_paid_at is null or p_paid_at>clock_timestamp() then raise exception 'VALID_PAYMENT_TIMESTAMP_REQUIRED';end if;
 if nullif(trim(b.transfer_reference),'') is null then raise exception 'REFERENCE_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtext(upper(b.method)||':'||upper(trim(b.transfer_reference))));
 if exists(select 1 from billing_payments where id<>b.id and upper(method)=upper(b.method) and upper(trim(transfer_reference))=upper(trim(b.transfer_reference)) and status='paid') then raise exception 'TRANSFER_ALREADY_USED';end if;
 o:=c.organization_id;
 if o is null then o:='org_'||gen_random_uuid();insert into organizations(id,name) values(o,coalesce(nullif(c.company,''),c.name));end if;
 -- O pacote e o preço do pedido são imutáveis: uma alteração posterior no admin não os troca.
 insert into subscriptions(id,organization_id,plan,status,monthly_amount,next_billing_at)
 values('sub_'||gen_random_uuid(),o,coalesce(b.paid_plan,c.plan),'active',b.amount,now()+interval '30 days')
 on conflict(organization_id) do update set plan=excluded.plan,status='active',monthly_amount=excluded.monthly_amount,next_billing_at=greatest(subscriptions.next_billing_at,now())+interval '30 days';
 bonus:=coalesce(b.paid_plan in ('Starter','Growth') and p_paid_at>=b.promo_starts_at and p_paid_at<b.promo_ends_at
 and not exists(select 1 from billing_payments other where other.customer_id=c.id and other.id<>b.id and (other.landing_page_bonus or (other.status='paid' and other.paid_plan in ('Starter','Growth')))),false);
 update customer_accounts set organization_id=o,plan=coalesce(b.paid_plan,c.plan),monthly_amount=b.amount,access_status='active',payment_status='paid',activated_at=now() where id=c.id;
 update billing_payments set organization_id=o,status='paid',paid_at=p_paid_at,landing_page_bonus=bonus,reviewed_at=now(),reviewed_by=p_actor,review_note=p_note where id=b.id;
 insert into admin_audit(actor,action,customer_id,details) values(p_actor,'payment_approved',c.id,jsonb_build_object('payment',b.id,'paidAt',p_paid_at,'landingPageBonus',bonus));
end $$;

-- Criar um cliente fora do site, verificar pagamento e activar de forma atómica.
create or replace function public.create_manual_customer(p_data jsonb,p_actor text) returns text
language plpgsql security definer set search_path=public as $$
declare c text:='customer_'||gen_random_uuid();b text:='billing_'||gen_random_uuid();price numeric;
begin
 price:=case p_data->>'plan' when 'Starter' then 2490 when 'Growth' then 4990 when 'Scale' then 8990 end;
 if price is null then raise exception 'INVALID_PLAN';end if;
 insert into customer_accounts(id,name,email,phone,company,plan,monthly_amount,payment_method,notes)
 values(c,p_data->>'name',lower(trim(p_data->>'email')),p_data->>'phone',p_data->>'company',p_data->>'plan',price,p_data->>'paymentMethod',p_data->>'notes');
 insert into billing_payments(id,customer_id,provider,reference,method,amount,status,transfer_reference,proof_path)
 values(b,c,'Manual','MANUAL-'||gen_random_uuid(),p_data->>'paymentMethod',price,'under_review',p_data->>'reference','admin-verified');
 perform review_manual_payment(b,true,'Pagamento conferido e registado directamente pelo administrador.',p_actor,(p_data->>'paidAt')::timestamptz);
 update billing_payments set proof_path=null where id=b;
 return c;
end $$;
revoke all on function public.create_manual_customer(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_manual_customer(jsonb,text) to service_role;
revoke all on function public.plan_limits(text),public.agent_allowed(text,text),public.enforce_capacity(),public.enforce_agent_run(),public.check_tenant_links() from public,anon,authenticated;
grant execute on function public.plan_limits(text),public.agent_allowed(text,text) to service_role;

-- Comprovativos sempre privados; não alterar o conteúdo de objectos existentes.
update storage.buckets set public=false where id in ('payment-proofs','nexsell-uploads');
commit;


-- Consolidado: 20260912_connections.sql
begin;
create table if not exists public.connection_secrets (
 organization_id text not null references organizations(id) on delete cascade,
 provider text not null check(provider='whatsapp'),
 encrypted_value text not null,
 updated_at timestamptz not null default now(),
 primary key(organization_id,provider)
);
alter table public.connection_secrets enable row level security;
revoke all on public.connection_secrets from public,anon,authenticated;
grant all on public.connection_secrets to service_role;
commit;


-- Consolidado: 20260913_renewals.sql
begin;

-- Inicialização atómica e repetível da área do administrador, sem dados fictícios.
create or replace function public.ensure_admin_workspace(p_user uuid,p_email text,p_name text)
returns text language plpgsql security definer set search_path=public as $$
declare o text;
begin
 perform pg_advisory_xact_lock(hashtext(lower(p_email)));
 select organization_id into o from memberships where user_id=p_user or user_email=lower(p_email) limit 1;
 if o is not null then return o;end if;
 o:='org_'||gen_random_uuid();
 insert into organizations(id,name) values(o,'Minha empresa');
 insert into subscriptions(id,organization_id,plan,status,monthly_amount,next_billing_at)
 values('sub_'||gen_random_uuid(),o,'Scale','active',8990,null);
 insert into memberships(id,organization_id,user_id,user_email,display_name,role)
 values('member_'||gen_random_uuid(),o,p_user,lower(p_email),p_name,'owner');
 insert into admin_audit(actor,action,details) values(p_email,'initialize_admin_workspace',jsonb_build_object('organizationId',o));
 return o;
end $$;
revoke all on function public.ensure_admin_workspace(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ensure_admin_workspace(uuid,text,text) to service_role;

-- Uma renovação pendente não altera o pacote nem a validade em utilização.
create or replace function public.manual_checkout(p_email text,p_name text,p_phone text,p_company text,p_plan text,p_method text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c customer_accounts;b billing_payments;price numeric;plan_name text;
begin
 p_email:=lower(trim(p_email));
 perform pg_advisory_xact_lock(hashtext(p_email));
 price:=case p_plan when 'starter' then 2490 when 'growth' then 4990 when 'scale' then 8990 end;
 plan_name:=initcap(p_plan);
 if price is null or p_method not in ('EMOLA','BCI') then raise exception 'INVALID_PLAN';end if;
 select * into c from customer_accounts where email=p_email for update;
 if c.id is not null then
  select * into b from billing_payments where customer_id=c.id and provider='Manual' and status in ('pending','under_review','rejected') order by created_at desc limit 1;
 else
  -- Uma conta de colaborador não pode tornar-se proprietária de outra empresa pelo checkout.
  if exists(select 1 from memberships where user_email=p_email) then raise exception 'MEMBER_ACCOUNT';end if;
  insert into customer_accounts(id,name,email,phone,company,plan,monthly_amount,payment_method)
  values('customer_'||gen_random_uuid(),p_name,p_email,p_phone,p_company,plan_name,price,p_method) returning * into c;
 end if;
 if b.id is null then
  insert into billing_payments(id,customer_id,provider,reference,method,amount,status,paid_plan)
  values('billing_'||gen_random_uuid(),c.id,'Manual','NXS-'||gen_random_uuid(),p_method,price,'pending',plan_name) returning * into b;
 end if;
 return jsonb_build_object('reference',b.reference,'status',b.status,'method',b.method,'amount',b.amount,'plan',b.paid_plan,'message',b.review_note,'promoEndsAt',b.promo_ends_at,'landingPageBonus',b.landing_page_bonus);
end $$;

-- A primeira subscrição elegível, mesmo que haja um pagamento Scale anterior.
create or replace function public.snapshot_landing_offer()
returns trigger language plpgsql security definer set search_path=public as $$
declare campaign landing_campaign;c customer_accounts;
begin
 select * into c from customer_accounts where id=new.customer_id;
 new.paid_plan:=coalesce(new.paid_plan,c.plan);
 if new.provider='Manual' and new.paid_plan in ('Starter','Growth')
 and not exists(select 1 from billing_payments where customer_id=c.id and status='paid' and (paid_plan in ('Starter','Growth') or landing_page_bonus)) then
  perform get_landing_campaign();
  select * into campaign from landing_campaign where id='launch-landing-v1';
  new.promo_starts_at:=campaign.starts_at;new.promo_ends_at:=campaign.ends_at;
 end if;
 return new;
end $$;
commit;

-- Consolidado: 20260914_whatsapp_signup.sql
begin;
alter table public.connection_secrets add column if not exists phone_number_id text;
alter table public.connection_secrets add column if not exists waba_id text;
alter table public.connection_secrets add column if not exists display_number text;
create unique index if not exists unique_whatsapp_number on public.connection_secrets(phone_number_id) where phone_number_id is not null;
create table if not exists public.whatsapp_signup_sessions(
 id uuid primary key default gen_random_uuid(),
 organization_id text not null references organizations(id) on delete cascade,
 user_id uuid not null,
 expires_at timestamptz not null default now()+interval '15 minutes',
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.whatsapp_signup_sessions enable row level security;
revoke all on public.whatsapp_signup_sessions from public,anon,authenticated;
grant all on public.whatsapp_signup_sessions to service_role;

-- O número fica reservado à empresa antes de haver alterações na Meta.
create table if not exists public.whatsapp_number_claims(
 phone_number_id text primary key,
 organization_id text not null references organizations(id) on delete cascade,
 encrypted_registration text,
 created_at timestamptz not null default now()
);
alter table public.whatsapp_number_claims enable row level security;
revoke all on public.whatsapp_number_claims from public,anon,authenticated;
grant all on public.whatsapp_number_claims to service_role;
create or replace function public.claim_whatsapp_number(p_org text,p_phone text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('wa:'||p_phone));
 if exists(select 1 from connection_secrets where phone_number_id=p_phone and organization_id<>p_org)
 or exists(select 1 from whatsapp_number_claims where phone_number_id=p_phone and organization_id<>p_org) then raise exception 'WHATSAPP_NUMBER_IN_USE';end if;
 insert into whatsapp_number_claims(phone_number_id,organization_id) values(p_phone,p_org) on conflict(phone_number_id) do nothing;
end $$;
revoke all on function public.claim_whatsapp_number(text,text) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_number(text,text) to service_role;
create or replace function public.save_whatsapp_connection(p_org text,p_phone text,p_waba text,p_display text,p_encrypted text,p_actor text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from subscriptions where organization_id=p_org and plan in ('Growth','Scale') and status in ('active','trial') and (next_billing_at is null or next_billing_at>now())) then raise exception 'SUBSCRIPTION_INACTIVE';end if;
 perform claim_whatsapp_number(p_org,p_phone);
 insert into connection_secrets(organization_id,provider,encrypted_value,phone_number_id,waba_id,display_number,updated_at)
 values(p_org,'whatsapp',p_encrypted,p_phone,p_waba,p_display,now())
 on conflict(organization_id,provider) do update set encrypted_value=excluded.encrypted_value,phone_number_id=excluded.phone_number_id,waba_id=excluded.waba_id,display_number=excluded.display_number,updated_at=now();
 update integrations set status='verificada',last_sync_at=now() where organization_id=p_org and provider='whatsapp';
 if not found then insert into integrations(id,organization_id,provider,label,status,last_sync_at) values('int_'||gen_random_uuid(),p_org,'whatsapp','WhatsApp Business','verificada',now());end if;
 insert into admin_audit(actor,action,details) values(p_actor,'whatsapp_connected',jsonb_build_object('organizationId',p_org,'phoneNumberId',p_phone));
end $$;
revoke all on function public.save_whatsapp_connection(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_whatsapp_connection(text,text,text,text,text,text) to service_role;
commit;

begin;
create table if not exists public.whatsapp_device_links (
 organization_id text primary key references public.organizations(id) on delete cascade,
 instance_name text not null unique default ('nx_'||replace(gen_random_uuid()::text,'-','')),
 state text not null default 'close' check(state in ('open','close','connecting','disconnecting')),
 last_pair_at timestamptz,
 checked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.whatsapp_device_links add column if not exists phone text;
create unique index if not exists whatsapp_device_phone_unique on public.whatsapp_device_links(phone) where phone is not null;
alter table public.whatsapp_device_links enable row level security;
revoke all on public.whatsapp_device_links from anon,authenticated;
grant all on public.whatsapp_device_links to service_role;
create or replace function public.prepare_whatsapp_device(p_org text) returns text language plpgsql security definer set search_path=public as $$
declare v public.whatsapp_device_links;
begin
 perform pg_advisory_xact_lock(hashtextextended('device:'||p_org,0));
 if not exists(select 1 from subscriptions where organization_id=p_org and plan in ('Growth','Scale') and status in ('active','trial') and (next_billing_at is null or next_billing_at>now())) then raise exception 'PLAN_UPGRADE_REQUIRED';end if;
 insert into whatsapp_device_links(organization_id) values(p_org) on conflict do nothing;
 select * into v from whatsapp_device_links where organization_id=p_org for update;
 if v.state='disconnecting' then raise exception 'DISCONNECT_PENDING';end if;
 if v.last_pair_at>now()-interval '30 seconds' then raise exception 'PAIR_RATE_LIMIT';end if;
 update whatsapp_device_links set last_pair_at=now() where organization_id=p_org;
 return v.instance_name;
end $$;
revoke all on function public.prepare_whatsapp_device(text) from public,anon,authenticated;
grant execute on function public.prepare_whatsapp_device(text) to service_role;
commit;
