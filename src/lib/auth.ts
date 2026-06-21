import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the current user's role ("admin" | "manager" | "viewer"),
 * or "" when not logged in.
 */
export async function getRole(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile?.role as string) ?? "viewer";
}

/**
 * Guard for admin-only API actions.
 * Returns a NextResponse to short-circuit (401/403) when the caller is not an
 * admin, or null when the caller is allowed to proceed.
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<NextResponse | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }
  return null;
}
