import { getCurrentUser } from "../lib/auth";
import { NexSellApp } from "./nexsell-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  return <NexSellApp user={user} />;
}
