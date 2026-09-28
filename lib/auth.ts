import "server-only";
import { createSupabaseServerClient } from "./supabase/server";

export type NexSellUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function isPlatformAdmin(email: string) {
  const allowed = (process.env.NEXSELL_ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return allowed.includes(normalizeEmail(email));
}

export async function getCurrentUser(): Promise<NexSellUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.email_confirmed_at) return null;
    const fullName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null;
    return {
      id: user.id,
      email: normalizeEmail(user.email),
      fullName,
      displayName: fullName || user.email.split("@")[0],
    };
  } catch {
    return null;
  }
}
