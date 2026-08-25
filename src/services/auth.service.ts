import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser, UserRole } from "@/types";

/**
 * Resolve the signed-in user's profile. Cached per-request so multiple
 * callers (layout + page) hit the DB once.
 * Returns null when not authenticated.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return profile as SessionUser;
});

/**
 * Guard for server components/actions. Redirects:
 *  - anonymous → /login (middleware appends ?next=<path>)
 *  - wrong role → that user's own home
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homePathFor(user.role));
  return user;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export function homePathFor(role: UserRole): string {
  return role === "admin" ? "/admin" : "/student";
}
