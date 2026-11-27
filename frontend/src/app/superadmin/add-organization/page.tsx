"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentAdmin,
  addOrganization,
  listOrganizations,
} from "@/lib/supabase/service";
import { Organization, SuperAdminUser } from "@/lib/supabase/types";
import { AdminHeader } from "@/components/AdminHeader";
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

export default function AddOrganizationPage() {
  const router = useRouter();

  // Auth state
  const [currentUser, setCurrentUser] = useState<SuperAdminUser | null>(null);

  // Form state
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPassword, setOrgPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successOrg, setSuccessOrg] = useState<Organization | null>(null);
  const [copied, setCopied] = useState(false);

  // Organizations list
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load organizations from Supabase
  const loadOrganizations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listOrganizations();
      setOrganizations(data);
    } catch (err) {
      console.error("Failed to load organizations:", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Verify auth on mount
  useEffect(() => {
    async function verifyAuth() {
      try {
        const admin = await getCurrentAdmin();
        if (!admin) {
          router.replace("/superadmin/login");
          return;
        }
        // If an organization user somehow accesses this, redirect them to organization portal
        if (admin.role === "organization") {
          router.replace("/organization/dashboard");
          return;
        }
        setCurrentUser(admin);
        await loadOrganizations();
      } catch (err) {
        console.error("Auth check failed:", err);
        router.replace("/superadmin/login");
      }
    }

    verifyAuth();
  }, [router, loadOrganizations]);

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setSuccessOrg(null);
    setCopied(false);

    const name = orgName.trim();
    const email = orgEmail.trim();
    const password = orgPassword.trim();

    if (!name) {
      setFormError("Please enter an Organization Name");
      return;
    }

    if (!email) {
      setFormError("Please enter an Email ID for the organization");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError("Please enter a valid business email address");
      return;
    }

    if (!password) {
      setFormError("Please assign a Password for the organization account");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters long");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await addOrganization(name, email, password);

      if (error || !data) {
        setFormError(error || "Failed to save organization to database.");
        setSubmitting(false);
        return;
      }

      setSuccessOrg(data);
      setOrgName("");
      setOrgEmail("");
      setOrgPassword("");

      await loadOrganizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!successOrg) return;
    const text = `Organization: ${successOrg.name}\nEmail: ${successOrg.email}\nPassword: ${successOrg.password || "Provided during setup"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredOrgs = organizations.filter((org) => {
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans">
      <AdminHeader user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Executive Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#242D53]/10 text-[#242D53] border border-[#242D53]/15 mb-2">
                <Layers className="w-3.5 h-3.5 text-[#242D53]" />
                Tenant Management Suite
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#242D53]">
                Add Organization
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Provision new client organizations, set their initial login password, and enforce RBAC access.
              </p>
            </div>
          </div>
        </div>

        {/* Enterprise KPI Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#242D53]/10 text-[#242D53] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Organizations
              </div>
              <div className="text-2xl font-extrabold text-[#242D53] mt-0.5">
                {organizations.length}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Database Engine
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Supabase PostgreSQL
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#D2B68D]/20 text-[#242D53] flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Role-Based Access
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                RBAC Enforcement Active
              </div>
            </div>
          </div>
        </div>

        {/* Main Work Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Add Organization Form (5 cols on lg) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Form Card Header */}
              <div className="bg-gradient-to-r from-[#242D53] to-[#1B2240] p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#D2B68D] border border-white/10">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Register Organization
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Sets up credentials &amp; permissions in Supabase
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-7 space-y-6">
                {/* Success Message with Credentials Sharing Card */}
                {successOrg && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <p className="font-bold text-emerald-900">
                          Organization Provisioned Successfully!
                        </p>
                        <p className="text-xs text-emerald-800">
                          The organization can now log in using these credentials to access their Organization Dashboard:
                        </p>
                        <div className="text-xs bg-white/90 p-3 rounded-lg border border-emerald-200 space-y-1 text-slate-700">
                          <p>
                            <span className="font-semibold text-slate-500">Name:</span>{" "}
                            <span className="font-bold text-[#242D53]">{successOrg.name}</span>
                          </p>
                          <p>
                            <span className="font-semibold text-slate-500">Email:</span>{" "}
                            <span className="font-bold text-slate-900">{successOrg.email}</span>
                          </p>
                          {successOrg.password && (
                            <p>
                              <span className="font-semibold text-slate-500">Password:</span>{" "}
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-900 font-semibold">
                                {successOrg.password}
                              </span>
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono truncate pt-0.5">
                            Role: {successOrg.role} &bull; ID: {successOrg.id}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={copyCredentials}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copied ? "Copied!" : "Copy Credentials"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSuccessOrg(null)}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {formError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm animate-in fade-in duration-200">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs sm:text-sm font-medium">{formError}</div>
                  </div>
                )}

                {/* Form Inputs */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Organization Name Field */}
                  <div>
                    <label
                      htmlFor="orgName"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        id="orgName"
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Acme Corporation"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#242D53] focus:outline-none focus:ring-4 focus:ring-[#242D53]/10 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Email ID Field */}
                  <div>
                    <label
                      htmlFor="orgEmail"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Organization Email ID <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="orgEmail"
                        type="email"
                        required
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        placeholder="contact@acme.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#242D53] focus:outline-none focus:ring-4 focus:ring-[#242D53]/10 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Password Field (NEW) */}
                  <div>
                    <label
                      htmlFor="orgPassword"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Organization Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="orgPassword"
                        type={showPassword ? "text" : "password"}
                        required
                        value={orgPassword}
                        onChange={(e) => setOrgPassword(e.target.value)}
                        placeholder="Create organization login password"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#242D53] focus:outline-none focus:ring-4 focus:ring-[#242D53]/10 transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Minimum 6 characters. The organization will use this password to sign in.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#242D53] hover:bg-[#1B2240] active:bg-[#161C36] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[#242D53]/20 hover:shadow-lg transition-all cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#D2B68D]" />
                          <span>Provisioning Tenant...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-[#D2B68D]" />
                          <span>Create Organization</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT: Organizations Directory (7 cols on lg) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Directory Header */}
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-[#242D53]">
                      Organizations Directory
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#242D53]/10 text-[#242D53]">
                      {organizations.length} {organizations.length === 1 ? "Tenant" : "Tenants"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tenants provisioned with dedicated credentials &amp; RBAC profiles
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadOrganizations}
                    disabled={loadingList}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#242D53] hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    title="Refresh data from Supabase"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin text-[#242D53]" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Search filter */}
              {organizations.length > 0 && (
                <div className="px-6 py-3.5 bg-slate-50/60 border-b border-slate-100">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter organizations by name or email..."
                      className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#242D53] transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Table or Empty State */}
              {loadingList && organizations.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#242D53] mb-3" />
                  <p className="text-xs font-medium">Synchronizing with Supabase...</p>
                </div>
              ) : filteredOrgs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredOrgs.map((org) => {
                    const initial = org.name.charAt(0).toUpperCase();
                    return (
                      <div
                        key={org.id}
                        className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Organization Avatar */}
                          <div className="w-10 h-10 rounded-xl bg-[#242D53] text-[#D2B68D] font-bold text-sm flex items-center justify-center shadow-2xs flex-shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {org.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1 truncate text-slate-600 font-medium">
                                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                {org.email}
                              </span>
                              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                {org.updated_at
                                  ? `Last Active: ${new Date(org.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : new Date(org.created_at).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {org.role === "super_admin" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#D2B68D]/20 text-[#242D53] border border-[#D2B68D]">
                              <ShieldCheck className="w-3 h-3 text-[#242D53]" />
                              Super Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <KeyRound className="w-3 h-3" />
                              Role: Organization
                            </span>
                          )}
                          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#242D53]/5 text-[#242D53] flex items-center justify-center mb-3">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {searchQuery ? "No matching organizations found" : "No organizations registered yet"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {searchQuery
                      ? "Try searching for a different organization name or email address."
                      : "Use the registration form on the left to add your first organization with name, email, and password."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
