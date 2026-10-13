// Full restore-approval flow in the browser on the DEV stack. Two real accounts in separate browser contexts:
// admin asks (New Restore Request form), approver.test1 approves and rejects through the e-signature dialog,
// admin sees their own request without approve/reject. Results are checked against the API. Passwords come from the environment only.
const puppeteer = require("puppeteer-core");
const PW = process.env.TEST_PW;
const BASE = "http://localhost:3000";
const API = "http://127.0.0.1:3000/api";
const results = [];
const check = (name, ok, detail = "") => { results.push([name, !!ok]); console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? `  [${detail}]` : "")); };

const api = async (method, path, token, body) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 200) }; }
  return { status: res.status, data };
};
const login = async (user) => (await api("POST", "/auth/login", null, { identifier: user, password: PW })).data.accessToken;
const esig = async (user, token) => (await api("POST", "/auth/verify-signature", token, { username: user, password: PW })).data.signatureToken;

const bodyHas = (page, t) => page.evaluate((x) => document.body.innerText.toLowerCase().includes(x.toLowerCase()), t);
const waitFor = async (page, t, ms = 20000) => {
  try { await page.waitForFunction((x) => document.body.innerText.toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t); return true; } catch { return false; }
};
const clickButton = async (page, text, scope = "document") => {
  const handle = await page.evaluateHandle((t, s) => {
    const root = s === "document" ? document : document.querySelector(s);
    const els = root ? Array.from(root.querySelectorAll("button")) : [];
    return els.find((e) => (e.textContent || "").trim() === t && !e.disabled) || null;
  }, text, scope);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
};
const clickInRow = async (page, rowText, buttonText) => {
  const handle = await page.evaluateHandle((r, b) => {
    const row = Array.from(document.querySelectorAll("tr")).find((tr) => tr.innerText.includes(r));
    if (!row) return null;
    return Array.from(row.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === b) || null;
  }, rowText, buttonText);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
};
// Row menu of the Restore Requests list: open the More actions menu of a request, then press one item.
const menuAction = async (page, requestId, item) => {
  const opened = await page.evaluate((id) => {
    const row = Array.from(document.querySelectorAll("tr")).find((tr) => tr.innerText.includes(id));
    const btn = row && row.querySelector("button[aria-label='More actions']");
    if (!btn) return false;
    btn.click();
    return true;
  }, requestId);
  if (!opened) return false;
  await new Promise((r) => setTimeout(r, 400));
  return clickButton(page, item);
};
const signIn = async (page, user) => {
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 120000 });
  await page.type("#username", user);
  await page.type("#current-password", PW);
  await clickButton(page, "Sign In");
  await page.waitForNetworkIdle({ timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
};
const newContext = async (browser) => (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext());

// Admin asks for a validation restore through the form. Returns true when the form submitted.
const askThroughForm = async (page, backupId, reason) => {
  await page.goto(`${BASE}/backup-restore/restores/new?backup=${backupId}`, { waitUntil: "networkidle2" });
  await waitFor(page, "Select a backup");
  await page.evaluate((id) => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => (x.textContent || "").includes(id));
    b && b.click();
  }, backupId);
  await clickButton(page, "Next");
  await page.waitForSelector("textarea[placeholder='Why is this restore needed?']", { timeout: 15000 });
  await page.type("textarea[placeholder='Why is this restore needed?']", reason);
  await clickButton(page, "Next");
  await clickButton(page, "Next");
  await page.click("input[type=checkbox]");
  return clickButton(page, "Submit for Approval");
};

// Approver signs in the e-signature dialog with their own credentials.
const signDialog = async (page, user, reason) => {
  await page.waitForSelector("input[id$='-password']", { timeout: 15000 });
  await page.type("input[id$='-username']", user);
  await page.type("input[id$='-password']", PW);
  const reasonBox = await page.$("textarea[id$='-reason']");
  if (reasonBox) await reasonBox.type(reason);
  await clickButton(page, "Sign & Confirm");
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--window-size=1440,1000"] });
  const adminTok = await login("admin");
  const approverTok = await login("approver.test1");
  check("API sign-in for admin and approver.test1", !!adminTok && !!approverTok);
  const bk = await api("GET", "/backup-restore/backups?status=COMPLETED&verification=VERIFIED&limit=1", adminTok);
  const backupId = bk.data.data?.[0]?.id;
  check("a completed and verified backup exists", !!backupId, backupId);
  const openBefore = (await api("GET", "/backup-restore/restores?status=PENDING_APPROVAL&limit=100", adminTok)).data.data || [];
  check("no request waits before the test", openBefore.length === 0, String(openBefore.length));

  // A. admin asks through the form
  const admin = await newContext(browser).then((c) => c.newPage());
  await admin.setViewport({ width: 1440, height: 1000 });
  await signIn(admin, "admin");
  check("form submitted by admin", await askThroughForm(admin, backupId, "Browser flow: approval test"));
  await waitFor(admin, "waits for a second person");
  const pending = (await api("GET", "/backup-restore/restores?status=PENDING_APPROVAL&limit=100", adminTok)).data.data || [];
  const req1 = pending[0]?.requestId;
  check("the request exists and is pending with admin as requester", !!req1 && pending[0].requestedBy === "admin", req1);

  // B. the requester sees the request in the approval queue, but without approve or reject
  await admin.goto(`${BASE}/backup-restore/restores`, { waitUntil: "networkidle2" });
  await waitFor(admin, req1);
  check("requester's menu does not allow approving their own request", !(await menuAction(admin, req1, "Approve Request")));

  // C. approver approves with the e-signature dialog
  const approverCtx = await newContext(browser);
  const approver = await approverCtx.newPage();
  await approver.setViewport({ width: 1440, height: 1000 });
  await signIn(approver, "approver.test1");
  await approver.goto(`${BASE}/backup-restore/restores`, { waitUntil: "networkidle2" });
  check("approver sees the request in the queue", await waitFor(approver, req1));
  check("approve opens the e-signature dialog", await menuAction(approver, req1, "Approve Request"));
  await signDialog(approver, "approver.test1", "Approved after review");
  check("approval toast shows", await waitFor(approver, "Restore approved", 20000));
  const after = (await api("GET", `/backup-restore/restores/${req1}`, adminTok)).data;
  check("the server records APPROVED by approver.test1 with a signature", after.status === "APPROVED" && after.approvedBy === "approver.test1" && !!after.approvalSignatureRef, `${after.status} ${after.approvedBy}`);

  // D. rejection with a reason, through the dialog's reason field
  await admin.goto(`${BASE}/backup-restore/restores/new?backup=${backupId}`, { waitUntil: "networkidle2" });
  check("second request submitted by admin", await askThroughForm(admin, backupId, "Browser flow: rejection test"));
  await waitFor(admin, "waits for a second person");
  const second = ((await api("GET", "/backup-restore/restores?status=PENDING_APPROVAL&limit=100", adminTok)).data.data || [])[0]?.requestId;
  check("second request is pending", !!second, second);
  await approver.goto(`${BASE}/backup-restore/restores`, { waitUntil: "networkidle2" });
  await waitFor(approver, second);
  check("reject opens a reason dialog", await menuAction(approver, second, "Reject Request"));
  const rejectBox = await approver.waitForSelector("[role=dialog] textarea", { timeout: 10000 });
  const confirmDisabledBefore = await approver.evaluate(() => {
    const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => x.textContent.trim() === "Continue to sign");
    return b ? b.disabled : null;
  });
  check("reject continues to the signature only with a reason", confirmDisabledBefore === true);
  await rejectBox.type("Change control not approved yet");
  // wait until React has the whole reason before pressing the button (typing is faster than the re-render)
  await approver.waitForFunction(() => document.querySelector("[role=dialog] textarea")?.value === "Change control not approved yet", { timeout: 5000 }).catch(async () => {
    console.log("DEBUG textareas:", JSON.stringify(await approver.evaluate(() => Array.from(document.querySelectorAll("textarea")).map((t) => ({ v: t.value, id: t.id, dlg: !!t.closest("[role=dialog]") })))));
  });
  check("reject goes on to the rejection signature", await clickButton(approver, "Continue to sign", "[role=dialog]"));
  check("the rejection asks for its own electronic signature", await waitFor(approver, "Backup Restore Rejection"));
  await signDialog(approver, "approver.test1", "Rejected after review");
  await waitFor(approver, "Restore rejected");
  const rejected = (await api("GET", `/backup-restore/restores/${second}`, adminTok)).data;
  // detail screen of the rejected request shows the four steps
  await approver.goto(`${BASE}/backup-restore/restores/${second}`, { waitUntil: "networkidle2" });
  check("the detail screen shows the steps", (await waitFor(approver, "Pending Approval")) && (await bodyHas(approver, "Rejected")));
  check("the server records REJECTED with the reason", rejected.status === "REJECTED" && rejected.decisionReason === "Change control not approved yet", rejected.status);

  // E. clean up: a third request is asked for and decided by the assigned approver (there is no cancellation), so no request is left open
  await admin.goto(`${BASE}/backup-restore/restores/new?backup=${backupId}`, { waitUntil: "networkidle2" });
  await askThroughForm(admin, backupId, "Browser flow: clean-up request");
  await waitFor(admin, "waits for a second person");
  const third = ((await api("GET", "/backup-restore/restores?status=PENDING_APPROVAL&limit=100", adminTok)).data.data || [])[0]?.requestId;
  const closed = await api("POST", `/backup-restore/restores/${third}/reject`, approverTok, { reason: "Clean-up of the DEV test", signatureToken: await esig("approver.test1", approverTok) });
  check("the assigned approver decides the clean-up request", closed.status === 200 && closed.data.status === "REJECTED", String(closed.status));

  await browser.close();
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
