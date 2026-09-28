import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Integridade de subscrições, empresas, agentes e campanha", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  await db.exec(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  for (const migration of [
    "20260911_product_integrity.sql",
    "20260912_connections.sql",
    "20260913_renewals.sql",
    "20260914_whatsapp_signup.sql",
    "20260915_whatsapp_device.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const scalar = async (sql, args = []) =>
    Object.values(await one(sql, args))[0];
  const query = (sql, args = []) => db.query(sql, args);
  const org = async (id, plan = "Starter") => {
    await query("insert into organizations(id,name) values($1,$1)", [id]);
    await query(
      "insert into subscriptions(id,organization_id,plan,status,monthly_amount,next_billing_at) values($1,$2,$3,'active',2490,now()+interval '30 days')",
      ["s" + id, id, plan],
    );
  };
  const agent = async (id, org) => {
    await query(
      "insert into ai_agents(id,organization_id,name,role,objective) values($1,$2,'Vendas','Vendas','Responder com conhecimento')",
      [id, org],
    );
  };
  await t.test("dispositivos são privados, têm uma sessão por empresa e controlo de plano", async()=>{
    await org("device-a","Growth");await org("device-b","Starter");
    const instance=await scalar("select prepare_whatsapp_device('device-a')");
    assert.match(instance,/^nx_[a-f0-9]{32}$/);
    await assert.rejects(scalar("select prepare_whatsapp_device('device-a')"),/PAIR_RATE_LIMIT/);
    await assert.rejects(scalar("select prepare_whatsapp_device('device-b')"),/PLAN_UPGRADE_REQUIRED/);
    await query("update whatsapp_device_links set phone='258841234567' where organization_id='device-a'");
    await assert.rejects(query("insert into whatsapp_device_links(organization_id,phone) values('device-b','258841234567')"),/unique/);
    await query("set role authenticated");
    await assert.rejects(query("select * from whatsapp_device_links"),/permission denied/);
    await query("reset role");
  });
  let campaign;
  await t.test("prazo global de 24h é persistente", async () => {
    campaign = await scalar("select get_landing_campaign()");
    const repeat = await scalar("select get_landing_campaign()");
    assert.equal(campaign.endsAt, repeat.endsAt);
    assert.equal(
      Date.parse(campaign.endsAt) - Date.parse(campaign.startsAt),
      86400000,
    );
  });
  await org("company-a");
  await org("company-b", "Growth");
  await t.test(
    "Starter permite exactamente um agente; Growth dois",
    async () => {
      await agent("a1", "company-a");
      await assert.rejects(agent("a2", "company-a"), /PLAN_LIMIT_REACHED/);
      await agent("b1", "company-b");
      await agent("b2", "company-b");
      await assert.rejects(agent("b3", "company-b"), /PLAN_LIMIT_REACHED/);
    },
  );
  await t.test(
    "redução de plano preserva agentes e bloqueia utilização excedente",
    async () => {
      await query(
        "update subscriptions set plan='Starter' where organization_id='company-b'",
      );
      assert.equal(
        await scalar(
          "select count(*)::int from ai_agents where organization_id='company-b'",
        ),
        2,
      );
      assert.equal(
        await scalar("select agent_allowed('company-b','b1')"),
        true,
      );
      assert.equal(
        await scalar("select agent_allowed('company-b','b2')"),
        false,
      );
      await assert.rejects(
        query(
          "insert into agent_runs(id,organization_id,agent_id,channel,input_text) values('blocked','company-b','b2','test','Olá')",
        ),
        /PLAN_LIMIT_REACHED/,
      );
    },
  );
  await t.test(
    "limite não pode ser ultrapassado por duas criações simultâneas",
    async () => {
      await org("race");
      const results = await Promise.allSettled([
        agent("race1", "race"),
        agent("race2", "race"),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await scalar(
          "select count(*)::int from ai_agents where organization_id='race'",
        ),
        1,
      );
    },
  );
  await t.test(
    "base de conhecimento e catálogo do Starter são utilizáveis",
    async () => {
      await query(
        "insert into knowledge_resources(id,organization_id,name,resource_type,content_text,status) values('ka','company-a','FAQ','text','Horário: 8 às 17','ready')",
      );
      await query(
        "insert into catalog_items(id,organization_id,name,price) values('ca','company-a','Serviço',250)",
      );
      await query(
        "insert into agent_resources(id,organization_id,agent_id,resource_id,resource_kind) values('linka','company-a','a1','ka','knowledge'),('linkc','company-a','a1','ca','catalog')",
      );
      assert.equal(
        await scalar(
          "select count(*)::int from agent_resources where agent_id='a1'",
        ),
        2,
      );
    },
  );
  await t.test("ligações entre empresas são rejeitadas pela BD", async () => {
    await assert.rejects(
      query(
        "insert into agent_resources(id,organization_id,agent_id,resource_id,resource_kind) values('evil','company-b','b1','ka','knowledge')",
      ),
      /TENANT_MISMATCH/,
    );
    await query(
      "insert into leads(id,organization_id,name,phone) values('la','company-a','Contacto','840000000')",
    );
    await assert.rejects(
      query(
        "insert into payments(id,organization_id,lead_id,provider,amount) values('evilpay','company-b','la','e-Mola',200)",
      ),
      /TENANT_MISMATCH/,
    );
  });
  await t.test(
    "guardar agente e recursos é atómico e invalida teste",
    async () => {
      const data = {
        name: "Nova configuração",
        role: "Vendas",
        objective: "Responder",
        tone: "consultivo",
        language: "Português",
        instructions: "Não inventar",
        handoffMessage: "Equipa",
        handoffKeywords: [],
        knowledgeIds: ["ka"],
        catalogIds: ["ca"],
      };
      await query("update ai_agents set last_tested_at=now() where id='a1'");
      await query("select save_agent($1,null,$2,$3)", [
        "company-a",
        "a1",
        data,
      ]);
      assert.equal(
        (await one("select * from ai_agents where id='a1'")).last_tested_at,
        null,
      );
      await assert.rejects(
        query("select save_agent($1,null,$2,$3)", [
          "company-a",
          "a1",
          { ...data, name: "Não guardar", knowledgeIds: ["invalid"] },
        ]),
        /TENANT_MISMATCH/,
      );
      assert.equal(
        await scalar("select name from ai_agents where id='a1'"),
        "Nova configuração",
      );
    },
  );
  await t.test(
    "franquia mensal é reservada antes da chamada e falhas não contam",
    async () => {
      await query(
        "insert into agent_runs(id,organization_id,agent_id,channel,input_text,status) select 'run'||g,'company-a','a1','test','Olá','processing' from generate_series(1,500) g",
      );
      await assert.rejects(
        query(
          "insert into agent_runs(id,organization_id,agent_id,input_text) values('over','company-a','a1','Olá')",
        ),
        /PLAN_LIMIT_REACHED/,
      );
      await query("update agent_runs set status='failed' where id='run1'");
      await query(
        "insert into agent_runs(id,organization_id,agent_id,input_text) values('retry','company-a','a1','Olá')",
      );
    },
  );
  await t.test("expiração de subscrição impede novas operações", async () => {
    await query(
      "update subscriptions set next_billing_at=now()-interval '1 day' where organization_id='race'",
    );
    await assert.rejects(
      query(
        "insert into leads(id,organization_id,name,phone) values('expired','race','Teste','840000000')",
      ),
      /SUBSCRIPTION_INACTIVE/,
    );
  });
  const checkout = async (email, plan = "starter") =>
    scalar(
      "select manual_checkout($1,'Cliente','840000000','Empresa',$2,'EMOLA')",
      [email, plan],
    );
  const payment = (ref) =>
    one("select * from billing_payments where reference=$1", [ref]);
  const proof = async (p) =>
    query("select submit_manual_proof($1,$2,$3,$4)", [
      p.id,
      p.customer_id,
      p.customer_id + "/proof.pdf",
      "TX-" + p.id,
    ]);
  await t.test(
    "comprovativo não activa; recusa com motivo permite novo envio",
    async () => {
      const out = await checkout("proof@example.test"),
        p = await payment(out.reference);
      await proof(p);
      assert.equal(
        await scalar(
          "select access_status from customer_accounts where id=$1",
          [p.customer_id],
        ),
        "pending",
      );
      await assert.rejects(
        query("select review_manual_payment($1,false,$2,$3,null)", [
          p.id,
          "",
          "admin@example.test",
        ]),
        /REASON_REQUIRED/,
      );
      await query("select review_manual_payment($1,false,$2,$3,null)", [
        p.id,
        "Imagem ilegível",
        "admin@example.test",
      ]);
      await proof(p);
      assert.equal((await payment(out.reference)).status, "under_review");
    },
  );
  // Um prazo terminado e datas reais dentro desse prazo, para verificar aprovação tardia.
  await query(
    "update landing_campaign set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour'",
  );
  await t.test(
    "aprovação tardia preserva oferta; pacote do pedido é imutável",
    async () => {
      const out = await checkout("ontime@example.test"),
        p = await payment(out.reference);
      await proof(p);
      await query(
        "update customer_accounts set plan='Scale',monthly_amount=8990 where id=$1",
        [p.customer_id],
      );
      await query(
        "select review_manual_payment($1,true,'Verificado','admin@example.test',now()-interval '2 hours')",
        [p.id],
      );
      const paid = await payment(out.reference);
      assert.equal(paid.landing_page_bonus, true);
      assert.equal(paid.reviewed_by, "admin@example.test");
      assert.equal(
        await scalar(
          "select plan from subscriptions where organization_id=$1",
          [paid.organization_id],
        ),
        "Starter",
      );
      assert.equal(Number(paid.amount), 2490);
      await assert.rejects(
        query(
          "select review_manual_payment($1,true,'Verificado','admin@example.test',now()-interval '2 hours')",
          [p.id],
        ),
        /PAYMENT_NOT_REVIEWABLE/,
      );
    },
  );
  await t.test(
    "transferência após o prazo e plano Scale não recebem bónus",
    async () => {
      for (const [email, plan] of [
        ["late@example.test", "starter"],
        ["scale@example.test", "scale"],
      ]) {
        const out = await checkout(email, plan),
          p = await payment(out.reference);
        await proof(p);
        await query(
          "select review_manual_payment($1,true,'Verificado','admin@example.test',now())",
          [p.id],
        );
        assert.equal((await payment(out.reference)).landing_page_bonus, false);
      }
    },
  );
  await t.test(
    "referência de transferência não pode activar duas contas",
    async () => {
      const paid = await one(
          "select * from billing_payments where status='paid' limit 1",
        ),
        out = await checkout("duplicate@example.test"),
        p = await payment(out.reference);
      await query("select submit_manual_proof($1,$2,$3,$4)", [
        p.id,
        p.customer_id,
        "proof.pdf",
        paid.transfer_reference,
      ]);
      await assert.rejects(
        query(
          "select review_manual_payment($1,true,'Verificado','admin@example.test',now())",
          [p.id],
        ),
        /TRANSFER_ALREADY_USED/,
      );
    },
  );
  await t.test(
    "criação manual tem auditoria; suspender/reactivar mantém validade",
    async () => {
      const data = {
        name: "Cliente manual",
        email: "manual@example.test",
        phone: "840000000",
        company: "Empresa",
        plan: "Growth",
        paymentMethod: "BCI",
        reference: "BCI-TEST-1",
        notes: "Teste",
        paidAt: new Date(Date.now() - 7200000).toISOString(),
      };
      const id = await scalar("select create_manual_customer($1,$2)", [
        data,
        "admin@example.test",
      ]);
      const c = await one("select * from customer_accounts where id=$1", [id]);
      const expiry = await scalar(
        "select next_billing_at::text from subscriptions where organization_id=$1",
        [c.organization_id],
      );
      await query(
        "select manage_customer($1,'admin@example.test',null,'suspended')",
        [id],
      );
      await query(
        "select manage_customer($1,'admin@example.test',null,'active')",
        [id],
      );
      assert.equal(
        await scalar(
          "select next_billing_at::text from subscriptions where organization_id=$1",
          [c.organization_id],
        ),
        expiry,
      );
      assert.equal(
        await scalar(
          "select count(*)::int from admin_audit where customer_id=$1",
          [id],
        ),
        3,
      );
    },
  );
  await t.test(
    "RLS e RPCs administrativos não são acessíveis pelo cliente",
    async () => {
      for (const role of ["anon", "authenticated"])
        for (const fn of [
          "review_manual_payment(text,boolean,text,text,timestamp with time zone)",
          "create_manual_customer(jsonb,text)",
          "save_agent(text,uuid,text,jsonb)",
          "manage_customer(text,text,text,text)",
        ])
          assert.equal(
            await scalar("select has_function_privilege($1,$2,$3)", [
              role,
              fn,
              "EXECUTE",
            ]),
            false,
          );
      await db.exec(
        "grant usage on schema public to authenticated;grant select on all tables in schema public to authenticated;set role authenticated;",
      );
      assert.equal((await query("select * from leads")).rows.length, 0);
      assert.equal(
        (await query("select * from billing_payments")).rows.length,
        0,
      );
      await db.exec("reset role;");
      assert.equal(
        await scalar(
          "select public from storage.buckets where id='payment-proofs'",
        ),
        false,
      );
    },
  );
  await t.test(
    "renovação mantém pacote e validade até aprovação e não repete bónus",
    async () => {
      const c = await one(
        "select * from customer_accounts where email='ontime@example.test'",
      );
      const expiry = await scalar(
        "select next_billing_at::text from subscriptions where organization_id=$1",
        [c.organization_id],
      );
      const out = await checkout(c.email, "growth"),
        p = await payment(out.reference);
      assert.equal(p.paid_plan, "Growth");
      assert.equal(Number(p.amount), 4990);
      assert.equal(
        await scalar("select plan from customer_accounts where id=$1", [c.id]),
        "Starter",
      );
      assert.equal(
        await scalar(
          "select next_billing_at::text from subscriptions where organization_id=$1",
          [c.organization_id],
        ),
        expiry,
      );
      assert.equal((await checkout(c.email, "scale")).reference, out.reference);
      await proof(p);
      await query(
        "select review_manual_payment($1,true,'Verificado','admin@example.test',now()-interval '2 hours')",
        [p.id],
      );
      assert.equal((await payment(out.reference)).landing_page_bonus, false);
      assert.equal(
        await scalar(
          "select plan from subscriptions where organization_id=$1",
          [c.organization_id],
        ),
        "Growth",
      );
      assert.equal(
        await scalar(
          "select count(*)::int from billing_payments where customer_id=$1 and landing_page_bonus",
          [c.id],
        ),
        1,
      );
    },
  );
  await t.test(
    "inicialização do admin é repetível e sem contactos fictícios",
    async () => {
      const user = "00000000-0000-4000-8000-000000000001";
      await query("insert into auth.users(id) values($1)", [user]);
      const args = [user, "owner@example.test", "Administrador"];
      const first = await scalar(
        "select ensure_admin_workspace($1,$2,$3)",
        args,
      );
      assert.equal(
        await scalar("select ensure_admin_workspace($1,$2,$3)", args),
        first,
      );
      assert.equal(
        await scalar(
          "select count(*)::int from leads where organization_id=$1",
          [first],
        ),
        0,
      );
      assert.equal(
        await scalar(
          "select count(*)::int from subscriptions where organization_id=$1",
          [first],
        ),
        1,
      );
      await assert.rejects(checkout("owner@example.test"), /MEMBER_ACCOUNT/);
    },
  );
  await t.test(
    "número WhatsApp fica associado a uma única empresa, com auditoria",
    async () => {
      await org("wa-a", "Growth");
      await org("wa-b", "Growth");
      await query("select claim_whatsapp_number('wa-a','123456789')");
      await query("select claim_whatsapp_number('wa-a','123456789')");
      await assert.rejects(
        query("select claim_whatsapp_number('wa-b','123456789')"),
        /WHATSAPP_NUMBER_IN_USE/,
      );
      await query(
        "select save_whatsapp_connection('wa-a','123456789','987654321','+258840000000','ciphertext-test','owner@example.test')",
      );
      assert.equal(
        await scalar(
          "select organization_id from connection_secrets where phone_number_id='123456789'",
        ),
        "wa-a",
      );
      await query(
        "update subscriptions set plan='Starter' where organization_id='wa-a'",
      );
      await assert.rejects(
        query(
          "select save_whatsapp_connection('wa-a','123456789','987654321','+258840000000','new-test','owner@example.test')",
        ),
        /SUBSCRIPTION_INACTIVE/,
      );
      assert.equal(
        await scalar(
          "select encrypted_value from connection_secrets where phone_number_id='123456789'",
        ),
        "ciphertext-test",
      );
      assert.equal(
        await scalar(
          "select has_function_privilege('authenticated','save_whatsapp_connection(text,text,text,text,text,text)','EXECUTE')",
        ),
        false,
      );
    },
  );
  await t.test(
    "sessão de ligação expira, pertence à empresa/utilizador e só é consumida uma vez",
    async () => {
      const uid = "00000000-0000-4000-8000-000000000002";
      const row = await one(
        "insert into whatsapp_signup_sessions(organization_id,user_id) values('wa-b',$1) returning id",
        [uid],
      );
      const consume = (org) =>
        query(
          "update whatsapp_signup_sessions set consumed_at=now() where id=$1 and organization_id=$2 and user_id=$3 and consumed_at is null and expires_at>now() returning id",
          [row.id, org, uid],
        );
      assert.equal((await consume("wa-a")).rows.length, 0);
      assert.equal((await consume("wa-b")).rows.length, 1);
      assert.equal((await consume("wa-b")).rows.length, 0);
      await query(
        "update whatsapp_signup_sessions set consumed_at=null,expires_at=now()-interval '1 minute' where id=$1",
        [row.id],
      );
      assert.equal((await consume("wa-b")).rows.length, 0);
    },
  );
  await db.close();
});
