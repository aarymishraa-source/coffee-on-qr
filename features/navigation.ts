import type { Role } from "@/server/auth/types";

// One navigation for the café console and the Kisan module. Pages enforce the
// same `roles` server-side (requirePage) and APIs enforce them again.
export interface NavItem {
  href: string;
  label: string;
  icon: "today" | "supply" | "orders" | "batches" | "payments" | "assistant" | "farmers" | "fpo" | "agents" | "settings";
  roles: Role[];
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const CAFE: Role[] = ["ADMIN", "CAFE_MANAGER"];

export const NAV: NavGroup[] = [
  {
    label: "Café",
    items: [
      { href: "/console", label: "Today", icon: "today", roles: CAFE, exact: true },
      { href: "/console/supply", label: "Supply forecast", icon: "supply", roles: CAFE, exact: true },
      { href: "/console/supply/orders", label: "Farm orders", icon: "orders", roles: [...CAFE, "FPO_MANAGER"] },
      { href: "/console/supply/batches", label: "Harvest batches", icon: "batches", roles: [...CAFE, "FPO_MANAGER"] },
      { href: "/console/supply/payments", label: "Payments", icon: "payments", roles: CAFE },
    ],
  },
  {
    label: "Kisan Sahayak",
    items: [
      { href: "/kisan", label: "Assistant", icon: "assistant", roles: ["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"], exact: true },
      { href: "/kisan/farmers", label: "Farmers", icon: "farmers", roles: ["ADMIN", "FPO_MANAGER", "FIELD_AGENT"] },
      { href: "/kisan/fpo", label: "FPO overview", icon: "fpo", roles: ["ADMIN", "FPO_MANAGER"] },
      { href: "/kisan/agents", label: "Field agents", icon: "agents", roles: ["ADMIN", "FPO_MANAGER"] },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/console/settings/integrations", label: "Integrations", icon: "settings", roles: ["ADMIN"] }],
  },
];

/** Extra routes not in the nav but guarded the same way. */
const EXTRA: { href: string; roles: Role[] }[] = [
  { href: "/kisan/farmers/new", roles: ["ADMIN", "FPO_MANAGER", "FIELD_AGENT"] },
];

export function rolesFor(path: string): Role[] | null {
  const all = [...NAV.flatMap((g) => g.items), ...EXTRA];
  const match = all
    .filter((i) => path === i.href || path.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.roles ?? null;
}

export function navFor(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
}
