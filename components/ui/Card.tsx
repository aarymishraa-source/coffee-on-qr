import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** oat (default surface), forest (dark brand card), espresso (dark console card) */
  tone?: "oat" | "forest" | "espresso" | "paper";
}

const toneClasses: Record<NonNullable<CardProps["tone"]>, string> = {
  oat: "bg-oat border border-line text-espresso",
  paper: "bg-paper border border-line text-espresso",
  forest: "bg-forest border border-forest text-oat",
  espresso: "bg-espresso border border-espresso/80 text-oat",
};

export function Card({ children, tone = "oat", className = "", ...props }: CardProps) {
  return (
    <div className={`rounded-2xl ${toneClasses[tone]} ${className}`} {...props}>
      {children}
    </div>
  );
}
