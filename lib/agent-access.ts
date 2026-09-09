import { getCurrentUser, isPlatformAdmin } from "./auth";
import { createAdminClient } from "./supabase/admin";
import { PLAN_ACCESS, normalizePlanKey, planHasFeature } from "../app/plans";

export async function getAgentAccess(){
  const user=await getCurrentUser();
  if(!user)return {error:"Autenticação necessária",status:401} as const;
  const db=createAdminClient();
  let {data:membership}=await db.from("memberships").select("*").eq("user_id",user.id).maybeSingle();
  if(!membership){
    const result=await db.from("memberships").select("*").eq("user_email",user.email).maybeSingle();
    membership=result.data;
  }
  if(!membership)return {error:"Esta conta ainda não pertence a uma empresa ativa.",status:403} as const;
  const {data:subscription}=await db.from("subscriptions").select("*").eq("organization_id",membership.organization_id).maybeSingle();
  const admin=isPlatformAdmin(user.email);
  if(!admin&&(!subscription||!["active","trial"].includes(String(subscription.status))))return {error:"A subscrição desta empresa não está ativa.",status:403} as const;
  const planKey=admin?"scale":normalizePlanKey(String(subscription?.plan??"starter"));
  if(!admin&&!planHasFeature(planKey,"ai"))return {error:"Os agentes estão disponíveis a partir do plano Growth. Suba o seu pacote para continuar.",status:403,code:"PLAN_UPGRADE_REQUIRED"} as const;
  return {db,user,organizationId:String(membership.organization_id),planKey,limits:PLAN_ACCESS[planKey].limits,admin} as const;
}
