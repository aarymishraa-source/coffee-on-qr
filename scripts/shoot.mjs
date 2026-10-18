// Screenshot harness for the customer app.
// Usage: start the dev server (npm run dev), then `node scripts/shoot.mjs`.
// Clicks through every /app screen at phone and desktop sizes, saves PNGs to
// /shots and prints every browser console error/warning and page error.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "shots";
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];

function watch(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      problems.push(`[${label}] console.${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => problems.push(`[${label}] pageerror: ${err.message}`));
}

try {
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  watch(page, vp.name);
  let n = 0;
  const shot = async (name) => {
    await page.waitForTimeout(700);
    n += 1;
    await page.screenshot({ path: `${OUT}/${vp.name}-${String(n).padStart(2, "0")}-${name}.png` });
  };
  const nav = (label) => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: label }).click();

  // Hide the Next.js dev-tools bubble: it sits over the bottom nav in screenshots and swallows clicks.
  await context.addInitScript(() => {
    const css = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    });
  });

  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await shot("taste-swipe");

  // Before any swipes: the seeded profile, i.e. exactly what design pages 5 and 6 show.
  await page.getByRole("button", { name: "See my matches", exact: true }).click();
  await shot("picked-default");
  await page.locator("ul li button").first().click();
  await shot("dish-default");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back to taste cards" }).click();
  await page.waitForTimeout(400);

  // One real drag (like), then buttons for the rest.
  const card = page.locator("[data-swipe-card]");
  const box = await card.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy, { steps: 6 });
    await shot("taste-dragging");
    await page.mouse.move(cx + 220, cy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  for (const label of ["Skip", "Like", "Not sure", "Like"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(500);
  }
  await shot("taste-after-5");

  await page.getByText("See my matches", { exact: true }).click();
  await shot("picked-for-you");
  await page.getByRole("button", { name: /Under/ }).click();
  await shot("picked-under-budget");
  await page.getByRole("button", { name: /Under/ }).click();

  await page.locator("ul li button").first().click();
  await shot("dish-detail");
  await page.getByRole("button", { name: "About storage monitoring" }).click();
  await shot("storage-info-sheet");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Reserve/ }).click();
  await shot("reserve-success");
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await nav("Offers");
  await shot("offers-empty");

  // Approve the pending offer from the console (another tab, same storage).
  const consolePage = await context.newPage();
  watch(consolePage, `${vp.name}/console`);
  await consolePage.goto(`${BASE}/console`, { waitUntil: "networkidle" });
  const approve = consolePage.getByRole("button", { name: /Approve/ });
  if (await approve.count()) {
    await approve.first().click();
    await page.bringToFront();
    await page.waitForTimeout(300);
    await shot("whatsapp-banner");
    await page.waitForTimeout(7500);
    await shot("offers-live");
    await page.getByRole("button", { name: /Reserve now/ }).click();
    await shot("offer-reserved-sheet");
    await page.getByRole("button", { name: "Done" }).click();
  } else {
    problems.push(`[${vp.name}] could not find an Approve button on /console`);
  }
  await consolePage.close();

  await nav("Home");
  await shot("home");
  await nav("Order");
  await shot("orders");
  await nav("Profile");
  await shot("profile");

  await context.close();
}

} catch (err) {
  problems.push(`harness: ${err.message.split(/\r?\n/)[0]}`);
  process.exitCode = 1;
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "No console errors, warnings or page errors.");
