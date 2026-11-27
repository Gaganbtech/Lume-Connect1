import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { UserRole } from "./types";

export const SUPER_ADMIN_EMAIL = "admin@lumeconnect.com";

const DEFAULT_SUPABASE_URL = "https://ujhuxmfsvfnnmrspgkqc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_s1_F6J0hTD6ciaDvHEYipA_SvdKhmxq";

function normalizeSupabaseUrl(url?: string): string {
  if (!url) return DEFAULT_SUPABASE_URL;
  const trimmed = url.trim();
  const match = trimmed.match(/project\/([a-z0-9_-]+)/i);
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`;
  }
  return trimmed;
}

export function getSupabaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (
    !configured ||
    configured.includes("your-project.supabase.co") ||
    configured.includes("placeholder.supabase.co")
  ) {
    return DEFAULT_SUPABASE_URL;
  }
  return normalizeSupabaseUrl(configured);
}

export function getSupabaseAnonKey(): string {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!configured || configured === "your-anon-key-here" || configured === "placeholder-key") {
    return DEFAULT_SUPABASE_ANON_KEY;
  }
  return configured;
}

export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key === "your-service-role-key-here") {
    return null;
  }
  return key;
}

/**
 * Server-only Supabase client with Service Role privileges.
 * Never import this module into client components.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) {
    return null;
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Server-side Supabase SSR client bound to Next.js cookies.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Safe to ignore in read-only Server Component contexts
        }
      },
    },
  });
}

export interface VerifiedSessionResult {
  user: User | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
  status: 200 | 401 | 403;
  error: string | null;
}

/**
 * Verifies the caller's session directly against Supabase Auth using
 * the SSR cookie or Bearer token (never trusting client-supplied role cookies/headers).
 */
export async function verifyAuthenticatedSession(
  request?: Request
): Promise<VerifiedSessionResult> {
  const supabase = await createSupabaseServerClient();

  let bearerToken: string | undefined;
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      bearerToken = authHeader.slice(7).trim() || undefined;
    }
  }

  const {
    data: { user },
    error,
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return {
      user: null,
      role: null,
      isSuperAdmin: false,
      status: 401,
      error: "Authentication required. Please sign in with a valid session.",
    };
  }

  const email = user.email.toLowerCase();
  const metadataRole =
    (user.user_metadata?.role as string | undefined) ||
    (user.app_metadata?.role as string | undefined);

  let resolvedRole: UserRole =
    metadataRole === "organization" ? "organization" : metadataRole === "super_admin" ? "super_admin" : "organization";

  // Verify role against DB when metadata role is missing or when checking super_admin
  const adminClient = createSupabaseAdminClient();
  if (adminClient && (!metadataRole || email === SUPER_ADMIN_EMAIL)) {
    const { data: orgRow } = await adminClient
      .from("organizations")
      .select("role")
      .ilike("email", email)
      .maybeSingle();

    if (orgRow?.role === "super_admin" || orgRow?.role === "organization") {
      resolvedRole = orgRow.role;
    } else {
      const { data: credRow } = await adminClient
        .from("login_credentials")
        .select("role")
        .ilike("email", email)
        .maybeSingle();

      if (credRow?.role === "super_admin" || credRow?.role === "organization") {
        resolvedRole = credRow.role;
      }
    }
  }

  const isSuperAdmin = email === SUPER_ADMIN_EMAIL && resolvedRole === "super_admin";

  return {
    user,
    role: resolvedRole,
    isSuperAdmin,
    status: 200,
    error: null,
  };
}

/**
 * Enforces that the caller has a verified Supabase Auth session belonging to
 * admin@lumeconnect.com with role = super_admin.
 */
export async function verifySuperAdminSession(
  request?: Request
): Promise<VerifiedSessionResult> {
  const session = await verifyAuthenticatedSession(request);
  if (!session.user) {
    return session;
  }

  if (!session.isSuperAdmin) {
    return {
      user: session.user,
      role: session.role,
      isSuperAdmin: false,
      status: 403,
      error: `Forbidden: Only Super Admin (${SUPER_ADMIN_EMAIL}) is authorized.`,
    };
  }

  return session;
}

/**
 * Finds a Supabase Auth user by email (case-insensitive) via the Admin API.
 */
export async function findAuthUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<User | null> {
  const targetEmail = email.trim().toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error || !data?.users?.length) {
      return null;
    }

    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail);
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }
    page += 1;
  }
}
