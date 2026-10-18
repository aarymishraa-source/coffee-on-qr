// Taste match scoring — see CLAUDE.md §7 "Match score".

import type { Dish } from "./seed";

export type Diet = "veg" | "non-veg";

export interface CustomerProfile {
  diet: Diet;
  budget: number;
  likedIngredientIds: string[];
  dislikedIngredientIds: string[];
  avoidAllergens: string[];
}

export interface MatchResult {
  score: number; // raw 0..1ish, can go negative with dislikes
  display: number; // "NN% match"
  hidden: boolean;
  why: string;
}

export function computeMatch(
  dish: Dish,
  profile: CustomerProfile,
  stock: number | "available" | "sold-out"
): MatchResult {
  const inStock = stock === "available" || (typeof stock === "number" && stock > 0);

  const dietBlocked = profile.diet === "veg" && dish.diet === "non-veg";
  const allergenBlocked = dish.allergens.some((a) => profile.avoidAllergens.includes(a));

  const likedInDish = dish.ingredientIds.filter((id) =>
    profile.likedIngredientIds.includes(id)
  );
  const dislikedInDish = dish.ingredientIds.filter((id) =>
    profile.dislikedIngredientIds.includes(id)
  );

  const ingredientFit = dish.ingredientIds.length > 0 ? likedInDish.length / dish.ingredientIds.length : 0;
  const budgetFit = dish.price <= profile.budget ? 1 : 0.3;
  const availabilityFit = inStock ? 1 : 0;

  const score =
    0.6 * ingredientFit +
    0.25 * budgetFit +
    0.15 * availabilityFit -
    0.4 * dislikedInDish.length;

  const display = Math.round(55 + score * 45);
  const hidden = dietBlocked || allergenBlocked;

  const why = dish.whyOverride ?? buildWhyLine(dish, likedInDish);

  return { score, display, hidden, why };
}

function buildWhyLine(dish: Dish, likedInDish: string[]): string {
  if (likedInDish.length === 0) {
    return `From ${dish.cafeName}`;
  }
  const names = likedInDish.map((id) => INGREDIENT_NAME_LOOKUP[id] ?? id);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Because you liked ${list}`;
}

// Populated lazily by seed.ts to avoid a circular import; see registerIngredientNames().
const INGREDIENT_NAME_LOOKUP: Record<string, string> = {};

export function registerIngredientNames(lookup: Record<string, string>) {
  Object.assign(INGREDIENT_NAME_LOOKUP, lookup);
}

export function rankDishes(
  dishes: Dish[],
  profile: CustomerProfile,
  stockFor: (dish: Dish) => number | "available" | "sold-out"
): Array<Omit<Dish, "stock"> & { match: MatchResult; stock: number | "available" | "sold-out" }> {
  return dishes
    .map((dish) => {
      const stock = stockFor(dish);
      return { ...dish, stock, match: computeMatch(dish, profile, stock) };
    })
    .filter((d) => !d.match.hidden)
    .sort((a, b) => b.match.display - a.match.display);
}
