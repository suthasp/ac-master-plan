import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import { fetchSheetCSV, CM_DASHBOARD_CSV_URL } from "@/lib/csv";
import CmDashboardClient from "./CmDashboardClient";

export const dynamic = "force-dynamic";

export default async function CmDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const role = await getRole(supabase);
  const { headers, rows, error } = await fetchSheetCSV(CM_DASHBOARD_CSV_URL);

  return (
    <CmDashboardClient
      headers={headers}
      rows={rows}
      error={error}
      userEmail={user?.email ?? ""}
      isLoggedIn={!!user}
      role={role}
    />
  );
}
