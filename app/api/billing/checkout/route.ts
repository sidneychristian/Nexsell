import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "../../../../lib/auth";
import { createAdminClient } from "../../../../lib/supabase/admin";
export async function POST(request:Request){
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({error:"Crie a sua conta ou entre antes de escolher o plano."},{status:401});
 const data=z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().min(7).max(30),company:z.string().max(120),plan:z.enum(["starter","growth","scale"]),method:z.enum(["EMOLA","BCI"])}).safeParse(await request.json().catch(()=>null));
 if(!data.success)return NextResponse.json({error:"Verifique os dados do pedido."},{status:400});
 const {data:result,error}=await createAdminClient().rpc("manual_checkout",{p_email:user.email,p_name:data.data.name,p_phone:data.data.phone,p_company:data.data.company,p_plan:data.data.plan,p_method:data.data.method});
 if(error)return NextResponse.json({error:"Não foi possível criar o pedido. Verifique se já tem um pedido ou acesso activo."},{status:409});
 return NextResponse.json(result);
}
