import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import { fetchSheetCSV } from "@/lib/csv";
import CmClient from "./CmClient";

export const dynamic = "force-dynamic";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQvngGGOY9JoMIeWBjSrXsJ3LGXLuLijSyCWvgoZNFEThads_vwnAWfM3Yt32jZlfu9JIYIYbcgWer/pub?gid=1331082262&single=true&output=csv";

export default async function CmPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const role = await getRole(supabase);
  const { headers, rows, error } = await fetchSheetCSV(CSV_URL);

  return (
    <CmClient
      headers={headers}
      rows={rows}
      error={error}
      userEmail={user?.email ?? ""}
      isLoggedIn={!!user}
      role={role}
    />
  );
}
