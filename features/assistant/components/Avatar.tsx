import { cn } from "@/lib/utils";

const TONES = ["bg-primary-soft text-primary", "bg-warning-soft text-warning", "bg-sunken text-foreground", "bg-matcha/30 text-forest"];

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const tone = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-sm font-medium", tone, className)}
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function AssistantAvatar({ size = 40 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full bg-forest" style={{ width: size, height: size }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M5 19c0-8 6-13 14-14-1 8-6 14-14 14Z" stroke="#A8C47A" strokeWidth="2" strokeLinejoin="round" />
        <path d="M5 19 13 11" stroke="#A8C47A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
