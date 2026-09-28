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
