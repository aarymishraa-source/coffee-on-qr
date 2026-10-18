// Flat illustrated SVGs — no stock photos (CLAUDE.md §3).

interface IllustrationProps {
  className?: string;
}

/** Leaf in a circle with three small dots — the ingredient card artwork. */
export function LeafCircle({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="#3B5A38" />
      <path
        d="M100 32c26 22 38 46 38 70 0 30-17 50-38 66-21-16-38-36-38-66 0-24 12-48 38-70z"
        fill="#A8C47A"
      />
      <path
        d="M100 44v118M100 80l-20-14M100 80l20-14M100 104l-24-16M100 104l24-16M100 128l-20-14M100 128l20-14"
        stroke="#1F3A1E"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="160" cy="62" r="7" fill="#FBFAF5" />
      <circle cx="40" cy="146" r="10" fill="#FBFAF5" />
      <circle cx="162" cy="142" r="12" fill="#C2702E" />
    </svg>
  );
}

interface SandwichProps extends IllustrationProps {
  /** "warm" = toasted (dish hero), "plain" = white bread (offer card) */
  variant?: "warm" | "plain";
  shadow?: boolean;
}

/** Simple isometric sandwich slab. */
export function Sandwich({ className = "", variant = "warm", shadow = true }: SandwichProps) {
  const top = variant === "warm" ? "#D9A55B" : "#F7F3E8";
  const left = variant === "warm" ? "#C2702E" : "#E8C98A";
  const right = variant === "warm" ? "#A95E24" : "#D9A55B";
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      {shadow && <ellipse cx="120" cy="104" rx="96" ry="28" fill="#000" opacity="0.18" />}
      <polygon points="40,60 120,100 120,114 40,74" fill={left} />
      <polygon points="120,100 200,60 200,74 120,114" fill={right} />
      <polygon points="120,20 200,60 120,100 40,60" fill={top} />
      {variant === "warm" && (
        <>
          <circle cx="98" cy="58" r="3.5" fill="#FBFAF5" />
          <circle cx="120" cy="48" r="3.5" fill="#FBFAF5" />
          <circle cx="142" cy="64" r="3.5" fill="#FBFAF5" />
        </>
      )}
    </svg>
  );
}

/** Tall iced glass for drinks. */
export function IcedGlass({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <ellipse cx="120" cy="132" rx="60" ry="12" fill="#000" opacity="0.18" />
      <path d="M92 22h56l-8 108h-40z" fill="#FBFAF5" opacity="0.92" />
      <path d="M95 56h50l-5 74h-40z" fill="#C2702E" />
      <rect x="104" y="40" width="14" height="14" rx="3" fill="#E4E0D3" />
      <rect x="122" y="46" width="14" height="14" rx="3" fill="#E4E0D3" />
      <path d="M132 22l14-20" stroke="#A8C47A" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** Muffin with a domed top. */
export function Muffin({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <ellipse cx="120" cy="128" rx="70" ry="14" fill="#000" opacity="0.18" />
      <path d="M78 76h84l-12 54h-60z" fill="#C2702E" />
      <path d="M96 80l4 50M120 80v50M144 80l-4 50" stroke="#A95E24" strokeWidth="4" />
      <path d="M70 80c0-34 22-52 50-52s50 18 50 52z" fill="#D9A55B" />
      <circle cx="102" cy="56" r="6" fill="#4B4E8C" />
      <circle cx="132" cy="48" r="6" fill="#4B4E8C" />
      <circle cx="142" cy="68" r="6" fill="#4B4E8C" />
      <circle cx="112" cy="70" r="5" fill="#4B4E8C" />
    </svg>
  );
}

/** Shallow bowl — rice bowls, pasta, noodles. */
export function Bowl({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <ellipse cx="120" cy="124" rx="88" ry="16" fill="#000" opacity="0.18" />
      <ellipse cx="120" cy="66" rx="84" ry="26" fill="#D9A55B" />
      <circle cx="96" cy="60" r="9" fill="#C2702E" />
      <circle cx="128" cy="54" r="8" fill="#A8C47A" />
      <circle cx="146" cy="70" r="7" fill="#FBFAF5" />
      <circle cx="108" cy="76" r="6" fill="#A8C47A" />
      <path d="M36 66c4 38 40 58 84 58s80-20 84-58z" fill="#FBFAF5" />
    </svg>
  );
}

export function DishIllustration({ dishId, className = "" }: { dishId: string; className?: string }) {
  if (dishId === "iced-latte") return <IcedGlass className={className} />;
  if (dishId === "blueberry-muffin") return <Muffin className={className} />;
  if (dishId.includes("sandwich")) return <Sandwich className={className} />;
  return <Bowl className={className} />;
}
