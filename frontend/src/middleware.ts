import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const roleCookie = request.cookies.get("lume_user_role")?.value;
  const authSessionCookie = request.cookies.get("lume_auth_session")?.value;
  const legacySessionCookie = request.cookies.get("lume_superadmin_session")?.value;
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  const isAuthenticated = Boolean(
    authSessionCookie || legacySessionCookie || hasSupabaseCookie
  );

  // Parse role if present
  let role = roleCookie;
  if (!role && authSessionCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(authSessionCookie));
      role = parsed.role;
    } catch {
      // ignore
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
    if (role === "organization") {
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
      if (role === "organization") {
        return NextResponse.redirect(new URL("/organization/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/superadmin/add-organization", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/superadmin/:path*", "/organization/:path*", "/login"],
};
