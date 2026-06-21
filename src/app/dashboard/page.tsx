import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = await getRole(supabase);

  return (
    <DashboardClient
      userEmail={user?.email ?? ""}
      role={role}
      isLoggedIn={!!user}
    />
  );
}
