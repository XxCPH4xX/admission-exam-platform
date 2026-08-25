import { NextResponse } from "next/server";
import type { SessionUser } from "@/types";
import { getSessionUser } from "@/services/auth.service";

/**
 * Route-handler auth guard: verifies the session server-side (never trusting
 * client-sent identity) and enforces the admin role.
 */
export async function requireAdminApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

/** Authenticated-user guard for student-facing endpoints. */
export async function requireUserApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  return { ok: true, user };
}
