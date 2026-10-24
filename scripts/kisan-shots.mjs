// Screenshot loop for the supply + Kisan screens (design self-review).
// Usage: BASE_URL=http://localhost:3000 node scripts/kisan-shots.mjs [filter]
// Saves PNGs at 1440×900 and 390×844 to /shots/kisan and prints console errors.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "shots/kisan";
const filter = process.argv[2];
mkdirSync(OUT, { recursive: true });

const SCREENS = [
  { name: "login", as: null, path: "/login" },
  { name: "supply", as: "cafe", path: "/console/supply" },
  { name: "supply-panel", as: "cafe", path: "/console/supply", click: { role: "button", name: /Review and send|Review .* order/ } },
  { name: "orders", as: "cafe", path: "/console/supply/orders" },
  { name: "batches", as: "cafe", path: "/console/supply/batches" },
  { name: "payments", as: "cafe", path: "/console/supply/payments" },
  { name: "kisan", as: "kavita", path: "/kisan" },
  { name: "kisan-ramesh", as: "ramesh", path: "/kisan" },
  { name: "farmers", as: "kavita", path: "/kisan/farmers" },
  { name: "farmer-new", as: "kavita", path: "/kisan/farmers/new" },
  { name: "fpo", as: "fpo", path: "/kisan/fpo" },
  { name: "agents", as: "fpo", path: "/kisan/agents" },
  { name: "integrations", as: "admin", path: "/console/settings/integrations" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

const browser = await chromium.launch();
const problems = [];
try {
  for (const vp of VIEWPORTS) {
    for (const s of SCREENS.filter((x) => !filter || x.name.includes(filter))) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && problems.push(`[${vp.name}/${s.name}] ${m.type()}: ${m.text()}`));
      page.on("pageerror", (e) => problems.push(`[${vp.name}/${s.name}] pageerror: ${e.message}`));
      if (s.as) {
        const r = await page.request.post(`${BASE}/api/auth/login`, { data: { email: `${s.as}@demo.coffeeonqr.in`, password: "demo1234" } });
        if (!r.ok()) problems.push(`[${s.name}] login failed ${r.status()}`);
      }
      await page.goto(`${BASE}${s.path}`, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      if (s.click) {
        await page.getByRole(s.click.role, { name: s.click.name }).first().click();
        await page.waitForTimeout(900);
      }
      await page.screenshot({ path: `${OUT}/${s.name}-${vp.name}.png`, fullPage: !s.click });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(problems.length ? problems.join("\n") : "No console errors.");
