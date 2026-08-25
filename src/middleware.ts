import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ADMIN_PREFIX = "/admin";
const STUDENT_PREFIX = "/student";

/**
 * 1. Refreshes the Supabase session cookie on every matched request.
 * 2. Protects /admin/* and /student/* — anonymous users are bounced to
 *    /login?next=…; authenticated users landing on /login go home.
 * Role checks (admin vs student) happen server-side in requireRole().
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isProtected =
    pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith(STUDENT_PREFIX);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    // Already signed in — send to the ?next target or their role home.
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname =
      next && isSafeNext(next) && next !== "/"
        ? next
        : profile?.role === "admin"
          ? ADMIN_PREFIX
          : STUDENT_PREFIX;
    return NextResponse.redirect(url);
  }

  return response;
}

function isSafeNext(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/student/:path*",
    "/exam/:path*",
    "/login",
  ],
};
