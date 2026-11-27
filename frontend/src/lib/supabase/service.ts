import { createClient, isSupabaseConfigured } from "./client";
import { AuthUser, Organization, OrganizationStatus, UserRole } from "./types";

const LOCAL_STORAGE_SESSION_KEY = "lume_auth_session";
const LOCAL_STORAGE_ORGS_KEY = "lume_mock_organizations";

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Network timeout")), ms)
    ),
  ]);
}

/**
 * Universal Login for both Super Admin and Organizations with RBAC
 * Signs into Supabase Auth and updates Last Sign In.
 */
export async function loginUser(email: string, password: string): Promise<{
  user: AuthUser | null;
  error: string | null;
  redirectUrl: string;
}> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !password) {
    return { user: null, error: "Please enter both Email and Password", redirectUrl: "" };
  }

  if (password.length < 6) {
    return { user: null, error: "Password must be at least 6 characters", redirectUrl: "" };
  }

  // 1. Call server API endpoint to authenticate and store in Supabase
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });

    const json = await res.json();

    if (res.status === 403) {
      return {
        user: null,
        error: json.error || "This organization account has been suspended. Please contact the Super Administrator.",
        redirectUrl: "",
      };
    }

    if (res.ok && json.success && json.user) {
      const authUser = json.user as AuthUser;
      setSessionCookies(authUser);
      return {
        user: authUser,
        error: null,
        redirectUrl:
          json.redirectUrl ||
          (authUser.role === "organization"
            ? "/organization/dashboard"
            : "/superadmin/add-organization"),
      };
    }

    if (res.status === 401 || res.status === 400 || (json.error && !json.error.includes("Internal"))) {
      return { user: null, error: json.error || "Invalid credentials", redirectUrl: "" };
    }
  } catch (apiErr) {
    console.warn("[loginUser] API login route exception, attempting client fallbacks:", apiErr);
  }

  // 2. Direct client Supabase Auth Fallback
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const remoteOrgCheck = async () => {
        const { data } = await supabase
          .from("organizations")
          .select("*")
          .ilike("email", trimmedEmail)
          .eq("password", password)
          .maybeSingle();

        if (data) {
          if (data.status === "suspended") {
            throw new Error("This organization account has been suspended. Please contact the Super Administrator.");
          }
          return {
            id: data.id,
            email: data.email,
            role: "organization" as UserRole,
            name: data.name,
            org_id: data.id,
            status: data.status,
          };
        }
        return null;
      };

      const remoteOrg = await withTimeout(remoteOrgCheck(), 2000).catch((err) => {
        if (err?.message?.includes("suspended")) {
          throw err;
        }
        return null;
      });

      if (remoteOrg) {
        setSessionCookies(remoteOrg);
        return { user: remoteOrg, error: null, redirectUrl: "/organization/dashboard" };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("suspended")) {
        return { user: null, error: msg, redirectUrl: "" };
      }
    }
  }

  // 3. Check local registered organizations
  const localOrgs = getStoredOrganizations();
  const localMatch = localOrgs.find(
    (o) => o.email.toLowerCase() === trimmedEmail.toLowerCase() && o.password === password
  );

  if (localMatch) {
    if (localMatch.status === "suspended") {
      return {
        user: null,
        error: "This organization account has been suspended. Please contact the Super Administrator.",
        redirectUrl: "",
      };
    }

    const orgUser: AuthUser = {
      id: localMatch.id,
      email: localMatch.email,
      role: "organization",
      name: localMatch.name,
      org_id: localMatch.id,
      status: localMatch.status || "active",
    };
    setSessionCookies(orgUser);
    return { user: orgUser, error: null, redirectUrl: "/organization/dashboard" };
  }

  // 4. Default Super Admin fallback
  if (
    trimmedEmail.toLowerCase() === "admin@lumeconnect.com" &&
    password === "admin123"
  ) {
    const superAdmin: AuthUser = {
      id: "superadmin-default",
      email: trimmedEmail,
      role: "super_admin",
      name: "Super Admin",
    };
    setSessionCookies(superAdmin);
    return { user: superAdmin, error: null, redirectUrl: "/superadmin/add-organization" };
  }

  return {
    user: null,
    error: "Invalid email or password. Please verify your credentials.",
    redirectUrl: "",
  };
}

export async function loginSuperAdmin(email: string, password: string) {
  const res = await loginUser(email, password);
  return {
    user: res.user,
    error: res.error,
    isDemoMode: false,
  };
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      await withTimeout(supabase.auth.signOut(), 1500).catch(() => {});
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    document.cookie = "lume_auth_session=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "lume_user_role=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "lume_superadmin_session=; path=/; max-age=0; SameSite=Lax";
  }
}

export const logoutSuperAdmin = logoutUser;

export async function getCurrentUser(): Promise<AuthUser | null> {
  // Check local session first
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const getUserPromise = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const userRole: UserRole =
            user.user_metadata?.role === "organization" ? "organization" : "super_admin";
          return {
            id: user.id,
            email: user.email || "",
            role: userRole,
            name: user.user_metadata?.org_name,
          };
        }
        return null;
      };

      return await withTimeout(getUserPromise(), 1500).catch(() => null);
    } catch {
      // ignore
    }
  }

  return null;
}

export const getCurrentAdmin = getCurrentUser;

/**
 * Super Admin adds an organization with Name, Email, and Password
 */
export async function addOrganization(
  name: string,
  email: string,
  password?: string,
  status: OrganizationStatus = "active"
): Promise<{
  data: Organization | null;
  error: string | null;
}> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const orgPassword = password?.trim() || "OrgPass123!";

  if (!trimmedName) {
    return { data: null, error: "Organization Name is required" };
  }
  if (!trimmedEmail) {
    return { data: null, error: "Organization Email is required" };
  }
  if (!orgPassword || orgPassword.length < 6) {
    return { data: null, error: "Password must be at least 6 characters" };
  }

  // 1. Call server API endpoint to save directly into Supabase
  try {
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        password: orgPassword,
        status,
      }),
    });

    const json = await res.json();
    if (res.ok && json.data) {
      const savedOrg = {
        ...json.data,
        password: orgPassword,
        status: json.data.status || status,
      } as Organization;
      storeLocalOrganization(savedOrg);
      return { data: savedOrg, error: null };
    }

    if (json.error) {
      console.warn("API save error:", json.error);
    }
  } catch (apiErr) {
    console.warn("API route exception, falling back:", apiErr);
  }

  // Fallback local save if offline / API route fails
  const newOrg: Organization = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `org-${Date.now()}`,
    name: trimmedName,
    email: trimmedEmail,
    password: orgPassword,
    role: "organization",
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  storeLocalOrganization(newOrg);
  return { data: newOrg, error: null };
}

function setSessionCookies(user: AuthUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
    const cookieOptions = "path=/; max-age=86400; SameSite=Lax";
    document.cookie = `lume_auth_session=${encodeURIComponent(JSON.stringify(user))}; ${cookieOptions}`;
    document.cookie = `lume_user_role=${user.role}; ${cookieOptions}`;
    document.cookie = `lume_superadmin_session=${encodeURIComponent(user.email)}; ${cookieOptions}`;
  }
}

function storeLocalOrganization(newOrg: Organization) {
  if (typeof window !== "undefined") {
    const existing = getStoredOrganizations();
    const filtered = existing.filter((o) => o.id !== newOrg.id && o.email.toLowerCase() !== newOrg.email.toLowerCase());
    const updated = [newOrg, ...filtered];
    localStorage.setItem(LOCAL_STORAGE_ORGS_KEY, JSON.stringify(updated));
  }
}

/**
 * List all organizations: combines remote Supabase data and local offline records
 */
export async function listOrganizations(): Promise<Organization[]> {
  const localOrgs = getStoredOrganizations();
  let remoteOrgs: Organization[] = [];

  // 1. Fetch real organizations directly from Supabase via server API
  try {
    const res = await fetch("/api/organizations", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        remoteOrgs = json.data as Organization[];
      }
    }
  } catch {
    // ignore
  }

  // 2. Direct client query to Supabase if API returned nothing
  if (remoteOrgs.length === 0 && isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        remoteOrgs = data as Organization[];
      }
    } catch {
      // ignore
    }
  }

  // 3. Merge remote and local organizations, deduplicating by ID and Email
  const orgMap = new Map<string, Organization>();

  for (const org of remoteOrgs) {
    orgMap.set(org.id, {
      ...org,
      status: org.status || "active",
    });
  }

  for (const org of localOrgs) {
    const existingById = orgMap.get(org.id);
    const existingByEmail = Array.from(orgMap.values()).find(
      (o) => o.email.toLowerCase() === org.email.toLowerCase()
    );

    if (!existingById && !existingByEmail) {
      orgMap.set(org.id, {
        ...org,
        status: org.status || "active",
      });
    } else {
      // Preserve local status updates and password if local is more specific
      const target = existingById || existingByEmail!;
      if (org.status && org.status !== target.status) {
        target.status = org.status;
      }
      if (org.password && !target.password) {
        target.password = org.password;
      }
    }
  }

  const combined = Array.from(orgMap.values());

  // Cache combined list locally so UI never flashes empty on offline or reload
  if (typeof window !== "undefined" && combined.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_ORGS_KEY, JSON.stringify(combined));
  }

  return combined;
}

/**
 * Toggle or update organization status (active / suspended)
 */
export async function updateOrganizationStatus(
  id: string,
  status: OrganizationStatus
): Promise<{ success: boolean; error: string | null }> {
  // 1. Immediately update localStorage for instant reactive UI
  if (typeof window !== "undefined") {
    const existing = getStoredOrganizations();
    const updated = existing.map((o) =>
      o.id === id ? { ...o, status, updated_at: new Date().toISOString() } : o
    );
    localStorage.setItem(LOCAL_STORAGE_ORGS_KEY, JSON.stringify(updated));
  }

  // 2. Call server API
  try {
    const res = await fetch("/api/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, error: null };
    }
    if (json.error) {
      console.warn("[updateOrganizationStatus] API note:", json.error);
    }
  } catch (apiErr) {
    console.warn("[updateOrganizationStatus] API exception, updated locally:", apiErr);
  }

  // 3. Fallback direct client query if Supabase is configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      await supabase
        .from("organizations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch {
      // ignore
    }
  }

  return { success: true, error: null };
}

/**
 * Delete an organization from Supabase and local storage
 */
export async function deleteOrganization(
  id: string,
  email?: string
): Promise<{ success: boolean; error: string | null }> {
  // 1. Immediately remove from localStorage
  if (typeof window !== "undefined") {
    const existing = getStoredOrganizations();
    const filtered = existing.filter(
      (o) => o.id !== id && (!email || o.email.toLowerCase() !== email.toLowerCase())
    );
    localStorage.setItem(LOCAL_STORAGE_ORGS_KEY, JSON.stringify(filtered));
  }

  // 2. Call server API
  try {
    const res = await fetch(
      `/api/organizations?id=${encodeURIComponent(id)}${email ? `&email=${encodeURIComponent(email)}` : ""}`,
      { method: "DELETE" }
    );

    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, error: null };
    }
    if (json.error) {
      console.warn("[deleteOrganization] API note:", json.error);
    }
  } catch (apiErr) {
    console.warn("[deleteOrganization] API exception, deleted locally:", apiErr);
  }

  // 3. Fallback direct client query if Supabase is configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      await supabase.from("organizations").delete().eq("id", id);
      if (email) {
        await supabase.from("login_credentials").delete().eq("email", email);
      }
    } catch {
      // ignore
    }
  }

  return { success: true, error: null };
}

export function getStoredOrganizations(): Organization[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LOCAL_STORAGE_ORGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
