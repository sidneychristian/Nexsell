import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "../server-env";

export async function createSupabaseServerClient() {
  const url = getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Supabase não configurado.");
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components não podem sempre alterar cookies; as rotas de autenticação tratam a renovação.
        }
      },
    },
  });
}
