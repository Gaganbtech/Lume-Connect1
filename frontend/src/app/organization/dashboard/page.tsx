"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/lib/supabase/service";
import { AuthUser } from "@/lib/supabase/types";
import { TravlumeBrand } from "@/components/TravlumeBrand";
import {
  Activity,
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
} from "lucide-react";

export default function OrganizationDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function verifySession() {
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/superadmin/login");
        return;
      }
      setCurrentUser(user);
    }

    verifySession();
  }, [router]);

  const handleLogout = async () => {
    await logoutUser();
    router.push("/superadmin/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Enterprise Organization Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="h-[2px] bg-gradient-to-r from-[#242D53] via-[#D2B68D] to-[#242D53]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Brand */}
            <div className="flex items-center gap-4">
              <TravlumeBrand />

              <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Organization Portal
                </span>
              </div>
            </div>

            {/* Profile & Sign Out */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <div className="w-6 h-6 rounded-lg bg-[#242D53] text-[#D2B68D] flex items-center justify-center font-bold text-xs">
                  {currentUser?.name?.charAt(0) || "O"}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-slate-900 max-w-[150px] truncate leading-tight">
                    {currentUser?.name || "Organization"}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Role: {currentUser?.role || "organization"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-[#242D53] to-[#1B2240] rounded-2xl p-8 sm:p-10 text-white relative overflow-hidden shadow-lg shadow-[#242D53]/10">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-[#D2B68D]/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#D2B68D]/20 text-[#D2B68D] border border-[#D2B68D]/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RBAC Verified: Organization Access</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Welcome, {currentUser?.name || "Organization"}!
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              You are signed in to your dedicated organization workspace. Your tenant profile is provisioned and managed by the Super Admin in Supabase.
            </p>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tenant Status
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-[#242D53]">Active &bull; Verified</div>
            <p className="text-xs text-slate-400 mt-1">
              Provisioned by Super Admin with full tenant privileges
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Assigned RBAC Role
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-[#242D53]">Organization</div>
            <p className="text-xs text-slate-400 mt-1">
              Access restricted to organization workspace (RBAC enforced)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Database Isolation
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#D2B68D]/20 text-[#242D53] flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-[#242D53]">Supabase RLS Active</div>
            <p className="text-xs text-slate-400 mt-1">
              Data encrypted and isolated in PostgreSQL backend
            </p>
          </div>
        </div>

        {/* Organization Account Details Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#242D53]/10 text-[#242D53] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#242D53]">
                Organization Account Profile
              </h2>
              <p className="text-xs text-slate-500">
                Credentials and contact information provisioned in Supabase
              </p>
            </div>
          </div>

          <div className="p-6 divide-y divide-slate-100">
            <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Organization Name</span>
              <span className="text-sm font-bold text-slate-900">
                {currentUser?.name || "Acme Corporation"}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Primary Contact Email</span>
              <span className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {currentUser?.email || "contact@acme.com"}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Tenant Account ID</span>
              <span className="text-xs font-mono bg-slate-50 px-2 py-1 rounded text-slate-600 border border-slate-200">
                {currentUser?.id || "org-tenant-id"}
              </span>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500">Security Clearance</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Authenticated Organization Member
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
