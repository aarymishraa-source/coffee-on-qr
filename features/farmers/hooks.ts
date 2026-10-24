"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetcher";
import type { IngredientOption } from "./types";

/** Farm-sourced ingredient names keyed by id (crop ids are ingredient ids). */
export function useIngredientNames() {
  const q = useQuery({ queryKey: ["ingredients"], queryFn: () => apiGet<IngredientOption[]>("/api/ingredients"), staleTime: 60_000 });
  const options = q.data ?? [];
  const names = Object.fromEntries(options.map((o) => [o.id, o.name])) as Record<string, string>;
  return { names, options };
}
