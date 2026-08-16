const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:5173";
const OUT = "C:/Users/luisg/Projects/neon-dusk/.qa";
const RUN_ID = "nd-20260816-143000-auth-mapping";
const EMAIL = "zanetti@zan.ia.br";
const PASS = "Zan12345";

const shotDir = path.join(OUT, "screenshots", RUN_ID);
const logDir = path.join(OUT, "logs", RUN_ID);
fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

const consoleMsgs = [];
const pageErrors = [];
const apiRequests = [];
const apiResponses = [];

const CHROME_CANDIDATES = [
  "C:/Users/luisg/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
const existing = CHROME_CANDIDATES.find((p) => fs.existsSync(p));

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(shotDir, name) }); } catch (e) {}
}

(async () => {
  let browser = null;
  if (existing) {
    try { browser = await chromium.launch({ executablePath: existing, headless: true }); } catch (e) { console.log("LAUNCH_EXE_FAIL=" + e.message); }
  }
  if (!browser) {
    for (const channel of ["chrome", "msedge"]) {
      try { browser = await chromium.launch({ channel, headless: true }); break; } catch (e) {}
    }
  }
  if (!browser) { console.log("NO_BROWSER_FOUND existing=" + existing); return; }

  const R = {};

  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctxA.newPage();
  page.setDefaultTimeout(15000);
  page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (req) => { if (req.url().includes("/api/")) apiRequests.push(`${req.method()} ${req.url()}`); });
  page.on("response", (resp) => {
    const u = resp.url();
    if (u.includes("/api/")) apiResponses.push({ method: resp.request().method(), url: u, status: resp.status() });
  });

  const countReq = (sub) => apiRequests.filter((r) => r.includes(sub)).length;

  try {
    // 1. LOGIN
    await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(1500);
    R.login = { url: page.url(), ok: page.url().includes("/dashboard") };
    await shot(page, "01-login-dashboard.png");

    // 2. SESSION PERSISTENCE
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    R.sessionReload = { url: page.url(), persisted: page.url().includes("/dashboard") };
    await shot(page, "02-session-after-reload.png");

    // 3. GOTO /gigs (previously blocked route)
    await page.goto(BASE + "/gigs", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    let body = await page.textContent("body").catch(() => "");
    R.gigBoard = {
      renderedBoard: body.includes("CUPIM"),
      errorBoundary: body.includes("Unexpected Application Error") || body.includes("Failed to fetch dynamically imported"),
      activeGigPresent: body.includes("GIG ATIVA"),
    };
    await shot(page, "03-gig-board.png");

    if (R.gigBoard.activeGigPresent) {
      page.once("dialog", (d) => d.accept());
      await page.locator('button:has-text("Abandonar Gig")').first().click().catch(() => {});
      await page.waitForTimeout(2500);
      await page.goto(BASE + "/gigs", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      body = await page.textContent("body").catch(() => "");
      R.gigBoard.activeGigPresent = body.includes("GIG ATIVA");
      await shot(page, "03b-gig-board-clean.png");
    }

    // 4. ACCEPT
    const acceptBtn = page.locator('button:has-text("Aceitar"):not([disabled])').first();
    const acceptCount = await acceptBtn.count();
    if (acceptCount === 0) {
      R.accept = { error: "no eligible gig available" };
    } else {
      await acceptBtn.click();
      await page.waitForTimeout(2500);
      body = await page.textContent("body").catch(() => "");
      R.accept = { activeGigPanel: body.includes("GIG ATIVA"), hasDirectBtn: body.includes("Executar direto") };
      await shot(page, "04-after-accept.png");

      // 5. ANTI DOUBLE-CLICK on "Executar direto"
      const beforeReq = countReq("/execute");
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /executar direto/i.test(b.textContent));
        if (btn) { btn.click(); btn.click(); }
      });
      await page.waitForTimeout(3500);
      const afterReq = countReq("/execute");
      R.doubleClick = { executeRequestsSent: afterReq - beforeReq, expected: 1 };
      body = await page.textContent("body").catch(() => "");
      R.afterExecute = { hasEscapeBtn: body.includes("Fugir"), executeSuccess: body.includes("Serviço limpo"), executeFailure: body.includes("Deu ruim") };
      await shot(page, "05-after-execute.png");

      // 6. ESCAPE
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /fugir/i.test(b.textContent));
        if (btn) btn.click();
      });
      await page.waitForTimeout(2500);
      body = await page.textContent("body").catch(() => "");
      R.afterEscape = { hasWrapupBtn: body.includes("Concluir gig") };
      await shot(page, "06-after-escape.png");

      // 7. WRAPUP
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /concluir gig/i.test(b.textContent));
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);
      body = await page.textContent("body").catch(() => "");
      R.wrapup = { resolvedSummary: body.includes("GIG RESOLVIDA"), hasEuro: /€\$/.test(body) };
      await shot(page, "07-wrapup-summary.png");
    }
  } catch (e) {
    R.fatal = e.message;
    await shot(page, "99-fatal.png");
  }

  // Context B: wrong password
  try {
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageB = await ctxB.newPage();
    const loginStatuses = [];
    pageB.on("response", (resp) => { if (resp.url().includes("/api/auth/login")) loginStatuses.push(resp.status()); });
    await pageB.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
    await pageB.waitForSelector('input[type="email"]', { timeout: 10000 });
    await pageB.fill('input[type="email"]', EMAIL);
    await pageB.fill('input[type="password"]', "WrongPass123!");
    await pageB.click('button[type="submit"]');
    await pageB.waitForTimeout(2500);
    const bbody = await pageB.textContent("body").catch(() => "");
    R.wrongPassword = { status: loginStatuses[0] ?? null, stillOnLogin: pageB.url().includes("/login"), errorVisible: /inválidos/i.test(bbody) };
    await shot(pageB, "08-wrong-password.png");
    await ctxB.close();
  } catch (e) {
    R.wrongPasswordError = e.message;
  }

  R.consoleErrorCount = pageErrors.length;
  R.consoleErrorMessages = consoleMsgs.filter((m) => m.startsWith("[error]"));
  R.consoleWarnings = consoleMsgs.filter((m) => m.startsWith("[warning]"));
  R.apiResponses = apiResponses;

  fs.writeFileSync(path.join(logDir, "console.log"), consoleMsgs.join("\n"), "utf8");
  fs.writeFileSync(path.join(logDir, "errors.log"), pageErrors.join("\n"), "utf8");
  fs.writeFileSync(path.join(logDir, "api-requests.log"), apiRequests.join("\n"), "utf8");
  fs.writeFileSync(path.join(logDir, "results.json"), JSON.stringify(R, null, 2), "utf8");

  await browser.close();
  console.log("=====RESULTS_JSON=====");
  console.log(JSON.stringify(R, null, 2));
})().catch((e) => { console.error("FATAL=" + e.stack); process.exit(1); });
