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
