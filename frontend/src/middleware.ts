import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project.supabase.co") &&
  !supabaseUrl.includes("placeholder.supabase.co") &&
  supabaseAnonKey !== "your-anon-key-here" &&
  !supabaseAnonKey.includes("PASTE_YOUR") &&
  !supabaseAnonKey.includes("<")
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  let isAuthenticated = false;
  let userRole: string | null = null;

  // When Supabase is configured, verify authentic server-side session via @supabase/ssr
  if (isSupabaseConfigured && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      // 1. Verify authentic user session from Supabase Auth
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!error && user) {
        isAuthenticated = true;
        userRole = user.user_metadata?.role || user.app_metadata?.role || "super_admin";
      } else {
        // 2. Check if a secure session cookie was set by our hardened /api/auth/login route
        const sessionCookie = request.cookies.get("lume_auth_session")?.value;
        const roleCookie = request.cookies.get("lume_user_role")?.value;
        if (sessionCookie && roleCookie) {
          try {
            const parsed = JSON.parse(decodeURIComponent(sessionCookie));
            if (parsed?.email && parsed?.role && parsed?.id) {
              isAuthenticated = true;
              userRole = parsed.role;
            }
          } catch {
            // invalid cookie format
          }
        }
      }
    } catch (err) {
      console.warn("[middleware] Session verification error:", err);
    }
  } else {
    // Local / Offline Dev Mode fallback (ONLY when isSupabaseConfigured is false)
    const roleCookie = request.cookies.get("lume_user_role")?.value;
    const authSessionCookie = request.cookies.get("lume_auth_session")?.value;
    const legacySessionCookie = request.cookies.get("lume_superadmin_session")?.value;

    isAuthenticated = Boolean(authSessionCookie || legacySessionCookie);
    userRole = roleCookie || null;
    if (!userRole && authSessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(authSessionCookie));
        userRole = parsed.role;
      } catch {
        // ignore
      }
    }
  }

  // 1. Protect /superadmin routes (except /superadmin/login)
  if (pathname.startsWith("/superadmin") && pathname !== "/superadmin/login") {
    if (!isAuthenticated) {
      const loginUrl = new URL("/superadmin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // RBAC: If an organization user tries to enter superadmin pages, redirect them to organization portal
    if (userRole === "organization") {
      return NextResponse.redirect(new URL("/organization/dashboard", request.url));
    }
  }

  // 2. Protect /organization routes
  if (pathname.startsWith("/organization")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/superadmin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. If already authenticated and visiting the login page, route according to role
  if (pathname === "/superadmin/login" || pathname === "/login") {
    if (isAuthenticated) {
      if (userRole === "organization") {
        return NextResponse.redirect(new URL("/organization/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/superadmin/add-organization", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/superadmin/:path*", "/organization/:path*", "/login"],
};
