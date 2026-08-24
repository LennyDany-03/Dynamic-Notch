import type { ReactNode } from "react";

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
  variant?: "primary" | "secondary" | "onColor" | "onColorGhost";
  size?: "md" | "lg";
  external?: boolean;
  className?: string;
}) {
  const base =
    "press group inline-flex items-center justify-center gap-2 rounded-[var(--r-pill)] font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out-quart)]";

  
  const sizes = {
    md: "h-11 px-5 text-[14px]",
    lg: "h-[52px] px-7 text-[15px]",
  };

  const variants = {
    primary:
      "bg-[var(--accent)] text-white shadow-[var(--sh-cta)] hover:bg-[var(--accent-bright)]",
    secondary:
      "border border-[var(--hairline)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] hover:border-[var(--hairline-strong)]",
    
    onColor: "bg-white text-[var(--surface-raised)] hover:bg-white/90",
    onColorGhost: "glass-on-color text-white hover:bg-white/20",
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
