import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { PublicHome } from "../public-home";
export const dynamic = "force-dynamic";
export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <PublicHome signedIn />;
}
