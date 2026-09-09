import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../server-env";

export function createAdminClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("Supabase não configurado no servidor.");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
