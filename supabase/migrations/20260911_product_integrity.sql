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
