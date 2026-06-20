"use client";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

// load AG Grid only client-side (no SSR)
const PlanGrid = dynamic(() => import("@/components/PlanGrid"), { ssr: false });

export default function DashboardClient({
  userEmail,
  isAdmin,
  isLoggedIn,
}: {
  userEmail: string;
  isAdmin: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan 2026 (AMC)</span>
          <span className="text-blue-400 font-semibold">Plan</span>
          <button
            onClick={() => router.push("/insights")}
            className="text-[var(--text-muted)] hover:text-blue-400 transition-colors"
          >
            Insights
          </button>
          <button
            onClick={() => router.push("/sheet")}
            className="text-[var(--text-muted)] hover:text-blue-400 transition-colors"
          >
            PM Results
          </button>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn ? (
            <>
              <span className="text-[var(--text-muted)] text-xs hidden sm:inline">
                {userEmail} <span className="text-blue-400">({isAdmin ? "admin" : "viewer"})</span>
              </span>
              <button
                onClick={handleLogout}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <span className="text-[var(--text-muted)] text-xs hidden sm:inline">โหมดดูอย่างเดียว</span>
              <button
                onClick={() => router.push("/login")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-0.5 rounded transition-colors"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PlanGrid year={2026} isAdmin={isAdmin} isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
}
