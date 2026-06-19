"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-8 w-full max-w-sm shadow-2xl">
        <h1 className="text-2xl font-bold text-[var(--app-text)] mb-2 text-center">AMC Air Conditioning</h1>
        <p className="text-[var(--text-muted)] text-sm text-center mb-8">PM Air Conditioning Tracker</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[var(--app-text)] text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-[var(--app-text)] text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2 transition-colors"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
