"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  default: "bg-[rgba(255,251,236,0.05)] text-[var(--color-text-muted)] border border-[rgba(255,251,236,0.10)]",
  primary: "bg-[rgba(17,166,166,0.10)] text-[var(--theme-accent-teal)] border border-[rgba(17,166,166,0.24)]",
  success: "bg-[rgba(17,163,106,0.10)] text-[var(--theme-accent-green)] border border-[rgba(17,163,106,0.24)]",
  warning: "bg-[rgba(245,158,11,0.10)] text-[#F5C04C] border border-[rgba(245,158,11,0.22)]",
  error: "bg-[rgba(239,68,68,0.10)] text-[#F87171] border border-[rgba(239,68,68,0.22)]",
  info: "bg-[rgba(36,107,254,0.10)] text-[var(--theme-accent-blue)] border border-[rgba(36,107,254,0.24)]",
  rose: "bg-[rgba(201,138,173,0.10)] text-[var(--theme-accent-rose)] border border-[rgba(201,138,173,0.26)]",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium tracking-[0.02em]",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "success" && "bg-[var(--theme-accent-green)]",
            variant === "warning" && "bg-yellow-400",
            variant === "error" && "bg-red-400",
            variant === "info" && "bg-[var(--theme-accent-blue)]",
            variant === "primary" && "bg-[var(--theme-accent-teal)]",
            variant === "rose" && "bg-[var(--theme-accent-rose)]",
            variant === "default" && "bg-gray-400"
          )}
        />
      )}
      {icon && <span style={{ fontSize: "13px" }}>{icon}</span>}
      {children}
    </span>
  );
}
