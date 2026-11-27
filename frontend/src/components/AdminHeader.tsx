"use client";

import { useRouter } from "next/navigation";
import { logoutSuperAdmin } from "@/lib/supabase/service";
import { SuperAdminUser } from "@/lib/supabase/types";
import { TravlumeBrand } from "./TravlumeBrand";
import { Database, LogOut, ShieldCheck } from "lucide-react";

interface AdminHeaderProps {
  user?: SuperAdminUser | null;
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutSuperAdmin();
    router.push("/superadmin/login");
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top micro gold line */}
      <div className="h-[2px] bg-gradient-to-r from-[#242D53] via-[#D2B68D] to-[#242D53]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <TravlumeBrand />

            <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-200">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#242D53]/5 text-[#242D53] border border-[#242D53]/10">
                <ShieldCheck className="w-3.5 h-3.5 text-[#242D53]" />
                Super Admin Console
              </span>
            </div>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center gap-3.5">
            {/* Live Database Status */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Database className="w-3 h-3 text-emerald-600" />
              <span>Supabase Connected</span>
            </div>

            {/* Admin User Info */}
            {user?.email && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-[#242D53] text-[#D2B68D] flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-slate-900 max-w-[160px] truncate leading-tight">
                    {user.email}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    Super Admin
                  </span>
                </div>
              </div>
            )}

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
              title="Sign Out of Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
