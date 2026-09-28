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
