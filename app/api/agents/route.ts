import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentAccess } from "../../../lib/agent-access";
import { runAgent } from "../../../lib/agent-runtime";

export const dynamic="force-dynamic";
const id=(prefix:string)=>`${prefix}_${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();

const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("create_agent"),name:z.string().trim().min(2).max(80),role:z.string().trim().min(2).max(100),objective:z.string().trim().min(10).max(1200),tone:z.enum(["profissional","amigável","consultivo","direto"]),language:z.enum(["Português","Português e Inglês","Inglês"]),instructions:z.string().max(5000).default(""),handoffMessage:z.string().max(500).default("Vou encaminhar a sua conversa para um membro da equipa."),handoffKeywords:z.array(z.string().trim().min(1).max(60)).max(30).default([]),knowledgeIds:z.array(z.string()).max(250).default([]),catalogIds:z.array(z.string()).max(1000).default([])}),
  z.object({action:z.literal("set_agent_status"),agentId:z.string().min(1),status:z.enum(["active","paused"])}),
  z.object({action:z.literal("create_resource"),name:z.string().trim().min(2).max(120),resourceType:z.enum(["text","url","document"]),contentText:z.string().max(50000).default(""),sourceUrl:z.string().url().optional().or(z.literal("")),storageKey:z.string().max(500).default(""),mimeType:z.string().max(120).default(""),fileSize:z.number().nonnegative().max(10*1024*1024).default(0)}),
  z.object({action:z.literal("create_catalog_item"),name:z.string().trim().min(2).max(120),itemType:z.enum(["Produto","Serviço"]),price:z.number().nonnegative().max(100000000),description:z.string().trim().min(2).max(3000),imageKeys:z.array(z.string()).max(5).default([])}),
  z.object({action:z.literal("resolve_approval"),approvalId:z.string().min(1),decision:z.enum(["approved","rejected"]),note:z.string().max(1000).default("")}),
  z.object({action:z.literal("test_agent"),agentId:z.string().min(1),message:z.string().trim().min(1).max(3000),history:z.array(z.object({role:z.enum(["user","assistant"]),text:z.string().max(3000)})).max(12).default([])}),
]);

async function agentSnapshot(access:Extract<Awaited<ReturnType<typeof getAgentAccess>>,{organizationId:string}>){
  const {db,organizationId,limits,planKey}=access;
  const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
  const [agents,resources,catalog,approvals,runs]=await Promise.all([
    db.from("ai_agents").select("*").eq("organization_id",organizationId).order("updated_at",{ascending:false}),
    db.from("knowledge_resources").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    db.from("catalog_items").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    db.from("agent_approvals").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    db.from("agent_runs").select("id",{count:"exact",head:true}).eq("organization_id",organizationId).gte("created_at",monthStart.toISOString()),
  ]);
  const agentIds=(agents.data??[]).map(agent=>agent.id);
  const {data:links}=agentIds.length?await db.from("agent_resources").select("agent_id,resource_id,resource_kind").eq("organization_id",organizationId).in("agent_id",agentIds):{data:[]};
  return {agents:agents.data??[],resources:resources.data??[],catalog:catalog.data??[],approvals:approvals.data??[],links:links??[],planKey,limits,usage:{agentMessages:runs.count??0}};
}

export async function GET(){
  const access=await getAgentAccess();
  if("error" in access)return NextResponse.json({error:access.error,code:"code" in access?access.code:undefined},{status:access.status});
  try{return NextResponse.json(await agentSnapshot(access));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Não foi possível carregar os agentes. Execute a migração do Supabase."},{status:500});}
}

export async function POST(request:Request){
  const access=await getAgentAccess();
  if("error" in access)return NextResponse.json({error:access.error,code:"code" in access?access.code:undefined},{status:access.status});
  const parsed=actionSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Dados inválidos",details:parsed.error.flatten()},{status:400});
  const {db,organizationId,limits,user}=access;
  const data=parsed.data;
  try{
    if(data.action==="create_agent"){
      const {count}=await db.from("ai_agents").select("id",{count:"exact",head:true}).eq("organization_id",organizationId);
      if((count??0)>=limits.agents)return NextResponse.json({error:`O seu plano permite ${limits.agents} agente${limits.agents===1?"":"s"}. Suba o pacote para criar mais.`,code:"PLAN_LIMIT_REACHED"},{status:403});
      const [validKnowledge,validCatalog]=await Promise.all([
        data.knowledgeIds.length?db.from("knowledge_resources").select("id").eq("organization_id",organizationId).in("id",data.knowledgeIds):Promise.resolve({data:[]}),
        data.catalogIds.length?db.from("catalog_items").select("id").eq("organization_id",organizationId).in("id",data.catalogIds):Promise.resolve({data:[]}),
      ]);
      const knowledgeIds=(validKnowledge.data??[]).map(item=>String(item.id));
      const catalogIds=(validCatalog.data??[]).map(item=>String(item.id));
      const agentId=id("agent");const createdAt=now();
      await db.from("ai_agents").insert({id:agentId,organization_id:organizationId,name:data.name,role:data.role,objective:data.objective,tone:data.tone,language:data.language,instructions:data.instructions,handoff_message:data.handoffMessage,handoff_keywords:data.handoffKeywords,status:"draft",created_by:user.id,created_at:createdAt,updated_at:createdAt});
      const links=[...knowledgeIds.map(resourceId=>({id:id("link"),organization_id:organizationId,agent_id:agentId,resource_id:resourceId,resource_kind:"knowledge",created_at:createdAt})),...catalogIds.map(resourceId=>({id:id("link"),organization_id:organizationId,agent_id:agentId,resource_id:resourceId,resource_kind:"catalog",created_at:createdAt}))];
      if(links.length)await db.from("agent_resources").insert(links);
    }else if(data.action==="set_agent_status"){
      const {data:agent}=await db.from("ai_agents").select("*").eq("id",data.agentId).eq("organization_id",organizationId).maybeSingle();
      if(!agent)return NextResponse.json({error:"Agente não encontrado."},{status:404});
      if(data.status==="active"&&!agent.last_tested_at)return NextResponse.json({error:"Teste o agente pelo menos uma vez antes de o publicar."},{status:409});
      if(data.status==="active"&&!process.env.OPENAI_API_KEY)return NextResponse.json({error:"Adicione OPENAI_API_KEY na Vercel antes de publicar o agente."},{status:409});
      await db.from("ai_agents").update({status:data.status,updated_at:now(),published_at:data.status==="active"?now():agent.published_at}).eq("id",data.agentId).eq("organization_id",organizationId);
    }else if(data.action==="create_resource"){
      const {count}=await db.from("knowledge_resources").select("id",{count:"exact",head:true}).eq("organization_id",organizationId);
      if((count??0)>=limits.knowledgeResources)return NextResponse.json({error:`Atingiu o limite de ${limits.knowledgeResources} recursos do plano.`,code:"PLAN_LIMIT_REACHED"},{status:403});
      const resourceId=id("resource");const createdAt=now();const ready=data.resourceType==="text"&&Boolean(data.contentText.trim());
      await db.from("knowledge_resources").insert({id:resourceId,organization_id:organizationId,name:data.name,resource_type:data.resourceType,content_text:data.contentText,source_url:data.sourceUrl||"",storage_key:data.storageKey,mime_type:data.mimeType,file_size:data.fileSize,status:ready?"ready":"processing",created_by:user.id,created_at:createdAt,updated_at:createdAt});
      if(!ready&&process.env.N8N_WEBHOOK_URL){
        try{await fetch(process.env.N8N_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json","x-nexsell-secret":process.env.N8N_OUTBOUND_SECRET??""},body:JSON.stringify({event:"knowledge.processing_requested",organizationId,resourceId,resourceType:data.resourceType,sourceUrl:data.sourceUrl,storageKey:data.storageKey,occurredAt:createdAt})});}catch{/* O recurso continua em processamento e pode ser repetido no n8n. */}
      }
    }else if(data.action==="create_catalog_item"){
      const {count}=await db.from("catalog_items").select("id",{count:"exact",head:true}).eq("organization_id",organizationId);
      if((count??0)>=limits.catalogItems)return NextResponse.json({error:`Atingiu o limite de ${limits.catalogItems} itens do catálogo.`,code:"PLAN_LIMIT_REACHED"},{status:403});
      await db.from("catalog_items").insert({id:id("item"),organization_id:organizationId,name:data.name,item_type:data.itemType,price:data.price,currency:"MZN",description:data.description,image_keys:data.imageKeys,status:"active",created_by:user.id,created_at:now(),updated_at:now()});
    }else if(data.action==="resolve_approval"){
      await db.from("agent_approvals").update({status:data.decision,resolution_note:data.note,resolved_by:user.id,resolved_at:now()}).eq("id",data.approvalId).eq("organization_id",organizationId).eq("status","pending");
    }else if(data.action==="test_agent"){
      const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
      const {count}=await db.from("agent_runs").select("id",{count:"exact",head:true}).eq("organization_id",organizationId).gte("created_at",monthStart.toISOString());
      if((count??0)>=limits.monthlyAgentMessages)return NextResponse.json({error:"Atingiu o limite mensal de mensagens dos agentes. Suba o pacote para continuar.",code:"PLAN_LIMIT_REACHED"},{status:403});
      const {data:agent}=await db.from("ai_agents").select("*").eq("id",data.agentId).eq("organization_id",organizationId).maybeSingle();
      if(!agent)return NextResponse.json({error:"Agente não encontrado."},{status:404});
      const result=await runAgent(db,agent,data.message,data.history);
      const createdAt=now();
      await db.from("agent_runs").insert({id:id("run"),organization_id:organizationId,agent_id:agent.id,channel:"test",input_text:data.message,output_text:result.reply,status:"completed",handed_off:result.handedOff,created_at:createdAt});
      await db.from("ai_agents").update({last_tested_at:createdAt,updated_at:createdAt}).eq("id",agent.id);
      return NextResponse.json({result,...result,snapshot:await agentSnapshot(access)});
    }
    return NextResponse.json(await agentSnapshot(access));
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Não foi possível concluir esta ação."},{status:500});}
}
