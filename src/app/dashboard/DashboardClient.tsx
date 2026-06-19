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
        {isLoggedIn ? (
          <span className="text-[var(--app-text)]">
            {userEmail}
            <span className="ml-2 text-xs text-blue-400">({isAdmin ? "admin" : "viewer"})</span>
          </span>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">โหมดดูอย่างเดียว (ยังไม่ได้เข้าสู่ระบบ)</span>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/insights")}
            className="text-[var(--text-muted)] hover:text-blue-400 transition-colors"
          >
            Insights
          </button>
          <ThemeToggle />
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-0.5 rounded transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PlanGrid year={2026} isAdmin={isAdmin} isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
}
