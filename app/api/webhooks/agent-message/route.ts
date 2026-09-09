import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { PLAN_ACCESS, normalizePlanKey, planHasFeature } from "../../../plans";
import { runAgent } from "../../../../lib/agent-runtime";

const schema=z.object({organizationId:z.string().min(5),agentId:z.string().min(5),message:z.string().min(1).max(3000),leadId:z.string().optional(),conversationId:z.string().max(160).optional(),channel:z.enum(["whatsapp","instagram","website"]).default("whatsapp")});
const id=(prefix:string)=>`${prefix}_${crypto.randomUUID()}`;

export async function POST(request:Request){
  const supplied=request.headers.get("x-nexsell-secret");
  if(!process.env.N8N_INBOUND_SECRET||supplied!==process.env.N8N_INBOUND_SECRET)return NextResponse.json({error:"Assinatura inválida"},{status:401});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Payload inválido",details:parsed.error.flatten()},{status:400});
  const db=createAdminClient();
  const {data:subscription}=await db.from("subscriptions").select("plan,status").eq("organization_id",parsed.data.organizationId).maybeSingle();
  const planKey=normalizePlanKey(String(subscription?.plan??"starter"));
  if(!subscription||!["active","trial"].includes(String(subscription.status))||!planHasFeature(planKey,"ai"))return NextResponse.json({error:"A subscrição não permite agentes."},{status:403});
  const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
  const {count}=await db.from("agent_runs").select("id",{count:"exact",head:true}).eq("organization_id",parsed.data.organizationId).gte("created_at",monthStart.toISOString());
  if((count??0)>=PLAN_ACCESS[planKey].limits.monthlyAgentMessages)return NextResponse.json({error:"Limite mensal de mensagens atingido.",code:"PLAN_LIMIT_REACHED"},{status:429});
  const {data:agent}=await db.from("ai_agents").select("*").eq("id",parsed.data.agentId).eq("organization_id",parsed.data.organizationId).eq("status","active").maybeSingle();
  if(!agent)return NextResponse.json({error:"Agente indisponível."},{status:404});
  try{
    const {data:previousRuns}=parsed.data.conversationId?await db.from("agent_runs").select("input_text,output_text").eq("organization_id",parsed.data.organizationId).eq("agent_id",agent.id).eq("conversation_id",parsed.data.conversationId).order("created_at",{ascending:false}).limit(6):{data:[]};
    const history=(previousRuns??[]).reverse().flatMap(run=>[{role:"user" as const,text:String(run.input_text)},{role:"assistant" as const,text:String(run.output_text)}]);
    const result=await runAgent(db,agent,parsed.data.message,history);const createdAt=new Date().toISOString();let approvalId:string|undefined;
    if(result.handedOff){approvalId=id("approval");await db.from("agent_approvals").insert({id:approvalId,organization_id:parsed.data.organizationId,agent_id:agent.id,lead_id:parsed.data.leadId??null,conversation_id:parsed.data.conversationId??"",reason:result.reason??"Transferência solicitada",request_payload:{message:parsed.data.message,channel:parsed.data.channel},status:"pending",created_at:createdAt});}
    await db.from("agent_runs").insert({id:id("run"),organization_id:parsed.data.organizationId,agent_id:agent.id,lead_id:parsed.data.leadId??null,conversation_id:parsed.data.conversationId??"",channel:parsed.data.channel,input_text:parsed.data.message,output_text:result.reply,status:"completed",handed_off:result.handedOff,created_at:createdAt});
    return NextResponse.json({reply:result.reply,handedOff:result.handedOff,approvalId});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"O agente não conseguiu responder."},{status:502});}
}
