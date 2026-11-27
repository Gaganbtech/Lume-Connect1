"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentAdmin,
  addOrganization,
  listOrganizations,
  updateOrganizationStatus,
  deleteOrganization,
} from "@/lib/supabase/service";
import { Organization, OrganizationStatus, SuperAdminUser } from "@/lib/supabase/types";
import { AdminHeader } from "@/components/AdminHeader";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ban,
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
  Trash2,
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

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load organizations from Supabase / local storage
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
    setActionNotice(null);

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
      const { data, error } = await addOrganization(name, email, password, "active");

      if (error || !data) {
        setFormError(error || "Failed to save organization to database.");
        setSubmitting(false);
        return;
      }

      setSuccessOrg(data);
      setOrgName("");
      setOrgEmail("");
      setOrgPassword("");

      // Immediately append to local organizations list so it shows up with 0 lag
      setOrganizations((prev) => {
        const exists = prev.some((o) => o.id === data.id || o.email.toLowerCase() === data.email.toLowerCase());
        return exists ? prev : [data, ...prev];
      });

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

  // Status toggle handler
  const handleToggleStatus = async (org: Organization) => {
    const newStatus: OrganizationStatus = org.status === "suspended" ? "active" : "suspended";
    setActionLoadingId(org.id);
    setActionNotice(null);

    // Optimistic UI update
    setOrganizations((prev) =>
      prev.map((o) => (o.id === org.id ? { ...o, status: newStatus } : o))
    );

    try {
      const { success, error } = await updateOrganizationStatus(org.id, newStatus);
      if (!success && error) {
        setActionNotice({ message: error, type: "error" });
        await loadOrganizations();
      } else {
        setActionNotice({
          message: `"${org.name}" status updated to ${newStatus.toUpperCase()}.`,
          type: "success",
        });
      }
    } catch {
      setActionNotice({ message: "Failed to update organization status.", type: "error" });
      await loadOrganizations();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete confirmation handler
  const handleConfirmDelete = async () => {
    if (!deletingOrg) return;
    setDeleteLoading(true);
    setActionNotice(null);

    const orgId = deletingOrg.id;
    const orgEmail = deletingOrg.email;
    const orgName = deletingOrg.name;

    // Optimistic UI removal
    setOrganizations((prev) => prev.filter((o) => o.id !== orgId));

    try {
      const { success, error } = await deleteOrganization(orgId, orgEmail);
      if (!success && error) {
        setActionNotice({ message: error, type: "error" });
        await loadOrganizations();
      } else {
        setActionNotice({
          message: `Organization "${orgName}" removed from directory.`,
          type: "success",
        });
      }
    } catch {
      setActionNotice({ message: "Failed to delete organization.", type: "error" });
      await loadOrganizations();
    } finally {
      setDeleteLoading(false);
      setDeletingOrg(null);
    }
  };

  const filteredOrgs = organizations.filter((org) => {
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.email.toLowerCase().includes(q)
    );
  });

  const activeCount = organizations.filter((o) => o.status !== "suspended").length;
  const suspendedCount = organizations.filter((o) => o.status === "suspended").length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans">
      <AdminHeader user={currentUser} />

      {/* Confirmation Modal for Delete Action */}
      {deletingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#243354] p-5 text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Organization</h3>
                <p className="text-xs text-slate-300">Permanent offboarding confirmation</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900">{deletingOrg.name}</strong> (<span className="text-slate-700 font-mono text-xs">{deletingOrg.email}</span>)?
              </p>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  This action permanently removes tenant credentials and revokes portal access. This action cannot be undone.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingOrg(null)}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 shadow-sm shadow-red-600/20 transition-all cursor-pointer"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Organization</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Executive Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#243354]/10 text-[#243354] border border-[#243354]/15 mb-2">
                <Layers className="w-3.5 h-3.5 text-[#243354]" />
                Tenant Management Suite
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#243354]">
                Organization Directory &amp; Provisioning
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Provision client organizations, manage lifecycle status (Active/Suspended), and enforce RBAC credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Notification */}
        {actionNotice && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
              actionNotice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-xs font-semibold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Enterprise KPI Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#243354]/10 text-[#243354] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Organizations
              </div>
              <div className="text-2xl font-extrabold text-[#243354] mt-0.5">
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
                Tenant Status
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {activeCount} Active
                </span>
                {suspendedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-700 pl-1.5 border-l border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {suspendedCount} Suspended
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#D9B68F]/25 text-[#243354] flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Access Enforcement
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                Suspension &amp; RBAC Active
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
              <div className="bg-gradient-to-r from-[#243354] to-[#1C2742] p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#D9B68F] border border-white/10">
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
                            <span className="font-bold text-[#243354]">{successOrg.name}</span>
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
                            Role: {successOrg.role} &bull; Status: {successOrg.status || "active"}
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
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#243354] focus:outline-none focus:ring-4 focus:ring-[#243354]/10 transition-all font-medium"
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
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#243354] focus:outline-none focus:ring-4 focus:ring-[#243354]/10 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
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
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl border border-slate-200 focus:border-[#243354] focus:outline-none focus:ring-4 focus:ring-[#243354]/10 transition-all font-medium"
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
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-[#243354] hover:bg-[#1C2742] active:bg-[#161F35] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[#243354]/20 hover:shadow-lg transition-all cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#D9B68F]" />
                          <span>Provisioning Tenant...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-[#D9B68F]" />
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
                    <h2 className="text-base font-bold text-[#243354]">
                      Organizations Directory
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#243354]/10 text-[#243354]">
                      {organizations.length} {organizations.length === 1 ? "Tenant" : "Tenants"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage tenant statuses, credentials &amp; platform lifecycle
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadOrganizations}
                    disabled={loadingList}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#243354] hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    title="Refresh data from Supabase &amp; local storage"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin text-[#243354]" : ""}`} />
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
                      className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#243354] transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Table or Empty State */}
              {loadingList && organizations.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#243354] mb-3" />
                  <p className="text-xs font-medium">Synchronizing organizations...</p>
                </div>
              ) : filteredOrgs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredOrgs.map((org) => {
                    const initial = org.name.charAt(0).toUpperCase();
                    const isSuspended = org.status === "suspended";
                    const isSuperAdmin = org.role === "super_admin";

                    return (
                      <div
                        key={org.id}
                        className={`p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                          isSuspended ? "bg-amber-50/30 hover:bg-amber-50/50" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Organization Avatar */}
                          <div
                            className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shadow-2xs flex-shrink-0 ${
                              isSuspended
                                ? "bg-slate-300 text-slate-600"
                                : "bg-[#243354] text-[#D9B68F]"
                            }`}
                          >
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3
                                className={`text-sm font-bold truncate ${
                                  isSuspended ? "text-slate-600 line-through decoration-amber-500/70" : "text-slate-900"
                                }`}
                              >
                                {org.name}
                              </h3>
                              {isSuspended && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1 truncate text-slate-600 font-medium">
                                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                {org.email}
                              </span>
                              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                {org.updated_at
                                  ? `Updated: ${new Date(org.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : new Date(org.created_at).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions & Status Pill Bar */}
                        <div className="flex items-center gap-2.5 flex-shrink-0 pt-2 sm:pt-0 justify-end border-t sm:border-t-0 border-slate-100">
                          {/* Role Badge */}
                          {isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#D9B68F]/20 text-[#243354] border border-[#D9B68F]">
                              <ShieldCheck className="w-3 h-3 text-[#243354]" />
                              Super Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <KeyRound className="w-3 h-3" />
                              Tenant
                            </span>
                          )}

                          {/* Status Toggle Button (Active / Suspended) */}
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(org)}
                              disabled={actionLoadingId === org.id}
                              title={isSuspended ? "Click to Activate this organization" : "Click to Suspend this organization"}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                isSuspended
                                  ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              }`}
                            >
                              {actionLoadingId === org.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isSuspended ? (
                                <Ban className="w-3 h-3 text-amber-600" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              )}
                              <span>{isSuspended ? "Suspended" : "Active"}</span>
                            </button>
                          )}

                          {/* Delete Button */}
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeletingOrg(org)}
                              title="Delete organization"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
                              aria-label={`Delete ${org.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#243354]/5 text-[#243354] flex items-center justify-center mb-3">
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
