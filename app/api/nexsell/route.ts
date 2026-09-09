import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser,isPlatformAdmin,normalizeEmail,type NexSellUser } from "../../../lib/auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { activateCustomer,makeId } from "../../billing";
import { ACTION_FEATURES, NEXSELL_PLANS, PLAN_ACCESS, normalizePlanKey, planHasFeature, minimumPlanFor } from "../../plans";

export const dynamic="force-dynamic";
const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("review_payment"),paymentId:z.string().min(1),approve:z.boolean(),note:z.string().max(500).default("")}),
  z.object({action:z.literal("create_lead"),name:z.string().min(2).max(100),company:z.string().max(120).default(""),phone:z.string().min(7).max(30),email:z.string().email().optional().or(z.literal("")),source:z.string().max(50),interest:z.string().max(100),value:z.number().nonnegative().default(0),consent:z.boolean().default(true)}),
  z.object({action:z.literal("update_stage"),leadId:z.string().min(1),stage:z.enum(["novo","contactado","qualificado","proposta","negociacao","ganho","perdido"])}),
  z.object({action:z.literal("send_message"),leadId:z.string().min(1),body:z.string().min(1).max(2000)}),
  z.object({action:z.literal("toggle_automation"),automationId:z.string().min(1),status:z.enum(["ativa","pausada"])}),
  z.object({action:z.literal("create_proposal"),leadId:z.string().min(1),title:z.string().min(2).max(160),amount:z.number().positive(),paymentOption:z.string().max(80)}),
  z.object({action:z.literal("record_payment"),leadId:z.string().optional(),proposalId:z.string().optional(),provider:z.enum(["M-Pesa","e-Mola","Transferência"]),amount:z.number().positive(),reference:z.string().max(100)}),
  z.object({action:z.literal("test_n8n"),automationId:z.string().min(1)}),
  z.object({action:z.literal("create_customer"),name:z.string().min(2).max(100),email:z.string().email().max(160),phone:z.string().min(7).max(30),company:z.string().max(120).default(""),plan:z.enum(["Starter","Growth","Scale"]).default("Growth"),paymentMethod:z.enum(["M-Pesa","e-Mola","Transferência","Numerário","Outro"]),amount:z.number().nonnegative().max(1000000).default(4990),reference:z.string().max(100).default(""),notes:z.string().max(500).default("")}),
  z.object({action:z.literal("update_customer_status"),customerId:z.string().min(1),status:z.enum(["active","suspended"])}),
  z.object({action:z.literal("update_customer_plan"),customerId:z.string().min(1),plan:z.enum(["Starter","Growth","Scale"])}),
]);

type Row=Record<string,unknown>;
const now=()=>new Date();
const iso=()=>now().toISOString();
const id=(prefix:string)=>`${prefix}_${crypto.randomUUID()}`;
const camelKey=(key:string)=>key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase());
function camelRow(row:Row|null){if(!row)return null;return Object.fromEntries(Object.entries(row).map(([key,value])=>[camelKey(key),value]));}
function camelRows(rows:Row[]|null){return (rows??[]).map(row=>camelRow(row));}

function configured(provider:string){
  const groups:Record<string,string[]>={
    whatsapp:["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID"],
    meta:["META_APP_SECRET"],
    n8n:["N8N_WEBHOOK_URL","N8N_INBOUND_SECRET"],
    mpesa:["PAGAR_API_KEY","PAGAR_SIGNING_SECRET","PAGAR_WEBHOOK_SECRET"],
    emola:["PAGAR_API_KEY","PAGAR_SIGNING_SECRET","PAGAR_WEBHOOK_SECRET"],
    pagar:["PAGAR_API_KEY","PAGAR_SIGNING_SECRET","PAGAR_WEBHOOK_SECRET"],
    ai:["OPENAI_API_KEY"],
  };
  return Boolean(groups[provider]?.every(key=>process.env[key]));
}

async function seedAdminOrganization(user:NexSellUser){
  const db=createAdminClient();
  const organizationId=id("org");
  const createdAt=iso();
  const {error:orgError}=await db.from("organizations").insert({id:organizationId,name:"Minha empresa",industry:"Vários sectores",country:"Moçambique",currency:"MZN",timezone:"Africa/Maputo",created_at:createdAt});
  if(orgError)throw orgError;
  const {error:memberError}=await db.from("memberships").insert({id:id("member"),organization_id:organizationId,user_id:user.id,user_email:user.email,display_name:user.displayName,role:"owner",created_at:createdAt});
  if(memberError)throw memberError;

  const leads=[
    {id:id("lead"),name:"Ana Mussa",company:"Casa Ana",phone:"+258 84 123 4567",email:"ana@exemplo.co.mz",source:"Instagram",interest:"Website + catálogo",stage:"qualificado",score:92,temperature:"quente",owner:user.displayName,value:18500,location:"Maputo",next_action:"Enviar proposta",consent:true},
    {id:id("lead"),name:"Carlos Matola",company:"Matola Auto",phone:"+258 86 555 0192",email:"",source:"Meta Ads",interest:"Automação WhatsApp",stage:"proposta",score:84,temperature:"quente",owner:user.displayName,value:32000,location:"Matola",next_action:"Follow-up da proposta",consent:true},
    {id:id("lead"),name:"Lídia Jamal",company:"LJ Eventos",phone:"+258 87 220 1180",email:"lidia@exemplo.com",source:"Indicação",interest:"CRM de vendas",stage:"contactado",score:68,temperature:"morno",owner:user.displayName,value:12000,location:"Beira",next_action:"Agendar demonstração",consent:true},
    {id:id("lead"),name:"Paulo Ernesto",company:"PE Construções",phone:"+258 85 991 2201",email:"",source:"Website",interest:"Pedido de orçamento",stage:"novo",score:61,temperature:"morno",owner:"Sem responsável",value:24000,location:"Nampula",next_action:"Responder em menos de 5 min",consent:true},
    {id:id("lead"),name:"Sofia Uamusse",company:"Sabores da Sofia",phone:"+258 84 777 3140",email:"",source:"WhatsApp",interest:"Loja online",stage:"negociacao",score:89,temperature:"quente",owner:user.displayName,value:27500,location:"Maputo",next_action:"Confirmar pagamento",consent:true},
  ].map(lead=>({...lead,organization_id:organizationId,last_contact_at:createdAt,created_at:createdAt,updated_at:createdAt}));
  await db.from("leads").insert(leads);
  await db.from("automations").insert([
    {name:"Resposta imediata a novos leads",trigger:"Novo lead recebido",action:"Qualificar com IA e responder no WhatsApp",status:"ativa",runs:124,success_rate:98.4},
    {name:"Follow-up de proposta",trigger:"48h sem resposta",action:"Enviar lembrete personalizado",status:"ativa",runs:47,success_rate:95.7},
    {name:"Recuperar conversa abandonada",trigger:"24h sem interação",action:"Retomar com benefício e CTA",status:"ativa",runs:76,success_rate:93.1},
    {name:"Pedir testemunho",trigger:"Venda concluída há 7 dias",action:"Solicitar avaliação e indicação",status:"pausada",runs:18,success_rate:100},
  ].map(item=>({id:id("auto"),organization_id:organizationId,...item,last_run_at:createdAt,created_at:createdAt})));
  await db.from("campaigns").insert([
    {name:"Website que vende",channel:"Meta Ads",status:"ativa",spend:6900,leads:43,sales:7,revenue:91800},
    {name:"Diagnóstico gratuito",channel:"Instagram",status:"ativa",spend:2400,leads:28,sales:4,revenue:49960},
    {name:"Reativação de clientes",channel:"WhatsApp",status:"concluída",spend:0,leads:21,sales:6,revenue:57600},
  ].map(item=>({id:id("camp"),organization_id:organizationId,...item,created_at:createdAt})));
  await db.from("integrations").insert([
    ["whatsapp","WhatsApp Business Cloud"],["n8n","n8n Automations"],["meta","Meta Lead Ads"],
    ["mpesa","M-Pesa"],["emola","e-Mola"],["pagar","Pagar — pagamentos"],["ai","Assistente de IA"],
  ].map(([provider,label])=>({id:id("int"),organization_id:organizationId,provider,label,status:"por_configurar",created_at:createdAt})));
  await db.from("subscriptions").insert({id:id("sub"),organization_id:organizationId,plan:"Growth",status:"trial",monthly_amount:4990,next_billing_at:new Date(Date.now()+14*86400000).toISOString(),created_at:createdAt});
  await db.from("tasks").insert(leads.slice(0,3).map((lead,index)=>({id:id("task"),organization_id:organizationId,lead_id:lead.id,title:lead.next_action,due_at:new Date(Date.now()+(index+1)*3600000).toISOString(),status:"pendente",priority:index===0?"alta":"média",created_at:createdAt})));
  return {organizationId,role:"owner"};
}

async function getOrganization(user:NexSellUser){
  const db=createAdminClient();
  const {data:byId}=await db.from("memberships").select("*").eq("user_id",user.id).maybeSingle();
  if(byId){
    const {data:subscription}=await db.from("subscriptions").select("status").eq("organization_id",byId.organization_id).maybeSingle();
    if(isPlatformAdmin(user.email)||["active","trial"].includes(String(subscription?.status)))return {organizationId:byId.organization_id as string,role:byId.role as string};
    return null;
  }
  const {data:byEmail}=await db.from("memberships").select("*").eq("user_email",user.email).maybeSingle();
  if(byEmail){
    const {data:subscription}=await db.from("subscriptions").select("status").eq("organization_id",byEmail.organization_id).maybeSingle();
    if(!isPlatformAdmin(user.email)&&!["active","trial"].includes(String(subscription?.status)))return null;
    await db.from("memberships").update({user_id:user.id,display_name:user.displayName}).eq("id",byEmail.id);
    return {organizationId:byEmail.organization_id as string,role:byEmail.role as string};
  }
  const {data:customer}=await db.from("customer_accounts").select("*").eq("email",user.email).maybeSingle();
  if(customer?.access_status==="active"){
    const organizationId=customer.organization_id??await activateCustomer(customer.id);
    await db.from("memberships").upsert({id:id("member"),organization_id:organizationId,user_id:user.id,user_email:user.email,display_name:user.displayName,role:"owner",created_at:iso()},{onConflict:"user_email"});
    return {organizationId,role:"owner"};
  }
  if(!isPlatformAdmin(user.email))return null;
  return seedAdminOrganization(user);
}

async function snapshot(organizationId:string,role:string,admin:boolean){
  const db=createAdminClient();
  const subscriptionResult=await db.from("subscriptions").select("*").eq("organization_id",organizationId).maybeSingle();
  const planKey=normalizePlanKey(String(subscriptionResult.data?.plan??"Starter"));
  const allowed=(feature:Parameters<typeof planHasFeature>[1])=>admin||planHasFeature(planKey,feature);
  const [organization,leads,activities,tasks,automations,proposals,payments,campaigns,integrations,subscription,customers,billing]=await Promise.all([
    db.from("organizations").select("*").eq("id",organizationId).maybeSingle(),
    db.from("leads").select("*").eq("organization_id",organizationId).order("updated_at",{ascending:false}),
    allowed("whatsapp")?db.from("activities").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[]}),
    db.from("tasks").select("*").eq("organization_id",organizationId).order("due_at"),
    db.from("automations").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    allowed("proposals")?db.from("proposals").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
    allowed("payments")?db.from("payments").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
    allowed("campaigns")?db.from("campaigns").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
    allowed("connections")?db.from("integrations").select("*").eq("organization_id",organizationId):Promise.resolve({data:[]}),
    Promise.resolve(subscriptionResult),
    admin?db.from("customer_accounts").select("*").order("created_at",{ascending:false}):Promise.resolve({data:[]}),
    admin?db.from("billing_payments").select("*").order("created_at",{ascending:false}).limit(200):Promise.resolve({data:[]}),
  ]);
  const integrationRows=(camelRows(integrations.data as Row[]) as Row[]).map(item=>({...item,status:configured(String(item.provider))?"ativa":item.status}));
  return {
    organization:camelRow(organization.data as Row),leads:camelRows(leads.data as Row[]),activities:camelRows(activities.data as Row[]),
    tasks:camelRows(tasks.data as Row[]),automations:camelRows(automations.data as Row[]),proposals:camelRows(proposals.data as Row[]),
    payments:camelRows(payments.data as Row[]),campaigns:camelRows(campaigns.data as Row[]),integrations:integrationRows,
    subscription:camelRow(subscription.data as Row),customers:camelRows(customers.data as Row[]),billingPayments:camelRows(billing.data as Row[]),
    currentRole:role,isPlatformAdmin:admin,planKey,planLimits:PLAN_ACCESS[planKey].limits,
  };
}

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:"Autenticação necessária"},{status:401});
  try{
    const access=await getOrganization(user);
    if(!access)return NextResponse.json({error:"Esta conta ainda não tem uma subscrição ativa."},{status:403});
    return NextResponse.json(await snapshot(access.organizationId,access.role,isPlatformAdmin(user.email)));
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Não foi possível carregar o NexSell."},{status:500});
  }
}

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:"Autenticação necessária"},{status:401});
  const parsed=actionSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Dados inválidos",details:parsed.error.flatten()},{status:400});
  const access=await getOrganization(user);
  if(!access)return NextResponse.json({error:"Esta conta ainda não tem uma subscrição ativa."},{status:403});
  const admin=isPlatformAdmin(user.email);
  const data=parsed.data;
  if((["create_customer","update_customer_status","update_customer_plan","review_payment"] as string[]).includes(data.action)&&!admin)return NextResponse.json({error:"Apenas o administrador pode gerir clientes."},{status:403});
  const db=createAdminClient();
  const organizationId=access.organizationId;
  const changedAt=iso();
  const {data:subscription}=await db.from("subscriptions").select("plan,status").eq("organization_id",organizationId).maybeSingle();
  const planKey=normalizePlanKey(String(subscription?.plan??"Starter"));
  const requiredFeature=ACTION_FEATURES[data.action];
  if(!admin&&requiredFeature&&!planHasFeature(planKey,requiredFeature)){
    const requiredPlan=minimumPlanFor(requiredFeature);
    return NextResponse.json({error:`Esta funcionalidade requer o plano ${requiredPlan.name}. Suba o seu pacote para continuar.`,code:"PLAN_UPGRADE_REQUIRED",requiredPlan:requiredPlan.name},{status:403});
  }

  if(!admin&&data.action==="create_lead"){
    const {count}=await db.from("leads").select("id",{count:"exact",head:true}).eq("organization_id",organizationId);
    if((count??0)>=PLAN_ACCESS[planKey].limits.contacts)return NextResponse.json({error:`Atingiu o limite de ${PLAN_ACCESS[planKey].limits.contacts.toLocaleString("pt-MZ")} contactos do plano. Suba o seu pacote para adicionar mais leads.`,code:"PLAN_LIMIT_REACHED"},{status:403});
  }
  if(!admin&&data.action==="toggle_automation"&&data.status==="ativa"){
    const {count}=await db.from("automations").select("id",{count:"exact",head:true}).eq("organization_id",organizationId).eq("status","ativa");
    if((count??0)>=PLAN_ACCESS[planKey].limits.activeAutomations)return NextResponse.json({error:`Atingiu o limite de ${PLAN_ACCESS[planKey].limits.activeAutomations} automações ativas. Suba o seu pacote para continuar.`,code:"PLAN_LIMIT_REACHED"},{status:403});
  }

  if(data.action==="review_payment"){
    const {error}=await db.rpc("review_manual_payment",{p_payment:data.paymentId,p_approve:data.approve,p_note:data.note,p_actor:user.email});
    if(error)return NextResponse.json({error:"Pedido já analisado, sem comprovativo ou motivo inválido."},{status:409});
  }else if(data.action==="create_lead"){
    await db.from("leads").insert({id:id("lead"),organization_id:organizationId,name:data.name,company:data.company,phone:data.phone,email:data.email??"",source:data.source,interest:data.interest,stage:"novo",score:55,temperature:"morno",owner:user.displayName,value:data.value,location:"Moçambique",next_action:"Contactar pelo WhatsApp",consent:data.consent,created_at:changedAt,updated_at:changedAt});
  }else if(data.action==="update_stage"){
    await db.from("leads").update({stage:data.stage,updated_at:changedAt}).eq("id",data.leadId).eq("organization_id",organizationId);
  }else if(data.action==="send_message"){
    const {data:lead}=await db.from("leads").select("*").eq("id",data.leadId).eq("organization_id",organizationId).maybeSingle();
    if(!lead||!lead.consent)return NextResponse.json({error:"O contacto não tem consentimento válido para mensagens."},{status:409});
    let status="fila";
    if(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID){
      const response=await fetch(`https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:String(lead.phone).replace(/\D/g,""),type:"text",text:{body:data.body}})});
      status=response.ok?"enviado":"erro";
    }
    await db.from("activities").insert({id:id("act"),organization_id:organizationId,lead_id:data.leadId,type:"mensagem",channel:"whatsapp",direction:"outbound",body:data.body,status,created_at:changedAt});
    await db.from("leads").update({last_contact_at:changedAt,updated_at:changedAt}).eq("id",data.leadId);
  }else if(data.action==="toggle_automation"){
    await db.from("automations").update({status:data.status}).eq("id",data.automationId).eq("organization_id",organizationId);
  }else if(data.action==="create_proposal"){
    await db.from("proposals").insert({id:id("prop"),organization_id:organizationId,lead_id:data.leadId,code:`NX-${String(Date.now()).slice(-6)}`,title:data.title,amount:data.amount,status:"enviada",payment_option:data.paymentOption,due_date:new Date(Date.now()+7*86400000).toISOString(),created_at:changedAt});
    await db.from("leads").update({stage:"proposta",value:data.amount,updated_at:changedAt}).eq("id",data.leadId).eq("organization_id",organizationId);
  }else if(data.action==="record_payment"){
    await db.from("payments").insert({id:id("pay"),organization_id:organizationId,lead_id:data.leadId??null,proposal_id:data.proposalId??null,provider:data.provider,amount:data.amount,reference:data.reference,status:"confirmado",created_at:changedAt});
  }else if(data.action==="test_n8n"){
    if(!process.env.N8N_WEBHOOK_URL)return NextResponse.json({error:"Adicione N8N_WEBHOOK_URL na Vercel."},{status:409});
    const response=await fetch(process.env.N8N_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json","x-nexsell-secret":process.env.N8N_OUTBOUND_SECRET??""},body:JSON.stringify({event:"manual_test",organizationId,automationId:data.automationId,occurredAt:changedAt})});
    if(!response.ok)return NextResponse.json({error:"O n8n não confirmou o teste."},{status:502});
    await db.from("automations").update({last_run_at:changedAt}).eq("id",data.automationId);
  }else if(data.action==="create_customer"){
    const email=normalizeEmail(data.email);
    const {data:existing}=await db.from("customer_accounts").select("*").eq("email",email).maybeSingle();
    if(existing)return NextResponse.json({error:"Este e-mail já está registado. Faça a gestão na lista de clientes."},{status:409});
    const customerId=makeId("customer");
    const values={name:data.name,email,phone:data.phone,company:data.company,plan:data.plan,payment_method:data.paymentMethod,payment_status:"paid",monthly_amount:data.amount,external_payment_reference:data.reference,notes:data.notes};
    if(existing)await db.from("customer_accounts").update(values).eq("id",customerId);
    else await db.from("customer_accounts").insert({id:customerId,...values,access_status:"pending",created_at:changedAt});
    const customerOrganizationId=await activateCustomer(customerId);
    await db.from("billing_payments").insert({id:makeId("billing"),customer_id:customerId,organization_id:customerOrganizationId,provider:"Manual",reference:`MANUAL-${Date.now()}-${crypto.randomUUID().slice(0,6)}`,method:data.paymentMethod,amount:data.amount,status:"paid",created_at:changedAt,paid_at:changedAt});
  }else if(data.action==="update_customer_status"){
    const {data:customer}=await db.from("customer_accounts").select("*").eq("id",data.customerId).maybeSingle();
    if(!customer)return NextResponse.json({error:"Cliente não encontrado."},{status:404});
    if(data.status==="active"){
      if(customer.access_status!=="suspended")return NextResponse.json({error:"Aprove primeiro o comprovativo na lista de pagamentos."},{status:409});
      await activateCustomer(data.customerId);
    }
    else{
      await db.from("customer_accounts").update({access_status:"suspended"}).eq("id",data.customerId);
      if(customer.organization_id)await db.from("subscriptions").update({status:"suspended"}).eq("organization_id",customer.organization_id);
    }
  }else if(data.action==="update_customer_plan"){
    const {data:customer}=await db.from("customer_accounts").select("*").eq("id",data.customerId).maybeSingle();
    if(!customer)return NextResponse.json({error:"Cliente não encontrado."},{status:404});
    const selected=NEXSELL_PLANS.find(plan=>plan.name===data.plan);
    if(!selected)return NextResponse.json({error:"Plano inválido."},{status:400});
    await db.from("customer_accounts").update({plan:selected.name,monthly_amount:selected.monthlyAmount}).eq("id",data.customerId);
    if(customer.organization_id)await db.from("subscriptions").update({plan:selected.name,monthly_amount:selected.monthlyAmount}).eq("organization_id",customer.organization_id);
  }
  return NextResponse.json(await snapshot(organizationId,access.role,admin));
}
