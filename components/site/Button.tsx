import type { ReactNode } from "react";

/**
 * Every call to action on the page is an outbound link to GitHub, so this is a
 * styled anchor rather than a button — nothing here submits or toggles.
 */
export default function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  external = true,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
  external?: boolean;
  className?: string;
}) {
  const base =
    "group inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-bright)]";

  const sizes = {
    md: "h-11 px-5 text-[14px]",
    lg: "h-13 px-7 text-[15px]",
  };

  const variants = {
    primary:
      "bg-[var(--accent)] text-white shadow-[0_8px_28px_-8px_rgba(124,58,237,.9)] hover:bg-[var(--accent-bright)] hover:shadow-[0_12px_34px_-8px_rgba(168,85,247,.95)] hover:-translate-y-0.5",
    ghost:
      "border border-[var(--hairline)] bg-white/[.03] text-[var(--foreground)] backdrop-blur hover:bg-white/[.07] hover:border-[var(--hairline-bright)]",
  };

  return (
    <a
      href={href}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {children}
    </a>
  );
}
