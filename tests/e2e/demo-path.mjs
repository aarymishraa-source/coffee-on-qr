// End-to-end: the 9-step demo path from the brief, in a real browser, with no
// optional provider keys. Usage: BASE_URL=http://localhost:3000 node tests/e2e/demo-path.mjs
// Exits non-zero on the first failed step. Screenshots go to shots/e2e/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "shots/e2e";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const pages = [];
let step = 0;

async function as(user) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  pages.push([user, page]);
  page.on("pageerror", (e) => errors.push(`[${user}] ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`[${user}] console: ${m.text()}`));
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: { email: `${user}@demo.coffeeonqr.in`, password: "demo1234" } });
  if (!r.ok()) throw new Error(`login ${user} failed: ${r.status()}`);
  return { ctx, page };
}

async function check(name, fn) {
  step++;
  process.stdout.write(`${String(step).padStart(2)}. ${name} … `);
  await fn();
  console.log("ok");
}

const api = async (page, path) => (await (await page.request.get(`${BASE}${path}`)).json()).data;
const basil = async (page) => (await api(page, "/api/forecasts")).rows.find((r) => r.ingredientId === "basil");
const expectEq = (a, b, what) => {
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
};

try {
  const cafe = await as("cafe");
  await check("reset demo data", async () => {
    const r = await cafe.page.request.post(`${BASE}/api/demo/reset`);
    expectEq(r.status(), 200, "reset status");
  });

  await check("supply dashboard shows basil 10 kg with the calculation", async () => {
    await cafe.page.goto(`${BASE}/console/supply`);
    await cafe.page.getByText("Basil: 10 kg needed next week").waitFor();
    await cafe.page.getByRole("button", { name: /Review and send basil offer/ }).click();
    await cafe.page.getByText("How this was calculated").waitFor();
    await cafe.page.getByText("Pesto Paneer Sandwich").first().waitFor();
    await cafe.page.screenshot({ path: `${OUT}/01-supply-panel.png` });
  });

  await check("send the offer to Palghar Kisan FPO", async () => {
    await cafe.page.getByRole("button", { name: /Send 10 kg offer to Palghar Kisan FPO/ }).click();
    await cafe.page.getByText("Offer sent to Palghar Kisan FPO").waitFor();
    expectEq((await basil(cafe.page)).status, "offered", "basil status");
  });

  const ramesh = await as("ramesh");
  await check("Ramesh sees the offer card and commits 6 kg", async () => {
    await ramesh.page.goto(`${BASE}/kisan`);
    const chat = ramesh.page.getByRole("region", { name: "Conversation" });
    await chat.getByText("Basil · 10 kg").waitFor();
    await chat.getByRole("button", { name: "Other amount" }).last().click();
    await ramesh.page.getByLabel("Kilograms you can supply").fill("6");
    await ramesh.page.getByRole("button", { name: "Save" }).click();
    await ramesh.page.getByText("4 kg still needed").first().waitFor();
    await ramesh.page.screenshot({ path: `${OUT}/02-ramesh-commit.png` });
    const b = await basil(cafe.page);
    expectEq(b.committed, 6, "committed");
    expectEq(b.open, 4, "open");
  });

  const sunita = await as("sunita");
  await check("Sunita commits 4 kg in chat → basil fully committed", async () => {
    await sunita.page.goto(`${BASE}/kisan`);
    await sunita.page.getByLabel("Message", { exact: true }).fill("मैं 4 किलो दूँगी");
    await sunita.page.keyboard.press("Enter");
    await sunita.page.getByText(/ऑर्डर अब पूरा हो गया/).waitFor({ timeout: 20000 });
    const b = await basil(cafe.page);
    expectEq(b.committed, 10, "committed");
    expectEq(b.open, 0, "open");
    await cafe.page.goto(`${BASE}/console/supply`);
    await cafe.page.getByText("0 kg still open").waitFor();
    await cafe.page.screenshot({ path: `${OUT}/03-supply-committed.png` });
  });

  await check("Ramesh sends a leaf photo → labelled demo analysis → follow-up → ask expert", async () => {
    await ramesh.page.getByRole("button", { name: "Attach" }).click();
    await ramesh.page.getByRole("menuitem", { name: /Sample leaf photo/ }).click();
    await ramesh.page.getByAltText("Selected photo").waitFor();
    await ramesh.page.getByRole("button", { name: "Send", exact: true }).click();
    await ramesh.page.getByText("Demo analysis", { exact: true }).waitFor({ timeout: 20000 });
    await ramesh.page.getByRole("button", { name: "Ask a follow-up" }).click();
    const box = ramesh.page.getByLabel("Message", { exact: true });
    await box.waitFor();
    if (!(await box.inputValue()).includes("फोटो")) throw new Error("follow-up did not prefill the composer");
    await box.fill("या फोटोबद्दल: पान काय आहे?");
    await box.press("Enter");
    await ramesh.page.getByText(/निश्चित निदान नाही/).last().waitFor({ timeout: 20000 });
    await ramesh.page.getByRole("button", { name: "Ask an expert" }).click();
    await ramesh.page.getByText("Expert review requested").first().waitFor();
    await ramesh.page.screenshot({ path: `${OUT}/04-crop-photo.png` });
  });

  await check("Ramesh logs his harvest with a photo → preliminary grade A", async () => {
    await ramesh.page.getByRole("button", { name: "Log harvest" }).first().click();
    await ramesh.page.getByRole("button", { name: /Use sample harvest photo/ }).click();
    await ramesh.page.getByText("Attached: basil-harvest.jpg").waitFor();
    await ramesh.page.getByRole("dialog").getByRole("button", { name: "Log harvest" }).click();
    await ramesh.page.getByText(/Harvest logged as BAS-/).waitFor();
  });

  await check("ops confirms grade A and marks the batch delivered", async () => {
    await cafe.page.goto(`${BASE}/console/supply/batches`);
    await cafe.page.getByText(/^BAS-/).first().click();
    await cafe.page.getByLabel("Reason (audited)").fill("Checked at pickup — matches photo");
    await cafe.page.getByRole("button", { name: "Confirm grade A" }).click();
    await cafe.page.getByText("Grade A confirmed").waitFor();
    await cafe.page.getByRole("button", { name: "Mark delivered" }).click();
    await cafe.page.getByText(/marked delivered/).waitFor();
    await cafe.page.screenshot({ path: `${OUT}/05-batch-delivered.png` });
  });

  await check("payments: simulated café payment, simulated farmer payouts", async () => {
    await cafe.page.goto(`${BASE}/console/supply/payments`);
    await cafe.page.getByRole("button", { name: /Create simulated payment of ₹1,800/ }).click();
    await cafe.page.getByRole("button", { name: "Mark paid (simulated)" }).click();
    await cafe.page.getByRole("dialog").getByRole("button", { name: "Mark paid (simulated)" }).click();
    await cafe.page.getByRole("button", { name: "Record farmer payouts (simulated)" }).click();
    await cafe.page.getByText("Settled in this demo").waitFor();
    await cafe.page.screenshot({ path: `${OUT}/06-payments.png`, fullPage: true });
  });

  await check("customer dish page shows the Farm Story", async () => {
    const story = await api(cafe.page, "/api/farm-story?dishId=pesto-paneer-sandwich");
    expectEq(story?.farmerName, "Ramesh Patil", "farm story farmer");
    const { page } = await as("cafe");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/app`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "See my matches", exact: true }).click();
    await page.getByText("Pesto Paneer Sandwich").first().click();
    await page.getByText("Basil grown by Ramesh Patil").waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/07-farm-story.png` });
  });

  await check("reset returns to step 1", async () => {
    await cafe.page.request.post(`${BASE}/api/demo/reset`);
    const b = await basil(cafe.page);
    expectEq(b.status, "not_offered", "basil after reset");
    const story = await api(cafe.page, "/api/farm-story?dishId=pesto-paneer-sandwich");
    expectEq(story, null, "farm story after reset");
  });

  console.log(errors.length ? `\nBrowser errors:\n${errors.join("\n")}` : "\nDemo path passed. No browser errors.");
  if (errors.length) process.exitCode = 1;
} catch (err) {
  console.log("FAILED");
  console.error(err.message);
  for (const [user, page] of pages) await page.screenshot({ path: `${OUT}/failure-${user}.png` }).catch(() => {});
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
