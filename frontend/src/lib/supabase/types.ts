export type UserRole = "super_admin" | "organization";

export interface Organization {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  user_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  org_id?: string;
}

// Backwards compatibility alias
export type SuperAdminUser = AuthUser;
