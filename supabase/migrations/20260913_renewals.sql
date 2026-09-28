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
