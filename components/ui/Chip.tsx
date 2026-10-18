import type { ReactNode } from "react";

type Variant = "outline" | "filled" | "tinted";
type Tone = "default" | "matcha" | "crema" | "signal" | "espresso";

interface ChipProps {
  children: ReactNode;
  variant?: Variant;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

const tintedTones: Record<Tone, string> = {
  default: "bg-line/50 text-muted",
  matcha: "bg-matcha/25 text-forest",
  crema: "bg-crema/20 text-crema",
  signal: "bg-signal/15 text-signal",
  espresso: "bg-espresso/10 text-espresso",
};

export function Chip({
  children,
  variant = "outline",
  tone = "default",
  active = false,
  onClick,
  icon,
  className = "",
}: ChipProps) {
  const isActive = active || variant === "filled";

  const base = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors";
  const look = isActive
    ? "bg-espresso text-oat border border-espresso"
    : variant === "tinted"
      ? `border border-transparent ${tintedTones[tone]}`
      : "bg-transparent text-espresso border border-line";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={`${base} ${look} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${className}`}
      >
        {icon}
        {children}
      </button>
    );
  }

  return (
    <span className={`${base} ${look} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
