import json, sys, urllib.request, subprocess
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]; PW = open(S + "/pw.txt").read(); API = "http://localhost:5100/api"; B = "http://localhost:3113"
res = []
def check(n, ok, d=""): res.append(ok); print(("PASS " if ok else "FAIL ") + n + (" -- " + str(d)[:240] if d else ""))
sql = lambda q: subprocess.check_output(["docker","exec","eqms-postgres","psql","-U","eqms","-d","eqms_compare_clone","-Atc",q]).decode().strip()
def call(path, token):
    r = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + token})
    return json.loads(urllib.request.urlopen(r, timeout=60).read())
tok = json.loads(urllib.request.urlopen(urllib.request.Request(API + "/auth/login", json.dumps({"username": "admin", "password": PW}).encode(), {"Content-Type": "application/json"})).read())["accessToken"]
for name in ("dco.test1", "author.test1", "reviewer.test"):
    uid = sql(f"select id from app_users where username='{name}'")
    exp = int(sql(f"select count(*) from audit_logs where acted_by_user_id='{uid}' or (acted_by_user_id is null and lower(username)='{name}')"))
    r = call(f"/audit-trail?user={uid}&limit=10&page=1&dateFrom=2000-01-01T00:00:00&dateTo=2100-01-01T00:00:00", tok)
    check(f"{name}: total equals the database", r["pagination"]["total"] == exp, (r["pagination"]["total"], exp))
    who = {x["user"]["id"] for x in r["data"] if x.get("user")}
    check(f"{name}: every record of this account only", who <= {uid}, who)
sub = call("/audit-trail?user=reviewer.test&limit=1&dateFrom=2000-01-01T00:00:00&dateTo=2100-01-01T00:00:00", tok)["pagination"]["total"]
uid = sql("select id from app_users where username='reviewer.test'")
check("old text filter still matches more (substring)", sub > call(f"/audit-trail?user={uid}&limit=1&dateFrom=2000-01-01T00:00:00&dateTo=2100-01-01T00:00:00", tok)["pagination"]["total"], sub)
with sync_playwright() as pw:
    br = pw.chromium.launch(channel="msedge", headless=True); p = br.new_page(viewport={"width": 1700, "height": 1000})
    errs = []; p.on("pageerror", lambda e: errs.append(str(e)))
    p.goto(B + "/login", wait_until="domcontentloaded"); p.wait_for_timeout(25000)
    p.locator("input").nth(0).press_sequentially("admin", delay=30); p.locator("input[type=password]").press_sequentially(PW, delay=20); p.keyboard.press("Enter"); p.wait_for_timeout(15000)
    uid = sql("select id from app_users where username='author.test1'")
    p.evaluate("u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')) }", f"/settings/users/profile/{uid}"); p.wait_for_timeout(9000)
    c = p.get_by_role("button", name="Continue Working")
    if c.count(): c.first.click(); p.wait_for_timeout(1000)
    print(p.url)
    tab = p.get_by_role("tab", name="Audit Trail")
    check("Audit Trail tab is offered", tab.count() == 1)
    if tab.count():
        tab.click(); p.wait_for_timeout(6000)
        p.screenshot(path=S + "/profile_audit.png")
        rows = p.locator("tbody tr").count()
        names = set(p.locator("tbody tr td:nth-child(3)").all_inner_texts())
        check("rows shown, all of this user", rows > 0 and names <= {"Author Test 1"}, (rows, names))
        check("no User filter offered", p.get_by_label("User", exact=True).count() == 0)
        check("address of the profile is unchanged", "?" not in p.url or "user=" not in p.url, p.url)
    check("no page error", not errs, errs[:2])
    br.close()
print(f"\n{sum(res)}/{len(res)} passed")
