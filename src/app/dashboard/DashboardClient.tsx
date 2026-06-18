"use client";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// load AG Grid only client-side (no SSR)
const PlanGrid = dynamic(() => import("@/components/PlanGrid"), { ssr: false });

export default function DashboardClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-[#0f3460] border-b border-[#2d3561] text-sm flex-shrink-0">
        <span className="text-gray-300">{userEmail}</span>
        <button
          onClick={handleLogout}
          className="text-red-400 hover:text-red-300 transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <PlanGrid year={2026} />
      </div>
    </div>
  );
}
