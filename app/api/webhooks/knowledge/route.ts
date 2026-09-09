import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";

const schema=z.object({organizationId:z.string().min(5),resourceId:z.string().min(5),status:z.enum(["ready","error"]),contentText:z.string().max(100000).default(""),errorMessage:z.string().max(1000).default("")});

export async function POST(request:Request){
  const supplied=request.headers.get("x-nexsell-secret");
  if(!process.env.N8N_INBOUND_SECRET||supplied!==process.env.N8N_INBOUND_SECRET)return NextResponse.json({error:"Assinatura inválida"},{status:401});
  const parsed=schema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Payload inválido"},{status:400});
  const {error}=await createAdminClient().from("knowledge_resources").update({status:parsed.data.status,content_text:parsed.data.contentText,error_message:parsed.data.errorMessage,updated_at:new Date().toISOString()}).eq("id",parsed.data.resourceId).eq("organization_id",parsed.data.organizationId);
  if(error)return NextResponse.json({error:"Não foi possível atualizar o recurso."},{status:500});
  return NextResponse.json({accepted:true});
}
