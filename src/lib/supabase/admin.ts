import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for privileged admin operations
 * (creating/deleting auth users). SERVER-ONLY — never import in client code.
 * Requires SUPABASE_SERVICE_ROLE_KEY (set in .env.local and Vercel).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
