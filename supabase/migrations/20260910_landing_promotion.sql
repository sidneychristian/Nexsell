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
