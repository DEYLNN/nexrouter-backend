"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  primary: "bg-[var(--theme-accent-teal)] hover:bg-[#0D8585] text-white shadow-[0_8px_22px_-10px_rgba(17,166,166,0.55)] disabled:opacity-40",
  secondary: "bg-[rgba(255,251,236,0.04)] hover:bg-[rgba(255,251,236,0.08)] text-[var(--color-text-main)] border border-[rgba(255,251,236,0.10)] hover:border-[rgba(255,251,236,0.18)] disabled:opacity-40",
  outline: "border border-[rgba(255,251,236,0.14)] text-[var(--color-text-main)] hover:bg-[rgba(255,251,236,0.04)] hover:border-[rgba(17,166,166,0.45)]",
  ghost: "text-[var(--color-text-muted)] hover:bg-[rgba(255,251,236,0.04)] hover:text-[var(--color-text-main)]",
  danger: "bg-[rgba(239,68,68,0.10)] hover:bg-[rgba(239,68,68,0.18)] text-[#F87171] border border-[rgba(239,68,68,0.22)] disabled:opacity-40",
  success: "bg-[rgba(17,163,106,0.10)] hover:bg-[rgba(17,163,106,0.18)] text-[var(--theme-accent-green)] border border-[rgba(17,163,106,0.24)] disabled:opacity-40",
};

const sizes = {
  sm: "h-7 px-3 text-xs rounded-[10px]",
  md: "h-9 px-4 text-sm rounded-[12px]",
  lg: "h-11 px-6 text-sm rounded-[12px]",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ease-out cursor-pointer",
        "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
      ) : icon ? (
        typeof icon === "string" ? (
          <span className="material-symbols-outlined text-[16px] leading-none">{icon}</span>
        ) : (
          <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
        )
      ) : null}
      {children}
      {iconRight && !loading && (
        <span style={{ display: "flex", alignItems: "center" }}>{iconRight}</span>
      )}
    </button>
  );
}

// Note: add @keyframes spin to globals.css if not present
