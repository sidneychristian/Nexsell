import { NextResponse } from "next/server";
import { getCurrentUser,isPlatformAdmin } from "../../../../lib/auth";
import { createAdminClient } from "../../../../lib/supabase/admin";
export async function POST(request:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Entre na conta."},{status:401});
 if(Number(request.headers.get("content-length"))>3500000)return NextResponse.json({error:"Máximo 3 MB."},{status:413});
 const form=await request.formData();const file=form.get("file");const reference=String(form.get("reference")??"");
 const transaction=String(form.get("transaction")??"").trim();
 if(!(file instanceof File)||file.size===0||file.size>3*1024*1024||transaction.length<3||transaction.length>100)return NextResponse.json({error:"Envie um comprovativo até 3 MB e a referência da transferência."},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 const ext=bytes.subarray(0,5).toString()==="%PDF-"?"pdf":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"png":bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"jpg":null;
 if(!ext)return NextResponse.json({error:"Use PDF, PNG ou JPG."},{status:400});
 const db=createAdminClient();const {data:c}=await db.from("customer_accounts").select("id").eq("email",user.email).maybeSingle();
 const {data:p}=await db.from("billing_payments").select("id,status").eq("reference",reference).eq("customer_id",c?.id??"").eq("provider","Manual").maybeSingle();
 if(!p||!["pending","rejected"].includes(p.status))return NextResponse.json({error:"Pedido indisponível para envio."},{status:409});
 const path=`${c!.id}/${crypto.randomUUID()}.${ext}`;
 const {error:upload}=await db.storage.from("payment-proofs").upload(path,bytes,{contentType:ext==="pdf"?"application/pdf":ext==="png"?"image/png":"image/jpeg"});
 if(upload)return NextResponse.json({error:"Não foi possível guardar o comprovativo."},{status:500});
 const {error}=await db.rpc("submit_manual_proof",{p_payment:p.id,p_customer:c!.id,p_path:path,p_transaction:transaction});
 if(error){await db.storage.from("payment-proofs").remove([path]);return NextResponse.json({error:"O pedido mudou. Actualize e tente novamente."},{status:409});}
 return NextResponse.json({status:"under_review"});
}
export async function GET(request:Request){
 const user=await getCurrentUser();if(!user||!isPlatformAdmin(user.email))return NextResponse.json({error:"Acesso reservado."},{status:403});
 const db=createAdminClient();const {data:p}=await db.from("billing_payments").select("proof_path").eq("id",new URL(request.url).searchParams.get("id")??"").maybeSingle();
 if(!p?.proof_path)return NextResponse.json({error:"Sem comprovativo."},{status:404});
 const {data,error}=await db.storage.from("payment-proofs").createSignedUrl(p.proof_path,60,{download:true});
 if(error||!data)return NextResponse.json({error:"Não foi possível abrir."},{status:500});
 return NextResponse.redirect(data.signedUrl);
}
