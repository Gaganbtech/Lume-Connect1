interface TravlumeBrandProps {
  variant?: "light" | "dark";
  showSubtitle?: boolean;
  className?: string;
}

export function TravlumeBrand({
  variant = "light",
  showSubtitle = true,
  className = "",
}: TravlumeBrandProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Brand Icon / Logo Mark */}
      <div className="relative h-10 w-10 rounded-xl bg-[#242D53] border border-[#D2B68D]/40 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
        <span className="font-extrabold text-base tracking-tighter text-[#D2B68D]">
          TL
        </span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#D2B68D] to-[#C4A67D]" />
      </div>

      {/* Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-extrabold text-xl tracking-tight ${
              variant === "dark" ? "text-white" : "text-[#242D53]"
            }`}
          >
            Trav<span className="text-[#D2B68D]">Lume</span>
          </span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#242D53]/10 text-[#242D53] border border-[#242D53]/15 tracking-wide">
            Connect
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`text-[10px] tracking-wider font-semibold uppercase mt-1 ${
              variant === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Enterprise Super Admin
          </span>
        )}
      </div>
    </div>
  );
}
