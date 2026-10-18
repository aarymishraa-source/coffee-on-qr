import type { ReactNode } from "react";

interface MonoLabelProps {
  children: ReactNode;
  className?: string;
}

/** Small uppercase mono section label — INGREDIENTS, PICK UP, WHY YOU'RE SEEING THIS. */
export function MonoLabel({ children, className = "" }: MonoLabelProps) {
  return <span className={`mono-label text-muted ${className}`}>{children}</span>;
}
