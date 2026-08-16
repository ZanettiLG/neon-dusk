const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:/Users/luisg/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const BASE = "http://localhost:5173";
const OUT = "C:/Users/luisg/Projects/neon-dusk/.qa";
const EMAIL = process.env.ND_TEST_EMAIL;
const PASSWORD = process.env.ND_TEST_PASS;

const shotDir = path.join(OUT, "screenshots");
const logDir = path.join(OUT, "logs");
fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

const R = {};
const consoleMsgs = [];
const pageErrors = [];
const apiRequests = [];

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(shotDir, name) }); } catch (e) {}
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => pageErrors.push(`pageerror: ${e.message}`));
  page.on("request", (req) => { if (req.url().includes("/api/")) apiRequests.push(`${req.method()} ${req.url()}`); });
  page.on("response", (resp) => { if (resp.url().includes("/api/auth/login")) R.loginStatus = resp.status(); });

  try {
    // A: LOGIN
    await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(1500);
    R.A = { loginStatus: R.loginStatus, url: page.url(), loggedIn: page.url().includes("/dashboard") };
    await shot(page, "A-login-dashboard.png");

    // E: NIL / energy typeof check (numbers, not strings — bigint parser)
    const nil = await page.evaluate(async () => {
      const raw = localStorage.getItem("nd_auth");
      const token = raw ? (JSON.parse(raw).state?.accessToken || null) : null;
      const r = await fetch("/api/characters/me/nil", { headers: { Authorization: "Bearer " + token } });
      const j = await r.json();
      return { status: r.status, currentType: typeof j.current, maxType: typeof j.max, current: j.current, max: j.max, error: j.error || null };
    }).catch((e) => ({ fetchError: e.message }));
    R.E = { nil: nil };
    const bodyText = await page.textContent("body").catch(() => "");
    R.E.nilVisibleInDashboard = bodyText.includes("NIL") || bodyText.includes("CARGA NEURAL");

    // B: SESSION PERSISTENCE
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    R.B = { urlAfterReload: page.url(), persisted: page.url().includes("/dashboard") };
    await shot(page, "B-session-after-reload.png");

    // G: WRONG PASSWORD
    await page.click('button:has-text("Desconectar")');
    await page.waitForURL("**/login", { timeout: 10000 });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', "WrongPass123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const loginBody = await page.textContent("body").catch(() => "");
    R.G = { stillOnLogin: page.url().includes("/login"), errorVisible: /inválidos/i.test(loginBody), snippet: loginBody.slice(0, 300) };
    await shot(page, "G-wrong-password.png");

    // re-login correct
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // C: GIG BOARD
    R.C = {};
    try { await page.goto(BASE + "/gigs", { waitUntil: "domcontentloaded" }); } catch (e) { R.C.gotoError = e.message; }
    await page.waitForTimeout(4000);
    const gigBody = await page.textContent("body").catch(() => "");
    R.C.renderedBoard = gigBody.includes("CUPIM") && gigBody.includes("O PORTEIRO");
    R.C.hasActiveGigPanel = gigBody.includes("GIG ATIVA");
    R.C.stuckLoading = gigBody.includes("loading");
    R.C.snippet = gigBody.slice(0, 400);
    await shot(page, "C-gig-board.png");

    R.apiRequests = apiRequests;
    R.consoleErrorCount = pageErrors.length;
    R.consoleWarnings = consoleMsgs.filter((m) => m.startsWith("[warning]") || m.startsWith("[error]"));
  } catch (e) {
    R.fatal = e.message;
    await shot(page, "fatal.png");
  }

  fs.writeFileSync(path.join(logDir, "console.log"), consoleMsgs.join("\n"), "utf8");
  fs.writeFileSync(path.join(logDir, "errors.log"), pageErrors.join("\n"), "utf8");
  fs.writeFileSync(path.join(logDir, "api-requests.log"), apiRequests.join("\n"), "utf8");
  fs.writeFileSync(path.join(logDir, "results.json"), JSON.stringify(R, null, 2), "utf8");

  await browser.close();

  console.log("=====RESULTS_JSON=====");
  console.log(JSON.stringify(R, null, 2));
  console.log("=====PAGE_ERRORS=====");
  console.log(pageErrors.join("\n") || "(none)");
  console.log("=====API_REQUESTS=====");
  console.log(apiRequests.join("\n") || "(none)");
})();
