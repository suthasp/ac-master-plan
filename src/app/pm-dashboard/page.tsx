import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import { fetchSheetCSV, PM_CSV_URL } from "@/lib/csv";
import PmDashboardClient from "./PmDashboardClient";

export const dynamic = "force-dynamic";

export default async function PmDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const role = await getRole(supabase);
  const { headers, rows, error } = await fetchSheetCSV(PM_CSV_URL);

  return (
    <PmDashboardClient
      headers={headers}
      rows={rows}
      error={error}
      userEmail={user?.email ?? ""}
      isLoggedIn={!!user}
      role={role}
    />
  );
}
