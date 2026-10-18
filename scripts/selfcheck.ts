// Tiny sanity check for the seed data + pure lib functions.
// Run with: npm run selfcheck
import {
  BATCHES,
  DEMO_START,
  DISHES,
  FEATURED_PICKS_DEFAULT,
  RIYA_PROFILE,
} from "../lib/seed";
import { computeThermal, type ThermalStatus } from "../lib/thermal";
import { rankDishes, rankDishesForDisplay } from "../lib/match";
import { canApproveOffer, isOfferWithdrawn } from "../lib/selectors";

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

// The honest formula alone doesn't reproduce the mockup's exact top 3
// (Paneer Tikka Bowl and Veg Sandwich legitimately score well too, since
// they share Riya's liked ingredients) — that's expected, not a bug.
for (const { dishId, display: target } of FEATURED_PICKS_DEFAULT) {
  const dish = ranked.find((d) => d.id === dishId);
  const diff = Math.abs((dish?.match.display ?? -1) - target);
  check(
    `${dishId} honest score is roughly in range of ${target}%`,
    dish !== undefined && diff <= 15,
    `got ${dish?.match.display}%, mockup target ${target}% (diff ${diff})`
  );
}

console.log("\n── Picked for you (default, pre-swipe display) ───────────");
const displayRanked = rankDishesForDisplay(
  DISHES,
  RIYA_PROFILE,
  (dish) => (dish.stock === "available" ? "available" : dish.stock),
  FEATURED_PICKS_DEFAULT
);
displayRanked.slice(0, 3).forEach((dish, i) => {
  console.log(`  ${i + 1}. ${dish.name} — ${dish.match.display}% match`);
});
check(
  "Default top 3 exactly matches the design mockup",
  JSON.stringify(displayRanked.slice(0, 3).map((d) => `${d.id}:${d.match.display}`)) ===
    JSON.stringify(FEATURED_PICKS_DEFAULT.map((f) => `${f.dishId}:${f.display}`)),
  `got [${displayRanked.slice(0, 3).map((d) => `${d.id}:${d.match.display}%`).join(", ")}]`
);

check(
  "Featured override disappears once swiped (falls back to honest ranking)",
  JSON.stringify(rankDishesForDisplay(DISHES, RIYA_PROFILE, (dish) =>
    dish.stock === "available" ? "available" : dish.stock
  ).map((d) => d.id)) === JSON.stringify(ranked.map((d) => d.id)),
  "rankDishesForDisplay(..., []) === rankDishes(...)"
);

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

console.log("\n── Console demo moments ──────────────────────────────────");

// "Push Cooked rice tray to 12°C and fast-forward" — mirrors what
// SensorSimulator.setSimTemp() + fastForward30() do to the store: append a
// reading at the pushed temp, then (after 30 min) append another at the
// same temp.
function pushAndFastForward(batchId: string, pushedTemp: number) {
  const batch = BATCHES.find((b) => b.id === batchId)!;
  const afterPush = [...batch.readings, { at: DEMO_START, temp: pushedTemp }];
  const after30 = [
    ...afterPush,
    { at: new Date(DEMO_START.getTime() + 30 * 60_000), temp: pushedTemp },
  ];
  return {
    afterPush: computeThermal(afterPush, batch.saleWindowEnd, DEMO_START),
    after30: computeThermal(after30, batch.saleWindowEnd, new Date(DEMO_START.getTime() + 30 * 60_000)),
  };
}

const riceTray = pushAndFastForward("R041", 12);
check(
  "Cooked rice tray pushed to 12°C → still Warning before fast-forward",
  riceTray.afterPush.status === "warning",
  `status=${riceTray.afterPush.status}`
);
check(
  "...then Fast-forward 30 min → Blocked",
  riceTray.after30.status === "blocked",
  `status=${riceTray.after30.status}, debt=${Math.round(riceTray.after30.pct * 100)}%`
);

const vegSandwich = pushAndFastForward("S118", 14);
check(
  "Veg Sandwich pushed to 14°C + fast-forward → Blocked (offer withdrawn)",
  vegSandwich.after30.status === "blocked" && isOfferWithdrawn(vegSandwich.after30.status),
  `status=${vegSandwich.after30.status}, isOfferWithdrawn=${isOfferWithdrawn(vegSandwich.after30.status)}`
);
check(
  "...Approve is disabled for that batch",
  !canApproveOffer(vegSandwich.after30.status),
  `canApproveOffer=${canApproveOffer(vegSandwich.after30.status)}`
);

console.log("\n──────────────────────────────────────────────────────────");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("All checks passed.");
}
