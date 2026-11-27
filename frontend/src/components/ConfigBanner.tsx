"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export function ConfigBanner() {
  const [configured] = useState<boolean>(() => isSupabaseConfigured());
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (configured) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Connected to live Supabase project.</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Dev Mode Active:</strong> Add your real Supabase credentials to{" "}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code> to save data directly to your remote Supabase database.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-amber-700 hidden md:inline">
            Local simulated auth & storage active
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-700 hover:text-amber-950 p-1 rounded hover:bg-amber-100 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
