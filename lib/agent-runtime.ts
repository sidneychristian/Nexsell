import type { SupabaseClient } from "@supabase/supabase-js";

type AgentRow={id:string;organization_id:string;name:string;role:string;objective:string;tone:string;language:string;instructions:string;handoff_message:string;handoff_keywords:unknown;status:string};

function textFromResponse(payload:unknown){
  if(!payload||typeof payload!=="object")return "";
  const output=(payload as {output?:unknown[]}).output;
  if(!Array.isArray(output))return "";
  for(const item of output){
    if(!item||typeof item!=="object")continue;
    const content=(item as {content?:unknown[]}).content;
    if(!Array.isArray(content))continue;
    for(const part of content){
      if(part&&typeof part==="object"&&typeof (part as {text?:unknown}).text==="string")return String((part as {text:string}).text);
    }
  }
  return "";
}

export async function runAgent(db:SupabaseClient,agent:AgentRow,message:string,history:{role:"user"|"assistant";text:string}[]=[]){
  const keywords=Array.isArray(agent.handoff_keywords)?agent.handoff_keywords.map(String):[];
  const matched=keywords.find(keyword=>keyword&&message.toLowerCase().includes(keyword.toLowerCase()));
  if(matched)return {reply:agent.handoff_message||"Vou encaminhar a sua conversa para um membro da equipa.",handedOff:true,reason:`Palavra de transferência detetada: ${matched}`};

  const {data:links}=await db.from("agent_resources").select("resource_id,resource_kind").eq("agent_id",agent.id).eq("organization_id",agent.organization_id);
  const knowledgeIds=(links??[]).filter(link=>link.resource_kind==="knowledge").map(link=>link.resource_id);
  const catalogIds=(links??[]).filter(link=>link.resource_kind==="catalog").map(link=>link.resource_id);
  const [{data:knowledge},{data:catalog}]=await Promise.all([
    knowledgeIds.length?db.from("knowledge_resources").select("name,content_text,source_url,status").eq("organization_id",agent.organization_id).in("id",knowledgeIds):Promise.resolve({data:[]}),
    catalogIds.length?db.from("catalog_items").select("name,item_type,price,currency,description,status").eq("organization_id",agent.organization_id).in("id",catalogIds):Promise.resolve({data:[]}),
  ]);
  const knowledgeContext=(knowledge??[]).filter(item=>item.status==="ready"&&item.content_text).map(item=>`RECURSO: ${item.name}\n${String(item.content_text).slice(0,6000)}`).join("\n\n");
  const catalogContext=(catalog??[]).filter(item=>item.status==="active").map(item=>`ITEM: ${item.name} | ${item.item_type} | ${item.price} ${item.currency}\n${item.description}`).join("\n\n");
  if(!process.env.OPENAI_API_KEY)return {reply:"O agente está configurado, mas a chave de IA ainda não foi adicionada na Vercel.",handedOff:false,configurationRequired:true};

  const instructions=[
    `És ${agent.name}, ${agent.role}.`,
    `Objetivo: ${agent.objective}`,
    `Responde em ${agent.language}, com tom ${agent.tone}.`,
    agent.instructions,
    "Usa apenas os dados fornecidos. Nunca inventes preços, condições, disponibilidade ou políticas.",
    "Se não souberes, assume a limitação e oferece encaminhamento humano.",
    knowledgeContext?`BASE DE CONHECIMENTO:\n${knowledgeContext}`:"",
    catalogContext?`CATÁLOGO:\n${catalogContext}`:"",
  ].filter(Boolean).join("\n\n").slice(0,30000);
  const input=[...history.slice(-12).map(item=>({role:item.role,content:item.text.slice(0,3000)})),{role:"user" as const,content:message}];
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_AGENT_MODEL||"gpt-4.1-mini",instructions,input,max_output_tokens:500})});
  if(!response.ok)throw new Error("O serviço de IA não conseguiu responder agora.");
  const payload=await response.json();
  const reply=textFromResponse(payload);
  if(!reply)throw new Error("A IA devolveu uma resposta vazia.");
  return {reply,handedOff:false};
}
