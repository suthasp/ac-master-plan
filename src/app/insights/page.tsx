import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import InsightsClient from "./InsightsClient";

export default async function InsightsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = await getRole(supabase);

  return (
    <InsightsClient userEmail={user?.email ?? ""} isLoggedIn={!!user} role={role} />
  );
}
