export type Role = "ADMIN" | "CAFE_MANAGER" | "FPO_MANAGER" | "FIELD_AGENT" | "FARMER";

/** Whoever is performing an action — a signed-in user, or a farmer reaching us over WhatsApp. */
export interface Actor {
  id: string | null;
  name: string;
  role: Role;
  isDemo: boolean;
  cafeId: string | null;
  fpoId: string | null;
  farmerId: string | null;
  fieldAgentId: string | null;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  CAFE_MANAGER: "Café manager",
  FPO_MANAGER: "FPO manager",
  FIELD_AGENT: "Field agent",
  FARMER: "Farmer",
};

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/console/supply",
  CAFE_MANAGER: "/console/supply",
  FPO_MANAGER: "/kisan/fpo",
  FIELD_AGENT: "/kisan",
  FARMER: "/kisan",
};
