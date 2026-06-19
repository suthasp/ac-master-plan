import { createClient } from "@/lib/supabase/server";
import InsightsClient from "./InsightsClient";

export default async function InsightsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  return (
    <InsightsClient userEmail={user?.email ?? ""} isLoggedIn={!!user} isAdmin={isAdmin} />
  );
}
