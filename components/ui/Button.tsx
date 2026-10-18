import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "matcha" | "outline" | "ghost" | "danger";
type Size = "md" | "sm" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-espresso text-oat hover:bg-espresso/90",
  matcha: "bg-matcha text-espresso hover:bg-matcha/90",
  outline: "bg-transparent text-espresso border border-line hover:bg-oat",
  ghost: "bg-oat text-espresso hover:bg-line/60",
  danger: "bg-signal text-oat hover:bg-signal/90",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3.5 py-1.5 gap-1.5",
  md: "text-sm px-5 py-3 gap-2",
  lg: "text-base px-6 py-3.5 gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
