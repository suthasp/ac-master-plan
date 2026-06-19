import { createClient } from "@/lib/supabase/server";
import InsightsClient from "./InsightsClient";

export default async function InsightsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <InsightsClient userEmail={user?.email ?? ""} isLoggedIn={!!user} />;
}
