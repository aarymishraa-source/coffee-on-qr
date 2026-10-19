// Responsive QA harness — every route × every test size.
// Usage: start the dev server (npm run dev), then `npm run responsive`.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "shots/responsive";
const MIN_TAP = 40;

const SIZES = [
  { w: 320, h: 568 },
  { w: 360, h: 800 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 414, h: 896 },
  { w: 430, h: 932 },
  { w: 844, h: 390 },
  { w: 768, h: 1024 },
  { w: 820, h: 1180 },
  { w: 1024, h: 768 },
  { w: 1024, h: 1366 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

// Touch-size gate for the 40×40 tap-target rule — the spec scopes it to
// "touch sizes"; the three clear laptop/desktop sizes are exempt (and must
// stay pixel-identical to today per the brief).
function isTouchSize(w, h) {
  const desktop = [
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ];
  return !desktop.some(([dw, dh]) => dw === w && dh === h);
}

mkdirSync(OUT, { recursive: true });

/** @type {{route:string,w:number,h:number,kind:string,detail:string}[]} */
const failures = [];

function recordFailure(route, w, h, kind, detail) {
  failures.push({ route, w, h, kind, detail });
}

function watchConsole(page, problems) {
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    // Per spec: fail on console errors, page errors and hydration warnings —
    // not on generic warnings (e.g. GPU/driver chatter from the landing
    // page's WebGL hero, which is noise, not a bug).
    if (type === "error" || /hydrat/i.test(text)) {
      problems.push(`console.${type}: ${text}`);
    }
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
}

async function checkLayout(page, route, w, h) {
  const touch = isTouchSize(w, h);
  const result = await page.evaluate((MIN_TAP) => {
    const out = { hScroll: false, stickingOut: [], clipped: [], tiny: [] };
    const docEl = document.documentElement;
    out.hScroll = docEl.scrollWidth > window.innerWidth + 1;

    const all = document.querySelectorAll("body *");
    for (const el of all) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      // Fixed/sticky CHROME (header/nav/footer-ish, interactive, or
      // containing interactive descendants) sticking out past the viewport.
      // Decorative full-bleed elements (grain textures, blobs) are expected
      // to bleed past the edge and are excluded.
      const decorative = el.getAttribute("aria-hidden") === "true" || style.pointerEvents === "none";
      if (!decorative && (style.position === "fixed" || style.position === "sticky")) {
        const isChrome =
          el.matches("header, nav, footer") || el.querySelector("button, a[href], input, select") !== null;
        if (isChrome && (rect.right > window.innerWidth + 2 || rect.left < -2)) {
          out.stickingOut.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")}`);
        }
      }

      // Single-line text clipped by its own box (not an intentional h-scroll
      // container, and not the standard 1×1px visually-hidden/sr-only pattern).
      if (
        el.children.length === 0 &&
        el.textContent &&
        el.textContent.trim().length > 0 &&
        style.whiteSpace === "nowrap" &&
        (style.overflow === "hidden" || style.overflowX === "hidden") &&
        el.clientWidth > 2 &&
        el.scrollWidth > el.clientWidth + 2
      ) {
        out.clipped.push(`${el.tagName.toLowerCase()}:"${el.textContent.trim().slice(0, 30)}"`);
      }

      // Tap target size for interactive elements.
      if (el.matches('button, a[href], input:not([type="range"]), select, [role="button"]')) {
        if (rect.width > 0 && rect.height > 0 && (rect.width < MIN_TAP || rect.height < MIN_TAP)) {
          out.tiny.push(
            `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""} ${Math.round(rect.width)}x${Math.round(rect.height)}`
          );
        }
      }
    }
    return out;
  }, MIN_TAP);

  if (result.hScroll) recordFailure(route, w, h, "h-scroll", "document.scrollWidth > innerWidth");
  if (result.stickingOut.length) recordFailure(route, w, h, "sticking-out", result.stickingOut.slice(0, 5).join(", "));
  if (result.clipped.length) recordFailure(route, w, h, "clipped-text", result.clipped.slice(0, 5).join(", "));
  if (touch && result.tiny.length) recordFailure(route, w, h, "tiny-tap-target", [...new Set(result.tiny)].slice(0, 8).join(", "));
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function runLanding(page, prefix, w, h) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await shot(page, `${prefix}-landing`);
  await checkLayout(page, "/", w, h);
}

async function runApp(page, prefix, w, h) {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, `${prefix}-app-01-taste`);
  await checkLayout(page, "/app", w, h);

  for (const label of ["Like", "Like", "Skip", "Not sure", "Like"]) {
    const btn = page.getByRole("button", { name: label, exact: true });
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(350);
    }
  }
  await page.getByText("See my matches", { exact: true }).click();
  await shot(page, `${prefix}-app-02-picked`);
  await checkLayout(page, "/app", w, h);

  const firstDish = page.locator("ul li button").first();
  if (await firstDish.count()) {
    await firstDish.click();
    await page.waitForTimeout(400);
    await shot(page, `${prefix}-app-03-dish`);
    await checkLayout(page, "/app", w, h);

    const reserve = page.getByRole("button", { name: /^Reserve/ });
    if (await reserve.count()) {
      await reserve.click();
      await page.waitForTimeout(400);
      await shot(page, `${prefix}-app-04-reserve-sheet`);
      await checkLayout(page, "/app", w, h);
      const done = page.getByRole("button", { name: "Done" });
      if (await done.count()) await done.click();
      await page.waitForTimeout(300);
    }
    const back = page.getByRole("button", { name: "Back", exact: true });
    if (await back.count()) await back.click();
    await page.waitForTimeout(300);
  }

  const nav = (label) => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: label });
  for (const [label, name] of [
    ["Offers", "05-offers"],
    ["Home", "06-home"],
    ["Order", "07-order"],
    ["Profile", "08-profile"],
  ]) {
    const btn = nav(label);
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(350);
      await shot(page, `${prefix}-app-${name}`);
      await checkLayout(page, "/app", w, h);
    }
  }
}

async function runConsole(page, prefix, w, h) {
  await page.goto(`${BASE}/console`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, `${prefix}-console-01-today`);
  await checkLayout(page, "/console", w, h);

  // A visible batch row — table row at md+ (768px), stacked card below it.
  const firstRow = page.locator("[data-batch-row]:visible").first();
  if (await firstRow.count()) {
    await firstRow.click();
    await page.waitForTimeout(500);
    await shot(page, `${prefix}-console-02-batch-drawer`);
    await checkLayout(page, "/console", w, h);
    const close = page.getByRole("button", { name: "Close" });
    if (await close.count()) await close.click();
    await page.waitForTimeout(300);
  }

  const editBtn = page.getByRole("button", { name: "Edit", exact: true });
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(300);
    await shot(page, `${prefix}-console-03-approval-edit`);
    await checkLayout(page, "/console", w, h);
  }
}

async function runDemo(page, prefix, w, h) {
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, `${prefix}-demo`);
  await checkLayout(page, "/demo", w, h);
}

for (const { w, h } of SIZES) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  watchConsole(page, problems);
  const prefix = `${w}x${h}`;

  try {
    await runLanding(page, prefix, w, h);
    await runApp(page, prefix, w, h);
    await runConsole(page, prefix, w, h);
    await runDemo(page, prefix, w, h);
  } catch (err) {
    recordFailure("?", w, h, "script-error", String(err?.message ?? err).slice(0, 200));
  }

  const hydrationIssues = problems.filter((p) => /hydrat/i.test(p));
  const otherConsole = problems.filter((p) => !/hydrat/i.test(p));
  if (hydrationIssues.length) recordFailure("*", w, h, "hydration-warning", hydrationIssues.slice(0, 5).join(" | "));
  if (otherConsole.length) recordFailure("*", w, h, "console", otherConsole.slice(0, 8).join(" | "));

  await browser.close();
}

console.log("\n" + "=".repeat(100));
if (failures.length === 0) {
  console.log("ALL PASS — zero failures across every route and size.");
} else {
  console.log(`${failures.length} FAILURE ROW(S):\n`);
  console.log("ROUTE".padEnd(10) + "SIZE".padEnd(12) + "KIND".padEnd(18) + "DETAIL");
  console.log("-".repeat(100));
  for (const f of failures) {
    console.log(f.route.padEnd(10) + `${f.w}x${f.h}`.padEnd(12) + f.kind.padEnd(18) + f.detail);
  }
}
console.log("=".repeat(100));
process.exit(failures.length > 0 ? 1 : 0);
