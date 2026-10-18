// Tiny sanity check for the seed data + pure lib functions.
// Run with: npm run selfcheck
import {
  BATCHES,
  DEMO_START,
  DISHES,
  RIYA_PROFILE,
} from "../lib/seed";
import { computeThermal, type ThermalStatus } from "../lib/thermal";
import { rankDishes } from "../lib/match";

let failures = 0;

function check(label: string, pass: boolean, detail: string) {
  const mark = pass ? "✓" : "✗";
  console.log(`${mark} ${label} — ${detail}`);
  if (!pass) failures += 1;
}

console.log("── Thermal Debt ──────────────────────────────────────────");

const expectedStatus: Record<string, ThermalStatus> = {
  P023: "within",
  S118: "within",
  R041: "warning",
  C044: "blocked",
  B207: "unknown",
};

for (const batch of BATCHES) {
  const result = computeThermal(batch.readings, batch.saleWindowEnd, DEMO_START);
  const pct = Math.round(result.pct * 100);
  const windowLeft =
    result.windowLeftMinutes === null
      ? "—"
      : `${Math.floor(result.windowLeftMinutes / 60)}h ${Math.round(result.windowLeftMinutes % 60)}m`;
  check(
    `${batch.id} ${batch.name}`,
    result.status === expectedStatus[batch.id],
    `status=${result.status} (expected ${expectedStatus[batch.id]}), debt=${pct}%, temp=${result.currentTemp ?? "—"}, windowLeft=${windowLeft}`
  );
}

console.log("\n── Taste Match ───────────────────────────────────────────");

const ranked = rankDishes(DISHES, RIYA_PROFILE, (dish) =>
  dish.stock === "available" ? "available" : dish.stock
);

ranked.forEach((dish, i) => {
  console.log(`  ${i + 1}. ${dish.name} — ${dish.match.display}% match — "${dish.match.why}"`);
});

// The design mockup's 3-card "Picked for you" screen (Pesto Paneer Sandwich
// 96%, Iced Latte 91%, Blueberry Muffin 84%) is an illustrative snapshot,
// not a literal computed output — other dishes that legitimately share
// Riya's liked ingredients (Paneer Tikka Bowl, Veg Sandwich) also score
// highly, which is correct behaviour. We check the three featured dishes
// each land "about" where the mockup suggests, not that they occupy
// specific ranks.
const featured: Array<{ id: string; target: number }> = [
  { id: "pesto-paneer-sandwich", target: 96 },
  { id: "iced-latte", target: 91 },
  { id: "blueberry-muffin", target: 84 },
];

for (const { id, target } of featured) {
  const dish = ranked.find((d) => d.id === id);
  const display = dish?.match.display ?? -1;
  const diff = Math.abs(display - target);
  check(
    `${id} score is "about" ${target}%`,
    dish !== undefined && diff <= 15,
    `got ${display}%, target ${target}% (diff ${diff})`
  );
}

check(
  "Non-veg dish hidden for Riya's veg diet",
  ranked.every((d) => d.id !== "grilled-chicken-bowl"),
  `ranked list has ${ranked.length} dishes, grilled-chicken-bowl excluded`
);

console.log("\n── Descending order sanity (full ranked list) ────────────");
let isDescending = true;
for (let i = 1; i < ranked.length; i++) {
  if (ranked[i].match.display > ranked[i - 1].match.display) isDescending = false;
}
check("Full ranked list is non-increasing", isDescending, `${ranked.length} dishes ranked`);

console.log("\n──────────────────────────────────────────────────────────");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("All checks passed.");
}
