import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "../../lib/auth";
import { NexSellApp } from "../nexsell-app";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user.email)) redirect("/");
  return <NexSellApp user={user} initialView="admin" />;
}
