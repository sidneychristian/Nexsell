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
