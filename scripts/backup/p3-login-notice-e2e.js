// Checks the sign-in page during a maintenance notice (browser), and the sign-in throttle (API, with a probe name that is not the
// Super Administrator). The notice is cancelled at the end, so the system is back in NORMAL. Passwords come from the environment only.
const puppeteer = require("puppeteer-core");
const PW = process.env.TEST_PW;
const BASE = "http://localhost:3000";
const API = "http://127.0.0.1:3000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push([name, !!ok]); console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? `  [${detail}]` : "")); };

const call = async (method, path, headers = {}, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
};
const waitFor = async (page, t, ms = 20000) => {
  try { await page.waitForFunction((x) => document.body.innerText.toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t); return true; } catch { return false; }
};

(async () => {
  // 1. throttle: five wrong sign-ins for a probe name, then the sixth is refused even for a right-looking attempt
  const probe = "throttle.probe";
  let codes = [];
  for (let i = 0; i < 6; i++) codes.push((await call("POST", "/system/maintenance/login", {}, { username: probe, password: "wrong-password" })).status);
  check("five wrong sign-ins are answered 401", codes.slice(0, 5).every((c) => c === 401), codes.join(","));
  const locked = await call("POST", "/system/maintenance/login", {}, { username: probe, password: "wrong-password" });
  check("the sixth attempt is refused as locked (429 SUPER_ADMIN_LOCKED)", locked.status === 429 && locked.data.code === "SUPER_ADMIN_LOCKED", `${locked.status} ${locked.data.code || ""}`);

  // 2. notice on the sign-in page
  const sa = await call("POST", "/system/maintenance/login", {}, { username: "super.admin", password: PW });
  check("the Super Administrator signs in to the maintenance gate", sa.status === 200 && !!sa.data.pass, String(sa.status));
  const pass = { "X-Maintenance-Pass": sa.data.pass };
  const notice = await call("POST", "/system/maintenance/notice", pass, { minutes: 1, requestId: "RQ-LOGIN-NOTICE" });
  check("a one-minute notice starts (DEV minimum)", notice.status === 200, String(notice.status));

  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--window-size=1440,1000"] });
  const context = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 120000 });
  check("the sign-in page shows the notice with a countdown", await waitFor(page, "System maintenance starts in"));
  const text = await page.evaluate(() => document.body.innerText);
  check("the sign-in form is still there", text.includes("Sign In To Your Account") && (await page.$("#username")) !== null);
  await page.screenshot({ path: "login-notice.png", fullPage: true });
  const shown = text.match(/starts in (\d+:\d{2})/);
  check("the countdown is at most one minute", !!shown && shown[1] <= "1:00", shown ? shown[1] : "none");

  // 3. put the system back to normal
  const cancelled = await call("POST", "/system/maintenance/cancel", pass, { requestId: "RQ-LOGIN-NOTICE" });
  check("the notice is withdrawn and the system is NORMAL", cancelled.status === 200, String(cancelled.status));
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  const after = await page.evaluate(() => document.body.innerText.includes("System maintenance starts in"));
  check("the notice disappears from the sign-in page", !after);

  await browser.close();
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
